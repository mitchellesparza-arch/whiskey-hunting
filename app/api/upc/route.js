import { NextResponse } from 'next/server'
import { Redis }        from '@upstash/redis'
import { UPC_MAP }      from '../../../lib/whiskey-db.js'

/**
 * GET /api/upc?code=<upc>
 *
 * Lookup priority:
 *   0. Static UPC_MAP   — hand-curated allocated/rare bottles (instant, no API)
 *   1. Redis cache      — every successful external hit is written back here
 *   2. UPC Item DB      — broad spirits coverage, returns images
 *   3. go-upc.com       — independent database, strong spirits coverage
 *   4. Open Food Facts  — wide fallback
 *
 * Every successful external lookup is cached to Redis permanently so the same
 * barcode never hits an external API twice. This builds up the database over
 * time as users scan bottles.
 */

let _redis = null
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv()
  return _redis
}

async function cacheUpc(code, name, imageUrl) {
  try {
    await getRedis().set(`wh:upc:${code}`, JSON.stringify({ name, imageUrl: imageUrl ?? null }))
  } catch {}
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = (searchParams.get('code') ?? '').trim().replace(/\D/g, '')
  if (!code) return NextResponse.json({ name: null, imageUrl: null })

  // 0. Static hand-curated map — allocated bottles, instant
  if (UPC_MAP[code]) {
    return NextResponse.json({ name: UPC_MAP[code].name, imageUrl: UPC_MAP[code].imageUrl ?? null })
  }

  // 1. Redis cache — built up from every successful external lookup
  try {
    const cached = await getRedis().get(`wh:upc:${code}`)
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached
      if (data?.name) return NextResponse.json({ name: data.name, imageUrl: data.imageUrl ?? null })
    }
  } catch {}

  // 2. UPC Item DB
  try {
    const r = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
      { headers: { Accept: 'application/json' }, cache: 'no-store' }
    )
    if (r.ok) {
      const d        = await r.json()
      const item     = d?.items?.[0]
      const name     = item?.title ?? null
      const imageUrl = item?.images?.[0] ?? null
      if (name) {
        await cacheUpc(code, name, imageUrl)
        return NextResponse.json({ name, imageUrl })
      }
    }
  } catch {}

  // 3. go-upc.com — requires GO_UPC_KEY env var (go-upc.com/api)
  const goUpcKey = process.env.GO_UPC_KEY
  if (goUpcKey) {
    try {
      const r = await fetch(
        `https://go-upc.com/api/v1/code/${encodeURIComponent(code)}`,
        {
          headers: { Authorization: `Bearer ${goUpcKey}`, Accept: 'application/json' },
          cache: 'no-store',
        }
      )
      if (r.ok) {
        const d        = await r.json()
        const name     = d?.product?.name ?? null
        const imageUrl = d?.product?.imageUrl ?? null
        if (name) {
          await cacheUpc(code, name, imageUrl)
          return NextResponse.json({ name, imageUrl })
        }
      }
    } catch {}
  }

  // 4. Open Food Facts — broadest fallback, no key required
  try {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`,
      { cache: 'no-store' }
    )
    if (r.ok) {
      const d    = await r.json()
      const name = d?.product?.product_name || d?.product?.product_name_en
      if (name) {
        await cacheUpc(code, name, null)
        return NextResponse.json({ name, imageUrl: null })
      }
    }
  } catch {}

  return NextResponse.json({ name: null, imageUrl: null })
}
