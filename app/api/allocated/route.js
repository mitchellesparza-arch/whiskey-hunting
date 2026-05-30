import { NextResponse }     from 'next/server'
import { hotlineBottles }   from '../../../lib/bottles.js'
import { checkAllRetailers } from '../../../lib/retailers.js'

/**
 * GET /api/allocated
 *
 * Returns the full allocated bottle master list, with each bottle enriched
 * with live retailer status (from checkAllRetailers) so the UI can show
 * which bottles are currently findable at Chicagoland retailers.
 *
 * Response shape:
 * {
 *   bottles: [
 *     {
 *       name:        string,
 *       tier:        string,   // "🦄 Unicorn Tier" | "🔴 Tier 1 — Highly Allocated" | etc.
 *       distributor: string|null,
 *       url:         string,
 *       retailerHits: [{ retailer, location, price, url }]  // currently in stock
 *     }
 *   ],
 *   checkedAt: ISO string
 * }
 */
export async function GET() {
  const checkedAt = new Date().toISOString()

  // ── Build tiered bottle list ──────────────────────────────────────────────
  let currentTier = ''
  const bottles = []

  for (const entry of hotlineBottles) {
    if (entry.divider) {
      currentTier = entry.divider
      continue
    }
    bottles.push({
      name:         entry.name,
      tier:         currentTier,
      distributor:  entry.distributor ?? null,
      url:          entry.url ?? null,
      retailerHits: [],
    })
  }

  // ── Merge live retailer status ────────────────────────────────────────────
  // Run concurrently with a timeout so a slow retailer doesn't stall the page
  try {
    const retailerResults = await Promise.race([
      checkAllRetailers(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
    ])

    const inStockResults = retailerResults.filter(r => r.inStock)

    for (const bottle of bottles) {
      // Match retailer finds to this bottle by fuzzy name match
      bottle.retailerHits = inStockResults
        .filter(r => {
          const rn = r.bottle.toLowerCase()
          const bn = bottle.name.toLowerCase()
          // Direct substring match either way, or first two significant words
          return rn.includes(bn.slice(0, 12)) || bn.includes(rn.slice(0, 12))
        })
        .map(r => ({
          retailer: r.retailer,
          location: r.location,
          price:    r.price,
          url:      r.url,
        }))
    }
  } catch {
    // Retailer check timed out or failed — return bottles without live status
  }

  return NextResponse.json({ bottles, checkedAt })
}
