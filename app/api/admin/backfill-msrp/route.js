import { NextResponse }                    from 'next/server'
import { Redis }                           from '@upstash/redis'
import Anthropic                           from '@anthropic-ai/sdk'
import { listBottleSlugs, bottleCount }    from '../../../../lib/bottle-db.js'
import { searchCatalog }                   from '../../../../lib/catalog.js'

/**
 * POST /api/admin/backfill-msrp
 * Authorization: Bearer CRON_SECRET
 *
 * Fills missing MSRP (and proof/category) for all canonical bottle records.
 *
 * Tiered lookup — AI only fires when catalog matching fails:
 *   1. Fuzzy match against static catalog (free, instant)
 *   2. Claude Haiku lookup (only for genuinely unknown bottles)
 *   3. Skip lot titles that look like private barrels / store picks
 *
 * Results cached permanently in the canonical record so the same bottle
 * is never looked up twice.
 */

// Lot titles matching these patterns don't have standard MSRPs
const SKIP_PATTERNS = [
  /'[^']{2,}'/,                        // 'Husk', 'Civic Center' (store pick)
  /private.*(barrel|selection)|store.*pick/i,
  /barrel\s*#?\s*\d/i,
  /\bcask\s+[a-z]?\d/i,
  /local\s+pickup\s+only/i,
  /decanter/i,
  /lot\s+#?\d/i,
]

function isSkippable(name) {
  return SKIP_PATTERNS.some(p => p.test(name))
}

function normName(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/['''''']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Ask Haiku for MSRP + metadata for a single bottle name.
// Returns null if it can't confidently identify the bottle.
async function aiLookup(client, name) {
  try {
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

Return only the JSON object. If you are not confident this is a real retail bottle with a known MSRP, return {"msrp":null,"proof":null,"category":null}.`,
      }],
    })
    const raw     = resp.content[0]?.text?.trim() ?? ''
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const parsed  = JSON.parse(jsonStr)
    return {
      msrp:     typeof parsed.msrp     === 'number' ? parsed.msrp     : null,
      proof:    typeof parsed.proof    === 'number' ? parsed.proof    : null,
      category: typeof parsed.category === 'string' ? parsed.category : null,
    }
  } catch {
    return null
  }
}

export async function POST(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  const auth  = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (token !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  const redis  = Redis.fromEnv()
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const total  = await bottleCount()

  let catalogHit = 0, aiHit = 0, aiNull = 0, skipped = 0, alreadyHad = 0
  const BATCH = 100

  for (let offset = 0; offset < total; offset += BATCH) {
    const slugs = await listBottleSlugs(offset, BATCH)
    if (!slugs.length) break

    // Fetch all records in one pipeline
    const p = redis.pipeline()
    for (const s of slugs) p.get(`wh:bottle:${s}`)
    const records = await p.exec()

    // Process concurrently within the batch
    await Promise.allSettled(
      records.map(async (raw, i) => {
        const bottle = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null
        if (!bottle) return

        // Already has MSRP — nothing to do
        if (bottle.msrp != null) { alreadyHad++; return }

        // Skip private barrel / store pick lot titles
        if (isSkippable(bottle.name)) { skipped++; return }

        let msrp = null, proof = null, category = null

        // Tier 1: fuzzy match against static catalog
        const catResults = searchCatalog(bottle.name, 1)
        if (catResults.length && catResults[0].msrp != null) {
          msrp     = catResults[0].msrp
          proof    = bottle.proof    ?? catResults[0].proof    ?? null
          category = bottle.category ?? catResults[0].category ?? null
          catalogHit++
        } else {
          // Tier 2: AI lookup
          const ai = await aiLookup(client, bottle.name)
          if (ai?.msrp != null) {
            msrp     = ai.msrp
            proof    = bottle.proof    ?? ai.proof    ?? null
            category = bottle.category ?? ai.category ?? null
            aiHit++
          } else {
            aiNull++
            return  // genuinely unknown — don't write anything
          }
        }

        // Write back into canonical record
        const updated = {
          ...bottle,
          msrp,
          proof:    proof    ?? bottle.proof,
          category: category ?? bottle.category,
          updatedAt: Date.now(),
        }
        await redis.set(`wh:bottle:${slugs[i]}`, JSON.stringify(updated))
      })
    )
  }

  return NextResponse.json({
    ok:         true,
    total,
    alreadyHad,
    catalogHit,
    aiHit,
    aiNull,
    skipped,
    filled:     catalogHit + aiHit,
  })
}
