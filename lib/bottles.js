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
// Keep this list small — only high-volume bottles with reliable restock signals.

export const canaryBottles = [
  // ── Breakthru Beverage ───────────────────────────────────────────────────
  {
    name:        'Old Forester 86° Bourbon',
    objectID:    '195257',
    url:         'https://www.binnys.com/spirits/whiskey/old-forester-bourbon-proof-bourbon-195257/',
    distributor: 'Breakthru Beverage',
  },
  {
    name:        'Benchmark Full Proof',
    objectID:    '152774',
    url:         'https://www.binnys.com/spirits/whiskey/benchmark-full-proof-kentucky-straight-bourbon-152774/',
    distributor: 'Breakthru Beverage',
  },

  // ── Southern Glazer's ────────────────────────────────────────────────────
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

  // ── RNDC ─────────────────────────────────────────────────────────────────
  {
    name:        'Four Roses Bourbon',
    objectID:    '192651',
    url:         'https://www.binnys.com/spirits/whiskey/four-roses-bourbon-192651/',
    distributor: 'RNDC',
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
