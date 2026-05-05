import { NextResponse } from 'next/server'
import { Redis }        from '@upstash/redis'

function normName(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/['''''']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * GET /api/price-history?name=<bottleName>
 * Returns secondary market price history for a bottle.
 * Data is stored as a Redis hash: field=YYYY-MM, value=JSON{avg,low,high}.
 * Written by the weekly market-price refresh route.
 * Returns array sorted oldest→newest for sparkline rendering.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ history: [] })

  try {
    const redis = Redis.fromEnv()
    const raw   = await redis.hgetall(`wh:price-history:${normName(name)}`)
    if (!raw) return NextResponse.json({ history: [] })

    const history = Object.entries(raw)
      .map(([date, val]) => {
        try {
          const p = typeof val === 'string' ? JSON.parse(val) : val
          return { date, avg: p.avg, low: p.low, high: p.high }
        } catch { return null }
      })
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ history })
  } catch {
    return NextResponse.json({ history: [] })
  }
}
