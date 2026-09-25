import { NextResponse }    from 'next/server'
import { searchCatalog }  from '../../../../lib/catalog.js'
import { getUAIndex, getUAEntries, normName as norm } from '../../../../lib/ua-catalog.js'

// Response depends only on the query string — let the CDN absorb repeat lookups.
const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' }

function scoreWords(queryNorm, candidateNorm) {
  const qw = queryNorm.split(/\s+/).filter(w => w.length >= 3)
  const cw = candidateNorm.split(/\s+/).filter(w => w.length >= 3)
  if (!qw.length || !cw.length) return 0
  // Query-coverage scoring: fraction of query words found in candidate.
  // Avoids penalizing short queries against long bottle names (e.g. "Michter's 20"
  // matching "Michter's 20 Year Limited Release Bourbon 2025").
  const hits = qw.filter(w => cw.some(c => c.includes(w) || w.includes(c))).length
  return hits / qw.length
}

async function searchUACatalog(q, staticResults, limit) {
  try {
    // Normalized names already returned by the static catalog — skip duplicates
    const staticNorms = new Set(staticResults.map(r => norm(r.name ?? '')))

    const qn   = norm(q)
    const hits = (await getUAIndex())
      .map(e => ({ normKey: e.normKey, nameNorm: e.nameNorm, _score: scoreWords(qn, e.nameNorm) }))
      .filter(e => e._score >= 0.4 && !staticNorms.has(e.nameNorm))
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)

    return (await getUAEntries(hits.map(h => h.normKey)))
      .map(({ normKey, ...rest }) => ({
        ...rest,
        source:   'unicorn_auctions',
        msrp:     null,
        secondary: null,
      }))
  } catch {
    return []
  }
}

/**
 * GET /api/catalog/search?q=<query>&limit=<n>
 * Search the full bottle catalog (400+ entries) by name, supplemented by
 * bottles seen on Unicorn Auctions that aren't in the static catalog.
 * Static catalog results (with MSRP + metadata) always rank first.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const q     = searchParams.get('q')?.trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 25)

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] }, { headers: CACHE_HEADERS })
  }

  const staticResults = searchCatalog(q, limit)
  const remaining     = limit - staticResults.length
  const uaResults     = remaining > 0 ? await searchUACatalog(q, staticResults, remaining) : []

  // Fill remaining slots with UA results not already covered by the static catalog
  const merged = [...staticResults, ...uaResults]

  return NextResponse.json({ results: merged, total: merged.length }, { headers: CACHE_HEADERS })
}
