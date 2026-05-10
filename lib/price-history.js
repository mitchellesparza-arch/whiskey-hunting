/**
 * Price history — shared Redis writer.
 *
 * Redis schema: wh:price-history:{normKey}
 *   Hash where each field is "YYYY-MM" and the value is JSON:
 *   { avg, low, high, count, source }
 *
 * Multiple data points in the same month are merged into a running
 * avg/low/high so the chart always shows one value per month.
 */

import { Redis } from '@upstash/redis'

function normKey(name) {
  return (name ?? '')
    .toLowerCase()
    .replace(/['''''']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function redis() {
  return Redis.fromEnv()
}

/**
 * Record a single confirmed price data point for a bottle.
 * Merges into the existing YYYY-MM bucket (running avg / min / max).
 *
 * @param {string} bottleName  - canonical bottle name (will be normalized)
 * @param {number} price       - confirmed sale price in USD
 * @param {string} source      - 'marketplace' | 'auction' | 'community'
 * @param {Date}   [date]      - defaults to now
 */
export async function recordPricePoint(bottleName, price, source = 'marketplace', date = new Date()) {
  if (!bottleName || !price || price <= 0) return
  const key   = `wh:price-history:${normKey(bottleName)}`
  const month = date.toISOString().slice(0, 7) // YYYY-MM
  try {
    const r   = redis()
    const raw = await r.hget(key, month)
    const existing = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null

    let merged
    if (!existing) {
      merged = { avg: Math.round(price), low: Math.round(price), high: Math.round(price), count: 1, source }
    } else {
      const count = (existing.count ?? 1) + 1
      merged = {
        avg:    Math.round((existing.avg * (count - 1) + price) / count),
        low:    Math.min(existing.low,  Math.round(price)),
        high:   Math.max(existing.high, Math.round(price)),
        count,
        source: existing.source === source ? source : 'mixed',
      }
    }
    await r.hset(key, { [month]: JSON.stringify(merged) })
  } catch (err) {
    console.warn('[price-history] recordPricePoint error:', err?.message)
  }
}

/**
 * Bulk-write multiple completed-sale price points.
 * Used by the UA ingest endpoint.
 *
 * @param {Array<{name: string, price: number, source: string, date: string}>} points
 */
export async function bulkRecordPricePoints(points) {
  if (!points?.length) return
  // Process sequentially to avoid rate-limiting Upstash free tier
  for (const p of points) {
    await recordPricePoint(
      p.name,
      p.price,
      p.source ?? 'auction',
      p.date ? new Date(p.date) : new Date(),
    )
  }
}
