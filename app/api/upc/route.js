import { NextResponse } from 'next/server'
import { Redis }        from '@upstash/redis'
import { UPC_MAP }      from '../../../lib/whiskey-db.js'

/**
 * GET /api/upc?code=<upc>
 * Lookup priority:
 *   0. Static UPC_MAP  — hand-curated allocated/rare bottles
 *   1. Redis cache     — populated by scripts/scrape-binnys-upcs.mjs
 *   2. UPC Item DB     — broad spirits coverage, returns images
 *   3. Open Food Facts — wide fallback
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = (searchParams.get('code') ?? '').trim().replace(/\D/g, '')
  if (!code) return NextResponse.json({ name: null, imageUrl: null })

  // 0. Static hand-curated map
  if (UPC_MAP[code]) {
    return NextResponse.json({ name: UPC_MAP[code].name, imageUrl: UPC_MAP[code].imageUrl ?? null })
  }

  // 1. Redis cache (populated by Binny's scrape + user-confirmed scans)
  try {
    const redis  = Redis.fromEnv()
    const cached = await redis.get(`wh:upc:${code}`)
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached
      if (data?.name) return NextResponse.json({ name: data.name, imageUrl: data.imageUrl ?? null })
    }
  } catch {}

  // 2. UPC Item DB — better spirits/whiskey coverage, returns images[]
  try {
    const r = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (r.ok) {
      const d        = await r.json()
      const item     = d?.items?.[0]
      const name     = item?.title ?? null
      const imageUrl = item?.images?.[0] ?? null
      if (name) return NextResponse.json({ name, imageUrl })
    }
  } catch {}

  // 3. Open Food Facts — broad fallback
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`, {
      cache: 'no-store',
    })
    if (r.ok) {
      const d    = await r.json()
      const name = d?.product?.product_name || d?.product?.product_name_en
      if (name) return NextResponse.json({ name, imageUrl: null })
    }
  } catch {}

  return NextResponse.json({ name: null, imageUrl: null })
}
