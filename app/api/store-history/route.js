import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'
import { Redis }        from '@upstash/redis'

/**
 * GET /api/store-history?placeId=<googlePlaceId>
 * Returns the permanent find history for a store (survives the 7-day finds TTL).
 * Array is ordered newest-first, capped at 150 entries.
 */
export async function GET(request) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const placeId = searchParams.get('placeId')?.trim()
  if (!placeId) return NextResponse.json({ history: [] })

  try {
    const redis = Redis.fromEnv()
    const raw   = await redis.get(`wh:store-history:${placeId}`)
    const history = raw
      ? (Array.isArray(raw) ? raw : JSON.parse(raw))
      : []
    return NextResponse.json({ history })
  } catch {
    return NextResponse.json({ history: [] })
  }
}
