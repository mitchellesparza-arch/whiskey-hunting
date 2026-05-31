import { NextResponse }               from 'next/server'
import { Redis }                       from '@upstash/redis'
import { checkAllRetailers, RETAILERS } from '../../../lib/retailers.js'
import { CACHE_KEY }                   from '../cron/independents/route.js'

export const maxDuration = 60

function getRedis() {
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

/**
 * GET /api/independents
 *
 * Serves from Redis cache when available (populated hourly by /api/cron/independents).
 * Falls back to a live scan if the cache is empty.
 *
 * Response:
 * {
 *   retailers: [...],
 *   allFinds: [...],   // in-stock only
 *   checkedAt: ISO string,
 *   fromCache: boolean
 * }
 */
export async function GET() {
  // ── Try cache first ─────────────────────────────────────────────────────────
  try {
    const raw = await getRedis().get(CACHE_KEY)
    if (raw) {
      const cached = typeof raw === 'string' ? JSON.parse(raw) : raw
      return NextResponse.json({ ...cached, fromCache: true })
    }
  } catch {
    // Redis unavailable — fall through to live scan
  }

  // ── Cache miss: live scan ────────────────────────────────────────────────────
  const checkedAt = new Date().toISOString()
  const { finds, diagnostics } = await checkAllRetailers()

  const byRetailer = {}
  for (const r of finds) {
    if (!byRetailer[r.retailer]) byRetailer[r.retailer] = []
    byRetailer[r.retailer].push(r)
  }

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

  return NextResponse.json({ retailers, allFinds, checkedAt, fromCache: false })
}
