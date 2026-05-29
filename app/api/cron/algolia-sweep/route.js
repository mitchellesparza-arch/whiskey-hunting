import { NextResponse } from 'next/server'
import { upsertBottle } from '../../../../lib/bottle-db.js'

/**
 * GET /api/cron/algolia-sweep
 *
 * Weekly sweep of Binny's full Algolia catalog.
 * Discovers new SKUs and enriches canonical bottle records with objectIDs,
 * Binny's URLs, live prices, and images.
 *
 * Uses Algolia's browse API (cursor-based) so we get every product, not just
 * the first page. Filters to spirits category to avoid wine/beer noise.
 *
 * Schedule: Sundays 7AM UTC (runs the day before market-price/refresh on Monday)
 */

const ALG_APP   = process.env.ALGOLIA_APP_ID  ?? 'Z25A2A928M'
const ALG_KEY   = process.env.ALGOLIA_API_KEY ?? '88b6125855a0bbd845447e35de8d51c5'
const ALG_INDEX = 'Products_Production_AB_Test'
const STORE_47  = '47'   // Binny's Orland Park
const BATCH     = 20     // parallel upserts per page

// Algolia category values that correspond to spirits (exclude wine, beer, etc.)
const SPIRIT_TYPES = new Set([
  'Bourbon', 'Rye', 'Whiskey', 'Scotch', 'Irish Whiskey', 'Japanese Whisky',
  'Canadian Whisky', 'American Whiskey', 'Tennessee Whiskey', 'Single Malt',
  'Blended Scotch', 'Single Barrel', 'Spirits', 'Whisky',
])

function isSpirit(hit) {
  const type = hit.productType ?? hit.type ?? hit.category ?? ''
  if (!type) return true  // unknown type: include rather than exclude
  return SPIRIT_TYPES.has(type)
}

function extractPrice(hit) {
  const store = (hit.storesPriceAndInventory ?? []).find(s => s.storeCode === STORE_47)
  return store?.prices?.bestPrice ?? hit.prices?.bestPrice ?? null
}

function extractImage(hit) {
  return hit.imageUrl ?? hit.image ?? hit.thumbnailUrl
    ?? hit.images?.[0] ?? hit.thumbnail ?? null
}

async function browsePage(cursor) {
  const url = cursor
    ? `https://${ALG_APP}-dsn.algolia.net/1/indexes/${ALG_INDEX}/browse`
    : `https://${ALG_APP}-dsn.algolia.net/1/indexes/${ALG_INDEX}/browse`

  const body = cursor
    ? { cursor }
    : { params: 'hitsPerPage=1000' }

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'X-Algolia-Application-Id': ALG_APP,
      'X-Algolia-API-Key':        ALG_KEY,
      'Content-Type':             'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Algolia browse HTTP ${res.status}`)
  return res.json()
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  const auth  = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (token !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const start   = Date.now()
  let cursor    = null
  let pagesDone = 0
  let hitsTotal = 0
  let upserted  = 0
  let skipped   = 0
  const errors  = []
  const MAX_PAGES = 50  // safety cap (~50k products max)

  try {
    do {
      const page = await browsePage(cursor)
      cursor     = page.cursor ?? null
      const hits = page.hits  ?? []
      hitsTotal += hits.length
      pagesDone++

      // Filter to spirits only, then upsert in small parallel batches
      const spirits = hits.filter(isSpirit)
      skipped += hits.length - spirits.length

      for (let i = 0; i < spirits.length; i += BATCH) {
        await Promise.allSettled(
          spirits.slice(i, i + BATCH).map(async hit => {
            const name = hit.productName ?? hit.name ?? null
            if (!name) return

            const price47   = extractPrice(hit)
            const inStock47 = (hit.inStockStores ?? []).includes(STORE_47)

            try {
              await upsertBottle({
                name,
                algoliaObjectId: String(hit.objectID),
                binnysUrl:       hit.productUrl ?? hit.url ?? null,
                binnysPrice:     price47 ? Number(price47) : null,
                binnysInStock:   inStock47,
                lastSeenBinnys:  inStock47 ? Date.now() : undefined,
                imageUrl:        extractImage(hit),
                category:        hit.productType ?? hit.type ?? hit.category ?? null,
              }, 'algolia', { skipFuzzy: true })
              upserted++
            } catch (err) {
              errors.push(`${name}: ${err.message}`)
            }
          })
        )
      }

      if (!cursor || pagesDone >= MAX_PAGES) break
    } while (true)

  } catch (err) {
    console.error('[algolia-sweep]', err)
    return NextResponse.json({
      ok: false,
      error:     err.message,
      pagesDone,
      hitsTotal,
      upserted,
      ms: Date.now() - start,
    }, { status: 500 })
  }

  console.log(`[algolia-sweep] pages=${pagesDone} hits=${hitsTotal} spirits=${upserted} skipped=${skipped} errors=${errors.length} ms=${Date.now() - start}`)

  return NextResponse.json({
    ok: true,
    pagesDone,
    hitsTotal,
    spiritsUpserted: upserted,
    nonSpiritSkipped: skipped,
    errors: errors.length,
    errorSample: errors.slice(0, 5),
    ms: Date.now() - start,
  })
}
