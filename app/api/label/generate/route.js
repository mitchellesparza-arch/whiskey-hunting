import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'
import OpenAI           from 'openai'
import { Redis }        from '@upstash/redis'
import { isPro }           from '../../../../lib/tier.js'
import { getUserProfile }  from '../../../../lib/friends.js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function getRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Redis env vars not set')
  return new Redis({ url, token })
}

function styleKey(name) {
  return `label:style:${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
}

/**
 * POST /api/label/generate
 * Body: { name, proof, distillery, giver }
 * Returns: { imageData } — base64 PNG data URL
 *
 * Step 1: Look up the real bottle label's visual style via web search
 *         (gpt-4o-mini-search-preview). Result is cached in Redis for 7 days
 *         so repeat generations for the same bottle skip the search entirely.
 * Step 2: Generate the sample label with gpt-image-1 at medium quality.
 *
 * Cost comparison (per label):
 *   Before: gpt-4o-search (~$0.04) + gpt-image-1 high (~$0.167) ≈ $0.21
 *   After:  mini-search   (~$0.004, cached $0) + medium (~$0.042) ≈ $0.046
 */
export async function POST(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use live tier from Redis — token.tier can be stale if tier changed after sign-in
  const profile = await getUserProfile(token.email.toLowerCase()).catch(() => null)
  if (!isPro(profile?.tier ?? token.tier)) return NextResponse.json({ error: 'Pro required' }, { status: 403 })

  const { name, proof, giver } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Bottle name required' }, { status: 400 })

  // ── Step 1: Style lookup — cache-first ───────────────────────────────────
  let styleDesc  = null
  let fromCache  = false
  const redis    = getRedis()
  const cacheKey = styleKey(name)

  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      styleDesc = cached
      fromCache = true
    }
  } catch { /* Redis failure is non-fatal */ }

  if (!styleDesc) {
    try {
      const searchResp = await openai.chat.completions.create({
        model: 'gpt-4o-mini-search-preview',     // ~10× cheaper than gpt-4o-search-preview
        web_search_options: { search_context_size: 'low' },
        messages: [{
          role:    'user',
          content: [
            `Search the web for the "${name}" whiskey bottle label.`,
            `Describe its visual design in 3-4 sentences covering:`,
            `- Exact color palette (background color, primary text color, accent colors)`,
            `- Typography (is the brand name in flowing cursive/script? bold condensed caps? elegant serif?)`,
            `- Decorative elements (seals, crests, illustrations, ornate borders, banners, rules)`,
            `- Overall aesthetic and label shape`,
            `Be precise enough that an AI image generator can faithfully recreate the style.`,
            `Output only the style description — no preamble or commentary.`,
          ].join(' '),
        }],
      })

      styleDesc = searchResp.choices[0]?.message?.content?.trim() ?? null

      // Cache for 7 days — bottle labels don't change
      if (styleDesc) {
        redis.set(cacheKey, styleDesc, { ex: 60 * 60 * 24 * 7 }).catch(() => {})
      }
    } catch (err) {
      console.warn('[label/generate] style search failed:', err?.message)
    }
  }

  // ── Step 2: Generate with gpt-image-1 at medium quality ─────────────────
  const prompt = [
    `Create a whiskey bottle SAMPLE label — a small label someone attaches to a sample pour they're sharing with a friend.`,
    ``,
    `Color: pure black and white only. White background with black ink — like a printed paper label. No dark backgrounds, no inverted colors, no gray shading, no gradients. The label background must be white.`,
    ``,
    styleDesc
      ? `Visual style — replicate the real bottle's layout, typography, and decorative elements in black and white: ${styleDesc}`
      : `Visual style: classic American craft whiskey label, elegant typographic design, black and white.`,
    ``,
    `The label must contain exactly this text, rendered accurately:`,
    `- Bottle name: "${name}"`,
    proof ? `- Proof: ${proof}°` : '',
    `- The phrase "SAMPLE FROM" with "${giver || 'Unknown'}" below it in an elegant script`,
    ``,
    `Layout: brand name prominent at top, spirit type / expression in a bold banner or block in the middle, proof and "SAMPLE FROM / ${giver || 'Unknown'}" in the footer. Thin decorative border framing the whole label. Square format.`,
    ``,
    `Render all text legibly and accurately. Do not invent text not listed above.`,
  ].filter(Boolean).join('\n')

  try {
    const response = await openai.images.generate({
      model:   'gpt-image-1',
      prompt,
      n:       1,
      size:    '1024x1024',
      quality: 'medium',            // $0.042 vs $0.167 for high — ~75% savings
    })

    const b64 = response.data[0].b64_json
    return NextResponse.json({ imageData: `data:image/png;base64,${b64}`, fromCache })
  } catch (err) {
    console.error('[label/generate]', err)
    const msg = err?.error?.message ?? err?.message ?? 'Generation failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
