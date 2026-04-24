/**
 * Bottle definitions for the Chicagoland Binny's truck tracker.
 *
 * canaryBottles:  High-volume bottles used to detect truck arrivals.
 *                 ONE Algolia call per canary checks ALL store codes at once
 *                 via the inStockStores[] field.
 *
 * hotlineBottles: Allocated bottles sold via Binny's Whiskey Hotline lottery.
 *                 Used as a distributor → bottle reference map, and to build
 *                 the "head in and ask about" list when a truck is detected.
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
// Sold exclusively via Binny's Whiskey Hotline lottery.
// NOT in Algolia — cannot be API-checked.
// `distributor` drives the "check for" list when a truck from that distributor
// is detected at a store.

export const hotlineBottles = [
  // ── Unicorn Tier ──────────────────────────────────────────────────────────
  { divider: '🦄 Unicorn Tier' },
  { name: 'Pappy Van Winkle 10yr',              url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Pappy Van Winkle 12yr',              url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Pappy Van Winkle 15yr',              url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Pappy Van Winkle 20yr',              url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Pappy Van Winkle 23yr',              url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'George T. Stagg (BTAC)',             url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Old Fitzgerald Decanter Series',     url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },

  // ── Tier 1 — Highly Allocated ─────────────────────────────────────────────
  { divider: '🔴 Tier 1 — Highly Allocated' },
  { name: "Blanton's Original Single Barrel",   url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: "Blanton's Straight from the Barrel", url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Weller Special Reserve',             url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Weller 12yr',                        url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Weller Antique 107',                 url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Weller CYPB',                        url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Weller Full Proof',                  url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'William Larue Weller (BTAC)',        url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'E.H. Taylor Small Batch',            url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'E.H. Taylor Single Barrel',          url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'E.H. Taylor Bottled-in-Bond',        url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },

  // ── Tier 2 — Allocated ────────────────────────────────────────────────────
  { divider: '🟠 Tier 2 — Allocated' },
  { name: 'Thomas H. Handy Sazerac (BTAC)',    url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Sazerac 18yr Rye (BTAC)',           url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Eagle Rare 10yr',                   url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: 'Eagle Rare 17yr',                   url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: "Russell's Reserve 13yr",            url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  { name: "Russell's Reserve 15yr",            url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  { name: 'Old Forester Birthday Bourbon',     url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: "Parker's Heritage Collection",      url: 'https://www.binnys.com/whiskey-hotline/', distributor: "Southern Glazer's" },
  { name: 'King of Kentucky',                  url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },
  { name: "Michter's 10yr Bourbon",            url: 'https://www.binnys.com/whiskey-hotline/', distributor: null },
  { name: "Michter's 20yr Bourbon",            url: 'https://www.binnys.com/whiskey-hotline/', distributor: null },
  { name: "Michter's 25yr Bourbon",            url: 'https://www.binnys.com/whiskey-hotline/', distributor: null },
  { name: 'Stagg Jr.',                         url: 'https://www.binnys.com/whiskey-hotline/', distributor: 'Breakthru Beverage' },

  // ── Not in Algolia — Check In Store Manually ──────────────────────────────
  { divider: '⬛ Not API-trackable — Check In Store' },
  { name: 'Buffalo Trace Bourbon',                     url: 'https://www.binnys.com/spirits/whiskey/', distributor: 'Breakthru Beverage' },
  { name: 'Elijah Craig 18yr',                         url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  { name: 'Wild Turkey Rare Breed Rye',                url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  { name: "Russell's Reserve Single Barrel Bourbon",   url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  { name: 'Knob Creek 9yr',                            url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  { name: 'Knob Creek Single Barrel Reserve',          url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  { name: "Michter's Toasted Barrel Finish Bourbon",   url: 'https://www.binnys.com/spirits/whiskey/', distributor: null },
  { name: 'Willett Pot Still Reserve',                 url: 'https://www.binnys.com/spirits/whiskey/', distributor: 'BC Merchants' },
  { name: 'Willett Family Estate Rye',                 url: 'https://www.binnys.com/spirits/whiskey/', distributor: 'BC Merchants' },
  { name: 'High West Rendezvous Rye',                  url: 'https://www.binnys.com/spirits/whiskey/', distributor: "Southern Glazer's" },
  { name: 'Bardstown Bourbon Company Discovery Series', url: 'https://www.binnys.com/spirits/whiskey/', distributor: 'Breakthru Beverage' },
  { name: 'Smokewagon Uncut Unfiltered',               url: 'https://www.binnys.com/spirits/whiskey/', distributor: null },
]
