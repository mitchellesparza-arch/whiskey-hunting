/**
 * lib/independents/index.js
 *
 * Public API for the Independents feature.
 * Assembles results from all store checkers into a unified format.
 *
 * checkAllRetailers()  — runs all store checks, returns { finds, diagnostics }
 * RETAILERS            — full store registry with coordinates for the map
 */

import { checkLiquorBarn, checkKegNBottle, checkSunsetLiquor, LIQUOR_BARN_LOCATIONS } from './shopify.js'
import { checkAllCityHive, CITY_HIVE_STORES } from './cityhive.js'

// ─── Store registry ───────────────────────────────────────────────────────────
// All independent retailers with coordinates for the map UI.

export const RETAILERS = [
  // Shopify stores — work from anywhere
  { name: 'Liquor Barn (Vernon Hills)', location: 'Vernon Hills, IL', url: 'https://theliquorbarn.com', lat: 42.2319, lng: -87.9615 },
  { name: 'Liquor Barn (Wheeling)',     location: 'Wheeling, IL',     url: 'https://theliquorbarn.com', lat: 42.1393, lng: -87.9278 },
  { name: 'Liquor Barn (Niles)',        location: 'Niles, IL',        url: 'https://theliquorbarn.com', lat: 42.0169, lng: -87.8285 },
  { name: 'Liquor Barn',               location: 'Wheeling/Niles/Vernon Hills, IL', url: 'https://theliquorbarn.com', lat: 42.1364, lng: -87.9270, multiLocation: true, locationNames: ['Wheeling', 'Niles', 'Vernon Hills'] },
  { name: 'Keg N Bottle',  location: 'Glenview, IL',     url: 'https://kegnbottle.com',  lat: 42.0776, lng: -87.8293 },
  { name: 'Sunset Liquor', location: 'Melrose Park, IL', url: 'https://sunsetliquor.us', lat: 41.8997, lng: -87.8572 },

  // City Hive stores (central api.cityhive.net — works from home machine and Vercel)
  { name: "Malloy's Finest (Glen Ellyn)",      location: 'Glen Ellyn, IL',              url: 'https://malloysfinest.com',           lat: 41.8761, lng: -88.0636 },
  { name: "Malloy's Finest (Naperville)",      location: 'Naperville, IL',              url: 'https://malloysfinest.com',           lat: 41.7508, lng: -88.1535 },
  { name: "Malloy's Finest (Lisle)",           location: 'Lisle, IL',                   url: 'https://malloysfinest.com',           lat: 41.7987, lng: -88.0714 },
  { name: "Joe's Beverage Warehouse",          location: 'Romeoville, IL',              url: 'https://joesbev.com',                 lat: 41.6475, lng: -88.0892 },
  { name: "John's Beverage Warehouse",         location: 'Joliet, IL',                  url: 'https://johnsbev.com',                lat: 41.5296, lng: -88.1318 },
  { name: 'Greene Valley Wine & Spirits',      location: 'Bolingbrook, IL',             url: 'https://greenevalleyws.com',          lat: 41.6896, lng: -88.0839 },
  { name: "Sal's Beverage World (Elmhurst)",   location: 'Elmhurst, IL',                url: 'https://elmhurst.salsbeverageworld.com', lat: 41.8592, lng: -87.9718 },
  { name: "Sal's Beverage World (Addison)",    location: 'Addison, IL',                 url: 'https://addison.salsbeverageworld.com',  lat: 41.9299, lng: -88.0081 },
  { name: "Sal's Beverage World (Villa Park)", location: 'Villa Park, IL',              url: 'https://villapark.salsbeverageworld.com', lat: 41.8675, lng: -87.9754 },
  { name: 'Uncork It Chicago',                 location: 'Chicago, IL',                 url: 'https://uncorkitchicago.com',         lat: 41.8748, lng: -87.6390 },
  { name: 'Archer Liquors',                    location: 'Chicago (SW), IL',            url: 'https://archerliquors.com',           lat: 41.8004, lng: -87.7477 },
  { name: 'Liquor Expo Chicago',               location: 'Chicago (Lincoln Park), IL',  url: 'https://myliquorexpo.com',            lat: 41.9210, lng: -87.6487 },
  { name: 'Northshore Wine & Spirits',         location: 'Highwood, IL',                url: 'https://northshorewineandspirit.com', lat: 42.2003, lng: -87.8054 },
  { name: 'Gold Eagle Wine & Spirits',         location: 'Libertyville, IL',            url: 'https://goldeaglewine.com',           lat: 42.2808, lng: -87.9577 },
  { name: 'D&D Smoke & Spirits',               location: 'Arlington Heights, IL',       url: 'https://ddsmokespirits.com',          lat: 42.0975, lng: -87.9705 },
  { name: 'Elgin Liquor & Wine',               location: 'Elgin, IL',                   url: 'https://elginliquor.com',             lat: 42.0299, lng: -88.2641 },
  { name: 'Antioch Fine Wine & Liquors',       location: 'Antioch, IL',                 url: 'https://antiochwine.com',             lat: 42.4778, lng: -88.0945 },
]

const SHOPIFY_CATALOG_SIZES = {
  'Liquor Barn (Vernon Hills)': 100,
  'Liquor Barn (Wheeling)':     100,
  'Liquor Barn (Niles)':        100,
  'Liquor Barn':                100,
  'Keg N Bottle':               70,
  'Sunset Liquor':              65,
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Run all independent retailer checks.
 *
 * All City Hive stores (including Malloy's) now use the central api.cityhive.net
 * endpoint which works from both Vercel and residential IPs.
 *
 * Returns:
 *   finds       — array of { bottle, retailer, location, inStock, price, url, ... }
 *   diagnostics — map of storeName → { accessible, catalogSize, source }
 */
export async function checkAllRetailers() {
  const [liquorBarnFinds, kegNBottleFinds, sunsetLiquorFinds, cityHiveResults] =
    await Promise.all([
      checkLiquorBarn(),
      checkKegNBottle(),
      checkSunsetLiquor(),
      checkAllCityHive(),
    ])

  const cityHiveFinds = cityHiveResults.flatMap(r => r.finds)

  const finds = [
    ...liquorBarnFinds,
    ...kegNBottleFinds,
    ...sunsetLiquorFinds,
    ...cityHiveFinds,
  ]

  const diagnostics = {}

  for (const [name, size] of Object.entries(SHOPIFY_CATALOG_SIZES)) {
    diagnostics[name] = { accessible: true, catalogSize: size, source: 'shopify' }
  }
  for (const loc of LIQUOR_BARN_LOCATIONS) {
    diagnostics[loc.retailer] = { accessible: true, catalogSize: 100, source: 'shopify' }
  }

  for (const { store, finds: _, catalogSize, accessible } of cityHiveResults) {
    diagnostics[store.name] = { accessible, catalogSize, source: 'cityhive' }
  }

  return { finds, diagnostics }
}

export { CITY_HIVE_STORES, LIQUOR_BARN_LOCATIONS }
