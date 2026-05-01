import { NextResponse } from 'next/server'
import { UPC_MAP }      from '../../../lib/whiskey-db.js'

/**
 * GET /api/upc?code=<upc>
 * Server-side proxy for UPC lookups — avoids client CORS issues and rate limits.
 * Priority: local UPC_MAP → UPC Item DB (with image) → Open Food Facts.
 * Returns { name: string | null, imageUrl: string | null }
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = (searchParams.get('code') ?? '').trim().replace(/\D/g, '')
  if (!code) return NextResponse.json({ name: null, imageUrl: null })

  // 0. Local map — instant hit for common rare bottles
  if (UPC_MAP[code]) {
    return NextResponse.json({ name: UPC_MAP[code].name, imageUrl: UPC_MAP[code].imageUrl ?? null })
  }

  // 1. UPC Item DB — better spirits/whiskey coverage, returns images[]
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

  // 2. Open Food Facts — broad fallback (no images for spirits usually)
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
