import { NextResponse } from 'next/server'
import data from '../../../lib/market-prices-data.json'

/**
 * GET /api/market-index
 * Returns aggregate secondary market data from the full bottle catalog.
 * Static-only — no Redis, fast cold-start.
 *
 * Response shape:
 *   { total, categories, topPremiums, unicorns }
 */
export async function GET() {
  const withSecondary = data.filter(e => e.secondary?.avg > 0 && e.msrp > 0)

  // ── Category aggregates ───────────────────────────────────────────────────
  const catMap = {}
  for (const e of withSecondary) {
    const cat = e.type ?? 'Other'
    if (!catMap[cat]) catMap[cat] = { count: 0, sumSecondary: 0, sumMsrp: 0 }
    catMap[cat].count++
    catMap[cat].sumSecondary += e.secondary.avg
    catMap[cat].sumMsrp += e.msrp
  }

  const categories = Object.entries(catMap)
    .map(([name, c]) => ({
      name,
      count:        c.count,
      avgSecondary: Math.round(c.sumSecondary / c.count),
      avgMsrp:      Math.round(c.sumMsrp / c.count),
      premium:      Math.round((c.sumSecondary / c.sumMsrp - 1) * 100),
    }))
    .sort((a, b) => b.avgSecondary - a.avgSecondary)

  // ── Top premiums (secondary avg / msrp − 1) ───────────────────────────────
  const topPremiums = withSecondary
    .map(e => ({
      name:       e.name,
      msrp:       e.msrp,
      avg:        e.secondary.avg,
      low:        e.secondary.low,
      high:       e.secondary.high,
      premium:    Math.round((e.secondary.avg / e.msrp - 1) * 100),
      rarity:     e.rarity,
      distillery: e.distillery ?? null,
      type:       e.type ?? null,
    }))
    .sort((a, b) => b.premium - a.premium)
    .slice(0, 20)

  // ── Unicorn bottles sorted by avg secondary price ─────────────────────────
  const unicorns = withSecondary
    .filter(e => e.rarity === 'Unicorn')
    .map(e => ({
      name:       e.name,
      msrp:       e.msrp,
      avg:        e.secondary.avg,
      low:        e.secondary.low,
      high:       e.secondary.high,
      distillery: e.distillery ?? null,
      type:       e.type ?? null,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 20)

  return NextResponse.json({ total: withSecondary.length, categories, topPremiums, unicorns })
}
