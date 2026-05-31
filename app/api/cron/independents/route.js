import { NextResponse }                from 'next/server'
import { Redis }                       from '@upstash/redis'
import { checkAllRetailers, RETAILERS } from '../../../../lib/retailers.js'

export const maxDuration = 60

export const CACHE_KEY = 'independents:cache'
export const CACHE_TTL = 7200 // 2 hours — survive a missed run

function getRedis() {
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

/**
 * POST /api/cron/independents
 *
 * Runs the full independent-retailer scan and saves the result to Redis.
 * Call this from cron-jobs.org every hour.
 *
 * Protected by CRON_SECRET Bearer token.
 *
 * Manual trigger:
 *   curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" \
 *        https://whiskey-hunter.vercel.app/api/cron/independents
 */
export async function POST(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  const auth  = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (token !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const checkedAt = new Date().toISOString()

  const { finds, diagnostics } = await checkAllRetailers()

  // Build the same shape that /api/independents returns
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
  const snapshot = { retailers, allFinds, checkedAt }

  await getRedis().set(CACHE_KEY, JSON.stringify(snapshot), { ex: CACHE_TTL })

  return NextResponse.json({
    ok:           true,
    checkedAt,
    storesScanned: retailers.length,
    inStockCount:  allFinds.length,
    storesWithStock: new Set(allFinds.map(f => f.retailer)).size,
  })
}
