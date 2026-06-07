/**
 * lib/independents/shopify.js
 *
 * Shopify-based independent retailers.
 * Uses /products/{slug}.js for global availability + variant ID,
 * then the Section Rendering API for per-location pickup status.
 *
 * Works from both Vercel and home machine — no Cloudflare issues.
 */

// ─── Liquor Barn ─────────────────────────────────────────────────────────────

const LIQUOR_BARN_BASE = 'https://theliquorbarn.com'

export const LIQUOR_BARN_LOCATIONS = [
  { key: 'vernon hills', retailer: 'Liquor Barn (Vernon Hills)', location: 'Vernon Hills, IL' },
  { key: 'wheeling',     retailer: 'Liquor Barn (Wheeling)',     location: 'Wheeling, IL' },
  { key: 'niles',        retailer: 'Liquor Barn (Niles)',        location: 'Niles, IL' },
]

const LIQUOR_BARN_BOTTLES = [
  // Buffalo Trace / Sazerac
  { slug: 'eagle-rare-10-year-bourbon',                                   name: 'Eagle Rare 10yr' },
  { slug: 'eagle-rare-12-year-bourbon-750ml',                             name: 'Eagle Rare 12yr' },
  { slug: 'eagle-rare-17-year-kentucky-straight-bourbon-750ml',           name: 'Eagle Rare 17yr' },
  { slug: 'eagle-rare-10-year-liquor-barn-single-barrel-bourbon-750ml',   name: 'Eagle Rare LB Single Barrel' },
  { slug: 'blantons-single-barrel-bourbon-750ml',                         name: "Blanton's Original" },
  { slug: 'blantons-gold-edition-bourbon-750ml',                          name: "Blanton's Gold" },
  { slug: 'blantons-straight-from-the-barrel-bourbon-750ml',              name: "Blanton's SFTB" },
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
  { slug: 'colonel-e-h-taylor-jr-straight-rye-whisky-750ml',              name: 'E.H. Taylor Rye' },
  { slug: 'colonel-e-h-taylor-bottled-in-bond-bourbon-750ml',             name: 'E.H. Taylor BIB (BTAC)' },
  { slug: 'buffalo-trace-bourbon-750ml-1',                                name: 'Buffalo Trace' },
  { slug: 'stagg-bourbon-750ml',                                          name: 'Stagg' },
  // Van Winkle
  { slug: 'old-rip-van-winkle-10-year-handmade-bourbon-750ml',            name: 'Old Rip Van Winkle 10yr' },
  { slug: 'pappy-van-winkle-family-reserve-12-year-bourbon-750ml',        name: 'Pappy Van Winkle 12yr' },
  { slug: 'pappy-van-winkle-family-reserve-15-year-bourbon-750ml',        name: 'Pappy Van Winkle 15yr' },
  { slug: 'pappy-van-winkle-family-reserve-20-year-bourbon-750ml',        name: 'Pappy Van Winkle 20yr' },
  { slug: 'pappy-van-winkle-family-reserve-23-year-bourbon-750ml',        name: 'Pappy Van Winkle 23yr' },
  { slug: 'pappy-van-winkle-family-reserve-rye-13-year-750ml',            name: 'PVW Family Reserve Rye 13yr' },
  // Heaven Hill
  { slug: 'old-fitzgerald-9-year-bourbon-100-proof-750ml',                name: 'Old Fitzgerald 9yr BIB' },
  { slug: 'old-fitzgerald-10-year-bourbon-100-proof-750ml',               name: 'Old Fitzgerald 10yr BIB' },
  { slug: 'old-fitzgerald-11-year-bourbon-100-proof-750ml',               name: 'Old Fitzgerald 11yr BIB' },
  { slug: 'elijah-craig-barrel-proof-bourbon-750ml',                      name: 'Elijah Craig Barrel Proof' },
  { slug: 'elijah-craig-15-year-bourbon-750ml',                           name: 'Elijah Craig 15yr' },
  { slug: 'elijah-craig-18-year-bourbon-750ml',                           name: 'Elijah Craig 18yr' },
  { slug: 'elijah-craig-toasted-barrel-bourbon-750ml',                    name: 'Elijah Craig Toasted' },
  { slug: 'parker-heritage-collection-bourbon-750ml',                     name: "Parker's Heritage" },
  { slug: 'larceny-barrel-proof-bourbon-750ml',                           name: 'Larceny Barrel Proof' },
  { slug: 'bernheim-original-wheat-whiskey-750ml',                        name: 'Bernheim Wheat Whiskey' },
  { slug: 'heaven-hill-heritage-collection-19-year-bourbon-750ml',        name: 'Heaven Hill Heritage 19yr' },
  { slug: 'heaven-hill-heritage-collection-22-year-bourbon-750ml',        name: 'Heaven Hill Heritage 22yr' },
  // Brown-Forman / Woodford
  { slug: 'woodford-reserve-batch-proof-bourbon-750ml',                   name: 'Woodford Reserve Batch Proof' },
  { slug: 'woodford-reserve-masters-collection-bourbon-750ml',            name: "Woodford Reserve Master's Collection" },
  { slug: 'old-forester-birthday-bourbon-2025-750ml',                     name: 'Old Forester Birthday 2025' },
  { slug: 'old-forester-birthday-bourbon-750ml',                          name: 'Old Forester Birthday' },
  { slug: 'old-forester-1924-10-year-bourbon-750ml',                      name: 'Old Forester 1924 10yr' },
  { slug: 'old-forester-117-series-bourbon-750ml',                        name: 'Old Forester 117 Series' },
  { slug: 'old-charter-oak-bourbon-750ml',                                name: 'Old Charter Oak' },
  { slug: 'king-of-kentucky-16-year-single-barrel-bourbon-750ml',         name: 'King of Kentucky 16yr' },
  { slug: 'king-of-kentucky-small-batch-bourbon-750ml',                   name: 'King of Kentucky Small Batch' },
  // Beam Suntory
  { slug: 'bookers-9-year-bourbon-750ml',                                 name: "Booker's 9yr" },
  { slug: 'bakers-13-year-bourbon-750ml',                                 name: "Baker's 13yr" },
  { slug: 'knob-creek-9-year-single-barrel-bourbon-750ml',                name: 'Knob Creek 9yr Single Barrel' },
  { slug: 'knob-creek-12-year-bourbon-750ml',                             name: 'Knob Creek 12yr' },
  { slug: 'knob-creek-18-year-bourbon-750ml',                             name: 'Knob Creek 18yr' },
  { slug: 'knob-creek-21-year-bourbon-750ml',                             name: 'Knob Creek 21yr' },
  { slug: 'little-book-chapter-bourbon-750ml',                            name: 'Little Book' },
  { slug: 'makers-mark-cellar-aged-bourbon-750ml',                        name: "Maker's Mark Cellar Aged" },
  { slug: 'makers-mark-star-hill-farm-bourbon-750ml',                     name: "Maker's Mark Star Hill Farm" },
  { slug: 'makers-mark-wood-finishing-series-bourbon-750ml',              name: "Maker's Mark Wood Finishing Series" },
  // Wild Turkey
  { slug: 'russells-reserve-single-barrel-bourbon-750ml',                 name: "Russell's Reserve Single Barrel" },
  { slug: 'russells-reserve-2-cycle-bourbon-750ml',                       name: "Russell's Reserve 2-Cycle" },
  { slug: 'russells-reserve-13-year-bourbon-750ml',                       name: "Russell's Reserve 13yr" },
  { slug: 'russells-reserve-15-year-bourbon-750ml',                       name: "Russell's Reserve 15yr" },
  { slug: 'russells-reserve-rickhouse-bourbon-750ml',                     name: "Russell's Reserve Rickhouse" },
  { slug: 'wild-turkey-masters-keep-bourbon-750ml',                       name: "Wild Turkey Master's Keep" },
  { slug: 'wild-turkey-rare-breed-rye-whiskey-750ml',                     name: 'Wild Turkey Rare Breed Rye' },
  // Angel's Envy
  { slug: 'angels-envy-single-barrel-bourbon-750ml',                      name: "Angel's Envy Single Barrel" },
  { slug: 'angels-envy-cask-strength-bourbon-750ml',                      name: "Angel's Envy Cask Strength" },
  // Four Roses
  { slug: 'four-roses-bourbon-single-barrel-select-750ml',                name: 'Four Roses Single Barrel Select' },
  { slug: 'four-roses-2025-limited-edition-small-batch-750ml',            name: 'Four Roses 2025 Limited Edition' },
  // Michter's
  { slug: 'michters-10-year-single-barrel-bourbon-750ml',                 name: "Michter's 10yr" },
  { slug: 'michters-20-year-bourbon-750ml',                               name: "Michter's 20yr" },
  { slug: 'michters-25-year-bourbon-750ml',                               name: "Michter's 25yr" },
  { slug: 'michters-toasted-barrel-finish-bourbon-750ml',                 name: "Michter's Toasted Barrel" },
  // High West
  { slug: 'high-west-bourye-whiskey-750ml',                               name: 'High West Bourye' },
  { slug: 'high-west-midwinter-nights-dram-whiskey-750ml',                name: "High West Midwinter Night's Dram" },
  { slug: 'high-west-rendezvous-rye-whiskey-750ml',                       name: 'High West Rendezvous Rye' },
  // Willett / Peerless
  { slug: 'willett-family-estate-4-year-bourbon-750ml',                   name: 'Willett 4yr' },
  { slug: 'willett-family-estate-8-year-bourbon-750ml',                   name: 'Willett 8yr' },
  { slug: 'willett-last-juice-bourbon-750ml',                             name: 'Willett Last Juice' },
  { slug: 'peerless-double-oak-bourbon-750ml',                            name: 'Peerless Double Oak' },
  { slug: 'peerless-single-barrel-bourbon-750ml',                         name: 'Peerless Single Barrel' },
  // Jack Daniel's
  { slug: 'jack-daniels-10-year-tennessee-whiskey-750ml',                 name: "Jack Daniel's 10yr" },
  { slug: 'jack-daniels-12-year-tennessee-whiskey-750ml',                 name: "Jack Daniel's 12yr" },
  { slug: 'jack-daniels-14-year-tennessee-whiskey-750ml',                 name: "Jack Daniel's 14yr" },
  { slug: 'jack-daniels-barrel-proof-rye-750ml',                          name: "Jack Daniel's Barrel Proof Rye" },
  // 1792
  { slug: '1792-12-year-bourbon-750ml',                                   name: '1792 12yr' },
  { slug: '1792-single-barrel-bourbon-750ml',                             name: '1792 Single Barrel' },
  { slug: '1792-bottled-in-bond-bourbon-750ml',                           name: '1792 BIB' },
  // Other
  { slug: 'smoke-wagon-uncut-unfiltered-bourbon-750ml',                   name: 'Smoke Wagon Uncut Unfiltered' },
  { slug: 'blood-oath-pact-11-bourbon-750ml',                             name: 'Blood Oath Pact 11' },
  { slug: 'blood-oath-pact-12-bourbon-750ml',                             name: 'Blood Oath Pact 12' },
  { slug: 'elmer-t-lee-single-barrel-bourbon-750ml',                      name: 'Elmer T. Lee' },
  { slug: 'new-riff-8-year-bourbon-750ml',                                name: 'New Riff 8yr' },
  { slug: 'fortaleza-still-strength-blanco-tequila-750ml',                name: 'Fortaleza Still Strength' },
]

function parseLiquorBarnPickup(html, bottleName, price, url, onlineUnavailable) {
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

export async function checkLiquorBarn() {
  const results = []
  let checked = 0, found = 0

  await Promise.all(LIQUOR_BARN_BOTTLES.map(async (bottle) => {
    const url = `${LIQUOR_BARN_BASE}/products/${bottle.slug}`
    try {
      // Step 1: global availability + variant ID
      const jsRes = await fetch(`${url}.js`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      })
      if (!jsRes.ok) return
      checked++

      const product   = await jsRes.json()
      const rawPrice  = product.variants?.[0]?.price
      const price     = rawPrice != null ? (rawPrice > 500 ? rawPrice / 100 : rawPrice) : null
      const variantId = product.variants?.[0]?.id
      if (!variantId) return

      // Step 2: per-location pickup availability (authoritative)
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
          if (locationFinds.length > 0) {
            found += locationFinds.filter(f => f.inStock).length
            results.push(...locationFinds)
          }
          return // pickup endpoint is authoritative regardless of result
        }
      } catch { /* fall through to global availability */ }

      // Fallback: pickup endpoint unreachable
      if (!product.available) return
      found++
      results.push({ bottle: bottle.name, retailer: 'Liquor Barn', location: 'Wheeling/Niles/Vernon Hills, IL', inStock: true, price, url })
    } catch { /* slug doesn't exist or network error — skip silently */ }
  }))

  console.log(`[Liquor Barn] ${checked}/${LIQUOR_BARN_BOTTLES.length} slugs found → ${found} in stock`)
  return results
}

// ─── Keg N Bottle ─────────────────────────────────────────────────────────────

const KEG_N_BOTTLE_BASE = 'https://kegnbottle.com'

const KEG_N_BOTTLE_BOTTLES = [
  // Buffalo Trace / Sazerac
  { slug: 'eagle-rare-kentucky-straight-bourbon',                       name: 'Eagle Rare 10yr' },
  { slug: 'blantons-original-single-barrel-bourbon-750-ml',             name: "Blanton's Original" },
  { slug: 'blantons-gold-edition-bourbon-750-ml',                       name: "Blanton's Gold" },
  { slug: 'blantons-straight-from-the-barrel-bourbon-750-ml',           name: "Blanton's SFTB" },
  { slug: 'w-l-weller-special-reserve-750-ml',                          name: 'Weller Special Reserve' },
  { slug: 'weller-12-year-bourbon-750-ml',                              name: 'Weller 12yr' },
  { slug: 'old-weller-antique-107-wheated-bourbon-750-ml',              name: 'Weller Antique 107' },
  { slug: 'weller-full-proof-bourbon-750-ml',                           name: 'Weller Full Proof' },
  { slug: 'weller-cypb-craft-your-path-bourbon-750-ml',                 name: 'Weller CYPB' },
  { slug: 'weller-single-barrel-bourbon-750-ml',                        name: 'Weller Single Barrel' },
  { slug: 'weller-millennium-bourbon-750-ml',                           name: 'Weller Millennium' },
  { slug: 'george-t-stagg-barrel-proof-bourbon-whiskey-750-ml',         name: 'George T. Stagg (BTAC)' },
  { slug: 'william-larue-weller-bourbon-750-ml',                        name: 'William Larue Weller (BTAC)' },
  { slug: 'thomas-h-handy-sazerac-straight-rye-whiskey-750-ml',         name: 'Thomas H. Handy (BTAC)' },
  { slug: 'sazerac-18-year-rye-whiskey-750-ml',                         name: 'Sazerac 18yr (BTAC)' },
  { slug: 'rock-hill-farms-single-barrel-bourbon-750-ml',               name: 'Rock Hill Farms' },
  { slug: 'colonel-e-h-taylor-small-batch-bourbon-750-ml',              name: 'E.H. Taylor Small Batch' },
  { slug: 'colonel-e-h-taylor-single-barrel-bourbon-750-ml',            name: 'E.H. Taylor Single Barrel' },
  { slug: 'colonel-e-h-taylor-barrel-proof-bourbon-750-ml',             name: 'E.H. Taylor Barrel Proof' },
  { slug: 'buffalo-trace',                                               name: 'Buffalo Trace' },
  { slug: 'stagg-bourbon-750-ml',                                        name: 'Stagg' },
  // Van Winkle
  { slug: 'old-rip-van-winkle-10-year-bourbon-750-ml',                  name: 'Old Rip Van Winkle 10yr' },
  { slug: 'pappy-van-winkle-family-reserve-12-year-bourbon-750-ml',     name: 'Pappy Van Winkle 12yr' },
  { slug: 'pappy-van-winkle-family-reserve-15-year-bourbon-750-ml',     name: 'Pappy Van Winkle 15yr' },
  { slug: 'pappy-van-winkle-family-reserve-20-year-bourbon-750-ml',     name: 'Pappy Van Winkle 20yr' },
  { slug: 'pappy-van-winkle-family-reserve-23-year-bourbon-750-ml',     name: 'Pappy Van Winkle 23yr' },
  // Heaven Hill
  { slug: 'old-fitzgerald-9-year-bottled-in-bond-bourbon-750-ml',       name: 'Old Fitzgerald 9yr BIB' },
  { slug: 'old-fitzgerald-10-year-bottled-in-bond-bourbon-750-ml',      name: 'Old Fitzgerald 10yr BIB' },
  { slug: 'elijah-craig-barrel-proof-bourbon-750-ml',                   name: 'Elijah Craig Barrel Proof' },
  { slug: 'elijah-craig-18-year-bourbon-750-ml',                        name: 'Elijah Craig 18yr' },
  { slug: 'parker-heritage-collection-bourbon-750-ml',                  name: "Parker's Heritage" },
  { slug: 'heaven-hill-heritage-collection-bourbon-750-ml',             name: 'Heaven Hill Heritage' },
  { slug: 'larceny-barrel-proof-bourbon-750-ml',                        name: 'Larceny Barrel Proof' },
  // Brown-Forman / Woodford
  { slug: 'woodford-reserve-batch-proof-bourbon-750-ml',                name: 'Woodford Reserve Batch Proof' },
  { slug: 'woodford-reserve-masters-collection-bourbon-750-ml',         name: "Woodford Reserve Master's Collection" },
  { slug: 'old-forester-birthday-bourbon-750-ml',                       name: 'Old Forester Birthday' },
  { slug: 'old-forester-1924-10-year-bourbon-750-ml',                   name: 'Old Forester 1924 10yr' },
  { slug: 'king-of-kentucky-16-year-single-barrel-bourbon-750-ml',      name: 'King of Kentucky 16yr' },
  // Beam Suntory
  { slug: 'bookers-9-year-bourbon-750-ml',                              name: "Booker's 9yr" },
  { slug: 'bakers-13-year-bourbon-750-ml',                              name: "Baker's 13yr" },
  { slug: 'knob-creek-9-year-single-barrel-bourbon-750-ml',             name: 'Knob Creek 9yr Single Barrel' },
  { slug: 'knob-creek-12-year-bourbon-750-ml',                          name: 'Knob Creek 12yr' },
  { slug: 'knob-creek-18-year-bourbon-750-ml',                          name: 'Knob Creek 18yr' },
  { slug: 'knob-creek-21-year-bourbon-750-ml',                          name: 'Knob Creek 21yr' },
  { slug: 'little-book-bourbon-750-ml',                                 name: 'Little Book' },
  // Wild Turkey
  { slug: 'russells-reserve-single-barrel-bourbon-750-ml',              name: "Russell's Reserve Single Barrel" },
  { slug: 'russells-reserve-2-cycle-bourbon-750-ml',                    name: "Russell's Reserve 2-Cycle" },
  { slug: 'russells-reserve-rickhouse-bourbon-750-ml',                  name: "Russell's Reserve Rickhouse" },
  { slug: 'russells-reserve-13-year-bourbon-750-ml',                    name: "Russell's Reserve 13yr" },
  { slug: 'russells-reserve-15-year-bourbon-750-ml',                    name: "Russell's Reserve 15yr" },
  { slug: 'wild-turkey-masters-keep-bourbon-750-ml',                    name: "Wild Turkey Master's Keep" },
  // Four Roses
  { slug: 'four-roses-limited-edition-small-batch-135th-anniversary-bourbon-whiskey-750-ml', name: 'Four Roses Limited Edition' },
  { slug: 'four-roses-bourbon-single-barrel-select-750-ml',             name: 'Four Roses Single Barrel Select' },
  // Michter's
  { slug: 'michters-10-year-single-barrel-bourbon-750-ml',              name: "Michter's 10yr" },
  { slug: 'michters-20-year-bourbon-750-ml',                            name: "Michter's 20yr" },
  { slug: 'michters-25-year-bourbon-750-ml',                            name: "Michter's 25yr" },
  // Angel's Envy
  { slug: 'angels-envy-cask-strength-bourbon-750-ml',                   name: "Angel's Envy Cask Strength" },
  { slug: 'angels-envy-single-barrel-bourbon-750-ml',                   name: "Angel's Envy Single Barrel" },
  // Peerless / High West / Willett
  { slug: 'peerless-double-oak-bourbon-750-ml',                         name: 'Peerless Double Oak' },
  { slug: 'peerless-single-barrel-bourbon-750-ml',                      name: 'Peerless Single Barrel' },
  { slug: 'high-west-midwinter-nights-dram-whiskey-750-ml',             name: "High West Midwinter Night's Dram" },
  { slug: 'high-west-bourye-whiskey-750-ml',                            name: 'High West Bourye' },
  { slug: 'high-west-rendezvous-rye-whiskey-750-ml',                    name: 'High West Rendezvous Rye' },
  { slug: 'willett-family-estate-4-year-bourbon-750-ml',                name: 'Willett 4yr' },
  { slug: 'willett-family-estate-8-year-bourbon-750-ml',                name: 'Willett 8yr' },
  { slug: 'willett-last-juice-bourbon-750-ml',                          name: 'Willett Last Juice' },
  // Jack Daniel's
  { slug: 'jack-daniels-10-year-tennessee-whiskey-750-ml',              name: "Jack Daniel's 10yr" },
  { slug: 'jack-daniels-12-year-tennessee-whiskey-750-ml',              name: "Jack Daniel's 12yr" },
]

export async function checkKegNBottle() {
  const results = []
  let found = 0

  // Quick connectivity probe — bail early on SSL/cert errors rather than
  // silently failing on every individual slug fetch.
  try {
    const probe = await fetch(`${KEG_N_BOTTLE_BASE}/`, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    })
    void probe
  } catch (err) {
    const msg = err?.cause?.message ?? err?.message ?? String(err)
    if (/certificate|ssl|tls/i.test(msg)) {
      console.warn(`[Keg N Bottle] SSL/cert error — store skipped until cert is renewed: ${msg}`)
    } else {
      console.warn(`[Keg N Bottle] Unreachable (${msg}) — skipping`)
    }
    return results
  }

  await Promise.all(KEG_N_BOTTLE_BOTTLES.map(async (bottle) => {
    try {
      const res = await fetch(`${KEG_N_BOTTLE_BASE}/products/${bottle.slug}.js`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return
      const product = await res.json()
      const inStock = product.available === true
      const rawPrice = product.variants?.[0]?.price
      const price = rawPrice != null ? (rawPrice > 500 ? rawPrice / 100 : rawPrice) : null
      if (inStock) found++
      results.push({
        bottle:      bottle.name,
        retailer:    'Keg N Bottle',
        location:    'Glenview, IL',
        inStock,
        price,
        marketPrice: true,
        url:         `${KEG_N_BOTTLE_BASE}/products/${bottle.slug}`,
      })
    } catch { /* slug 404 or timeout — skip */ }
  }))

  console.log(`[Keg N Bottle] ${results.length}/${KEG_N_BOTTLE_BOTTLES.length} slugs found → ${found} in stock`)
  return results
}

// ─── Sunset Liquor ────────────────────────────────────────────────────────────

const SUNSET_LIQUOR_BASE = 'https://sunsetliquor.us'

// Slugs verified against sunsetliquor.us/collections/whiskey — June 2026.
// Small store; primarily carries Buffalo Trace portfolio + select Heaven Hill.
// Does NOT carry: Knob Creek aged, Booker's, Russell's Reserve limited, Michter's,
//                 Angel's Envy limited, Willett, Four Roses limited, High West limited.
const SUNSET_LIQUOR_BOTTLES = [
  // Buffalo Trace / Sazerac
  { slug: 'eagle-rare-10-years-750ml',                                              name: 'Eagle Rare 10yr' },
  { slug: 'blanton-s-straight-from-the-barrel-750ml',                              name: "Blanton's SFTB" },
  { slug: 'blantons-gold-bourbon-750ml',                                            name: "Blanton's Gold" },
  { slug: 'weller-special-reserve',                                                 name: 'Weller Special Reserve' },
  { slug: 'weller-12-year-old-kentucky-straight-wheated-bourbon-whiskey',           name: 'Weller 12yr' },
  { slug: 'w-l-weller-full-proof-750ml',                                            name: 'Weller Full Proof' },
  { slug: 'w-l-weller-c-y-p-b-original-wheated-straight-bourbon-whiskey',          name: 'Weller CYPB' },
  { slug: 'colonel-e-h-taylor-jr-single-barrel-bourbon-whiskey',                   name: 'E.H. Taylor Single Barrel' },
  { slug: 'thomas-handy-sazerac-2021-straight-rye-whiskey-750ml',                  name: 'Thomas H. Handy (BTAC)' },
  // Van Winkle
  { slug: 'old-rip-van-winkle-10-year-old-2024',                                   name: 'Old Rip Van Winkle 10yr' },
  { slug: 'van-winkle-special-reserve-12-year',                                    name: 'Van Winkle Special Reserve 12yr' },
  { slug: 'pappy-van-winkle-family-reserve-15yr',                                  name: 'Pappy Van Winkle 15yr' },
  { slug: 'pappy-van-winkle-family-reserve-20-year-old-2024',                      name: 'Pappy Van Winkle 20yr' },
  { slug: 'pappy-van-winkle-family-reserve-23-year-old-2024',                      name: 'Pappy Van Winkle 23yr' },
  // Heaven Hill
  { slug: 'elijah-craig-barrel-proof-750ml',                                       name: 'Elijah Craig Barrel Proof' },
  { slug: 'elijah-craig-18-year-old-single-barrel-bourbon-whiskey-2022-bottled-750ml', name: 'Elijah Craig 18yr' },
  // Brown-Forman / Maker's
  { slug: 'makers-mark-2022-wood-finishing-series-brt-01-and-brt-02-explores-the-effects-of-a-barrels-location-within-a-warehouse', name: "Maker's Mark Wood Finishing Series" },
]

export async function checkSunsetLiquor() {
  const results = []
  let found = 0

  await Promise.all(SUNSET_LIQUOR_BOTTLES.map(async (bottle) => {
    try {
      const res = await fetch(`${SUNSET_LIQUOR_BASE}/products/${bottle.slug}.js`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return
      const product = await res.json()
      const inStock = product.available === true
      const rawPrice = product.variants?.[0]?.price
      const price = rawPrice != null ? (rawPrice > 500 ? rawPrice / 100 : rawPrice) : null
      if (inStock) found++
      results.push({
        bottle:   bottle.name,
        retailer: 'Sunset Liquor',
        location: 'Melrose Park, IL',
        inStock,
        price,
        url:      `${SUNSET_LIQUOR_BASE}/products/${bottle.slug}`,
      })
    } catch { /* slug 404 or timeout — skip */ }
  }))

  console.log(`[Sunset Liquor] ${results.length}/${SUNSET_LIQUOR_BOTTLES.length} slugs found → ${found} in stock`)
  return results
}
