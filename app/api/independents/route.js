import { NextResponse }               from 'next/server'
import { checkAllRetailers, RETAILERS } from '../../../lib/retailers.js'

/**
 * GET /api/independents
 *
 * Response:
 * {
 *   retailers: [
 *     {
 *       name, location, url, lat, lng,
 *       bottles: [...],
 *       inStockCount: number,
 *       catalogSize: number|null,   // how many products were on their whiskey page
 *       accessible: boolean,        // did we successfully read their catalog?
 *       source: 'shopify'|'cityhive'|'custom'
 *     }
 *   ],
 *   allFinds: [...],   // in-stock only
 *   checkedAt: ISO string
 * }
 */
export async function GET() {
  const checkedAt = new Date().toISOString()

  const { finds, diagnostics } = await checkAllRetailers()

  // Group finds by retailer
  const byRetailer = {}
  for (const r of finds) {
    if (!byRetailer[r.retailer]) byRetailer[r.retailer] = []
    byRetailer[r.retailer].push(r)
  }

  // Merge static retailer metadata + live finds + diagnostics
  const retailers = RETAILERS.filter(r => r.lat).map(meta => {
    const bottles = byRetailer[meta.name] ?? []
    const diag    = diagnostics[meta.name] ?? {}
    return {
      ...meta,
      bottles,
      inStockCount: bottles.filter(b => b.inStock).length,
      catalogSize:  diag.catalogSize  ?? null,
      accessible:   diag.accessible   ?? true,
      source:       diag.source       ?? 'unknown',
    }
  })

  const allFinds = finds.filter(r => r.inStock)

  return NextResponse.json({ retailers, allFinds, checkedAt })
}
