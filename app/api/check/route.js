import { NextResponse } from 'next/server'

/**
 * GET /api/check?objectID=<id>
 *
 * Fetches a single product from Binny's Algolia index by objectID and returns
 * stock status for Orland Park (store "47").
 *
 * Direct objectID lookup bypasses all Algolia redirect/merchandising rules that
 * otherwise suppress searches for allocated bottles (Blanton's, Eagle Rare, etc.).
 *
 * Algolia credentials are the public search-only key from binnys.com's frontend.
 */

const ALGOLIA_APP_ID  = process.env.ALGOLIA_APP_ID  ?? 'Z25A2A928M'
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY ?? '88b6125855a0bbd845447e35de8d51c5'
const ALGOLIA_INDEX   = 'Products_Production_AB_Test'
const ORLAND_PARK     = '47'  // Confirmed via Stores_Production index

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const objectID = searchParams.get('objectID')?.trim()

  if (!objectID) {
    return NextResponse.json({ error: 'objectID query param is required' }, { status: 400 })
  }

  try {
    // Direct object lookup — no search rules, no redirects, always returns the product if it exists
    const url = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${encodeURIComponent(ALGOLIA_INDEX)}/${encodeURIComponent(objectID)}`

    const res = await fetch(url, {
      headers: {
        'X-Algolia-Application-Id': ALGOLIA_APP_ID,
        'X-Algolia-API-Key':        ALGOLIA_API_KEY,
      },
      next: { revalidate: 300 }, // cache 5 min server-side
    })

    if (res.status === 404) {
      // Product not in index — treat as not found / out of stock
      return NextResponse.json({ found: false, inStock: false, objectID })
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`Algolia error ${res.status} for ${objectID}:`, body.slice(0, 200))
      return NextResponse.json({ error: `Algolia returned ${res.status}` }, { status: 502 })
    }

    const hit = await res.json()

    // ── In-stock check ────────────────────────────────────────────────────────
    // inStockStores is the fast path — array of storeCode strings
    const inStock = Array.isArray(hit.inStockStores)
      ? hit.inStockStores.includes(ORLAND_PARK)
      : false

    // ── Per-store detail ──────────────────────────────────────────────────────
    const storeEntry = Array.isArray(hit.storesPriceAndInventory)
      ? hit.storesPriceAndInventory.find((s) => s.storeCode === ORLAND_PARK)
      : null

    const price    = storeEntry?.prices?.bestPrice    ?? null
    const quantity = storeEntry?.purchaseAvailability ?? null
    const message  = storeEntry?.stockMessageByStore  ?? (inStock ? 'In Stock' : 'Out of Stock')
    const proof    = hit.proof ?? null   // top-level field, e.g. 129

    return NextResponse.json({
      found:    true,
      inStock,
      message,   // e.g. "Only 2 Left", "Out of Stock"
      name:     hit.productName ?? objectID,
      price,
      quantity,  // exact bottle count at Orland Park
      proof,     // bottle proof, e.g. 129
      url:      hit.productUrl ?? null,
      objectID: hit.objectID,
    })
  } catch (err) {
    console.error('check route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
