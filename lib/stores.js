/**
 * Chicagoland Binny's Beverage Depot store registry.
 *
 * fetchChicagolandStores() queries Algolia's Stores_Production index for all
 * Binny's locations. Binny's only operates in Illinois, so all results are
 * Chicagoland stores — no state filter needed.
 *
 * FALLBACK_STORES is used when Algolia is unreachable. Only store 47
 * (Orland Park) is confirmed; all others are discovered at runtime.
 */

const ALGOLIA_APP_ID  = process.env.ALGOLIA_APP_ID  ?? 'Z25A2A928M'
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY ?? '88b6125855a0bbd845447e35de8d51c5'

export const FALLBACK_STORES = [
  { code: '47', name: 'Orland Park', address: '15521 S. LaGrange Rd, Orland Park, IL 60462' },
]

/**
 * Query Algolia's Stores_Production index for all Binny's locations.
 * Returns [{ code, name, address }] sorted alphabetically by name.
 */
export async function fetchChicagolandStores() {
  try {
    const res = await fetch(
      `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/Stores_Production/query`,
      {
        method:  'POST',
        headers: {
          'X-Algolia-Application-Id': ALGOLIA_APP_ID,
          'X-Algolia-API-Key':        ALGOLIA_API_KEY,
          'Content-Type':             'application/json',
        },
        body:  JSON.stringify({ query: '', hitsPerPage: 100 }),
        cache: 'no-store',
      }
    )

    if (!res.ok) throw new Error(`Algolia Stores_Production returned ${res.status}`)

    const { hits = [] } = await res.json()

    // Field names reverse-engineered from the Stores_Production index schema
    const stores = hits
      .filter(h => h.storeCode)
      .map(h => ({
        code:    String(h.storeCode),
        name:    h.storeName ?? h.city ?? `Store ${h.storeCode}`,
        address: [h.address, h.city, h.state ?? 'IL'].filter(Boolean).join(', '),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    if (!stores.length) throw new Error('Empty store list from Algolia')

    console.log(`[stores] Discovered ${stores.length} Binny's stores`)
    return stores

  } catch (err) {
    console.warn('[stores] Store discovery failed:', err.message, '— using fallback')
    return FALLBACK_STORES
  }
}
