import { NextResponse } from 'next/server'
import { Redis }        from '@upstash/redis'

const CATALOG_KEY = 'wh:ua:catalog'

function norm(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/['''''']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreMatch(queryNorm, candidateNorm) {
  const qw = queryNorm.split(/\s+/).filter(w => w.length >= 3)
  const cw = candidateNorm.split(/\s+/).filter(w => w.length >= 3)
  if (!qw.length || !cw.length) return 0
  const hits = qw.filter(w => cw.some(c => c.includes(w) || w.includes(c))).length
  return hits / qw.length
}

/**
 * GET /api/ua-catalog?q=<query>&limit=<n>&category=<cat>
 *
 * Returns bottle names accumulated from Unicorn Auctions scrapes.
 * Used as a supplementary source for finds autocomplete, collection search,
 * and any other surface that needs bottle name suggestions beyond the static catalog.
 *
 * When ?q= is provided, results are ranked by fuzzy name match.
 * Without ?q=, returns most-recently-seen entries first.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const q        = searchParams.get('q')?.trim() ?? ''
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const category = searchParams.get('category') ?? ''

  try {
    const redis = Redis.fromEnv()
    const raw   = await redis.hgetall(CATALOG_KEY)

    if (!raw) return NextResponse.json({ results: [], total: 0 })

    let entries = Object.entries(raw).map(([normKey, val]) => {
      const meta = typeof val === 'string' ? JSON.parse(val) : val
      return { normKey, ...meta }
    })

    if (category) {
      entries = entries.filter(e => e.category === category)
    }

    if (q && q.length >= 2) {
      const qn = norm(q)
      entries = entries
        .map(e    => ({ ...e, _score: scoreMatch(qn, norm(e.name)) }))
        .filter(e => e._score >= 0.3)
        .sort((a, b) => b._score - a._score)
      entries.forEach(e => delete e._score)
    } else {
      entries.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
    }

    return NextResponse.json({
      results: entries.slice(0, limit),
      total:   entries.length,
    })
  } catch (err) {
    console.warn('[ua-catalog] Redis error:', err?.message)
    return NextResponse.json({ results: [], total: 0 })
  }
}
