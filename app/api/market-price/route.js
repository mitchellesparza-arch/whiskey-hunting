import { NextResponse }   from 'next/server'
import { getMarketPrice } from '../../../lib/market-prices.js'
import { getCatalogEntry } from '../../../lib/catalog.js'

/**
 * GET /api/market-price?name=Blanton%27s+Original
 * Returns secondary market price range + bottle metadata.
 * Falls back to catalog metadata (MSRP only) if no secondary data is cached.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ price: null })

  // Primary: Redis live cache → static JSON secondary pricing
  const price = await getMarketPrice(name)
  if (price) return NextResponse.json({ price })

  // Fallback: catalog metadata with MSRP only (no secondary data yet)
  const entry = getCatalogEntry(name)
  if (!entry) return NextResponse.json({ price: null })

  return NextResponse.json({
    price: {
      msrp:        entry.msrp,
      rarity:      entry.rarity,
      distillery:  entry.distillery,
      proof:       entry.proof,
      age:         entry.age,
      type:        entry.category,
      origin:      entry.origin,
      region:      entry.region,
      sizes:       entry.sizes,
      source:      'Catalog — no secondary data yet',
      lastUpdated: entry.lastUpdated ?? '2025-05',
      // secondary fields absent — UI will hide the secondary price block
    },
  })
}
