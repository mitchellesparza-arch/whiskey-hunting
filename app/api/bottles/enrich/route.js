import { NextResponse }     from 'next/server'
import { getToken }         from 'next-auth/jwt'
import Anthropic            from '@anthropic-ai/sdk'
import { Redis }            from '@upstash/redis'
import { isPro }            from '../../../../lib/tier.js'
import { getUserProfile }   from '../../../../lib/friends.js'

/**
 * POST /api/bottles/enrich   { name: string, existing?: object }
 *
 * Pro-only. Returns a structured DRAFT of a bottle's details for the user to
 * review and edit before saving — it does NOT persist anything. The actual
 * write happens via /api/bottles/save once the user confirms, so AI guesses
 * never land in the catalog unreviewed.
 *
 * Response: { draft: { name, distillery, category, proof, age, msrp,
 *   releaseYear, region, origin, rarity, note, secondary: {low,avg,high} } }
 */

const TTL_SEC = 30 * 24 * 60 * 60   // 30 days

let _redis = null
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv()
  return _redis
}

function normName(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Live tier from Redis — token.tier can be stale if it changed after sign-in.
  const profile = await getUserProfile(token.email.toLowerCase()).catch(() => null)
  if (!isPro(profile?.tier ?? token.tier)) {
    return NextResponse.json({ error: 'Pro required', upgradeRequired: true }, { status: 403 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  let body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = (body?.name ?? '').toString().trim()
  if (name.length < 3) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const cacheKey = `wh:ai-enrich:v1:${normName(name)}`
  try {
    const cached = await getRedis().get(cacheKey)
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached
      return NextResponse.json({ draft: data.draft, cached: true })
    }
  } catch { /* Redis down — fall through to live lookup */ }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: `You are a whiskey database expert. Return the canonical reference details for this exact bottle: "${name}".

Match the user's SPECIFIC bottle — the named age/variant/release — not the standard expression of the brand. If it is a real product (including limited or recent releases), fill every field you are confident about and use null for anything you genuinely don't know. Do not invent values.

Return ONE JSON object, no markdown, no commentary:
{
  "name":        canonical bottle name (string),
  "distillery":  producing distillery (string or null),
  "category":    one of "Bourbon" | "Rye" | "Scotch" | "Irish" | "Japanese" | "Canadian" | "American" | "Tennessee Whiskey" | "Other",
  "proof":       proof as a number, e.g. 97 (or null if it varies/unknown),
  "age":         age in years as a number, or null if NAS/no age statement,
  "msrp":        original US retail price in dollars as a number (or null),
  "releaseYear": year first released as a number (or null),
  "region":      e.g. "Kentucky", "Tennessee", "Speyside" (string or null),
  "origin":      country, e.g. "USA", "Scotland", "Japan" (string or null),
  "rarity":      one of "Common" | "Worth Watching" | "Allocated" | "Unicorn" (best estimate),
  "note":        one short sentence describing the bottle (under 120 chars),
  "secondary":   typical secondary-market price range as { "low": number, "avg": number, "high": number } in USD, or null if it trades at retail
}`,
      }],
    })

    const raw     = response.content[0]?.text?.trim() ?? ''
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    let draft
    try { draft = JSON.parse(jsonStr) } catch {
      console.warn('[bottles/enrich] non-JSON from Claude for:', name)
      return NextResponse.json({ error: 'Could not generate a draft — try again' }, { status: 502 })
    }
    if (!draft || typeof draft.name !== 'string' || !draft.name.trim()) {
      return NextResponse.json({ error: 'No reliable match found for this bottle' }, { status: 404 })
    }

    try {
      await getRedis().set(cacheKey, JSON.stringify({ draft, ts: Date.now() }), { ex: TTL_SEC })
    } catch { /* swallow cache write failures */ }

    return NextResponse.json({ draft })
  } catch (err) {
    console.error('[bottles/enrich] error:', err)
    return NextResponse.json({ error: 'AI lookup failed', detail: err.message }, { status: 500 })
  }
}
