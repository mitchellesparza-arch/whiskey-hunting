import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'
import { Redis }        from '@upstash/redis'
import { upsertBottle } from '../../../../lib/bottle-db.js'

/**
 * POST /api/bottles/save
 *
 * Persists an AI-suggested (or otherwise dynamic) bottle into the global
 * Redis-backed bottle index so future searches hit it without re-invoking
 * the AI fallback.  Triggered when a user explicitly picks an AI suggestion
 * from the search page — confirms the suggestion was useful.
 *
 * Idempotent: re-saving the same bottle just refreshes its metadata.
 *
 * Body: {
 *   name:        string (required),
 *   distillery?: string,
 *   category?:   string,
 *   proof?:      number,
 *   age?:        number,
 *   msrp?:       number,
 *   releaseYear?: number,
 *   note?:       string,
 *   source?:     string ('ai' | 'manual' — defaults to 'ai')
 * }
 *
 * Storage:
 *   wh:bottles:{normName}      → JSON record (full metadata)
 *   wh:bottle-index            → hash { [normName]: displayName } — used by /api/lookup search
 */

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

  let body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = (body?.name ?? '').toString().trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const norm = normName(name)
  if (!norm) return NextResponse.json({ error: 'invalid name' }, { status: 400 })

  const record = {
    name,
    distillery:  body.distillery  ?? null,
    category:    body.category    ?? null,
    proof:       body.proof       ?? null,
    age:         body.age         ?? null,
    msrp:        body.msrp        ?? null,
    releaseYear: body.releaseYear ?? null,
    note:        body.note        ?? null,
    source:      body.source      ?? 'ai',
    addedBy:     token.email,
    addedAt:     new Date().toISOString(),
  }

  // Confidence source: a reviewed/edited save ('user') is authoritative; a raw
  // AI suggestion pick ('ai') is lower confidence so curated data still wins.
  const source = body.source === 'user' ? 'user' : 'ai'

  try {
    const redis = getRedis()
    await Promise.all([
      redis.set(`wh:bottles:${norm}`, JSON.stringify(record)),
      redis.hset('wh:bottle-index', { [norm]: name }),
    ])

    // Also write the canonical record the bottle detail page actually reads
    // (/api/bottle/lookup). Without this the saved metadata only powered search
    // autocomplete and never appeared on the bottle page.
    try {
      const sec = body.secondary
      await upsertBottle({
        name,
        distillery:  record.distillery,
        category:    record.category,
        proof:       record.proof,
        age:         record.age != null ? `${record.age} Year` : null,
        msrp:        record.msrp,
        region:      body.region ?? null,
        origin:      body.origin ?? null,
        rarity:      body.rarity ?? null,
        releaseYear: record.releaseYear,
        market: (sec && (sec.low != null || sec.avg != null || sec.high != null))
          ? { low: sec.low ?? null, avg: sec.avg ?? null, high: sec.high ?? null,
              msrp: record.msrp, source: 'Member-provided', lastUpdated: new Date().toISOString().slice(0, 7) }
          : null,
      }, source)
    } catch (e) {
      console.error('[bottles/save] canonical upsert failed:', e)
      // Non-fatal — the legacy index write above already succeeded.
    }

    return NextResponse.json({ ok: true, name })
  } catch (err) {
    console.error('[bottles/save] error:', err)
    return NextResponse.json({ error: 'Save failed', detail: err.message }, { status: 500 })
  }
}
