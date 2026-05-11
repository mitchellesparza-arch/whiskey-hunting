import { NextResponse } from 'next/server'
import { Redis }        from '@upstash/redis'
import { getToken }     from 'next-auth/jwt'

const CATALOG_KEY = 'wh:ua:catalog'
const DEALS_KEY   = 'wh:unicorn:deals'
const IMG_TTL     = 30 * 24 * 60 * 60  // 30 days — lot pages are permanent

function norm(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/['''''']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchOgImage(lotUrl) {
  try {
    const res = await fetch(lotUrl, {
      headers: {
        'User-Agent': 'TaterTracker/1.0 (+bourbon hunting community app)',
        'Accept':     'text/html',
      },
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) return null
    const html = await res.text()
    // og:image can appear with property= or name= in either attribute order
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
           ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    return m?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * GET /api/ua-image?name=<bottleName>
 *
 * Returns { imageUrl } for a Unicorn Auctions bottle.
 * Lookup order:
 *   1. Redis image cache  wh:ua:img:{normKey}  (30-day TTL)
 *   2. wh:ua:catalog stored imageUrl (populated if UA GraphQL returns the field)
 *   3. og:image scraped from the lot page URL stored in the catalog
 *   4. Fallback: scan active wh:unicorn:deals for a lot_url match
 *
 * Result is cached after first fetch so subsequent calls are O(1).
 */
export async function GET(request) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ imageUrl: null }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.trim() ?? ''
  if (!name) return NextResponse.json({ imageUrl: null })

  const nk       = norm(name)
  const cacheKey = `wh:ua:img:${nk}`
  const redis    = Redis.fromEnv()

  // 1. Image cache hit
  try {
    const cached = await redis.get(cacheKey)
    if (cached !== null) return NextResponse.json({ imageUrl: cached || null })
  } catch { /* fall through */ }

  let lotUrl   = null
  let imageUrl = null

  // 2. Check catalog for stored imageUrl or lotUrl
  try {
    const val = await redis.hget(CATALOG_KEY, nk)
    if (val) {
      const meta = typeof val === 'string' ? JSON.parse(val) : val
      if (meta.imageUrl) {
        imageUrl = meta.imageUrl
      }
      if (meta.lotUrl) {
        lotUrl = meta.lotUrl
      }
    }
  } catch { /* fall through */ }

  // 3. If no imageUrl yet, scrape og:image from the lot page
  if (!imageUrl && lotUrl) {
    imageUrl = await fetchOgImage(lotUrl)
  }

  // 4. Last resort: scan active deals for a lot_url match
  if (!imageUrl && !lotUrl) {
    try {
      const deals = await redis.get(DEALS_KEY)
      const data  = typeof deals === 'string' ? JSON.parse(deals) : deals
      const match = (data?.deals ?? []).find(d => norm(d.bottle_name ?? '') === nk)
      if (match?.lot_url) {
        lotUrl   = match.lot_url
        imageUrl = await fetchOgImage(lotUrl)
        // Backfill lotUrl into catalog so future calls skip this scan
        try {
          const val = await redis.hget(CATALOG_KEY, nk)
          if (val) {
            const meta = typeof val === 'string' ? JSON.parse(val) : val
            if (!meta.lotUrl) {
              meta.lotUrl = lotUrl
              if (imageUrl) meta.imageUrl = imageUrl
              await redis.hset(CATALOG_KEY, { [nk]: JSON.stringify(meta) })
            }
          }
        } catch { /* non-critical */ }
      }
    } catch { /* fall through */ }
  }

  // Cache result (empty string = confirmed miss, avoids re-fetching)
  try {
    await redis.set(cacheKey, imageUrl ?? '', { ex: IMG_TTL })
  } catch { /* non-critical */ }

  return NextResponse.json({ imageUrl: imageUrl ?? null })
}
