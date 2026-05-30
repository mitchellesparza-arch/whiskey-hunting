/**
 * lib/retailers.js
 *
 * Multi-retailer allocated-bottle checker for Chicagoland.
 * Covers stores whose online catalogs DO expose allocated inventory,
 * complementing the Binny's Algolia checker which cannot see those bottles.
 *
 * Retailers covered:
 *   • The Liquor Barn  — Shopify,   Wheeling / Niles / Vernon Hills IL
 *   • Joe's Bev Warehouse — City Hive, Romeoville IL
 *   • Malloy's Finest  — City Hive,   Glen Ellyn / Naperville / Lisle IL
 *   • Uncork It Chicago — City Hive,  Chicago IL
 *   • Kenwood Liquors   — City Hive,  Oak Lawn / Chicago South Side IL
 */

// ─────────────────────────────────────────────────────────────────────────────
// LIQUOR BARN — Shopify  (theliquorbarn.com)
// The .js endpoint returns `available: true/false` live from Shopify inventory.
// ─────────────────────────────────────────────────────────────────────────────

const LIQUOR_BARN_BASE = 'https://theliquorbarn.com'

/**
 * Bottles to monitor at Liquor Barn.
 * `slug`  — Shopify product handle (from /products/{slug}.js)
 * `name`  — display name for alerts
 */
const LIQUOR_BARN_BOTTLES = [
  // ── Buffalo Trace / Sazerac ─────────────────────────────────────────────
  { slug: 'eagle-rare-10-year-bourbon',                         name: 'Eagle Rare 10yr' },
  { slug: 'eagle-rare-12-year-bourbon-750ml',                   name: 'Eagle Rare 12yr' },
  { slug: 'blantons-single-barrel-bourbon-750ml',               name: "Blanton's Original Single Barrel" },
  { slug: 'blantons-gold-edition-bourbon-750ml',                name: "Blanton's Gold Edition" },
  { slug: 'blantons-straight-from-the-barrel-bourbon-750ml',    name: "Blanton's Straight From The Barrel" },
  { slug: 'weller-special-reserve-750ml-1',                     name: 'Weller Special Reserve' },
  { slug: 'weller-12-year-bourbon',                             name: 'Weller 12yr' },
  { slug: 'weller-antique-107-proof-750ml',                     name: 'Weller Antique 107' },
  { slug: 'weller-full-proof-750ml',                            name: 'Weller Full Proof' },
  { slug: 'george-t-stagg-bourbon-750ml',                       name: 'George T. Stagg (BTAC)' },
  { slug: 'william-larue-weller-bourbon-750ml',                 name: 'William Larue Weller (BTAC)' },
  { slug: 'colonel-e-h-taylor-jr-small-batch-750ml',            name: 'E.H. Taylor Small Batch' },
  { slug: 'buffalo-trace-bourbon-750ml-1',                      name: 'Buffalo Trace Bourbon' },
  { slug: 'eagle-rare-10-year-liquor-barn-single-barrel-bourbon-750ml', name: 'Eagle Rare Liquor Barn Single Barrel' },
  // ── Heaven Hill ─────────────────────────────────────────────────────────
  { slug: 'old-fitzgerald-9-year-bourbon-100-proof-750ml',      name: 'Old Fitzgerald 9yr BIB' },
]

/**
 * Check all target bottles at Liquor Barn via Shopify .js endpoint.
 * Returns array of { bottle, retailer, inStock, price, url }
 */
async function checkLiquorBarn() {
  const results = []

  await Promise.all(LIQUOR_BARN_BOTTLES.map(async (bottle) => {
    try {
      const url = `${LIQUOR_BARN_BASE}/products/${bottle.slug}.js`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) return

      const product = await res.json()
      const inStock = product.available === true
      // Shopify .js endpoint returns price as integer cents (6999 = $69.99)
      const rawPrice = product.variants?.[0]?.price
      const price    = rawPrice != null
        ? (rawPrice > 500 ? rawPrice / 100 : rawPrice) // cents if > 500, else already dollars
        : null

      results.push({
        bottle:   bottle.name,
        retailer: 'Liquor Barn',
        location: 'Wheeling / Niles / Vernon Hills, IL',
        inStock,
        price,
        url: `${LIQUOR_BARN_BASE}/products/${bottle.slug}`,
        slug: bottle.slug,
      })
    } catch {
      // silently skip on network error
    }
  }))

  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// CITY HIVE STORES
// Pages are server-side rendered — allocated bottle names appear directly in
// the raw HTML.  No browser / Playwright needed.
//
// Merchant IDs (MongoDB ObjectID format):
//   Joe's Bev Warehouse:   6060f70c9b020f0191a360bb
//   Malloy's Finest:       62e1b40ca6d57025cc5d8be8   (Glen Ellyn location)
//   Uncork It Chicago:     5a72232ef4a6615179f2288d
//   Kenwood Liquors:       to be discovered (see detectKenwoodMerchantId)
// ─────────────────────────────────────────────────────────────────────────────

const CITY_HIVE_STORES = [
  {
    name:     "Joe's Beverage Warehouse",
    location: 'Romeoville, IL',
    base:     'https://joesbev.com',
    pages:    ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'],
  },
  {
    name:     "Malloy's Finest",
    location: 'Glen Ellyn / Naperville / Lisle, IL',
    base:     'https://malloysfinest.com',
    pages:    ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'],
  },
  {
    name:     'Uncork It Chicago',
    location: 'Chicago, IL',
    base:     'https://uncorkitchicago.com',
    pages:    ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'],
  },
  {
    name:     'Kenwood Liquors',
    location: 'Oak Lawn / Chicago, IL',
    base:     'https://www.kenwoodliquors.biz',
    pages:    ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'],
  },
]

/**
 * Allocated bottle patterns to flag in City Hive HTML.
 * Each entry: { pattern (RegExp), name (canonical display name) }
 */
const CITY_HIVE_TARGETS = [
  { pattern: /eagle\s*rare/i,                              name: 'Eagle Rare' },
  { pattern: /blanton'?s\s+(original|single|gold|straight)/i, name: "Blanton's" },
  { pattern: /blanton'?s/i,                                name: "Blanton's" },
  { pattern: /weller\s+special\s+reserve/i,                name: 'Weller Special Reserve' },
  { pattern: /weller\s+12/i,                               name: 'Weller 12yr' },
  { pattern: /weller\s+antique/i,                          name: 'Weller Antique 107' },
  { pattern: /weller\s+full\s+proof/i,                     name: 'Weller Full Proof' },
  { pattern: /weller\s+(cypb|craft\s+your\s+path)/i,       name: 'Weller CYPB' },
  { pattern: /william\s+larue\s+weller/i,                  name: 'William Larue Weller (BTAC)' },
  { pattern: /george\s+t[\.\s]+stagg(?!\s+jr)/i,           name: 'George T. Stagg (BTAC)' },
  { pattern: /stagg\s+jr/i,                                name: 'Stagg Jr.' },
  { pattern: /thomas\s+h[\.\s]+handy/i,                    name: 'Thomas H. Handy (BTAC)' },
  { pattern: /sazerac\s+18/i,                              name: 'Sazerac 18yr (BTAC)' },
  { pattern: /pappy\s+van\s+winkle/i,                      name: 'Pappy Van Winkle' },
  { pattern: /van\s+winkle/i,                              name: 'Van Winkle' },
  { pattern: /old\s+fitzgerald\s+(bottle|bottled|bib|b-i-b)/i, name: 'Old Fitzgerald BIB' },
  { pattern: /old\s+fitzgerald\s+\d+\s*yr/i,               name: 'Old Fitzgerald Limited' },
  { pattern: /e\.?h\.?\s*taylor\s+(single|small|straight|bottled|four|seasoned|cured|warehouse|old)/i, name: 'E.H. Taylor' },
  { pattern: /colonel\s+e\.?h\.?\s*taylor/i,               name: 'E.H. Taylor' },
  { pattern: /rock\s+hill\s+farms/i,                       name: 'Rock Hill Farms' },
  { pattern: /parker'?s\s+heritage/i,                      name: "Parker's Heritage" },
  { pattern: /elijah\s+craig\s+(barrel\s+proof|bp)/i,      name: 'Elijah Craig Barrel Proof' },
  { pattern: /four\s+roses\s+(limited|single\s+barrel\s+limited|small\s+batch\s+limited)/i, name: 'Four Roses Limited' },
  { pattern: /larceny\s+barrel\s+proof/i,                  name: 'Larceny Barrel Proof' },
  { pattern: /booker'?s\s+bourbon/i,                       name: "Booker's Bourbon" },
  { pattern: /whistlepig\s+(18|the\s+boss)/i,              name: 'WhistlePig 18yr / Boss Hog' },
  { pattern: /wild\s+turkey\s+(master|rare\s+breed\s+barrel)/i, name: "Wild Turkey Master's Keep" },
  { pattern: /russell'?s\s+reserve\s+(13|15)\s*yr/i,       name: "Russell's Reserve Limited" },
  { pattern: /michter'?s\s+(10|20|25)\s*yr/i,              name: "Michter's Limited" },
  { pattern: /little\s+book/i,                             name: 'Little Book' },
  { pattern: /angel'?s\s+envy\s+cask\s+strength/i,         name: "Angel's Envy Cask Strength" },
]

/**
 * Fetch a City Hive store page and extract allocated bottles via JSON-LD.
 *
 * City Hive SSR embeds product listings as schema.org ItemList in a
 * <script type="application/ld+json"> block — clean, structured, no false
 * positives from reviews or analytics.  Each item has:
 *   name, offers.price, offers.availability (InStock / OutOfStock URL)
 *
 * Returns array of { bottle, retailer, location, inStock, price, url }
 */
async function checkCityHiveStore(store) {
  const found = new Map() // canonical bottle name → result

  for (const pagePath of store.pages) {
    try {
      const pageUrl = store.base + pagePath
      const res = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html',
        },
        cache: 'no-store',
      })
      if (!res.ok) continue
      const html = await res.text()

      // ── Extract ItemList JSON-LD ──────────────────────────────────────────
      const blocks = [...html.matchAll(
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
      )]
      const itemListBlock = blocks.find(b => b[1].includes('"ItemList"'))
      if (!itemListBlock) continue

      const listData = JSON.parse(itemListBlock[1])
      const items    = listData.itemListElement || []

      for (const listItem of items) {
        const product = listItem.item || listItem
        const name    = product.name?.replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim()
        if (!name) continue

        // offers can be a single object or an array
        const offers   = Array.isArray(product.offers) ? product.offers[0] : product.offers
        const avail    = offers?.availability ?? ''
        const inStock  = /InStock/i.test(avail)
        const rawPrice = offers?.price
        const price    = rawPrice != null ? parseFloat(rawPrice) : null
        const url      = product.url || pageUrl

        // Check against each target pattern
        for (const target of CITY_HIVE_TARGETS) {
          if (!target.pattern.test(name)) continue
          if (found.has(target.name)) continue // already found this bottle

          found.set(target.name, {
            bottle:   target.name,
            retailer: store.name,
            location: store.location,
            inStock,
            price,
            url,
            rawName: name,
          })
          break // one target match per product
        }
      }
    } catch {
      // skip page on network / parse error
    }
  }

  return [...found.values()]
}

/**
 * Check all City Hive stores concurrently.
 */
async function checkAllCityHiveStores() {
  const results = await Promise.all(CITY_HIVE_STORES.map(checkCityHiveStore))
  return results.flat()
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check all Chicagoland retailers for allocated bottle availability.
 *
 * Returns array of:
 * {
 *   bottle:   string,   // canonical bottle name
 *   retailer: string,   // store name
 *   location: string,   // city/suburb
 *   inStock:  boolean,
 *   price:    number|null,
 *   url:      string,   // product or search page URL
 * }
 */
export async function checkAllRetailers() {
  const [liquorBarn, cityHive] = await Promise.all([
    checkLiquorBarn(),
    checkAllCityHiveStores(),
  ])
  return [...liquorBarn, ...cityHive]
}

/**
 * Return only in-stock allocated bottles across all retailers.
 */
export async function getRetailerFinds() {
  const all = await checkAllRetailers()
  return all.filter(r => r.inStock)
}

/**
 * Registry of all independent retailers with coordinates for map display.
 * Add new stores here — they're automatically picked up by the Independents tab.
 */
export const RETAILERS = [
  {
    name:     'Liquor Barn',
    location: 'Wheeling / Niles / Vernon Hills, IL',
    url:      'https://theliquorbarn.com',
    // Wheeling, IL location (primary)
    lat: 42.1364, lng: -87.9270,
  },
  {
    name:     "Joe's Beverage Warehouse",
    location: 'Romeoville, IL',
    url:      'https://joesbev.com',
    lat: 41.6475, lng: -88.0892,
  },
  {
    name:     "Malloy's Finest",
    location: 'Glen Ellyn / Naperville / Lisle, IL',
    url:      'https://malloysfinest.com',
    // Glen Ellyn location
    lat: 41.8761, lng: -88.0636,
  },
  {
    name:     'Uncork It Chicago',
    location: 'Chicago, IL',
    url:      'https://uncorkitchicago.com',
    lat: 41.8748, lng: -87.6390,
  },
  {
    name:     'Kenwood Liquors',
    location: 'Oak Lawn / Chicago, IL',
    url:      'https://www.kenwoodliquors.biz',
    lat: 41.7193, lng: -87.7787,
  },
]
