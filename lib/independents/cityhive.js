/**
 * lib/independents/cityhive.js
 *
 * City Hive REST API checker — 17 Chicagoland stores (including Malloy's 3 locations).
 *
 * Previously accessed via per-store domain proxies (e.g. joesbev.com/api/v1/...).
 * City Hive hardened Cloudflare on all store domains in mid-2026; the central
 * api.cityhive.net endpoint is the only working path.
 *
 * Response schema differences from the old proxy API:
 *   - Wrapper: data.data.products  (was data.products)
 *   - Each element: { product: {...} }  (unwrap with p.product ?? p)
 *   - merchants is now an object keyed by offer type: { pick_up, delivery, shipping }
 *     (was an array of { merchant_id, product_options: [{ price, quantity }] })
 *   - Hard cap: ~30 results per query (returns in-stock items ranked by store)
 *
 * Works from both home machine and Vercel — api.cityhive.net does not block
 * datacenter IPs.
 */

import { TARGETS } from './targets.js'

const API_KEY       = '7508df878a8c7566a880e4d3f7fa7972'
const CITYHIVE_BASE = 'https://api.cityhive.net'

const PRIMARY_SUBTYPES = ['bourbon', 'whiskey']
const BROAD_SUBTYPES   = [
  'bourbon', 'whiskey', 'american whiskey', 'straight bourbon',
  'rye whiskey', 'tennessee whiskey', 'blended whiskey', 'single malt',
]

export const CITY_HIVE_STORES = [
  // ── Southwest / Joliet corridor ──────────────────────────────────────────────
  { name: "Joe's Beverage Warehouse",          location: 'Romeoville, IL',              base: 'https://joesbev.com',                    merchantId: '6060f70c9b020f0191a360bb' },
  { name: "John's Beverage Warehouse",         location: 'Joliet, IL',                  base: 'https://johnsbev.com',                   merchantId: '69812499c28444433ede928f' },
  { name: 'Greene Valley Wine & Spirits',      location: 'Bolingbrook, IL',             base: 'https://greenevalleyws.com',             merchantId: '668471fdfd0ce678a5a1b3af' },
  // ── West / DuPage suburbs ────────────────────────────────────────────────────
  { name: "Sal's Beverage World (Elmhurst)",   location: 'Elmhurst, IL',                base: 'https://elmhurst.salsbeverageworld.com',  merchantId: '6414e185752b862a94911cff' },
  { name: "Sal's Beverage World (Addison)",    location: 'Addison, IL',                 base: 'https://addison.salsbeverageworld.com',   merchantId: '66228616d1c0852947bc439f' },
  { name: "Sal's Beverage World (Villa Park)", location: 'Villa Park, IL',              base: 'https://villapark.salsbeverageworld.com', merchantId: '67b3483b6903ea296d576738' },
  // ── DuPage / Malloy's ────────────────────────────────────────────────────────
  { name: "Malloy's Finest (Glen Ellyn)",      location: 'Glen Ellyn, IL',              base: 'https://malloysfinest.com',              merchantId: '61e1be9b0948c175812f04b5' },
  { name: "Malloy's Finest (Naperville)",      location: 'Naperville, IL',              base: 'https://malloysfinest.com',              merchantId: '61e1eb34695ac77714231544' },
  { name: "Malloy's Finest (Lisle)",           location: 'Lisle, IL',                   base: 'https://malloysfinest.com',              merchantId: '61e1f5e5afafbc5148d1b92b' },
  // ── Chicago city ─────────────────────────────────────────────────────────────
  { name: 'Uncork It Chicago',                 location: 'Chicago, IL',                 base: 'https://uncorkitchicago.com',            merchantId: '5a72232ef4a6615179f2288d' },
  { name: 'Archer Liquors',                    location: 'Chicago (SW), IL',            base: 'https://archerliquors.com',              merchantId: '619dae8c872ef80ea00d69a4' },
  { name: 'Liquor Expo Chicago',               location: 'Chicago (Lincoln Park), IL',  base: 'https://myliquorexpo.com',               merchantId: '62ccc3cf1dc8b32884ead506' },
  // ── North / Northwest suburbs ─────────────────────────────────────────────────
  { name: 'Northshore Wine & Spirits',         location: 'Highwood, IL',                base: 'https://northshorewineandspirit.com',    merchantId: '63bc86c7bd02f729e676944d' },
  { name: 'Gold Eagle Wine & Spirits',         location: 'Libertyville, IL',            base: 'https://goldeaglewine.com',              merchantId: '5b9d2b972275a35cb685aa58' },
  { name: 'D&D Smoke & Spirits',               location: 'Arlington Heights, IL',       base: 'https://ddsmokespirits.com',             merchantId: '63c18911e538a829c5d71677' },
  { name: 'Elgin Liquor & Wine',               location: 'Elgin, IL',                   base: 'https://elginliquor.com',                merchantId: '5e9a33845e5d640d02818ab3' },
  { name: 'Antioch Fine Wine & Liquors',       location: 'Antioch, IL',                 base: 'https://antiochwine.com',                merchantId: '59810104d05b4360e32fac36' },
]

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchProducts(store, subtypes) {
  const params = new URLSearchParams()
  params.set('api_key', API_KEY)
  params.set('merchant_id', store.merchantId)
  params.set('per_page', '30')
  subtypes.forEach(s => params.append('additional_properties[subtype][]', s))

  const res = await fetch(`${CITYHIVE_BASE}/api/v1/products/search.json?${params}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache:   'no-store',
    signal:  AbortSignal.timeout(12000),
  })

  if (!res.ok) {
    if (res.status === 403 || res.status === 429) {
      console.warn(`[CityHive] ${store.name}: blocked (${res.status})`)
    } else {
      console.warn(`[CityHive] ${store.name}: HTTP ${res.status}`)
    }
    return null
  }

  const data = await res.json()
  // New schema: { result, data: { products: [{ product: {...} }] } }
  return (data?.data?.products ?? []).map(p => p.product ?? p)
}

function matchProducts(products, store) {
  const found = new Map()

  for (const product of products) {
    const name = product.name?.trim()
    if (!name) continue

    for (const target of TARGETS) {
      if (!target.pattern.test(name)) continue
      if (found.has(target.name)) break

      // New schema: merchants is an object { pick_up, delivery, shipping }
      const pickup = product.merchants?.pick_up

      found.set(target.name, {
        bottle:   target.name,
        retailer: store.name,
        location: store.location,
        inStock:  true,
        price:    pickup?.price != null ? parseFloat(pickup.price) : null,
        quantity: pickup?.quantity ?? null,
        url:      pickup?.product_url ?? `${store.base}/shop/`,
        rawName:  name,
      })
      break
    }
  }

  return [...found.values()]
}

// ─── Per-store check ──────────────────────────────────────────────────────────

async function checkCityHiveStore(store) {
  let products = await fetchProducts(store, PRIMARY_SUBTYPES)

  if (products === null) {
    return { finds: [], catalogSize: 0, accessible: false }
  }

  if (products.length === 0) {
    console.log(`[CityHive] ${store.name}: 0 products with primary filter, trying broad subtypes...`)
    products = await fetchProducts(store, BROAD_SUBTYPES)

    if (products === null) {
      return { finds: [], catalogSize: 0, accessible: false }
    }

    if (products.length > 0) {
      console.log(`[CityHive] ${store.name}: broad filter returned ${products.length} products`)
    } else {
      console.log(`[CityHive] ${store.name}: 0 products even with broad filter`)
      return { finds: [], catalogSize: 0, accessible: true }
    }
  }

  const finds = matchProducts(products, store)

  if (finds.length === 0 && process.env.DEBUG_CITYHIVE === 'true') {
    console.log(`[CityHive DEBUG] ${store.name}: ${products.length} products, 0 matches. Sample names:`)
    products.slice(0, 20).forEach(p => console.log(`    "${p.name}"`))
  }

  const tag = finds.length > 0 ? ` → ${finds.length} FOUND` : ''
  console.log(`[CityHive] ${store.name}: ${products.length} products scanned${tag}`)

  return { finds, catalogSize: products.length, accessible: true }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function checkAllCityHive() {
  const results = await Promise.all(CITY_HIVE_STORES.map(checkCityHiveStore))

  return CITY_HIVE_STORES.map((store, i) => ({
    store,
    ...results[i],
  }))
}
