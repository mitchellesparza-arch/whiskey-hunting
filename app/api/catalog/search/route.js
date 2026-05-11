import { NextResponse }    from 'next/server'
import { searchCatalog }  from '../../../../lib/catalog.js'
import { Redis }          from '@upstash/redis'

const UA_CATALOG_KEY = 'wh:ua:catalog'

function norm(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/['''''']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

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

async function searchUACatalog(q, staticResults) {
  try {
    const redis = Redis.fromEnv()
    const raw   = await redis.hgetall(UA_CATALOG_KEY)
    if (!raw) return []

    // Normalized names already returned by the static catalog — skip duplicates
    const staticNorms = new Set(staticResults.map(r => norm(r.name ?? '')))

    const qn = norm(q)
    return Object.values(raw)
      .map(val => {
        const meta = typeof val === 'string' ? JSON.parse(val) : val
        return { ...meta, _score: scoreWords(qn, norm(meta.name ?? '')) }
      })
      .filter(e => e._score >= 0.4 && !staticNorms.has(norm(e.name ?? '')))
      .sort((a, b) => b._score - a._score)
      .map(({ _score, normKey, ...rest }) => ({
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
    return NextResponse.json({ results: [] })
  }

  const staticResults = searchCatalog(q, limit)
  const uaResults     = await searchUACatalog(q, staticResults)

  // Fill remaining slots with UA results not already covered by the static catalog
  const remaining = limit - staticResults.length
  const merged    = [
    ...staticResults,
    ...uaResults.slice(0, Math.max(remaining, 0)),
  ]

  return NextResponse.json({ results: merged, total: merged.length })
}
