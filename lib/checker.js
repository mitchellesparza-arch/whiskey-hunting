import { alertBottles, trackBottles } from './bottles.js'

/**
 * Algolia credentials — same public search-only keys used by binnys.com frontend.
 * Fall back to hard-coded values so the checker works even if env vars aren't set.
 */
const ALGOLIA_APP_ID  = process.env.ALGOLIA_APP_ID  ?? 'Z25A2A928M'
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY ?? '88b6125855a0bbd845447e35de8d51c5'
const ALGOLIA_INDEX   = 'Products_Production_AB_Test'
const ORLAND_PARK     = '47'

/**
 * Check a single bottle by calling Algolia directly (no HTTP round-trip through
 * the app itself).  This is used by the cron and any server-side caller.
 *
 * The browser UI (/app/page.jsx) still calls /api/check directly — that route
 * has 5-minute server-side caching which is fine for the interactive UI.
 */
async function checkBottle(bottle) {
  try {
    const url =
      `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/` +
      `${encodeURIComponent(ALGOLIA_INDEX)}/${encodeURIComponent(bottle.objectID)}`

    const res = await fetch(url, {
      headers: {
        'X-Algolia-Application-Id': ALGOLIA_APP_ID,
        'X-Algolia-API-Key':        ALGOLIA_API_KEY,
      },
      cache: 'no-store',   // always get fresh data in the cron
    })

    if (res.status === 404) {
      return {
        name:        bottle.name,
        objectID:    bottle.objectID,
        url:         bottle.url,
        distributor: bottle.distributor ?? null,
        inStock:     false,
        message:     'Not in index',
        price:       null,
        quantity:    null,
        proof:       null,
        error:       null,
      }
    }

    if (!res.ok) {
      throw new Error(`Algolia returned ${res.status}`)
    }

    const hit = await res.json()

    const inStock = Array.isArray(hit.inStockStores)
      ? hit.inStockStores.includes(ORLAND_PARK)
      : false

    const storeEntry = Array.isArray(hit.storesPriceAndInventory)
      ? hit.storesPriceAndInventory.find((s) => s.storeCode === ORLAND_PARK)
      : null

    const price    = storeEntry?.prices?.bestPrice        ?? null
    const quantity = storeEntry?.purchaseAvailability     ?? null
    const message  = storeEntry?.stockMessageByStore ?? (inStock ? 'In Stock' : 'Out of Stock')
    const proof    = hit.proof ?? null   // top-level field, e.g. 129

    return {
      name:        bottle.name,
      objectID:    bottle.objectID,
      url:         hit.productUrl ?? bottle.url,   // prefer Algolia's canonical URL
      distributor: bottle.distributor ?? null,
      inStock,
      message,
      price,
      quantity,
      proof,
      error:       null,
    }
  } catch (err) {
    return {
      name:        bottle.name,
      objectID:    bottle.objectID,
      url:         bottle.url,
      distributor: bottle.distributor ?? null,
      inStock:     false,
      message:     null,
      price:       null,
      quantity:    null,
      proof:       null,
      error:       err.message,
    }
  }
}

/**
 * Check all alert + track bottles concurrently against Algolia.
 * No baseUrl needed — calls Algolia directly.
 */
export async function checkAllBottles() {
  const [alertResults, trackResults] = await Promise.all([
    Promise.all(alertBottles.map((b) => checkBottle(b))),
    Promise.all(trackBottles.map((b) => checkBottle(b))),
  ])

  return {
    alertResults,
    trackResults,
    alertsInStock: alertResults.filter((r) => r.inStock),
    checkedAt:     new Date().toISOString(),
  }
}
