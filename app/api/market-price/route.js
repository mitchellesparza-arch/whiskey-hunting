import { NextResponse }    from 'next/server'
import { getMarketPrice }  from '../../../lib/market-prices.js'

/**
 * GET /api/market-price?name=Blanton%27s+Original
 * Returns secondary market price range for the given bottle name, or null.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ price: null })

  const price = await getMarketPrice(name)
  return NextResponse.json({ price })
}
