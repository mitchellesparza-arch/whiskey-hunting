import { NextResponse } from 'next/server'
import { Redis }        from '@upstash/redis'
import { UPC_MAP }      from '../../../lib/whiskey-db.js'

/**
 * GET /api/upc?code=<upc>
 *
 * Lookup priority:
 *   0. Static UPC_MAP   — hand-curated allocated/rare bottles (instant, no API)
 *   1. Redis cache      — permanent; grows with every successful scan
 *   2. UPC Item DB      — 100 free lookups/day; cached on hit so same bottle never repeats
 *   3. Open Food Facts  — unlimited free fallback
 *
 * Every successful external lookup is written to Redis permanently so the same
 * barcode never hits an external API twice. The cache builds itself over time
 * as users scan bottles in the wild.
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

  // 1. Redis cache — permanent, builds itself with every new scan
  try {
    const cached = await getRedis().get(`wh:upc:${code}`)
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached
      if (data?.name) return NextResponse.json({ name: data.name, imageUrl: data.imageUrl ?? null })
    }
  } catch {}

  // 2. UPC Item DB — 100/day free; cache on hit so this only fires once per unique barcode
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

  // 3. Open Food Facts — unlimited, no key required; cache on hit
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

/**
 * POST /api/upc
 * Body: { code: string, name: string }
 *
 * Caches a UPC→name mapping discovered via label scan so future scans
 * of the same barcode resolve instantly without hitting external APIs.
 */
export async function POST(request) {
  try {
    const { code, name } = await request.json()
    const clean = (code ?? '').toString().trim().replace(/\D/g, '')
    if (!clean || !name) return NextResponse.json({ ok: false }, { status: 400 })
    await cacheUpc(clean, name.trim(), null)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
