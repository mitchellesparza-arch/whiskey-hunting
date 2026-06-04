/**
 * GET /api/independents
 *
 * Serves the independents cache written by the home machine scraper.
 * No live fallback — if the cache is empty, return an empty state and
 * let the UI surface it gracefully.
 *
 * Cache is populated by: scripts/scrape-independents.mjs (home machine, hourly)
 * Cache is stored in: Redis key 'independents:cache', 2-hour TTL
 */

import { NextResponse } from 'next/server'
import { Redis }        from '@upstash/redis'

export const CACHE_KEY = 'independents:cache'

export async function GET() {
  try {
    const redis = Redis.fromEnv()
    const raw   = await redis.get(CACHE_KEY)

    if (raw) {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      return NextResponse.json({ ...data, fromCache: true })
    }
  } catch (err) {
    console.error('[independents] Redis error:', err.message)
  }

  // Cache miss — return empty state (UI handles this gracefully)
  return NextResponse.json({
    retailers:  [],
    allFinds:   [],
    checkedAt:  null,
    fromCache:  false,
  })
}
