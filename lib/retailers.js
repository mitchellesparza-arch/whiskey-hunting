/**
 * lib/retailers.js
 *
 * Multi-retailer allocated-bottle checker for Chicagoland.
 * Covers stores whose online catalogs expose allocated inventory,
 * complementing the Binny's Algolia checker which cannot see those bottles.
 *
 * SHOPIFY stores  — /products/{slug}.js  → available: true/false
 *   • The Liquor Barn      — Wheeling / Niles / Vernon Hills IL
 *   • Keg N Bottle         — Glenview IL  (market pricing, barrel picks)
 *
 * CITY HIVE stores — JSON-LD ItemList scrape (no browser needed)
 *   • Joe's Beverage Warehouse  — Romeoville IL
 *   • Malloy's Finest           — Glen Ellyn / Naperville / Lisle IL
 *   • Uncork It Chicago         — Chicago IL
 *   • Kenwood Liquors           — Oak Lawn / Chicago South Side IL
 *   • John's Beverage Warehouse — Joliet IL
 *   • Greene Valley Wine & Spirits — Bolingbrook IL
 *   • Archer Liquors            — Chicago (S Archer Ave) IL
 *   • Northshore Wine & Spirits — Highwood IL
 *   • Elgin Liquor & Wine       — Elgin IL
 *   • Gold Eagle Wine & Spirits — Libertyville IL
 *   • D&D Smoke & Spirits       — Arlington Heights IL
 *   • Liquor Expo Chicago       — Chicago (Lincoln Park) IL
 *   • Sal's Beverage World      — Elmhurst / Villa Park / Addison IL
 *
 * CUSTOM scrapers
 *   • 20 West Wine & Spirits    — Lombard IL  (custom HTML, MSRP pricing)
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
// KEG N BOTTLE — Shopify  (kegnbottle.com) — Glenview IL
// Note: prices are at market rate (often above MSRP) for allocated bottles.
// Carries its own barrel picks (Eagle Rare, Four Roses, etc.)
// ─────────────────────────────────────────────────────────────────────────────

const KEG_N_BOTTLE_BASE = 'https://kegnbottle.com'

const KEG_N_BOTTLE_BOTTLES = [
  { slug: 'eagle-rare-kentucky-straight-bourbon',              name: 'Eagle Rare 10yr' },
  { slug: 'eagle-rare-10-year-keg-n-bottle-barrel-pick-whiskey-375ml', name: 'Eagle Rare Keg N Bottle Barrel Pick' },
  { slug: 'blantons-original-single-barrel-bourbon-750-ml',    name: "Blanton's Original Single Barrel" },
  { slug: 'w-l-weller-special-reserve-750-ml',                 name: 'Weller Special Reserve' },
  { slug: 'old-weller-antique-107-wheated-bourbon-750-ml',     name: 'Weller Antique 107' },
  { slug: 'buffalo-trace',                                     name: 'Buffalo Trace Bourbon' },
  { slug: 'colonel-e-h-taylor-small-batch-bourbon-750-ml',     name: 'E.H. Taylor Small Batch' },
  { slug: 'george-t-stagg-barrel-proof-bourbon-whiskey-750-ml', name: 'George T. Stagg (BTAC)' },
  { slug: 'old-fitzgerald-7-year-bottled-in-bond-bourbon-750-ml', name: 'Old Fitzgerald BIB' },
  { slug: 'four-roses-limited-edition-small-batch-135th-anniversary-bourbon-whiskey-750-ml', name: 'Four Roses Limited Edition' },
]

async function checkKegNBottle() {
  const results = []
  await Promise.all(KEG_N_BOTTLE_BOTTLES.map(async (bottle) => {
    try {
      const res = await fetch(`${KEG_N_BOTTLE_BASE}/products/${bottle.slug}.js`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) return
      const product = await res.json()
      const inStock = product.available === true
      const rawPrice = product.variants?.[0]?.price
      const price = rawPrice != null ? (rawPrice > 500 ? rawPrice / 100 : rawPrice) : null
      results.push({
        bottle:   bottle.name,
        retailer: 'Keg N Bottle',
        location: 'Glenview, IL',
        inStock,
        price,
        marketPrice: true, // flags above-MSRP pricing for UI
        url: `${KEG_N_BOTTLE_BASE}/products/${bottle.slug}`,
      })
    } catch { /* skip */ }
  }))
  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// 20 WEST WINE & SPIRITS — Custom HTML  (20westwinespirits.com) — Lombard IL
// Community-confirmed MSRP pricing. Custom .bc product cards with .btag.red
// "Allocated" tags and "Ask In-Store" pricing for hot bottles.
// ─────────────────────────────────────────────────────────────────────────────

async function check20West() {
  const found = new Map()
  try {
    const res = await fetch('https://20westwinespirits.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Accept: 'text/html' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const html = await res.text()

    // Strip script tags to avoid false positives
    const clean = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')

    // Parse .bc product cards
    const cards = [...clean.matchAll(/<div[^>]+class="bc"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]+class="bc"|<\/)/gi)]

    for (const [, cardHtml] of cards) {
      // Only care about cards tagged "Allocated"
      if (!/btag\s+red|class="btag[^"]*red/i.test(cardHtml)) continue

      // Extract bottle name from .bn
      const name = cardHtml.match(/class="bn"[^>]*>([^<]+)/)?.[1]?.trim()
      if (!name) continue

      // Extract price from .bp (will be "Ask In-Store" for allocated)
      const priceText = cardHtml.match(/class="bp"[^>]*>([^<]+)/)?.[1]?.trim() || ''
      const price     = /\$[\d.]+/.test(priceText) ? parseFloat(priceText.replace('$','')) : null
      const inStock   = true // if listed in catalog, they have it

      // Match against allocated targets
      for (const target of CITY_HIVE_TARGETS) {
        if (!target.pattern.test(name)) continue
        if (found.has(target.name)) continue
        found.set(target.name, {
          bottle:   target.name,
          retailer: '20 West Wine & Spirits',
          location: 'Lombard, IL',
          inStock,
          price,
          url:      'https://20westwinespirits.com',
          rawName:  name,
        })
        break
      }
    }

    // Fallback: if card parsing yields nothing, do a raw text scan
    if (found.size === 0) {
      for (const target of CITY_HIVE_TARGETS) {
        if (target.pattern.test(clean)) {
          found.set(target.name, {
            bottle:   target.name,
            retailer: '20 West Wine & Spirits',
            location: 'Lombard, IL',
            inStock:  true,
            price:    null,
            url:      'https://20westwinespirits.com',
          })
        }
      }
    }
  } catch { /* skip */ }
  return [...found.values()]
}

// ─────────────────────────────────────────────────────────────────────────────
// CITY HIVE STORES
// Pages are SSR — products appear as JSON-LD ItemList blocks in raw HTML.
// Merchant MongoDB ObjectIDs (for reference / future direct API use):
//   Joe's Beverage Warehouse:   6060f70c9b020f0191a360bb
//   Malloy's Finest:            62e1b40ca6d57025cc5d8be8
//   Uncork It Chicago:          5a72232ef4a6615179f2288d
//   Kenwood Liquors:            kenwoodliquors.biz (TBD)
//   John's Beverage Warehouse:  69812499c28444433ede928f
//   Greene Valley W&S:          668471fdfd0ce678a5a1b3af
//   Archer Liquors:             619dae8c872ef80ea00d69a4
//   Northshore Wine & Spirits:  63bc86c7bd02f729e676944d
//   Elgin Liquor & Wine:        5e9a33845e5d640d02818ab3
//   Gold Eagle Wine & Spirits:  5b9d2b972275a35cb685aa58
//   D&D Smoke & Spirits:        63c18911e538a829c5d71677
//   Liquor Expo Chicago:        62ccc3cf1dc8b32884ead506
//   Sal's Beverage World:       (Elmhurst subdomain)
// ─────────────────────────────────────────────────────────────────────────────

const CITY_HIVE_STORES = [
  // ── Original stores ───────────────────────────────────────────────────────
  { name: "Joe's Beverage Warehouse",    location: 'Romeoville, IL',                    base: 'https://joesbev.com',                    pages: ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'] },
  { name: "Malloy's Finest",             location: 'Glen Ellyn / Naperville / Lisle, IL', base: 'https://malloysfinest.com',              pages: ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'] },
  { name: 'Uncork It Chicago',           location: 'Chicago, IL',                        base: 'https://uncorkitchicago.com',            pages: ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'] },
  { name: 'Kenwood Liquors',             location: 'Oak Lawn / Chicago, IL',             base: 'https://www.kenwoodliquors.biz',         pages: ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'] },

  // ── South / Southwest suburbs ─────────────────────────────────────────────
  { name: "John's Beverage Warehouse",   location: 'Joliet, IL',                         base: 'https://johnsbev.com',                   pages: ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'] },
  { name: 'Greene Valley Wine & Spirits', location: 'Bolingbrook, IL',                   base: 'https://greenevalleyws.com',             pages: ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'] },
  { name: "Sal's Beverage World",         location: 'Elmhurst / Villa Park / Addison, IL', base: 'https://elmhurst.salsbeverageworld.com', pages: ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'] },

  // ── Chicago city ──────────────────────────────────────────────────────────
  { name: 'Archer Liquors',              location: 'Chicago (SW), IL',                  base: 'https://archerliquors.com',              pages: ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'] },
  { name: 'Liquor Expo Chicago',         location: 'Chicago (Lincoln Park), IL',        base: 'https://myliquorexpo.com',               pages: ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'] },

  // ── North / Northwest suburbs ─────────────────────────────────────────────
  { name: 'Northshore Wine & Spirits',   location: 'Highwood, IL',                      base: 'https://northshorewineandspirit.com',    pages: ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'] },
  { name: 'Gold Eagle Wine & Spirits',   location: 'Libertyville, IL',                  base: 'https://goldeaglewine.com',              pages: ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'] },
  { name: 'D&D Smoke & Spirits',         location: 'Arlington Heights, IL',             base: 'https://ddsmokespirits.com',             pages: ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'] },
  { name: 'Elgin Liquor & Wine',         location: 'Elgin, IL',                         base: 'https://elginliquor.com',                pages: ['/shop/?subtype=whiskey', '/shop/?subtype=bourbon'] },
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
  const [liquorBarn, kegNBottle, twentyWest, cityHive] = await Promise.all([
    checkLiquorBarn(),
    checkKegNBottle(),
    check20West(),
    checkAllCityHiveStores(),
  ])
  return [...liquorBarn, ...kegNBottle, ...twentyWest, ...cityHive]
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
  // ── Shopify stores ────────────────────────────────────────────────────────
  { name: 'Liquor Barn',              location: 'Wheeling / Niles / Vernon Hills, IL', url: 'https://theliquorbarn.com',              lat: 42.1364, lng: -87.9270 },
  { name: 'Keg N Bottle',             location: 'Glenview, IL',                        url: 'https://kegnbottle.com',                 lat: 42.0776, lng: -87.8293 },

  // ── Custom scrapers ───────────────────────────────────────────────────────
  { name: '20 West Wine & Spirits',   location: 'Lombard, IL',                         url: 'https://20westwinespirits.com',          lat: 41.8825, lng: -88.0097 },

  // ── City Hive — Southwest suburbs ────────────────────────────────────────
  { name: "Joe's Beverage Warehouse", location: 'Romeoville, IL',                      url: 'https://joesbev.com',                    lat: 41.6475, lng: -88.0892 },
  { name: "John's Beverage Warehouse", location: 'Joliet, IL',                         url: 'https://johnsbev.com',                   lat: 41.5296, lng: -88.1318 },
  { name: 'Greene Valley Wine & Spirits', location: 'Bolingbrook, IL',                 url: 'https://greenevalleyws.com',             lat: 41.6896, lng: -88.0839 },

  // ── City Hive — West / DuPage suburbs ────────────────────────────────────
  { name: "Malloy's Finest",          location: 'Glen Ellyn / Naperville / Lisle, IL', url: 'https://malloysfinest.com',              lat: 41.8761, lng: -88.0636 },
  { name: "Sal's Beverage World",     location: 'Elmhurst / Villa Park / Addison, IL', url: 'https://www.salsbeverageworld.com',      lat: 41.8592, lng: -87.9718 },

  // ── City Hive — Chicago city ──────────────────────────────────────────────
  { name: 'Uncork It Chicago',        location: 'Chicago, IL',                         url: 'https://uncorkitchicago.com',            lat: 41.8748, lng: -87.6390 },
  { name: 'Archer Liquors',           location: 'Chicago (SW), IL',                   url: 'https://archerliquors.com',              lat: 41.8004, lng: -87.7477 },
  { name: 'Liquor Expo Chicago',      location: 'Chicago (Lincoln Park), IL',          url: 'https://myliquorexpo.com',               lat: 41.9210, lng: -87.6487 },

  // ── City Hive — South Side ────────────────────────────────────────────────
  { name: 'Kenwood Liquors',          location: 'Oak Lawn / Chicago, IL',              url: 'https://www.kenwoodliquors.biz',         lat: 41.7193, lng: -87.7787 },

  // ── City Hive — North / Northwest suburbs ─────────────────────────────────
  { name: 'Northshore Wine & Spirits', location: 'Highwood, IL',                       url: 'https://northshorewineandspirit.com',    lat: 42.2003, lng: -87.8054 },
  { name: 'Gold Eagle Wine & Spirits', location: 'Libertyville, IL',                   url: 'https://goldeaglewine.com',              lat: 42.2808, lng: -87.9577 },
  { name: 'D&D Smoke & Spirits',      location: 'Arlington Heights, IL',               url: 'https://ddsmokespirits.com',             lat: 42.0975, lng: -87.9705 },
  { name: 'Elgin Liquor & Wine',      location: 'Elgin, IL',                           url: 'https://elginliquor.com',                lat: 42.0299, lng: -88.2641 },
]
