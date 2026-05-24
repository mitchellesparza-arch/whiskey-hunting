import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'
import OpenAI           from 'openai'
import { isPro }        from '../../../../lib/tier.js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * POST /api/label/generate
 * Body: { name, proof, distillery, giver }
 * Returns: { imageData } — base64 PNG data URL
 *
 * Step 1: gpt-4o-search-preview searches the web for the real bottle label
 *         and returns a detailed style description (colors, fonts, elements).
 * Step 2: gpt-image-1 generates a sample label using that style as reference.
 */
export async function POST(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isPro(token.tier))  return NextResponse.json({ error: 'Pro required' }, { status: 403 })

  const { name, proof, distillery, giver } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Bottle name required' }, { status: 400 })

  // ── Step 1: Web search for the real label's visual style ──────────────────
  let styleDesc = null

  try {
    const searchResp = await openai.chat.completions.create({
      model: 'gpt-4o-search-preview',
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
  } catch (err) {
    // Search is best-effort — fall back to generic prompt
    console.warn('[label/generate] web search failed:', err?.message)
  }

  // ── Step 2: Generate sample label with gpt-image-1 ────────────────────────
  const prompt = [
    `Create a whiskey bottle SAMPLE label — a small label someone attaches to a sample pour they're sharing with a friend.`,
    ``,
    `Color: pure black and white only. No color, no gradients, no gray shading. Stark high-contrast monochrome — white background, black ink — as if printed on a thermal label printer.`,
    ``,
    styleDesc
      ? `Visual style — replicate the real bottle's layout, typography, and decorative elements in black and white: ${styleDesc}`
      : `Visual style: classic American craft whiskey label, elegant typographic design, black and white.`,
    ``,
    `The label must contain exactly this text, rendered accurately:`,
    `- Bottle name: "${name}"`,
    proof      ? `- Proof: ${proof}°` : '',
    distillery ? `- Distillery: ${distillery}` : '',
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
      quality: 'high',
    })

    const b64 = response.data[0].b64_json
    return NextResponse.json({ imageData: `data:image/png;base64,${b64}` })
  } catch (err) {
    console.error('[label/generate]', err)
    const msg = err?.error?.message ?? err?.message ?? 'Generation failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
