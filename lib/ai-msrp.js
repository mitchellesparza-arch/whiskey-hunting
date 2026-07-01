/**
 * On-demand AI-estimated MSRP — the last-resort tier when a bottle has no
 * catalog entry and no live Binny's/secondary-market price.
 *
 * Triggered lazily from /api/market-price when a user actually looks up a
 * bottle (search → detail page), NOT proactively for the whole catalog.
 * Result is cached (hit or miss) so the same bottle is never asked twice.
 *
 * Always tagged 'ai-estimated' — never treated as authoritative. Callers
 * must surface this as an estimate, not a confirmed price.
 */

import { Redis }    from '@upstash/redis'
import Anthropic    from '@anthropic-ai/sdk'
import { normName } from './bottle-match.js'

const CACHE_TTL = 90 * 24 * 60 * 60 // 90 days — re-asks periodically as AI knowledge/prices drift

function getRedis() {
  return Redis.fromEnv()
}

/**
 * Returns { msrp, proof, category } or null (never guessed / genuinely unknown).
 * Cached both ways so repeat lookups don't re-hit the AI.
 */
export async function getAiEstimatedMsrp(bottleName) {
  if (!bottleName?.trim() || !process.env.ANTHROPIC_API_KEY) return null

  const redis = getRedis()
  const key   = `wh:ai-msrp:v1:${normName(bottleName)}`

  try {
    const cached = await redis.get(key)
    if (cached != null) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
      return parsed?.msrp != null ? parsed : null
    }
  } catch {
    // Redis unavailable — fall through to a live (uncached) AI call
  }

  const result = await aiLookup(bottleName)

  try {
    await redis.set(key, JSON.stringify(result ?? { msrp: null }), { ex: CACHE_TTL })
  } catch {
    // Cache write failure shouldn't block returning the result
  }

  return result
}

async function aiLookup(name) {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const resp = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{
        role:    'user',
        content: `You are a whiskey pricing expert. Given this bottle name, return ONLY a JSON object with these fields (null if unknown):
- msrp: typical US retail price in dollars as a number
- proof: numeric proof value as a number
- category: one of "Bourbon"|"Rye"|"Scotch"|"Irish"|"Japanese"|"Canadian"|"American"|"Tennessee"|"Other"

Bottle: "${name}"

Return only the JSON object. Rules:
- Only return an msrp if you are certain of the standard US retail price for this EXACT bottle (age, edition, year). Do NOT guess or extrapolate from a related expression.
- If this is a new/recent release you're uncertain about, or a vintage/year variant you don't have confirmed pricing for, set msrp to null.
- When in doubt, return null for msrp — an empty field is better than a wrong price.`,
      }],
    })
    const raw     = resp.content[0]?.text?.trim() ?? ''
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const parsed  = JSON.parse(jsonStr)
    if (typeof parsed.msrp !== 'number') return null
    return {
      msrp:     parsed.msrp,
      proof:    typeof parsed.proof    === 'number' ? parsed.proof    : null,
      category: typeof parsed.category === 'string' ? parsed.category : null,
    }
  } catch {
    return null
  }
}
