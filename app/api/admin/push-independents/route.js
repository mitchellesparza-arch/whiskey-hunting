import { NextResponse } from 'next/server'
import { Redis }         from '@upstash/redis'

const CACHE_KEY = 'independents:cache'
const CACHE_TTL = 7200

export async function POST(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  const auth  = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (token !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await request.json()
  if (!payload?.retailers || !payload?.checkedAt) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const redis = Redis.fromEnv()
  await redis.set(CACHE_KEY, JSON.stringify(payload), { ex: CACHE_TTL })

  return NextResponse.json({
    ok:              true,
    checkedAt:       payload.checkedAt,
    storesScanned:   payload.retailers.length,
    inStockCount:    payload.allFinds.length,
    storesWithStock: new Set(payload.allFinds.map(f => f.retailer)).size,
  })
}
