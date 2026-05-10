import { NextResponse }    from 'next/server'
import { searchCatalog }  from '../../../../lib/catalog.js'

/**
 * GET /api/catalog/search?q=<query>&limit=<n>
 * Search the full bottle catalog (400+ entries) by name.
 * Returns MSRP, metadata, and secondary pricing where available.
 * Source is independent of Binny's Algolia — works for any known bottle.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const q     = searchParams.get('q')?.trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 25)

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const results = searchCatalog(q, limit)
  return NextResponse.json({ results, total: results.length })
}
