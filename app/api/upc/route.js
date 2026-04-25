import { NextResponse } from 'next/server'

/**
 * GET /api/upc?code=<upc>
 * Server-side proxy for UPC lookups — avoids client CORS issues and rate limits.
 * Tries UPC Item DB first, then Open Food Facts as fallback.
 * Returns { name: string | null }
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = (searchParams.get('code') ?? '').trim()
  if (!code) return NextResponse.json({ name: null })

  // 1. UPC Item DB — better spirits/whiskey coverage
  try {
    const r = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (r.ok) {
      const d    = await r.json()
      const name = d?.items?.[0]?.title
      if (name) return NextResponse.json({ name })
    }
  } catch {}

  // 2. Open Food Facts — broad fallback
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`, {
      cache: 'no-store',
    })
    if (r.ok) {
      const d    = await r.json()
      const name = d?.product?.product_name || d?.product?.product_name_en
      if (name) return NextResponse.json({ name })
    }
  } catch {}

  return NextResponse.json({ name: null })
}
