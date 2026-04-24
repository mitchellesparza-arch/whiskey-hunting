import { canaryBottles } from './bottles.js'

/**
 * Multi-store Algolia canary checker.
 *
 * Key insight: each Algolia product object contains inStockStores[] — an array
 * of ALL store codes where the bottle is currently in stock. One fetch per
 * canary bottle is enough to check every Chicagoland Binny's simultaneously.
 */

const ALGOLIA_APP_ID  = process.env.ALGOLIA_APP_ID  ?? 'Z25A2A928M'
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY ?? '88b6125855a0bbd845447e35de8d51c5'
const ALGOLIA_INDEX   = 'Products_Production_AB_Test'

/**
 * Fetch a single canary bottle from Algolia.
 * Returns the raw hit object, or null on any error.
 */
async function fetchCanary(bottle) {
  try {
    const url =
      `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/` +
      `${encodeURIComponent(ALGOLIA_INDEX)}/${encodeURIComponent(bottle.objectID)}`

    const res = await fetch(url, {
      headers: {
        'X-Algolia-Application-Id': ALGOLIA_APP_ID,
        'X-Algolia-API-Key':        ALGOLIA_API_KEY,
      },
      cache: 'no-store',
    })

    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Check all canary bottles across all given stores concurrently.
 *
 * @param {Array} stores - [{ code, name, address }]
 *
 * @returns {Array} results - one entry per canary:
 *   {
 *     bottle,            // the canary bottle definition
 *     byStore: {         // keyed by storeCode
 *       [code]: { inStock: boolean, quantity: number|null }
 *     },
 *     error: string|null
 *   }
 */
export async function checkAllCanaries(stores) {
  const storeCodes = stores.map(s => s.code)

  const results = await Promise.all(
    canaryBottles.map(async (bottle) => {
      const hit = await fetchCanary(bottle)

      if (!hit) {
        return {
          bottle,
          byStore: Object.fromEntries(
            storeCodes.map(c => [c, { inStock: false, quantity: null }])
          ),
          error: 'Algolia fetch failed',
        }
      }

      const inStockStores  = hit.inStockStores          ?? []
      const storeInventory = hit.storesPriceAndInventory ?? []

      const byStore = {}
      for (const code of storeCodes) {
        const inStock  = inStockStores.includes(code)
        const entry    = storeInventory.find(s => s.storeCode === code)
        const quantity = entry?.purchaseAvailability ?? null
        byStore[code]  = { inStock, quantity }
      }

      return { bottle, byStore, error: null }
    })
  )

  return results
}
