import { NextResponse }      from 'next/server'
import { checkAllRetailers, RETAILERS } from '../../../lib/retailers.js'

/**
 * GET /api/independents
 *
 * Runs a live check of all independent Chicagoland retailers and returns
 * structured results with retailer metadata merged in.
 *
 * Response:
 * {
 *   retailers: [
 *     {
 *       name, location, url, lat, lng,
 *       bottles: [{ bottle, inStock, price, url }]
 *       inStockCount: number
 *     }
 *   ],
 *   allFinds: [{ bottle, retailer, location, price, url }],   // in-stock only
 *   checkedAt: ISO string
 * }
 */
export async function GET() {
  const checkedAt = new Date().toISOString()

  const results = await checkAllRetailers()

  // Group results by retailer
  const byRetailer = {}
  for (const r of results) {
    if (!byRetailer[r.retailer]) byRetailer[r.retailer] = []
    byRetailer[r.retailer].push(r)
  }

  // Merge with static retailer metadata (coordinates, url, location)
  const retailers = RETAILERS.map(meta => {
    const bottles = byRetailer[meta.name] ?? []
    return {
      ...meta,
      bottles,
      inStockCount: bottles.filter(b => b.inStock).length,
    }
  })

  const allFinds = results.filter(r => r.inStock)

  return NextResponse.json({ retailers, allFinds, checkedAt })
}
