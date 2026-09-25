import { NextResponse } from 'next/server'
import { Redis }        from '@upstash/redis'
import { CATALOG_KEY, getUAIndex, getUAEntries, normName as norm } from '../../../lib/ua-catalog.js'

// Response depends only on the query string — let the CDN absorb repeat lookups.
const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' }

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
  const lookup   = searchParams.get('lookup')?.trim() ?? ''
  const q        = searchParams.get('q')?.trim() ?? ''
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const category = searchParams.get('category') ?? ''

  try {
    const redis = Redis.fromEnv()

    // Direct single-bottle lookup by normalized name — used by bottle detail page
    // for image resolution. HGET is O(1) vs HGETALL on a large catalog.
    if (lookup) {
      const val = await redis.hget(CATALOG_KEY, norm(lookup))
      if (!val) return NextResponse.json({ result: null }, { headers: CACHE_HEADERS })
      const meta = typeof val === 'string' ? JSON.parse(val) : val
      return NextResponse.json({ result: meta }, { headers: CACHE_HEADERS })
    }

    let entries = await getUAIndex()

    if (category) {
      entries = entries.filter(e => e.category === category)
    }

    if (q && q.length >= 2) {
      const qn = norm(q)
      entries = entries
        .map(e    => ({ ...e, _score: scoreMatch(qn, e.nameNorm) }))
        .filter(e => e._score >= 0.3)
        .sort((a, b) => b._score - a._score)
    } else {
      entries = [...entries].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
    }

    const results = await getUAEntries(entries.slice(0, limit).map(e => e.normKey))

    return NextResponse.json({ results, total: entries.length }, { headers: CACHE_HEADERS })
  } catch (err) {
    console.warn('[ua-catalog] Redis error:', err?.message)
    return NextResponse.json({ results: [], total: 0 })
  }
}
