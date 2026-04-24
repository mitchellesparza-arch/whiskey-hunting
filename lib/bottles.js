/**
 * Bottle definitions for the Chicagoland Binny's truck tracker.
 *
 * canaryBottles:  High-volume bottles used to detect truck arrivals.
 *                 ONE Algolia call per canary checks ALL store codes at once
 *                 via the inStockStores[] field.
 *
 * hotlineBottles: Allocated bottles sold via Binny's Whiskey Hotline lottery.
 *                 Used as a distributor → bottle reference map shown when a
 *                 truck from that distributor is detected at a store.
 *
 * DISTRIBUTOR MAP (Illinois, as of 2025-2026)
 * ────────────────────────────────────────────
 * "Breakthru Beverage" — Brown-Forman (Old Forester, Woodford Reserve,
 *                        Jack Daniel's), Sazerac/Buffalo Trace portfolio
 *                        (Blanton's, Weller, Eagle Rare, Pappy, BTAC,
 *                        E.H. Taylor, Benchmark, Ancient Age, Bardstown BC)
 * "Southern Glazer's"  — Beam Suntory (Knob Creek, Maker's Mark, Booker's,
 *                        Jim Beam), Campari (Wild Turkey, Russell's Reserve),
 *                        Bacardi (Angel's Envy), Heaven Hill (Elijah Craig,
 *                        Larceny, Parker's Heritage, Old Fitzgerald),
 *                        Constellation (High West), WhistlePig
 * "RNDC"               — Four Roses (Kirin)
 * "BC Merchants"       — Willett/KBD, Barrell Craft Spirits
 */

// ── CANARY BOTTLES ─────────────────────────────────────────────────────────────
// High-volume, frequently restocked bottles used to detect truck arrivals.
// Multiple canaries per distributor = redundancy against spotty Algolia data.
// ONE Algolia call per canary checks ALL store codes via inStockStores[].

export const canaryBottles = [
  // ── Breakthru Beverage ───────────────────────────────────────────────────
  // Brown-Forman brands
  {
    name:        'Old Forester 86° Bourbon',
    objectID:    '195257',
    url:         'https://www.binnys.com/spirits/whiskey/old-forester-bourbon-proof-bourbon-195257/',
    distributor: 'Breakthru Beverage',
  },
  {
    name:        'Old Forester 1920 Prohibition Style',
    objectID:    '948174',
    url:         'https://www.binnys.com/spirits/whiskey/old-forester-prohibition-style-kentucky-straight-bourbon-948174/',
    distributor: 'Breakthru Beverage',
  },
  // Sazerac / Buffalo Trace brands
  {
    name:        'Benchmark Full Proof',
    objectID:    '152774',
    url:         'https://www.binnys.com/spirits/whiskey/benchmark-full-proof-kentucky-straight-bourbon-152774/',
    distributor: 'Breakthru Beverage',
  },
  {
    name:        'Ancient Age Kentucky Straight Bourbon',
    objectID:    '190011',
    url:         'https://www.binnys.com/spirits/whiskey/ancient-age-kentucky-straight-bourbon-190011/',
    distributor: 'Breakthru Beverage',
  },
  {
    name:        'Sazerac Straight Rye',
    objectID:    '196996',
    url:         'https://www.binnys.com/spirits/whiskey/sazerac-straight-rye-196996/',
    distributor: 'Breakthru Beverage',
  },

  // ── Southern Glazer's ────────────────────────────────────────────────────
  // Beam Suntory brands
  {
    name:        'Jim Beam Bourbon',
    objectID:    '190665',
    url:         'https://www.binnys.com/spirits/whiskey/jim-beam-bourbon-190665/',
    distributor: "Southern Glazer's",
  },
  {
    name:        'Knob Creek Kentucky Straight Bourbon',
    objectID:    '194471',
    url:         'https://www.binnys.com/spirits/whiskey/knob-creek-kentucky-straight-bourbon-194471/',
    distributor: "Southern Glazer's",
  },
  // Heaven Hill brands
  {
    name:        'Elijah Craig Small Batch',
    objectID:    '192384',
    url:         'https://www.binnys.com/spirits/whiskey/elijah-craig-small-batch-bourbon-192384/',
    distributor: "Southern Glazer's",
  },
  {
    name:        'Rittenhouse Rye BIB 100 Proof',
    objectID:    '196941',
    url:         'https://www.binnys.com/spirits/whiskey/rittenhouse-rye-proof-196941/',
    distributor: "Southern Glazer's",
  },
  // Campari brands
  {
    name:        'Wild Turkey Rare Breed Bourbon',
    objectID:    '197773',
    url:         'https://www.binnys.com/spirits/whiskey/wild-turkey-rare-breed-bourbon-197773/',
    distributor: "Southern Glazer's",
  },
  // Bacardi brands
  {
    name:        "Angel's Envy Port Barrel Finished Bourbon",
    objectID:    '190031',
    url:         'https://www.binnys.com/spirits/whiskey/angels-envy-port-barrel-finished-bourbon-190031/',
    distributor: "Southern Glazer's",
  },

  // ── RNDC ─────────────────────────────────────────────────────────────────
  // Four Roses / Kirin brands
  {
    name:        'Four Roses Bourbon',
    objectID:    '192651',
    url:         'https://www.binnys.com/spirits/whiskey/four-roses-bourbon-192651/',
    distributor: 'RNDC',
  },
  {
    name:        'Four Roses Small Batch',
    objectID:    '192661',
    url:         'https://www.binnys.com/spirits/whiskey/four-roses-small-batch-bourbon-192661/',
    distributor: 'RNDC',
  },
  {
    name:        'Four Roses Small Batch Select',
    objectID:    '101259',
    url:         'https://www.binnys.com/spirits/whiskey/four-roses-small-batch-select-kentucky-straight-bourbon-101259/',
    distributor: 'RNDC',
  },

  // ── BC Merchants ─────────────────────────────────────────────────────────
  // Barrell Craft Spirits — lower volume than the above but the strongest
  // signal available for BC Merchants truck detection.
  {
    name:        'Barrell Bourbon Batch 037',
    objectID:    '168970',
    url:         'https://www.binnys.com/spirits/whiskey/barrell-bourbon-batch-aged-years-from-in-ky-and-tn-168970/',
    distributor: 'BC Merchants',
  },
  {
    name:        'Barrell Craft Spirits 12yr French Oak Finished Bourbon',
    objectID:    '173557',
    url:         'https://www.binnys.com/spirits/whiskey/barrell-craft-spirits-year-old-french-oak-cask-finished-bourbon-173557/',
    distributor: 'BC Merchants',
  },
]

// ── WHISKEY HOTLINE BOTTLES ───────────────────────────────────────────────────
// Sold via Binny's Whiskey Hotline lottery or in-store allocation only.
// NOT in Algolia — cannot be API-checked.
// `distributor` drives the allocated bottle reference list when a truck from
// that distributor is detected at a store.

export const hotlineBottles = [
  // ── Unicorn Tier ──────────────────────────────────────────────────────────
  { divider: '🦄 Unicorn Tier' },
  // Breakthru Beverage — Buffalo Trace (Van Winkle family, BTAC)
  { name: 'Pappy Van Winkle 10yr',                  url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Pappy Van Winkle 12yr',                  url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Pappy Van Winkle 15yr',                  url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Pappy Van Winkle 20yr',                  url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Pappy Van Winkle 23yr',                  url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'George T. Stagg (BTAC)',                 url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  // Southern Glazer's — Heaven Hill
  { name: 'Old Fitzgerald Decanter Series',         url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  // RNDC — Four Roses
  { name: "Four Roses Elliott's Select",            url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'RNDC' },

  // ── Tier 1 — Highly Allocated ─────────────────────────────────────────────
  { divider: '🔴 Tier 1 — Highly Allocated' },
  // Breakthru Beverage — Buffalo Trace (Blanton's, Weller, E.H. Taylor)
  { name: "Blanton's Original Single Barrel",       url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: "Blanton's Straight from the Barrel",     url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: "Blanton's Gold Edition",                 url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Weller Special Reserve',                 url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Weller 12yr',                            url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Weller Antique 107',                     url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Weller CYPB',                            url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Weller Full Proof',                      url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'William Larue Weller (BTAC)',            url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'E.H. Taylor Small Batch',                url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'E.H. Taylor Single Barrel',              url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'E.H. Taylor Bottled-in-Bond',            url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  // Southern Glazer's — Heaven Hill (Elijah Craig Barrel Proof)
  { name: 'Elijah Craig Barrel Proof (A-batch)',    url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  { name: 'Elijah Craig Barrel Proof (B-batch)',    url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  { name: 'Elijah Craig Barrel Proof (C-batch)',    url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  { name: 'Heaven Hill Heritage Collection',        url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  // Southern Glazer's — Bacardi (Angel's Envy)
  { name: "Angel's Envy Cask Strength",             url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  // Southern Glazer's — WhistlePig
  { name: 'WhistlePig The Boss Hog',                url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  { name: 'WhistlePig 18yr',                        url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  // RNDC — Four Roses
  { name: 'Four Roses Limited Edition Small Batch', url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'RNDC' },

  // ── Tier 2 — Allocated ────────────────────────────────────────────────────
  { divider: '🟠 Tier 2 — Allocated' },
  // Breakthru Beverage — Buffalo Trace (BTAC, E.H. Taylor limited, Rock Hill)
  { name: 'Thomas H. Handy Sazerac (BTAC)',         url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Sazerac 18yr Rye (BTAC)',               url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Eagle Rare 10yr',                        url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Eagle Rare 17yr (BTAC)',                 url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'E.H. Taylor Four Grain',                 url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'E.H. Taylor Seasoned Wood',              url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'E.H. Taylor Cured Oak',                  url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Rock Hill Farms Single Barrel',          url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Stagg Jr.',                              url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  // Breakthru Beverage — Brown-Forman (Old Forester, Woodford Reserve, Jack Daniel's)
  { name: 'Old Forester Birthday Bourbon',          url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: "Woodford Reserve Master's Collection",   url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Woodford Reserve Baccarat Edition',      url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: "Jack Daniel's Single Barrel Barrel Proof", url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: "Jack Daniel's Coy Hill High Proof",      url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'King of Kentucky',                       url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  // Southern Glazer's — Campari (Wild Turkey / Russell's)
  { name: "Russell's Reserve 13yr",                 url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  { name: "Russell's Reserve 15yr",                 url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  { name: "Wild Turkey Master's Keep",              url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  { name: 'Wild Turkey Rare Breed Barrel Proof',    url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  // Southern Glazer's — Heaven Hill
  { name: "Parker's Heritage Collection",           url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  { name: 'Larceny Barrel Proof',                   url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  // Southern Glazer's — Beam Suntory (Booker's, Knob Creek, Little Book, Maker's Mark)
  { name: "Booker's Bourbon",                       url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  { name: 'Knob Creek 18yr',                        url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  { name: 'Little Book',                            url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  { name: "Maker's Mark Cask Strength",             url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  { name: "Maker's Mark Wood Finishing Series",     url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  // Southern Glazer's — Constellation (High West)
  { name: "High West A Midwinter Night's Dram",     url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  // Southern Glazer's — WhistlePig
  { name: 'WhistlePig 15yr',                        url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  // Other — distributor unconfirmed for IL
  { name: "Michter's 10yr Bourbon",                 url: 'https://www.binnys.com/whiskey-hotline/', distributor: null },
  { name: "Michter's 20yr Bourbon",                 url: 'https://www.binnys.com/whiskey-hotline/', distributor: null },
  { name: "Michter's 25yr Bourbon",                 url: 'https://www.binnys.com/whiskey-hotline/', distributor: null },
  // RNDC — Four Roses
  { name: 'Four Roses Single Barrel Limited',       url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'RNDC' },
  // BC Merchants — Willett / KBD
  { name: 'Willett Family Estate 4yr Bourbon',      url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'BC Merchants' },
  { name: 'Willett Family Estate 6yr Bourbon',      url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'BC Merchants' },
  // BC Merchants — Barrell Craft Spirits
  { name: 'Barrell Seagrass',                       url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'BC Merchants' },
  { name: 'Barrell Dovetail',                       url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'BC Merchants' },

  // ── Worth Watching — Sporadic / In-Store Allocation ───────────────────────
  { divider: '⬛ Worth Watching — In-Store Allocation' },
  // Breakthru Beverage
  { name: 'Buffalo Trace Bourbon',                  url: 'https://www.binnys.com/spirits/whiskey/', distributor: 'Breakthru Beverage' },
  { name: 'Bardstown Bourbon Co. Discovery Series', url: 'https://www.binnys.com/spirits/whiskey/', distributor: 'Breakthru Beverage' },
  { name: 'Woodford Reserve Double Double Oaked',   url: 'https://www.binnys.com/spirits/whiskey/', distributor: 'Breakthru Beverage' },
  { name: "Jack Daniel's 12yr",                     url: 'https://www.binnys.com/spirits/whiskey/', distributor: 'Breakthru Beverage' },
  // Southern Glazer's
  { name: 'Elijah Craig 18yr',                      url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  { name: 'Henry McKenna 10yr Single Barrel BIB',   url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  { name: 'Wild Turkey Rare Breed Rye',             url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  { name: "Russell's Reserve Single Barrel Bourbon", url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  { name: 'Knob Creek 9yr',                         url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  { name: 'Knob Creek Single Barrel Reserve',       url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  { name: "Baker's 13yr",                           url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  { name: "Angel's Envy Finished Rye",              url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  { name: 'High West Rendezvous Rye',               url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  { name: 'High West Bourye',                       url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  // BC Merchants — Willett / KBD
  { name: 'Willett Pot Still Reserve',              url: 'https://www.binnys.com/spirits/whiskey/', distributor: 'BC Merchants' },
  { name: 'Willett Family Estate Rye',              url: 'https://www.binnys.com/spirits/whiskey/', distributor: 'BC Merchants' },
  { name: 'Johnny Drum Private Stock',              url: 'https://www.binnys.com/spirits/whiskey/', distributor: 'BC Merchants' },
  { name: "Noah's Mill",                            url: 'https://www.binnys.com/spirits/whiskey/', distributor: 'BC Merchants' },
  { name: "Rowan's Creek",                          url: 'https://www.binnys.com/spirits/whiskey/', distributor: 'BC Merchants' },
  // BC Merchants — Barrell Craft Spirits
  { name: 'Barrell Vantage',                        url: 'https://www.binnys.com/spirits/whiskey/', distributor: 'BC Merchants' },
  { name: 'Barrell Armida',                         url: 'https://www.binnys.com/spirits/whiskey/', distributor: 'BC Merchants' },
  // Other — distributor unconfirmed for IL
  { name: "Michter's Toasted Barrel Finish Bourbon", url: 'https://www.binnys.com/spirits/whiskey/', distributor: null },
  { name: 'Smokewagon Uncut Unfiltered',            url: 'https://www.binnys.com/spirits/whiskey/', distributor: null },
]
