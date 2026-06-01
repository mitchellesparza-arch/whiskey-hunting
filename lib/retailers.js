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
 *   • Sunset Liquor        — Melrose Park IL
 *
 * MALLOY'S FINEST — City Hive REST API (per-location, 3 stores)
 *   • Glen Ellyn / Naperville / Lisle IL
 *
 * CITY HIVE stores — JSON-LD ItemList scrape (no browser needed)
 *   • Joe's Beverage Warehouse    — Romeoville IL
 *   • Uncork It Chicago           — Chicago IL
 *   • Kenwood Liquors             — Oak Lawn / Chicago South Side IL
 *   • John's Beverage Warehouse   — Joliet IL
 *   • Greene Valley Wine & Spirits — Bolingbrook IL
 *   • Archer Liquors              — Chicago (S Archer Ave) IL
 *   • Northshore Wine & Spirits   — Highwood IL
 *   • Elgin Liquor & Wine         — Elgin IL
 *   • Gold Eagle Wine & Spirits   — Libertyville IL
 *   • D&D Smoke & Spirits         — Arlington Heights IL
 *   • Liquor Expo Chicago         — Chicago (Lincoln Park) IL
 *   • Sal's Beverage World        — Elmhurst / Villa Park / Addison IL
 *   • Antioch Fine Wine & Liquors — Antioch IL
 */

// ─────────────────────────────────────────────────────────────────────────────
// LIQUOR BARN — Shopify  (theliquorbarn.com)
// Two-step per-location check:
//   1. /products/{slug}.js           → global available flag + variant ID
//   2. /variants/{id}/?section_id=pickup-availability → per-store HTML
// The Section Rendering API is public (no auth) — same request the browser makes.
// Falls back to a single multi-location entry if step 2 is blocked.
// ─────────────────────────────────────────────────────────────────────────────

const LIQUOR_BARN_BASE = 'https://theliquorbarn.com'

const LIQUOR_BARN_LOCATIONS = [
  { key: 'vernon hills', retailer: 'Liquor Barn (Vernon Hills)', location: 'Vernon Hills, IL' },
  { key: 'wheeling',     retailer: 'Liquor Barn (Wheeling)',     location: 'Wheeling, IL' },
  { key: 'niles',        retailer: 'Liquor Barn (Niles)',        location: 'Niles, IL' },
]

function parseLiquorBarnPickup(html, bottleName, price, url, onlineUnavailable = false) {
  const results = []
  const items = html.split('<li>').slice(1)
  for (const item of items) {
    const nameMatch = item.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)
    if (!nameMatch) continue
    const storeName = nameMatch[1].replace(/<[^>]*>/g, '').trim()
    const inStock   = /Pickup available/i.test(item)
    const loc = LIQUOR_BARN_LOCATIONS.find(l => storeName.toLowerCase().includes(l.key))
    if (!loc) continue
    const find = { bottle: bottleName, retailer: loc.retailer, location: loc.location, inStock, price: inStock ? price : null, url }
    if (inStock && onlineUnavailable) find.pickupOnly = true
    results.push(find)
  }
  return results
}

/**
 * Bottles to monitor at Liquor Barn.
 * `slug`  — Shopify product handle (from /products/{slug}.js)
 * `name`  — display name for alerts
 */
const LIQUOR_BARN_BOTTLES = [
  // ── Buffalo Trace / Sazerac ─────────────────────────────────────────────
  { slug: 'eagle-rare-10-year-bourbon',                                   name: 'Eagle Rare 10yr' },
  { slug: 'eagle-rare-12-year-bourbon-750ml',                             name: 'Eagle Rare 12yr' },
  { slug: 'eagle-rare-17-year-kentucky-straight-bourbon-750ml',           name: 'Eagle Rare 17yr' },
  { slug: 'eagle-rare-10-year-liquor-barn-single-barrel-bourbon-750ml',   name: 'Eagle Rare Liquor Barn Single Barrel' },
  { slug: 'blantons-single-barrel-bourbon-750ml',                         name: "Blanton's Original Single Barrel" },
  { slug: 'blantons-gold-edition-bourbon-750ml',                          name: "Blanton's Gold Edition" },
  { slug: 'blantons-straight-from-the-barrel-bourbon-750ml',              name: "Blanton's Straight From The Barrel" },
  { slug: 'weller-special-reserve-750ml-1',                               name: 'Weller Special Reserve' },
  { slug: 'weller-12-year-bourbon',                                       name: 'Weller 12yr' },
  { slug: 'old-weller-107-proof-750ml',                                   name: 'Weller Antique 107' },
  { slug: 'weller-full-proof-750ml',                                      name: 'Weller Full Proof' },
  { slug: 'weller-cypb-craft-your-path-bourbon-750ml',                    name: 'Weller CYPB' },
  { slug: 'weller-single-barrel-bourbon-750ml',                           name: 'Weller Single Barrel' },
  { slug: 'weller-millennium-bourbon-750ml',                              name: 'Weller Millennium' },
  { slug: 'george-t-stagg-bourbon-750ml',                                 name: 'George T. Stagg (BTAC)' },
  { slug: 'william-larue-weller-bourbon-750ml',                           name: 'William Larue Weller (BTAC)' },
  { slug: 'thomas-h-handy-sazerac-straight-rye-whiskey-750ml',            name: 'Thomas H. Handy (BTAC)' },
  { slug: 'sazerac-18-year-rye-whiskey-750ml',                            name: 'Sazerac 18yr (BTAC)' },
  { slug: 'sazerac-rye-6-year-750ml',                                     name: 'Sazerac 6yr Rye' },
  { slug: 'double-eagle-very-rare-bourbon-750ml',                         name: 'Double Eagle Very Rare' },
  { slug: 'rock-hill-farms-single-barrel-bourbon-750ml',                  name: 'Rock Hill Farms' },
  { slug: 'colonel-e-h-taylor-jr-small-batch-750ml',                      name: 'E.H. Taylor Small Batch' },
  { slug: 'colonel-e-h-taylor-jr-single-barrel-bourbon-750ml',            name: 'E.H. Taylor Single Barrel' },
  { slug: 'colonel-e-h-taylor-jr-barrel-proof-bourbon-750ml',             name: 'E.H. Taylor Barrel Proof' },
  { slug: 'colonel-e-h-taylor-jr-straight-rye-whisky-750ml',              name: 'E.H. Taylor Straight Rye' },
  { slug: 'colonel-e-h-taylor-jr-barrel-proof-rye-750ml',                 name: 'E.H. Taylor Barrel Proof Rye' },
  { slug: 'colonel-e-h-taylor-bottled-in-bond-bourbon-750ml',             name: 'E.H. Taylor BIB (BTAC)' },
  { slug: 'buffalo-trace-bourbon-750ml-1',                                 name: 'Buffalo Trace Bourbon' },
  { slug: 'stagg-bourbon-750ml',                                           name: 'Stagg' },
  // ── Van Winkle ───────────────────────────────────────────────────────────
  { slug: 'old-rip-van-winkle-10-year-handmade-bourbon-750ml',            name: 'Old Rip Van Winkle 10yr' },
  { slug: 'pappy-van-winkle-family-reserve-12-year-bourbon-750ml',        name: 'Pappy Van Winkle 12yr (Lot B)' },
  { slug: 'pappy-van-winkle-family-reserve-15-year-bourbon-750ml',        name: 'Pappy Van Winkle 15yr' },
  { slug: 'pappy-van-winkle-family-reserve-20-year-bourbon-750ml',        name: 'Pappy Van Winkle 20yr' },
  { slug: 'pappy-van-winkle-family-reserve-23-year-bourbon-750ml',        name: 'Pappy Van Winkle 23yr' },
  { slug: 'pappy-van-winkle-family-reserve-rye-13-year-750ml',            name: 'PVW Family Reserve Rye 13yr' },
  // ── Heaven Hill ──────────────────────────────────────────────────────────
  { slug: 'old-fitzgerald-9-year-bourbon-100-proof-750ml',                name: 'Old Fitzgerald 9yr BIB' },
  { slug: 'old-fitzgerald-10-year-bourbon-100-proof-750ml',               name: 'Old Fitzgerald 10yr BIB' },
  { slug: 'old-fitzgerald-11-year-bourbon-100-proof-750ml',               name: 'Old Fitzgerald 11yr BIB' },
  { slug: 'elijah-craig-barrel-proof-bourbon-750ml',                      name: 'Elijah Craig Barrel Proof' },
  { slug: 'elijah-craig-15-year-bourbon-750ml',                           name: 'Elijah Craig 15yr' },
  { slug: 'elijah-craig-18-year-bourbon-750ml',                           name: 'Elijah Craig 18yr' },
  { slug: 'elijah-craig-toasted-barrel-bourbon-750ml',                    name: 'Elijah Craig Toasted Barrel' },
  { slug: 'elijah-craig-toasted-private-barrel-bourbon-750ml',            name: 'Elijah Craig Toasted Private Barrel' },
  { slug: 'parker-heritage-collection-bourbon-750ml',                     name: "Parker's Heritage" },
  { slug: 'larceny-barrel-proof-bourbon-750ml',                           name: 'Larceny Barrel Proof' },
  { slug: 'bernheim-original-wheat-whiskey-750ml',                        name: 'Bernheim Wheat Whiskey' },
  { slug: 'heaven-hill-heritage-collection-19-year-bourbon-750ml',        name: 'Heaven Hill Heritage 19yr' },
  { slug: 'heaven-hill-heritage-collection-22-year-bourbon-750ml',        name: 'Heaven Hill Heritage 22yr' },
  { slug: 'heaven-hill-90th-anniversary-bourbon-750ml',                   name: 'Heaven Hill 90th Anniversary' },
  // ── Brown-Forman / Woodford ──────────────────────────────────────────────
  { slug: 'woodford-reserve-batch-proof-bourbon-750ml',                   name: 'Woodford Reserve Batch Proof' },
  { slug: 'woodford-reserve-masters-collection-bourbon-750ml',            name: "Woodford Reserve Master's Collection" },
  { slug: 'old-forester-birthday-bourbon-2025-750ml',                     name: 'Old Forester Birthday Bourbon 2025' },
  { slug: 'old-forester-birthday-bourbon-750ml',                          name: 'Old Forester Birthday Bourbon' },
  { slug: 'old-forester-1924-10-year-bourbon-750ml',                      name: 'Old Forester 1924 10yr' },
  { slug: 'old-forester-117-series-bourbon-750ml',                        name: 'Old Forester 117 Series' },
  { slug: 'old-forester-barrel-proof-select-bourbon-750ml',               name: 'Old Forester Barrel Proof Select' },
  { slug: 'old-charter-oak-bourbon-750ml',                                name: 'Old Charter Oak' },
  { slug: 'king-of-kentucky-16-year-single-barrel-bourbon-750ml',         name: 'King of Kentucky 16yr Single Barrel' },
  { slug: 'king-of-kentucky-small-batch-bourbon-750ml',                   name: 'King of Kentucky Small Batch' },
  // ── Beam Suntory ─────────────────────────────────────────────────────────
  { slug: 'bookers-9-year-bourbon-750ml',                                 name: "Booker's 9yr" },
  { slug: 'bakers-13-year-bourbon-750ml',                                 name: "Baker's 13yr" },
  { slug: 'knob-creek-9-year-single-barrel-bourbon-750ml',                name: 'Knob Creek 9yr Single Barrel' },
  { slug: 'knob-creek-12-year-bourbon-750ml',                             name: 'Knob Creek 12yr' },
  { slug: 'knob-creek-18-year-bourbon-750ml',                             name: 'Knob Creek 18yr' },
  { slug: 'knob-creek-21-year-bourbon-750ml',                             name: 'Knob Creek 21yr' },
  { slug: 'little-book-chapter-bourbon-750ml',                            name: 'Little Book' },
  { slug: 'makers-mark-cellar-aged-bourbon-750ml',                        name: "Maker's Mark Cellar Aged" },
  { slug: 'makers-mark-star-hill-farm-bourbon-750ml',                     name: "Maker's Mark Star Hill Farm" },
  { slug: 'makers-mark-greats-of-the-gate-bourbon-750ml',                 name: "Maker's Mark Greats of the Gate" },
  { slug: 'makers-mark-wood-finishing-series-bourbon-750ml',              name: "Maker's Mark Wood Finishing Series" },
  // ── Campari / Wild Turkey ─────────────────────────────────────────────────
  { slug: 'russells-reserve-single-barrel-bourbon-750ml',                 name: "Russell's Reserve Single Barrel" },
  { slug: 'russells-reserve-2-cycle-bourbon-750ml',                       name: "Russell's Reserve 2-Cycle" },
  { slug: 'russells-reserve-13-year-bourbon-750ml',                       name: "Russell's Reserve 13yr" },
  { slug: 'russells-reserve-15-year-bourbon-750ml',                       name: "Russell's Reserve 15yr" },
  { slug: 'russells-reserve-rickhouse-bourbon-750ml',                     name: "Russell's Reserve Rickhouse" },
  { slug: 'wild-turkey-masters-keep-bourbon-750ml',                       name: "Wild Turkey Master's Keep" },
  { slug: 'wild-turkey-rare-breed-rye-whiskey-750ml',                     name: 'Wild Turkey Rare Breed Rye' },
  // ── Angel's Envy ─────────────────────────────────────────────────────────
  { slug: 'angels-envy-single-barrel-bourbon-750ml',                      name: "Angel's Envy Single Barrel" },
  { slug: 'angels-envy-cask-strength-bourbon-750ml',                      name: "Angel's Envy Cask Strength" },
  // ── Four Roses ───────────────────────────────────────────────────────────
  { slug: 'four-roses-bourbon-single-barrel-select-750ml',                name: 'Four Roses Single Barrel Select' },
  { slug: 'four-roses-2025-limited-edition-small-batch-750ml',            name: 'Four Roses 2025 Limited Edition' },
  // ── Jack Daniel's ────────────────────────────────────────────────────────
  { slug: 'jack-daniels-10-year-tennessee-whiskey-750ml',                 name: "Jack Daniel's 10yr" },
  { slug: 'jack-daniels-12-year-tennessee-whiskey-750ml',                 name: "Jack Daniel's 12yr" },
  { slug: 'jack-daniels-14-year-tennessee-whiskey-750ml',                 name: "Jack Daniel's 14yr" },
  { slug: 'jack-daniels-barrel-proof-rye-750ml',                          name: "Jack Daniel's Barrel Proof Rye" },
  { slug: 'jack-daniels-tanyard-hill-rye-750ml',                          name: "Jack Daniel's Tanyard Hill Rye" },
  { slug: 'jack-daniels-single-barrel-barrel-proof-rye-750ml',            name: "Jack Daniel's Single Barrel BP Rye" },
  // ── Michter's ────────────────────────────────────────────────────────────
  { slug: 'michters-10-year-single-barrel-bourbon-750ml',                 name: "Michter's 10yr Single Barrel" },
  { slug: 'michters-10-year-single-barrel-rye-750ml',                     name: "Michter's 10yr Rye" },
  { slug: 'michters-20-year-bourbon-750ml',                               name: "Michter's 20yr" },
  { slug: 'michters-25-year-bourbon-750ml',                               name: "Michter's 25yr" },
  { slug: 'michters-toasted-barrel-finish-bourbon-750ml',                 name: "Michter's Toasted Barrel" },
  { slug: 'michters-sour-mash-toasted-barrel-whiskey-750ml',              name: "Michter's Sour Mash Toasted" },
  // ── High West ────────────────────────────────────────────────────────────
  { slug: 'high-west-bourye-whiskey-750ml',                               name: 'High West Bourye' },
  { slug: 'high-west-midwinter-nights-dram-whiskey-750ml',                name: "High West Midwinter Night's Dram" },
  { slug: 'high-west-rendezvous-rye-whiskey-750ml',                       name: 'High West Rendezvous Rye' },
  // ── Willett ──────────────────────────────────────────────────────────────
  { slug: 'willett-family-estate-4-year-bourbon-750ml',                   name: 'Willett 4yr' },
  { slug: 'willett-family-estate-8-year-bourbon-750ml',                   name: 'Willett 8yr' },
  { slug: 'willett-last-juice-bourbon-750ml',                             name: 'Willett Last Juice' },
  // ── Peerless ─────────────────────────────────────────────────────────────
  { slug: 'peerless-double-oak-bourbon-750ml',                            name: 'Peerless Double Oak' },
  { slug: 'peerless-single-barrel-bourbon-750ml',                         name: 'Peerless Single Barrel' },
  // ── 1792 ─────────────────────────────────────────────────────────────────
  { slug: '1792-12-year-bourbon-750ml',                                   name: '1792 12yr' },
  { slug: '1792-barrel-select-bourbon-750ml',                             name: '1792 Barrel Select' },
  { slug: '1792-bottled-in-bond-bourbon-750ml',                           name: '1792 Bottled in Bond' },
  { slug: '1792-cognac-finished-bourbon-750ml',                           name: '1792 Cognac Finished' },
  { slug: '1792-single-barrel-bourbon-750ml',                             name: '1792 Single Barrel' },
  // ── Barrell Craft Spirits ────────────────────────────────────────────────
  { slug: 'barrell-bourbon-new-year-2025-750ml',                          name: 'Barrell New Year 2025' },
  { slug: 'barrell-cask-strength-bourbon-750ml',                          name: 'Barrell Cask Strength' },
  { slug: 'barrell-foundation-5-year-bourbon-750ml',                      name: 'Barrell Foundation 5yr' },
  { slug: 'barrell-sherry-cask-finish-bourbon-750ml',                     name: 'Barrell Sherry Cask' },
  { slug: 'barrell-vantage-whiskey-750ml',                                name: 'Barrell Vantage' },
  { slug: 'barrell-armida-whiskey-750ml',                                 name: 'Barrell Armida' },
  // ── Other allocated ──────────────────────────────────────────────────────
  { slug: 'smoke-wagon-uncut-unfiltered-bourbon-750ml',                   name: 'Smoke Wagon Uncut Unfiltered' },
  { slug: 'joseph-magnus-murray-hill-club-bourbon-750ml',                 name: 'Joseph Magnus Murray Hill Club' },
  { slug: 'makers-mark-fae-1-bourbon-750ml',                              name: "Maker's Mark FAE-1" },
  { slug: 'blood-oath-pact-11-bourbon-750ml',                             name: 'Blood Oath Pact 11' },
  { slug: 'blood-oath-pact-12-bourbon-750ml',                             name: 'Blood Oath Pact 12' },
  { slug: 'blade-and-bow-30-year-bourbon-750ml',                          name: 'Blade and Bow 30yr' },
  { slug: 'elmer-t-lee-single-barrel-bourbon-750ml',                      name: 'Elmer T. Lee' },
  { slug: 'new-riff-8-year-bourbon-750ml',                                name: 'New Riff 8yr' },
  { slug: 'old-overholt-12-year-rye-750ml',                               name: 'Old Overholt 12yr' },
  // ── Fortaleza ────────────────────────────────────────────────────────────
  { slug: 'fortaleza-blanco-tequila-750ml',                               name: 'Fortaleza Blanco' },
  { slug: 'fortaleza-reposado-tequila-750ml',                             name: 'Fortaleza Reposado' },
  { slug: 'fortaleza-still-strength-blanco-tequila-750ml',                name: 'Fortaleza Still Strength' },
]

export async function checkLiquorBarn() {
  const results = []

  await Promise.all(LIQUOR_BARN_BOTTLES.map(async (bottle) => {
    try {
      const url = `${LIQUOR_BARN_BASE}/products/${bottle.slug}`

      // Step 1: global availability + variant ID
      const jsRes = await fetch(`${url}.js`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        cache: 'no-store',
      })
      if (!jsRes.ok) return
      const product   = await jsRes.json()

      const rawPrice  = product.variants?.[0]?.price
      const price     = rawPrice != null ? (rawPrice > 500 ? rawPrice / 100 : rawPrice) : null
      const variantId = product.variants?.[0]?.id
      if (!variantId) return

      // Always check per-location pickup — some allocated bottles are in-store only:
      // available=false online (cart grayed out) but physically on the shelf.
      // The Section Rendering API is the definitive per-location source.
      try {
        const pickupRes = await fetch(
          `${LIQUOR_BARN_BASE}/variants/${variantId}/?section_id=pickup-availability`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
            cache: 'no-store',
            signal: AbortSignal.timeout(7000),
          }
        )
        if (pickupRes.ok) {
          const html = await pickupRes.text()
          const locationFinds = parseLiquorBarnPickup(html, bottle.name, price, url, !product.available)
          if (locationFinds.length > 0) results.push(...locationFinds)
          // Pickup endpoint responded → it's authoritative; skip fallback regardless
          return
        }
      } catch { /* fall through */ }

      // Fallback: pickup endpoint unreachable — only surface if globally available
      if (!product.available) return
      results.push({
        bottle:   bottle.name,
        retailer: 'Liquor Barn',
        location: 'Wheeling / Niles / Vernon Hills, IL',
        inStock:  true,
        price,
        url,
      })
    } catch { /* skip */ }
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
  // ── Buffalo Trace / Sazerac ─────────────────────────────────────────────
  { slug: 'eagle-rare-kentucky-straight-bourbon',                         name: 'Eagle Rare 10yr' },
  { slug: 'eagle-rare-10-year-keg-n-bottle-barrel-pick-whiskey-375ml',   name: 'Eagle Rare Keg N Bottle Barrel Pick' },
  { slug: 'blantons-original-single-barrel-bourbon-750-ml',               name: "Blanton's Original Single Barrel" },
  { slug: 'blantons-gold-edition-bourbon-750-ml',                         name: "Blanton's Gold Edition" },
  { slug: 'blantons-straight-from-the-barrel-bourbon-750-ml',             name: "Blanton's Straight From The Barrel" },
  { slug: 'w-l-weller-special-reserve-750-ml',                            name: 'Weller Special Reserve' },
  { slug: 'weller-12-year-bourbon-750-ml',                                name: 'Weller 12yr' },
  { slug: 'old-weller-antique-107-wheated-bourbon-750-ml',                name: 'Weller Antique 107' },
  { slug: 'weller-full-proof-bourbon-750-ml',                             name: 'Weller Full Proof' },
  { slug: 'weller-cypb-craft-your-path-bourbon-750-ml',                   name: 'Weller CYPB' },
  { slug: 'weller-single-barrel-bourbon-750-ml',                          name: 'Weller Single Barrel' },
  { slug: 'weller-millennium-bourbon-750-ml',                             name: 'Weller Millennium' },
  { slug: 'george-t-stagg-barrel-proof-bourbon-whiskey-750-ml',           name: 'George T. Stagg (BTAC)' },
  { slug: 'william-larue-weller-bourbon-750-ml',                          name: 'William Larue Weller (BTAC)' },
  { slug: 'thomas-h-handy-sazerac-straight-rye-whiskey-750-ml',           name: 'Thomas H. Handy (BTAC)' },
  { slug: 'sazerac-18-year-rye-whiskey-750-ml',                           name: 'Sazerac 18yr (BTAC)' },
  { slug: 'rock-hill-farms-single-barrel-bourbon-750-ml',                 name: 'Rock Hill Farms' },
  { slug: 'colonel-e-h-taylor-small-batch-bourbon-750-ml',                name: 'E.H. Taylor Small Batch' },
  { slug: 'colonel-e-h-taylor-single-barrel-bourbon-750-ml',              name: 'E.H. Taylor Single Barrel' },
  { slug: 'colonel-e-h-taylor-barrel-proof-bourbon-750-ml',               name: 'E.H. Taylor Barrel Proof' },
  { slug: 'buffalo-trace',                                                 name: 'Buffalo Trace Bourbon' },
  { slug: 'stagg-bourbon-750-ml',                                          name: 'Stagg' },
  // ── Van Winkle ───────────────────────────────────────────────────────────
  { slug: 'old-rip-van-winkle-10-year-bourbon-750-ml',                    name: 'Old Rip Van Winkle 10yr' },
  { slug: 'pappy-van-winkle-family-reserve-12-year-bourbon-750-ml',       name: 'Pappy Van Winkle 12yr (Lot B)' },
  { slug: 'pappy-van-winkle-family-reserve-15-year-bourbon-750-ml',       name: 'Pappy Van Winkle 15yr' },
  { slug: 'pappy-van-winkle-family-reserve-20-year-bourbon-750-ml',       name: 'Pappy Van Winkle 20yr' },
  { slug: 'pappy-van-winkle-family-reserve-23-year-bourbon-750-ml',       name: 'Pappy Van Winkle 23yr' },
  // ── Heaven Hill ──────────────────────────────────────────────────────────
  { slug: 'old-fitzgerald-7-year-bottled-in-bond-bourbon-750-ml',         name: 'Old Fitzgerald BIB' },
  { slug: 'old-fitzgerald-9-year-bottled-in-bond-bourbon-750-ml',         name: 'Old Fitzgerald 9yr BIB' },
  { slug: 'old-fitzgerald-10-year-bottled-in-bond-bourbon-750-ml',        name: 'Old Fitzgerald 10yr BIB' },
  { slug: 'elijah-craig-barrel-proof-bourbon-750-ml',                     name: 'Elijah Craig Barrel Proof' },
  { slug: 'elijah-craig-18-year-bourbon-750-ml',                          name: 'Elijah Craig 18yr' },
  { slug: 'parker-heritage-collection-bourbon-750-ml',                    name: "Parker's Heritage" },
  { slug: 'heaven-hill-heritage-collection-bourbon-750-ml',               name: 'Heaven Hill Heritage' },
  // ── Brown-Forman / Woodford ──────────────────────────────────────────────
  { slug: 'woodford-reserve-batch-proof-bourbon-750-ml',                  name: 'Woodford Reserve Batch Proof' },
  { slug: 'woodford-reserve-masters-collection-bourbon-750-ml',           name: "Woodford Reserve Master's Collection" },
  { slug: 'old-forester-birthday-bourbon-750-ml',                         name: 'Old Forester Birthday Bourbon' },
  { slug: 'old-forester-1924-10-year-bourbon-750-ml',                     name: 'Old Forester 1924 10yr' },
  { slug: 'king-of-kentucky-16-year-single-barrel-bourbon-750-ml',        name: 'King of Kentucky 16yr' },
  // ── Beam Suntory ─────────────────────────────────────────────────────────
  { slug: 'bookers-9-year-bourbon-750-ml',                                name: "Booker's 9yr" },
  { slug: 'bakers-13-year-bourbon-750-ml',                                name: "Baker's 13yr" },
  { slug: 'knob-creek-9-year-single-barrel-bourbon-750-ml',               name: 'Knob Creek 9yr Single Barrel' },
  { slug: 'knob-creek-12-year-bourbon-750-ml',                            name: 'Knob Creek 12yr' },
  { slug: 'knob-creek-18-year-bourbon-750-ml',                            name: 'Knob Creek 18yr' },
  { slug: 'knob-creek-21-year-bourbon-750-ml',                            name: 'Knob Creek 21yr' },
  { slug: 'little-book-bourbon-750-ml',                                   name: 'Little Book' },
  // ── Campari / Wild Turkey ─────────────────────────────────────────────────
  { slug: 'russells-reserve-single-barrel-bourbon-750-ml',                name: "Russell's Reserve Single Barrel" },
  { slug: 'russells-reserve-2-cycle-bourbon-750-ml',                      name: "Russell's Reserve 2-Cycle" },
  { slug: 'russells-reserve-rickhouse-bourbon-750-ml',                    name: "Russell's Reserve Rickhouse" },
  { slug: 'russells-reserve-13-year-bourbon-750-ml',                      name: "Russell's Reserve 13yr" },
  { slug: 'russells-reserve-15-year-bourbon-750-ml',                      name: "Russell's Reserve 15yr" },
  { slug: 'wild-turkey-masters-keep-bourbon-750-ml',                      name: "Wild Turkey Master's Keep" },
  { slug: 'wild-turkey-rare-breed-rye-whiskey-750-ml',                    name: 'Wild Turkey Rare Breed Rye' },
  // ── Jack Daniel's ────────────────────────────────────────────────────────
  { slug: 'jack-daniels-10-year-tennessee-whiskey-750-ml',                name: "Jack Daniel's 10yr" },
  { slug: 'jack-daniels-12-year-tennessee-whiskey-750-ml',                name: "Jack Daniel's 12yr" },
  // ── Four Roses ───────────────────────────────────────────────────────────
  { slug: 'four-roses-limited-edition-small-batch-135th-anniversary-bourbon-whiskey-750-ml', name: 'Four Roses Limited Edition' },
  { slug: 'four-roses-bourbon-single-barrel-select-750-ml',               name: 'Four Roses Single Barrel Select' },
  // ── Michter's ────────────────────────────────────────────────────────────
  { slug: 'michters-10-year-single-barrel-bourbon-750-ml',                name: "Michter's 10yr Single Barrel" },
  { slug: 'michters-20-year-bourbon-750-ml',                              name: "Michter's 20yr" },
  { slug: 'michters-25-year-bourbon-750-ml',                              name: "Michter's 25yr" },
  // ── Angel's Envy ─────────────────────────────────────────────────────────
  { slug: 'angels-envy-cask-strength-bourbon-750-ml',                     name: "Angel's Envy Cask Strength" },
  { slug: 'angels-envy-single-barrel-bourbon-750-ml',                     name: "Angel's Envy Single Barrel" },
  // ── Peerless ─────────────────────────────────────────────────────────────
  { slug: 'peerless-double-oak-bourbon-750-ml',                           name: 'Peerless Double Oak' },
  { slug: 'peerless-single-barrel-bourbon-750-ml',                        name: 'Peerless Single Barrel' },
  // ── High West ────────────────────────────────────────────────────────────
  { slug: 'high-west-midwinter-nights-dram-whiskey-750-ml',               name: "High West Midwinter Night's Dram" },
  { slug: 'high-west-bourye-whiskey-750-ml',                              name: 'High West Bourye' },
  { slug: 'high-west-rendezvous-rye-whiskey-750-ml',                      name: 'High West Rendezvous Rye' },
  // ── Willett ──────────────────────────────────────────────────────────────
  { slug: 'willett-family-estate-4-year-bourbon-750-ml',                  name: 'Willett 4yr' },
  { slug: 'willett-family-estate-8-year-bourbon-750-ml',                  name: 'Willett 8yr' },
  { slug: 'willett-last-juice-bourbon-750-ml',                            name: 'Willett Last Juice' },
]

export async function checkKegNBottle() {
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
// SUNSET LIQUOR — Shopify  (sunsetliquor.us) — Melrose Park IL
// Eagle Rare confirmed available: true via .js endpoint.
// ─────────────────────────────────────────────────────────────────────────────

const SUNSET_LIQUOR_BASE = 'https://sunsetliquor.us'

const SUNSET_LIQUOR_BOTTLES = [
  // ── Buffalo Trace / Sazerac ─────────────────────────────────────────────
  { slug: 'eagle-rare-10-years-750ml',                          name: 'Eagle Rare 10yr' },
  { slug: 'eagle-rare-12-year-bourbon',                         name: 'Eagle Rare 12yr' },
  { slug: 'blantons-original-single-barrel-bourbon-750ml',      name: "Blanton's Original Single Barrel" },
  { slug: 'blantons-gold-edition',                              name: "Blanton's Gold Edition" },
  { slug: 'blantons-straight-from-the-barrel-750ml',            name: "Blanton's Straight From The Barrel" },
  { slug: 'weller-special-reserve-bourbon',                     name: 'Weller Special Reserve' },
  { slug: 'weller-12-year',                                     name: 'Weller 12yr' },
  { slug: 'old-weller-antique-107',                             name: 'Weller Antique 107' },
  { slug: 'weller-full-proof-bourbon-750ml',                    name: 'Weller Full Proof' },
  { slug: 'weller-cypb-750ml',                                  name: 'Weller CYPB' },
  { slug: 'weller-single-barrel-bourbon-750ml',                 name: 'Weller Single Barrel' },
  { slug: 'george-t-stagg-barrel-proof-bourbon-750ml',          name: 'George T. Stagg (BTAC)' },
  { slug: 'william-larue-weller-bourbon-750ml',                 name: 'William Larue Weller (BTAC)' },
  { slug: 'thomas-h-handy-sazerac-rye-750ml',                   name: 'Thomas H. Handy (BTAC)' },
  { slug: 'sazerac-18-year-rye-750ml',                          name: 'Sazerac 18yr (BTAC)' },
  { slug: 'e-h-taylor-small-batch-bourbon',                     name: 'E.H. Taylor Small Batch' },
  { slug: 'e-h-taylor-single-barrel-bourbon-750ml',             name: 'E.H. Taylor Single Barrel' },
  { slug: 'e-h-taylor-barrel-proof-bourbon-750ml',              name: 'E.H. Taylor Barrel Proof' },
  { slug: 'rock-hill-farms-single-barrel-bourbon-750ml',        name: 'Rock Hill Farms' },
  { slug: 'stagg-bourbon-750ml',                               name: 'Stagg' },
  // ── Van Winkle ───────────────────────────────────────────────────────────
  { slug: 'old-rip-van-winkle-10-year-2024',                   name: 'Old Rip Van Winkle 10yr' },
  { slug: 'pappy-van-winkle-family-reserve-12-year',            name: 'Pappy Van Winkle 12yr' },
  { slug: 'pappy-van-winkle-family-reserve-15-year-2024',      name: 'Pappy Van Winkle 15yr' },
  { slug: 'pappy-van-winkle-family-reserve-20-year',            name: 'Pappy Van Winkle 20yr' },
  { slug: 'pappy-van-winkle-family-reserve-23-year',            name: 'Pappy Van Winkle 23yr' },
  { slug: 'pvw-family-reserve-rye-13-year-750ml',               name: 'PVW Family Reserve Rye 13yr' },
  // ── Heaven Hill ──────────────────────────────────────────────────────────
  { slug: 'old-fitzgerald-9-year-bib-bourbon-750ml',            name: 'Old Fitzgerald 9yr BIB' },
  { slug: 'old-fitzgerald-10-year-bib-bourbon-750ml',           name: 'Old Fitzgerald 10yr BIB' },
  { slug: 'old-fitzgerald-11-year-bib-bourbon-750ml',           name: 'Old Fitzgerald 11yr BIB' },
  { slug: 'elijah-craig-barrel-proof-bourbon-750ml',            name: 'Elijah Craig Barrel Proof' },
  { slug: 'elijah-craig-18-year-bourbon-750ml',                 name: 'Elijah Craig 18yr' },
  { slug: 'parker-heritage-collection-bourbon-750ml',           name: "Parker's Heritage" },
  { slug: 'larceny-barrel-proof-bourbon-750ml',                 name: 'Larceny Barrel Proof' },
  // ── Brown-Forman / Woodford ──────────────────────────────────────────────
  { slug: 'woodford-reserve-batch-proof-bourbon-750ml',         name: 'Woodford Reserve Batch Proof' },
  { slug: 'woodford-reserve-masters-collection-bourbon-750ml',  name: "Woodford Reserve Master's Collection" },
  { slug: 'old-forester-birthday-bourbon-2025',                 name: 'Old Forester Birthday Bourbon 2025' },
  { slug: 'old-forester-1924-10-year-bourbon-750ml',            name: 'Old Forester 1924 10yr' },
  { slug: 'king-of-kentucky-16-year-bourbon-750ml',             name: 'King of Kentucky 16yr' },
  // ── Beam Suntory ─────────────────────────────────────────────────────────
  { slug: 'bookers-9-year-bourbon-750ml',                       name: "Booker's 9yr" },
  { slug: 'bakers-13-year-bourbon-750ml',                       name: "Baker's 13yr" },
  { slug: 'knob-creek-9-year-single-barrel-bourbon-750ml',      name: 'Knob Creek 9yr Single Barrel' },
  { slug: 'knob-creek-12-year-bourbon-750ml',                   name: 'Knob Creek 12yr' },
  { slug: 'knob-creek-18-year-bourbon-750ml',                   name: 'Knob Creek 18yr' },
  { slug: 'knob-creek-21-year-bourbon-750ml',                   name: 'Knob Creek 21yr' },
  { slug: 'little-book-bourbon-750ml',                          name: 'Little Book' },
  // ── Campari / Wild Turkey ─────────────────────────────────────────────────
  { slug: 'russells-reserve-single-barrel-bourbon-750ml',       name: "Russell's Reserve Single Barrel" },
  { slug: 'russells-reserve-2-cycle-bourbon-750ml',             name: "Russell's Reserve 2-Cycle" },
  { slug: 'russells-reserve-rickhouse-bourbon-750ml',           name: "Russell's Reserve Rickhouse" },
  { slug: 'russells-reserve-13-year-bourbon-750ml',             name: "Russell's Reserve 13yr" },
  { slug: 'russells-reserve-15-year-bourbon-750ml',             name: "Russell's Reserve 15yr" },
  { slug: 'wild-turkey-masters-keep-bourbon-750ml',             name: "Wild Turkey Master's Keep" },
  { slug: 'wild-turkey-rare-breed-rye-750ml',                   name: 'Wild Turkey Rare Breed Rye' },
  // ── Four Roses ───────────────────────────────────────────────────────────
  { slug: 'four-roses-single-barrel-select-bourbon-750ml',      name: 'Four Roses Single Barrel Select' },
  { slug: 'four-roses-2025-limited-edition-small-batch-750ml',  name: 'Four Roses 2025 Limited Edition' },
  // ── Michter's ────────────────────────────────────────────────────────────
  { slug: 'michters-10-year-single-barrel-bourbon-750ml',       name: "Michter's 10yr Single Barrel" },
  { slug: 'michters-20-year-bourbon-750ml',                     name: "Michter's 20yr" },
  { slug: 'michters-25-year-bourbon-750ml',                     name: "Michter's 25yr" },
  // ── Angel's Envy ─────────────────────────────────────────────────────────
  { slug: 'angels-envy-cask-strength-bourbon-750ml',            name: "Angel's Envy Cask Strength" },
  { slug: 'angels-envy-single-barrel-bourbon-750ml',            name: "Angel's Envy Single Barrel" },
  // ── Peerless ─────────────────────────────────────────────────────────────
  { slug: 'peerless-double-oak-bourbon-750ml',                  name: 'Peerless Double Oak' },
  { slug: 'peerless-single-barrel-bourbon-750ml',               name: 'Peerless Single Barrel' },
  // ── High West ────────────────────────────────────────────────────────────
  { slug: 'high-west-bourye-whiskey-750ml',                     name: 'High West Bourye' },
  { slug: 'high-west-midwinter-nights-dram-whiskey-750ml',      name: "High West Midwinter Night's Dram" },
  { slug: 'high-west-rendezvous-rye-whiskey-750ml',             name: 'High West Rendezvous Rye' },
  // ── Willett ──────────────────────────────────────────────────────────────
  { slug: 'willett-4-year-family-estate-bourbon-750ml',         name: 'Willett 4yr' },
  { slug: 'willett-8-year-family-estate-bourbon-750ml',         name: 'Willett 8yr' },
  { slug: 'willett-last-juice-bourbon-750ml',                   name: 'Willett Last Juice' },
  // ── Fortaleza ────────────────────────────────────────────────────────────
  { slug: 'fortaleza-blanco-tequila-750ml',                     name: 'Fortaleza Blanco' },
  { slug: 'fortaleza-reposado-tequila-750ml',                   name: 'Fortaleza Reposado' },
  { slug: 'fortaleza-still-strength-blanco-tequila-750ml',      name: 'Fortaleza Still Strength' },
]

export async function checkSunsetLiquor() {
  const results = []
  await Promise.all(SUNSET_LIQUOR_BOTTLES.map(async (bottle) => {
    try {
      const res = await fetch(`${SUNSET_LIQUOR_BASE}/products/${bottle.slug}.js`, {
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
        retailer: 'Sunset Liquor',
        location: 'Melrose Park, IL',
        inStock,
        price,
        url: `${SUNSET_LIQUOR_BASE}/products/${bottle.slug}`,
      })
    } catch { /* skip */ }
  }))
  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// MALLOY'S FINEST — City Hive REST API  (malloysfinest.com)
// 3 locations with per-store inventory via the City Hive products API.
// Absence from merchants[] = OOS at that location.
// ─────────────────────────────────────────────────────────────────────────────

const MALLOYS_API_KEY = '7508df878a8c7566a880e4d3f7fa7972'
const MALLOYS_BASE    = 'https://malloysfinest.com'

const MALLOYS_LOCATIONS = [
  { id: '61e1be9b0948c175812f04b5', name: "Malloy's Finest (Glen Ellyn)",  location: 'Glen Ellyn, IL' },
  { id: '61e1eb34695ac77714231544', name: "Malloy's Finest (Naperville)", location: 'Naperville, IL' },
  { id: '61e1f5e5afafbc5148d1b92b', name: "Malloy's Finest (Lisle)",      location: 'Lisle, IL' },
]

export async function checkMalloysFinest() {
  const found = new Map()
  try {
    const params = new URLSearchParams()
    params.set('api_key', MALLOYS_API_KEY)
    params.set('local', 'true')
    params.set('per_page', '500')
    params.append('additional_properties[subtype][]', 'bourbon')
    params.append('additional_properties[subtype][]', 'whiskey')
    MALLOYS_LOCATIONS.forEach(l => params.append('merchant_ids[]', l.id))

    const res = await fetch(`${MALLOYS_BASE}/api/v1/products/search.json?${params}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) return []
    const data = await res.json()

    const locById = Object.fromEntries(MALLOYS_LOCATIONS.map(l => [l.id, l]))

    for (const product of (data.products ?? [])) {
      const name = product.name?.trim()
      if (!name) continue

      let matchedTarget = null
      for (const target of CITY_HIVE_TARGETS) {
        if (target.pattern.test(name)) { matchedTarget = target; break }
      }
      if (!matchedTarget) continue

      const merchantById = Object.fromEntries(
        (product.merchants ?? []).map(m => [m.merchant_id, m])
      )
      for (const loc of MALLOYS_LOCATIONS) {
        const merchant = merchantById[loc.id]
        if (!merchant) continue

        const key = `${loc.id}:${matchedTarget.name}`
        if (found.has(key)) continue

        const option = merchant.product_options?.[0]
        const qty    = option?.quantity ?? null
        const price  = option?.price != null ? parseFloat(option.price) : null

        found.set(key, {
          bottle:   matchedTarget.name,
          retailer: loc.name,
          location: loc.location,
          inStock:  true,
          price,
          quantity: qty,
          url:      `${MALLOYS_BASE}/shop/`,
          rawName:  name,
        })
      }
    }
  } catch { /* skip */ }
  return [...found.values()]
}

// ─────────────────────────────────────────────────────────────────────────────
// CITY HIVE STORES
// Stores with a merchantId use the REST API (full catalog, same key as Malloy's).
// Stores without merchantId fall back to JSON-LD HTML scraping.
// ─────────────────────────────────────────────────────────────────────────────

const CITY_HIVE_API_KEY = '7508df878a8c7566a880e4d3f7fa7972'

const SHOP_PAGES = ['/shop/?subtype=whiskey&per_page=500', '/shop/?subtype=bourbon&per_page=500']

const CITY_HIVE_STORES = [
  // API attempts use store.base; all currently 403'd by Cloudflare from Vercel IPs.
  // pages[] gives the HTML fallback real URLs to scrape when the API is blocked.
  { name: "Joe's Beverage Warehouse",    location: 'Romeoville, IL',              base: 'https://joesbev.com',                  merchantId: '6060f70c9b020f0191a360bb', pages: SHOP_PAGES },
  { name: 'Uncork It Chicago',           location: 'Chicago, IL',                  base: 'https://uncorkitchicago.com',          merchantId: '5a72232ef4a6615179f2288d', pages: SHOP_PAGES },
  { name: "John's Beverage Warehouse",   location: 'Joliet, IL',                   base: 'https://johnsbev.com',                 merchantId: '69812499c28444433ede928f', pages: SHOP_PAGES },
  { name: 'Greene Valley Wine & Spirits', location: 'Bolingbrook, IL',             base: 'https://greenevalleyws.com',           merchantId: '668471fdfd0ce678a5a1b3af', pages: SHOP_PAGES },
  { name: 'Archer Liquors',              location: 'Chicago (SW), IL',             base: 'https://archerliquors.com',            merchantId: '619dae8c872ef80ea00d69a4', pages: SHOP_PAGES },
  { name: 'Liquor Expo Chicago',         location: 'Chicago (Lincoln Park), IL',   base: 'https://myliquorexpo.com',             merchantId: '62ccc3cf1dc8b32884ead506', pages: SHOP_PAGES },
  { name: 'Northshore Wine & Spirits',   location: 'Highwood, IL',                 base: 'https://northshorewineandspirit.com',  merchantId: '63bc86c7bd02f729e676944d', pages: SHOP_PAGES },
  { name: 'Gold Eagle Wine & Spirits',   location: 'Libertyville, IL',             base: 'https://goldeaglewine.com',            merchantId: '5b9d2b972275a35cb685aa58', pages: SHOP_PAGES },
  { name: 'D&D Smoke & Spirits',         location: 'Arlington Heights, IL',        base: 'https://ddsmokespirits.com',           merchantId: '63c18911e538a829c5d71677', pages: SHOP_PAGES },
  { name: 'Elgin Liquor & Wine',         location: 'Elgin, IL',                    base: 'https://elginliquor.com',              merchantId: '5e9a33845e5d640d02818ab3', pages: SHOP_PAGES },
  { name: "Sal's Beverage World (Villa Park)", location: 'Villa Park, IL', base: 'https://villapark.salsbeverageworld.com', merchantId: '67b3483b6903ea296d576738', pages: SHOP_PAGES },
  { name: "Sal's Beverage World (Elmhurst)",   location: 'Elmhurst, IL',   base: 'https://elmhurst.salsbeverageworld.com',  merchantId: '6414e185752b862a94911cff', pages: SHOP_PAGES },
  { name: "Sal's Beverage World (Addison)",    location: 'Addison, IL',    base: 'https://addison.salsbeverageworld.com',   merchantId: '66228616d1c0852947bc439f', pages: SHOP_PAGES },
  { name: 'Antioch Fine Wine & Liquors',       location: 'Antioch, IL',    base: 'https://antiochwine.com',                merchantId: '59810104d05b4360e32fac36', pages: SHOP_PAGES },
]

/**
 * Allocated bottle patterns to flag in City Hive HTML.
 * Each entry: { pattern (RegExp), name (canonical display name) }
 */
const CITY_HIVE_TARGETS = [
  // ── Buffalo Trace / Sazerac ─────────────────────────────────────────────
  { pattern: /eagle\s*rare/i,                              name: 'Eagle Rare' },
  // Fixed: "Blanton's The Original..." has 'The' between brand and descriptor
  { pattern: /blanton'?s/i,                                name: "Blanton's" },
  { pattern: /weller\s+special\s+reserve/i,                name: 'Weller Special Reserve' },
  { pattern: /weller\s+12/i,                               name: 'Weller 12yr' },
  { pattern: /weller\s+antique/i,                          name: 'Weller Antique 107' },
  { pattern: /weller\s+full\s+proof/i,                     name: 'Weller Full Proof' },
  { pattern: /weller\s+(cypb|craft\s+your\s+path)/i,       name: 'Weller CYPB' },
  { pattern: /william\s+larue\s+weller/i,                  name: 'William Larue Weller (BTAC)' },
  { pattern: /george\s+t[\.\s]+stagg(?!\s+jr)/i,           name: 'George T. Stagg (BTAC)' },
  { pattern: /stagg\s+jr/i,                                name: 'Stagg Jr.' },
  { pattern: /\bstagg\b/i,                                 name: 'Stagg' },
  { pattern: /thomas\s+h[\.\s]+handy/i,                    name: 'Thomas H. Handy (BTAC)' },
  { pattern: /sazerac\s+18/i,                              name: 'Sazerac 18yr (BTAC)' },
  { pattern: /e\.?h\.?\s*taylor/i,                         name: 'E.H. Taylor' },
  { pattern: /colonel\s+e\.?h\.?\s*taylor/i,               name: 'E.H. Taylor' },
  { pattern: /rock\s+hill\s+farms/i,                       name: 'Rock Hill Farms' },
  { pattern: /old\s+charter\s+oak/i,                       name: 'Old Charter Oak' },
  // ── Van Winkle ────────────────────────────────────────────────────────
  { pattern: /pappy\s+van\s+winkle/i,                      name: 'Pappy Van Winkle' },
  { pattern: /van\s+winkle/i,                              name: 'Van Winkle' },
  { pattern: /old\s+rip\s+van\s+winkle/i,                  name: 'Old Rip Van Winkle 10yr' },
  // ── Heaven Hill ───────────────────────────────────────────────────────
  { pattern: /old\s+fitzgerald\s+(bottle|bottled|bib|b-i-b|\d)/i, name: 'Old Fitzgerald BIB' },
  { pattern: /elijah\s+craig\s+(barrel\s+proof|bp)/i,      name: 'Elijah Craig Barrel Proof' },
  { pattern: /elijah\s+craig\s+(15|18)\s*yr/i,             name: 'Elijah Craig Limited' },
  { pattern: /parker'?s\s+heritage/i,                      name: "Parker's Heritage" },
  { pattern: /larceny\s+barrel\s+proof/i,                  name: 'Larceny Barrel Proof' },
  { pattern: /heaven\s+hill\s+(heritage|9[05]th)/i,        name: 'Heaven Hill Heritage' },
  // ── Brown-Forman ──────────────────────────────────────────────────────
  { pattern: /old\s+forester\s+(birthday|117|1924|barrel\s+proof)/i, name: 'Old Forester Limited' },
  { pattern: /king\s+of\s+kentucky/i,                      name: 'King of Kentucky' },
  { pattern: /jack\s+daniel'?s\s+(10|12|14)\s*yr/i,        name: "Jack Daniel's Limited" },
  { pattern: /jack\s+daniel'?s\s+(barrel\s+proof|tanyard|coy\s+hill)/i, name: "Jack Daniel's Limited" },
  // ── Beam Suntory ──────────────────────────────────────────────────────
  { pattern: /booker'?s\s+(9|bourbon)/i,                   name: "Booker's Bourbon" },
  { pattern: /knob\s+creek\s+(12|18|21)/i,                  name: 'Knob Creek Limited' },
  { pattern: /little\s+book/i,                             name: 'Little Book' },
  { pattern: /baker'?s\s+13/i,                             name: "Baker's 13yr" },
  { pattern: /maker'?s\s+mark\s+(cellar|star\s+hill|greats|wood\s+finish|cask|fae|french)/i, name: "Maker's Mark Limited" },
  // ── Campari / Wild Turkey ─────────────────────────────────────────────
  { pattern: /russell'?s\s+reserve\s+(13|15|rickhouse)/i,  name: "Russell's Reserve Limited" },
  { pattern: /wild\s+turkey\s+(master|rare\s+breed\s+barrel)/i, name: "Wild Turkey Limited" },
  // ── Bacardi / Angel's Envy ─────────────────────────────────────────────
  { pattern: /angel'?s\s+envy\s+(cask|single\s+barrel)/i,  name: "Angel's Envy Limited" },
  // ── RNDC / Four Roses ────────────────────────────────────────────────
  { pattern: /four\s+roses\s+(limited|single\s+barrel|small\s+batch|barrel\s+proof|\d{4}|obs[a-z])/i, name: 'Four Roses Limited' },
  // ── WhistlePig ────────────────────────────────────────────────────────
  { pattern: /whistlepig\s+(18|the\s+boss)/i,              name: 'WhistlePig Limited' },
  // ── Michter's ─────────────────────────────────────────────────────────
  { pattern: /michter'?s\s+(10|20|25)\s*yr/i,              name: "Michter's Limited" },
  { pattern: /michter'?s\s+(toasted|sour\s+mash)/i,        name: "Michter's Toasted" },
  { pattern: /michter'?s\s+us[\*\s]*1/i,                   name: "Michter's US*1" },
  // ── BC Merchants / Barrell / Willett ─────────────────────────────────
  { pattern: /barrell\s+(seagrass|dovetail|vantage|cask\s+strength|sherry|foundation|new\s+year|armida)/i, name: 'Barrell Limited' },
  { pattern: /willett\s+(family\s+estate|\d+\s*yr|pot\s+still\s+reserve|last\s+juice)/i, name: 'Willett Limited' },
  { pattern: /peerless\s+(double\s+oak|single\s+barrel|barrel\s+proof|straight)/i, name: 'Peerless' },
  // ── Worth watching ────────────────────────────────────────────────────
  { pattern: /new\s+riff\s+\d+\s*yr/i,                     name: 'New Riff Limited' },
  { pattern: /blood\s+oath\s+pact/i,                        name: 'Blood Oath Pact' },
  { pattern: /blade\s+and\s+bow\s+30/i,                     name: 'Blade and Bow 30yr' },
  { pattern: /elmer\s+t[\.\s]+lee/i,                        name: 'Elmer T. Lee' },
  { pattern: /high\s+west\s+(bourye|midwinter|rendezvous)/i, name: 'High West Limited' },
  { pattern: /elijah\s+craig\s+toasted/i,                   name: 'Elijah Craig Toasted' },
  { pattern: /weller\s+single\s+barrel/i,                   name: 'Weller Single Barrel' },
  { pattern: /weller\s+millennium/i,                        name: 'Weller Millennium' },
  { pattern: /wild\s+turkey\s+rare\s+breed\s+rye/i,         name: 'Wild Turkey Rare Breed Rye' },
  { pattern: /bernheim\s+wheat/i,                           name: 'Bernheim Wheat Whiskey' },
  { pattern: /double\s+eagle\s+very\s+rare/i,              name: 'Double Eagle Very Rare' },
  { pattern: /sazerac\s+6/i,                               name: 'Sazerac 6yr Rye' },
  { pattern: /old\s+overholt\s+12/i,                       name: 'Old Overholt 12yr' },
  { pattern: /1792\s+(12|barrel\s+select|bottled|single|cognac)/i, name: '1792 Limited' },
  { pattern: /fortaleza/i,                                  name: 'Fortaleza' },
  // ── Brown-Forman / Woodford ───────────────────────────────────────────
  { pattern: /woodford\s+reserve\s+batch\s+proof/i,         name: 'Woodford Reserve Batch Proof' },
  { pattern: /woodford\s+reserve\s+master'?s\s+collection/i, name: "Woodford Reserve Master's Collection" },
  // ── Independent craft / allocated ────────────────────────────────────
  { pattern: /smoke\s+wagon\s+(rare|uncut|straight|limited)/i, name: 'Smoke Wagon' },
  { pattern: /joseph\s+magnus/i,                            name: 'Joseph Magnus' },
]

// REST API check — used for stores with a known merchantId.
// Returns the full catalog (up to 500 items) and matches against CITY_HIVE_TARGETS.
//
// Minimal User-Agent header only — sec-fetch-* headers make server-side requests
// look MORE suspicious to Cloudflare (TLS fingerprint doesn't match a real browser
// but headers claim to be one). Malloy's uses this same minimal approach and works.
export async function checkCityHiveStoreAPI(store) {
  const found = new Map()
  try {
    const params = new URLSearchParams()
    params.set('api_key', CITY_HIVE_API_KEY)
    params.set('merchant_id', store.merchantId)
    params.set('per_page', '500')
    params.append('additional_properties[subtype][]', 'bourbon')
    params.append('additional_properties[subtype][]', 'whiskey')

    const res = await fetch(`${store.base}/api/v1/products/search.json?${params}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      let body = ''
      try { body = await res.text() } catch {}
      console.error(`[CH-API] ${store.name} HTTP ${res.status} — ${body.slice(0, 200)}`)
      return checkCityHiveStoreHTML(store)
    }

    const data = await res.json()
    const products = data.products ?? []
    console.log(`[CH-API] ${store.name} OK — ${products.length} products`)

    for (const product of products) {
      const name = product.name?.trim()
      if (!name) continue

      for (const target of CITY_HIVE_TARGETS) {
        if (!target.pattern.test(name)) continue
        if (found.has(target.name)) continue

        const merchant = product.merchants?.[0]
        const option   = merchant?.product_options?.[0]
        const price    = option?.price != null ? parseFloat(option.price) : null
        const qty      = option?.quantity ?? null

        found.set(target.name, {
          bottle:   target.name,
          retailer: store.name,
          location: store.location,
          inStock:  true,
          price,
          quantity: qty,
          url:      `${store.base}/shop/`,
          rawName:  name,
        })
        break
      }
    }

    return { finds: [...found.values()], catalogSize: products.length, accessible: true }
  } catch (err) {
    console.error(`[CH-API] ${store.name} exception — ${err.message}`)
    return checkCityHiveStoreHTML(store)
  }
}

// HTML scrape fallback — used for stores without a merchantId.
// Parses JSON-LD ItemList from SSR page (limited to first-page results).
export async function checkCityHiveStoreHTML(store) {
  const found       = new Map()
  let   catalogSize = 0
  let   accessible  = false

  for (const pagePath of (store.pages ?? [])) {
    try {
      const pageUrl = store.base + pagePath
      const res = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(7000),
      })
      if (!res.ok) continue
      const html = await res.text()

      const blocks = [...html.matchAll(
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
      )]
      const itemListBlock = blocks.find(b => b[1].includes('"ItemList"'))
      if (!itemListBlock) continue

      const listData = JSON.parse(itemListBlock[1])
      const items    = listData.itemListElement || []
      accessible  = true
      catalogSize = Math.max(catalogSize, items.length)

      for (const listItem of items) {
        const product = listItem.item || listItem
        const name    = product.name?.replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim()
        if (!name) continue

        const offers  = Array.isArray(product.offers) ? product.offers[0] : product.offers
        const avail   = offers?.availability ?? ''
        const inStock = /InStock/i.test(avail)
        const price   = offers?.price != null ? parseFloat(offers.price) : null
        const url     = product.url || pageUrl

        for (const target of CITY_HIVE_TARGETS) {
          if (!target.pattern.test(name)) continue
          if (found.has(target.name)) continue
          found.set(target.name, {
            bottle:   target.name,
            retailer: store.name,
            location: store.location,
            inStock,
            price,
            url,
            rawName: name,
          })
          break
        }
      }
    } catch (e) {
      // network / parse error — keep accessible false for this page
    }
  }

  return { finds: [...found.values()], catalogSize, accessible }
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
/**
 * Check all Chicagoland retailers.
 * Returns { finds: [...], diagnostics: { [storeName]: { catalogSize, accessible, source } } }
 */
export async function runCityHiveChecks() {
  const promises = []
  const ordered  = []
  for (const store of CITY_HIVE_STORES) {
    if (store.merchantId) {
      promises.push(checkCityHiveStoreAPI(store))
    } else {
      promises.push(checkCityHiveStoreHTML(store))
    }
    ordered.push(store)
  }
  const results = await Promise.all(promises)
  return { results, ordered }
}

export async function checkAllRetailers() {
  const { results: cityHiveResults, ordered: cityHiveStores } = await runCityHiveChecks()
  const cityHiveResult = {
    finds: cityHiveResults.flatMap(r => r.finds),
    diagnostics: Object.fromEntries(
      cityHiveStores.map((store, i) => [store.name, {
        catalogSize: cityHiveResults[i].catalogSize,
        accessible:  cityHiveResults[i].accessible,
      }])
    ),
  }

  const [liquorBarn, kegNBottle, sunsetLiquor, malloysFinest] = await Promise.all([
    checkLiquorBarn(),
    checkKegNBottle(),
    checkSunsetLiquor(),
    checkMalloysFinest(),
  ])

  const finds = [
    ...liquorBarn,
    ...kegNBottle,
    ...sunsetLiquor,
    ...malloysFinest,
    ...cityHiveResult.finds,
  ]

  const diagnostics = {
    // Liquor Barn: per-location entries + catch-all fallback
    ...Object.fromEntries(LIQUOR_BARN_LOCATIONS.map(l => [l.retailer, { accessible: true, catalogSize: LIQUOR_BARN_BOTTLES.length, source: 'shopify' }])),
    'Liquor Barn':            { accessible: true, catalogSize: LIQUOR_BARN_BOTTLES.length,    source: 'shopify' },
    'Keg N Bottle':           { accessible: true, catalogSize: KEG_N_BOTTLE_BOTTLES.length,   source: 'shopify' },
    'Sunset Liquor':          { accessible: true, catalogSize: SUNSET_LIQUOR_BOTTLES.length,  source: 'shopify' },
    ...Object.fromEntries(MALLOYS_LOCATIONS.map(l => [l.name, { accessible: true, catalogSize: null, source: 'cityhive' }])),
    ...Object.fromEntries(
      Object.entries(cityHiveResult.diagnostics).map(([k, v]) => [k, { ...v, source: 'cityhive' }])
    ),
  }

  return { finds, diagnostics }
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
  // Liquor Barn: 3 per-location entries via Section Rendering API.
  // 'Liquor Barn' catch-all used only when the pickup endpoint is unreachable.
  { name: 'Liquor Barn (Vernon Hills)', location: 'Vernon Hills, IL', url: 'https://theliquorbarn.com', lat: 42.2319, lng: -87.9615 },
  { name: 'Liquor Barn (Wheeling)',     location: 'Wheeling, IL',     url: 'https://theliquorbarn.com', lat: 42.1393, lng: -87.9278 },
  { name: 'Liquor Barn (Niles)',        location: 'Niles, IL',        url: 'https://theliquorbarn.com', lat: 42.0169, lng: -87.8285 },
  { name: 'Liquor Barn', location: 'Wheeling / Niles / Vernon Hills, IL', url: 'https://theliquorbarn.com', lat: 42.1364, lng: -87.9270, multiLocation: true, locationNames: ['Wheeling', 'Niles', 'Vernon Hills'] },
  { name: 'Keg N Bottle',   location: 'Glenview, IL',      url: 'https://kegnbottle.com',   lat: 42.0776, lng: -87.8293 },
  { name: 'Sunset Liquor',  location: 'Melrose Park, IL',  url: 'https://sunsetliquor.us',  lat: 41.8997, lng: -87.8572 },

  // ── Malloy's Finest — 3 locations (City Hive REST API, per-location) ─────
  { name: "Malloy's Finest (Glen Ellyn)",  location: 'Glen Ellyn, IL',  url: 'https://malloysfinest.com', lat: 41.8761, lng: -88.0636 },
  { name: "Malloy's Finest (Naperville)", location: 'Naperville, IL',  url: 'https://malloysfinest.com', lat: 41.7508, lng: -88.1535 },
  { name: "Malloy's Finest (Lisle)",      location: 'Lisle, IL',       url: 'https://malloysfinest.com', lat: 41.7987, lng: -88.0714 },

  // ── City Hive — Southwest suburbs ────────────────────────────────────────
  { name: "Joe's Beverage Warehouse",  location: 'Romeoville, IL',  url: 'https://joesbev.com',       lat: 41.6475, lng: -88.0892 },
  { name: "John's Beverage Warehouse", location: 'Joliet, IL',      url: 'https://johnsbev.com',      lat: 41.5296, lng: -88.1318 },
  { name: 'Greene Valley Wine & Spirits', location: 'Bolingbrook, IL', url: 'https://greenevalleyws.com', lat: 41.6896, lng: -88.0839 },

  // ── City Hive — West / DuPage suburbs ────────────────────────────────────
  { name: "Sal's Beverage World (Elmhurst)",   location: 'Elmhurst, IL',   url: 'https://elmhurst.salsbeverageworld.com',  lat: 41.8592, lng: -87.9718 },
  { name: "Sal's Beverage World (Addison)",    location: 'Addison, IL',    url: 'https://addison.salsbeverageworld.com',   lat: 41.9299, lng: -88.0081 },
  { name: "Sal's Beverage World (Villa Park)", location: 'Villa Park, IL', url: 'https://villapark.salsbeverageworld.com', lat: 41.8675, lng: -87.9754 },

  // ── City Hive — Chicago city ──────────────────────────────────────────────
  { name: 'Uncork It Chicago',   location: 'Chicago, IL',                  url: 'https://uncorkitchicago.com',  lat: 41.8748, lng: -87.6390 },
  { name: 'Archer Liquors',      location: 'Chicago (SW), IL',             url: 'https://archerliquors.com',    lat: 41.8004, lng: -87.7477 },
  { name: 'Liquor Expo Chicago', location: 'Chicago (Lincoln Park), IL',   url: 'https://myliquorexpo.com',     lat: 41.9210, lng: -87.6487 },

  // Kenwood Liquors removed — /shop/ returns 404 (catalog unavailable)

  // ── City Hive — North / Northwest suburbs ─────────────────────────────────
  { name: 'Northshore Wine & Spirits', location: 'Highwood, IL',       url: 'https://northshorewineandspirit.com', lat: 42.2003, lng: -87.8054 },
  { name: 'Gold Eagle Wine & Spirits', location: 'Libertyville, IL',   url: 'https://goldeaglewine.com',           lat: 42.2808, lng: -87.9577 },
  { name: 'D&D Smoke & Spirits',       location: 'Arlington Heights, IL', url: 'https://ddsmokespirits.com',       lat: 42.0975, lng: -87.9705 },
  { name: 'Elgin Liquor & Wine',       location: 'Elgin, IL',          url: 'https://elginliquor.com',             lat: 42.0299, lng: -88.2641 },
  { name: 'Antioch Fine Wine & Liquors', location: 'Antioch, IL',      url: 'https://antiochwine.com',             lat: 42.4778, lng: -88.0945 },
]
