import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'
import Anthropic        from '@anthropic-ai/sdk'
import { Redis }        from '@upstash/redis'

/**
 * GET /api/search-fallback?q=<query>
 *
 * Backstop search source for queries our local DB + Algolia don't cover —
 * new releases, niche craft bourbons, allocated-line extensions like
 * "Eagle Rare 12 Year" that haven't propagated to Binny's catalog yet.
 *
 * Hits Claude Haiku with the query, asks for structured suggestions,
 * caches the result in Redis (`wh:ai-suggestions:{normQuery}`) for 30 days.
 *
 * Frontend should only invoke this when local results are weak (zero or
 * clearly miss the user's intent) so we don't burn API calls on hits we
 * already have.
 *
 * Response shape:
 *   { suggestions: [{ name, distillery, category, proof, age, msrp, releaseYear, note }] }
 *
 * Each suggestion is tagged AI-sourced on the client; users explicitly
 * confirm before any record is persisted.
 */

const TTL_SEC = 30 * 24 * 60 * 60   // 30 days

let _redis = null
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv()
  return _redis
}

function normQuery(q) {
  return (q ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function GET(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  if (q.length < 3) return NextResponse.json({ suggestions: [] })

  const cacheKey = `wh:ai-suggestions:${normQuery(q)}`

  // Cache hit — return immediately
  try {
    const cached = await getRedis().get(cacheKey)
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached
      return NextResponse.json({ suggestions: data.suggestions ?? [], cached: true })
    }
  } catch { /* Redis unavailable — fall through to live lookup */ }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are a whiskey database expert. A user is searching for a bottle in a bourbon-tracking app. Their query: "${q}"

Identify up to 5 real bottles that best match this query. Focus on US bourbon, rye, and American whiskey, but include other categories if the query suggests them.

Return ONLY a valid JSON array — no markdown, no explanation. Each entry:
{
  "name":        full canonical bottle name (string),
  "distillery":  producer (string or null),
  "category":    one of "Bourbon" | "Rye" | "Scotch" | "Irish" | "Japanese" | "Canadian" | "American" | "Other",
  "proof":       proof as a number (e.g. 90) or null,
  "age":         age in years as a number or null if NAS,
  "msrp":        typical US retail price in dollars as a number or null,
  "releaseYear": year of first release as a number or null,
  "note":        one short sentence describing the bottle (string, under 120 chars)
}

If you cannot identify any plausible matches, return an empty array [].
Do NOT invent bottles you are not confident exist. Better to return fewer high-confidence matches than to fill the array with guesses.`,
      }],
    })

    const raw      = response.content[0]?.text?.trim() ?? ''
    const jsonStr  = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    let parsed
    try { parsed = JSON.parse(jsonStr) } catch {
      console.warn('[search-fallback] Claude returned non-JSON for query:', q)
      return NextResponse.json({ suggestions: [] })
    }

    const suggestions = Array.isArray(parsed)
      ? parsed.filter(s => s && typeof s.name === 'string' && s.name.trim().length > 0).slice(0, 5)
      : []

    // Cache positive AND negative results — empty arrays save us repeat API calls on garbage queries
    try {
      await getRedis().set(cacheKey, JSON.stringify({ suggestions, ts: Date.now() }), { ex: TTL_SEC })
    } catch { /* swallow cache write failures */ }

    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error('[search-fallback] error:', err)
    return NextResponse.json({ error: 'AI lookup failed', detail: err.message }, { status: 500 })
  }
}
