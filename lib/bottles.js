/**
 * Bottle lists for Binny's Orland Park inventory tracker.
 *
 * HOW LOOKUPS WORK
 * ─────────────────
 * Binny's uses Algolia (app Z25A2A928M, index Products_Production_AB_Test).
 * Each bottle entry needs an `objectID` — the numeric ID at the end of every
 * Binny's product URL, e.g.:
 *   https://www.binnys.com/spirits/whiskey/elijah-craig-limited-edition-barrel-proof-104979/
 *                                                                                      ^^^^^^
 * The check route fetches by objectID directly, bypassing all redirect rules.
 * URLs here are sourced directly from Algolia's productUrl field.
 *
 * DISTRIBUTOR FIELD
 * ──────────────────
 * Illinois spirits distributors (as of 2025-2026):
 *   "Breakthru Beverage" — Brown-Forman (Old Forester, Woodford Reserve),
 *                          Sazerac/Buffalo Trace portfolio, Bardstown Bourbon Co.
 *   "Southern Glazer's"  — Beam Suntory (Knob Creek, Maker's Mark, Booker's),
 *                          Campari (Wild Turkey, Russell's Reserve),
 *                          Bacardi (Angel's Envy), Heaven Hill (Elijah Craig,
 *                          Henry McKenna, Evan Williams, Larceny, Rittenhouse),
 *                          Constellation (High West), WhistlePig
 *   "RNDC"               — Four Roses (Kirin)
 *   "BC Merchants"       — Willett/KBD (confirmed), Barrell Craft Spirits (likely)
 *   null                 — Michter's (Chatham Imports — unconfirmed),
 *                          Smokewagon, Jefferson's (Pernod Ricard — unconfirmed)
 *
 * Sazerac/BT in IL: Breakthru took over from RNDC after the 2023 Sazerac split
 * (not publicly confirmed for IL, but Breakthru is the dominant IL spirits house
 * and was awarded other Sazerac markets).
 *
 * WHISKEY HOTLINE NOTE
 * ─────────────────────
 * Binny's most-allocated bottles (Blanton's, Eagle Rare, Weller, Pappy, full
 * BTAC, Old Fitz BIB, Parker's Heritage, Old Forester Birthday, Michter's
 * 10/20/25yr, Stagg Jr.) are sold exclusively through the Whiskey Hotline
 * lottery and are NOT indexed in Algolia at all.  Those bottles live in
 * `hotlineBottles` — they link to the Hotline page and cannot be API-checked.
 */

// ── ALERT BOTTLES ─────────────────────────────────────────────────────────────
// Email sent immediately when any of these are in stock at Orland Park (#47).
// Rule of thumb: bottles that disappear within hours of hitting shelves.

export const alertBottles = [
  // ── Elijah Craig ──────────────────────────────────────────────────────────
  {
    name:        "Elijah Craig Barrel Proof (Limited Edition)",
    objectID:    "104979",
    url:         "https://www.binnys.com/spirits/whiskey/elijah-craig-limited-edition-barrel-proof-104979/",
    distributor: "Southern Glazer's",
  },

  // ── Angel's Envy ──────────────────────────────────────────────────────────
  {
    name:        "Angel's Envy Cask Strength 10yr 2025",
    objectID:    "173648",
    url:         "https://www.binnys.com/spirits/whiskey/angels-envy-cask-strength-year-old-bourbon-limited-release-173648/",
    distributor: "Southern Glazer's",
  },
  {
    name:        "Angel's Envy Bottled in Bond",
    objectID:    "171477",
    url:         "https://www.binnys.com/spirits/whiskey/angels-envy-bourbon-bottled-in-bond-limited-edition-171477/",
    distributor: "Southern Glazer's",
  },

  // ── Four Roses ────────────────────────────────────────────────────────────
  {
    name:        "Four Roses Single Barrel Limited (OBSK)",
    objectID:    "173006",
    url:         "https://www.binnys.com/spirits/whiskey/four-roses-single-barrel-obsk-limited-release-173006/",
    distributor: "RNDC",
  },
  {
    name:        "Four Roses Single Barrel Limited (OBSF)",
    objectID:    "164534",
    url:         "https://www.binnys.com/spirits/whiskey/four-roses-single-barrel-obsf-limited-release-164534/",
    distributor: "RNDC",
  },

  // ── Heaven Hill ───────────────────────────────────────────────────────────
  {
    name:        "Henry McKenna 10yr Single Barrel BIB",
    objectID:    "193801",
    url:         "https://www.binnys.com/spirits/whiskey/henry-mckenna-year-old-single-barrel-bottled-in-bond-193801/",
    distributor: "Southern Glazer's",
  },
  {
    name:        "Evan Williams Single Barrel Vintage",
    objectID:    "192391",
    url:         "https://www.binnys.com/spirits/whiskey/evan-williams-single-barrel-bourbon-192391/",
    distributor: "Southern Glazer's",
  },

  // ── Barrell Craft Spirits ─────────────────────────────────────────────────
  {
    name:        "Barrell Bourbon Batch 037",
    objectID:    "168970",
    url:         "https://www.binnys.com/spirits/whiskey/barrell-bourbon-batch-aged-years-from-in-ky-and-tn-168970/",
    distributor: "BC Merchants",
  },

  // ── High West ─────────────────────────────────────────────────────────────
  {
    name:        "High West A Midwinter Night's Dram",
    objectID:    "75367",
    url:         "https://www.binnys.com/spirits/whiskey/high-west-a-midwinter-nights-dram-port-and-french-oak-finished-rye-75367/",
    distributor: "Southern Glazer's",
  },

  // ── Maker's Mark ──────────────────────────────────────────────────────────
  {
    name:        "Maker's Mark Cask Strength 7yr",
    objectID:    "175857",
    url:         "https://www.binnys.com/spirits/whiskey/makers-mark-cask-strength-year-bourbon-175857/",
    distributor: "Southern Glazer's",
  },
]

// ── TRACK-ONLY BOTTLES ────────────────────────────────────────────────────────
// Checked 4× daily and shown in the UI, but no email alert.

export const trackBottles = [
  // ── Elijah Craig ──────────────────────────────────────────────────────────
  {
    name:        "Elijah Craig Small Batch",
    objectID:    "192384",
    url:         "https://www.binnys.com/spirits/whiskey/elijah-craig-small-batch-bourbon-192384/",
    distributor: "Southern Glazer's",
  },
  {
    name:        "Elijah Craig Toasted Barrel",
    objectID:    "106996",
    url:         "https://www.binnys.com/spirits/whiskey/elijah-craig-toasted-barrel-straight-bourbon-106996/",
    distributor: "Southern Glazer's",
  },

  // ── Four Roses ────────────────────────────────────────────────────────────
  {
    name:        "Four Roses Small Batch Select",
    objectID:    "101259",
    url:         "https://www.binnys.com/spirits/whiskey/four-roses-small-batch-select-kentucky-straight-bourbon-101259/",
    distributor: "RNDC",
  },
  {
    name:        "Four Roses Single Barrel",
    objectID:    "192671",
    url:         "https://www.binnys.com/spirits/whiskey/four-roses-single-barrel-192671/",
    distributor: "RNDC",
  },
  {
    name:        "Four Roses Small Batch",
    objectID:    "192661",
    url:         "https://www.binnys.com/spirits/whiskey/four-roses-small-batch-bourbon-192661/",
    distributor: "RNDC",
  },
  // 🐦 Canary — high volume, reliable RNDC truck signal
  {
    name:        "Four Roses Bourbon",
    objectID:    "192651",
    url:         "https://www.binnys.com/spirits/whiskey/four-roses-bourbon-192651/",
    distributor: "RNDC",
  },

  // ── Old Forester ──────────────────────────────────────────────────────────
  // 🐦 Canary — high volume, reliable Breakthru Beverage truck signal
  {
    name:        "Old Forester 86° Bourbon",
    objectID:    "195257",
    url:         "https://www.binnys.com/spirits/whiskey/old-forester-bourbon-proof-bourbon-195257/",
    distributor: "Breakthru Beverage",
  },
  // Whiskey Row series
  {
    name:        "Old Forester 1870 Original Batch",
    objectID:    "77269",
    url:         "https://www.binnys.com/spirits/whiskey/old-forester-original-batch-kentucky-straight-bourbon-77269/",
    distributor: "Breakthru Beverage",
  },
  {
    name:        "Old Forester 1897 Bottled in Bond",
    objectID:    "83712",
    url:         "https://www.binnys.com/spirits/whiskey/old-forester-bottled-in-bond-kentucky-straight-bourbon-83712/",
    distributor: "Breakthru Beverage",
  },
  {
    name:        "Old Forester 1910 Old Fine Whisky",
    objectID:    "970587",
    url:         "https://www.binnys.com/spirits/whiskey/old-forester-old-fine-whisky-kentucky-straight-bourbon-970587/",
    distributor: "Breakthru Beverage",
  },
  {
    name:        "Old Forester 1920 Prohibition Style",
    objectID:    "948174",
    url:         "https://www.binnys.com/spirits/whiskey/old-forester-prohibition-style-kentucky-straight-bourbon-948174/",
    distributor: "Breakthru Beverage",
  },

  // ── Wild Turkey ───────────────────────────────────────────────────────────
  {
    name:        "Wild Turkey Rare Breed Bourbon",
    objectID:    "197773",
    url:         "https://www.binnys.com/spirits/whiskey/wild-turkey-rare-breed-bourbon-197773/",
    distributor: "Southern Glazer's",
  },
  {
    name:        "Wild Turkey Russell's Reserve 10yr",
    objectID:    "197823",
    url:         "https://www.binnys.com/spirits/whiskey/wild-turkey-russells-reserve-year-old-small-batch-bourbon-197823/",
    distributor: "Southern Glazer's",
  },
  {
    name:        "Wild Turkey Russell's Reserve Single Barrel Rye",
    objectID:    "86969",
    url:         "https://www.binnys.com/spirits/whiskey/wild-turkey-russells-reserve-single-barrel-rye-86969/",
    distributor: "Southern Glazer's",
  },

  // ── Angel's Envy ──────────────────────────────────────────────────────────
  {
    name:        "Angel's Envy Port Barrel Finished",
    objectID:    "190031",
    url:         "https://www.binnys.com/spirits/whiskey/angels-envy-port-barrel-finished-bourbon-190031/",
    distributor: "Southern Glazer's",
  },
  {
    name:        "Angel's Envy Triple Oak",
    objectID:    "159143",
    url:         "https://www.binnys.com/spirits/whiskey/angels-envy-triple-oak-bourbon-159143/",
    distributor: "Southern Glazer's",
  },

  // ── Jefferson's ───────────────────────────────────────────────────────────
  {
    name:        "Jefferson's Tropics Aged in Humidity",
    objectID:    "146155",
    url:         "https://www.binnys.com/spirits/whiskey/jeffersons-tropics-aged-in-humidity-limited-release-146155/",
    distributor: null,   // Pernod Ricard IL distributor unconfirmed
  },
  {
    name:        "Jefferson's Ocean Aged at Sea",
    objectID:    "68108",
    url:         "https://www.binnys.com/spirits/whiskey/jeffersons-ocean-aged-at-sea-bourbon-standard-release-68108/",
    distributor: null,
  },

  // ── Larceny ───────────────────────────────────────────────────────────────
  {
    name:        "Larceny Barrel Proof Bourbon",
    objectID:    "156006",
    url:         "https://www.binnys.com/spirits/whiskey/larceny-barrel-proof-bourbon-156006/",
    distributor: "Southern Glazer's",
  },

  // ── Knob Creek / Jim Beam (Beam Suntory → Southern Glazer's) ─────────────
  // 🐦 Canaries — high volume, reliable Southern Glazer's truck signals
  {
    name:        "Jim Beam Bourbon",
    objectID:    "190665",
    url:         "https://www.binnys.com/spirits/whiskey/jim-beam-bourbon-190665/",
    distributor: "Southern Glazer's",
  },
  {
    name:        "Knob Creek Kentucky Straight Bourbon",
    objectID:    "194471",
    url:         "https://www.binnys.com/spirits/whiskey/knob-creek-kentucky-straight-bourbon-194471/",
    distributor: "Southern Glazer's",
  },
  {
    name:        "Knob Creek Blenders Edition Bourbon",
    objectID:    "176968",
    url:         "https://www.binnys.com/spirits/whiskey/knob-creek-blenders-edition-bourbon-176968/",
    distributor: "Southern Glazer's",
  },

  // ── Booker's ──────────────────────────────────────────────────────────────
  {
    name:        "Booker's Jerry's Batch",
    objectID:    "172610",
    url:         "https://www.binnys.com/spirits/whiskey/bookers-bourbon-jerrys-batch-172610/",
    distributor: "Southern Glazer's",
  },
  {
    name:        "Booker's 2025-2 By the Pond Batch",
    objectID:    "169018",
    url:         "https://www.binnys.com/spirits/whiskey/bookers-bourbon-year-by-the-pond-batch-169018/",
    distributor: "Southern Glazer's",
  },

  // ── Woodford Reserve Master's Collection ──────────────────────────────────
  {
    name:        "Woodford Reserve Master's Collection Batch Proof 2025",
    objectID:    "163682",
    url:         "https://www.binnys.com/spirits/whiskey/woodford-reserve-masters-collection-batch-proof-163682/",
    distributor: "Breakthru Beverage",
  },
  {
    name:        "Woodford Reserve Master's Collection Sweet Oak 2025",
    objectID:    "172709",
    url:         "https://www.binnys.com/spirits/whiskey/woodford-reserve-masters-collection-sweet-oak-aged-in-chinkapin-oak-172709/",
    distributor: "Breakthru Beverage",
  },
  {
    name:        "Woodford Reserve Baccarat Edition",
    objectID:    "130917",
    url:         "https://www.binnys.com/spirits/whiskey/woodford-reserve-baccarat-edition-finished-in-xo-cognac-casks-130917/",
    distributor: "Breakthru Beverage",
  },

  // ── Heaven Hill ───────────────────────────────────────────────────────────
  {
    name:        "Heaven Hill Grain to Glass Bourbon",
    objectID:    "157166",
    url:         "https://www.binnys.com/spirits/whiskey/heaven-hill-grain-to-glass-kentucky-straight-bourbon-157166/",
    distributor: "Southern Glazer's",
  },
  {
    name:        "Heaven Hill Grain to Glass Wheated Bourbon",
    objectID:    "157167",
    url:         "https://www.binnys.com/spirits/whiskey/heaven-hill-grain-to-glass-kentucky-straight-wheated-bourbon-157167/",
    distributor: "Southern Glazer's",
  },

  // ── Michter's ─────────────────────────────────────────────────────────────
  {
    name:        "Michter's US*1 Small Batch Bourbon",
    objectID:    "194814",
    url:         "https://www.binnys.com/spirits/whiskey/michters-us-small-batch-bourbon-194814/",
    distributor: null,   // Chatham Imports — IL distributor unconfirmed
  },
  {
    name:        "Michter's US*1 Sour Mash Whiskey",
    objectID:    "194813",
    url:         "https://www.binnys.com/spirits/whiskey/michters-us-small-batch-sour-mash-whiskey-194813/",
    distributor: null,
  },
  {
    name:        "Michter's US*1 Single Barrel Rye",
    objectID:    "194801",
    url:         "https://www.binnys.com/spirits/whiskey/michters-us-single-barrel-straight-rye-194801/",
    distributor: null,
  },

  // ── Buffalo Trace Portfolio ────────────────────────────────────────────────
  // Sazerac/BT → Breakthru Beverage after 2023 RNDC split (IL not publicly
  // confirmed but Breakthru is the dominant IL Sazerac heir).
  {
    name:        "Benchmark Full Proof",
    objectID:    "152774",
    url:         "https://www.binnys.com/spirits/whiskey/benchmark-full-proof-kentucky-straight-bourbon-152774/",
    distributor: "Breakthru Beverage",
  },
  {
    name:        "Ancient Age Kentucky Straight Bourbon",
    objectID:    "190011",
    url:         "https://www.binnys.com/spirits/whiskey/ancient-age-kentucky-straight-bourbon-190011/",
    distributor: "Breakthru Beverage",
  },

  // ── Maker's Mark ──────────────────────────────────────────────────────────
  {
    name:        "Maker's Mark 46 Cask Strength",
    objectID:    "106781",
    url:         "https://www.binnys.com/spirits/whiskey/makers-mark-cask-strength-106781/",
    distributor: "Southern Glazer's",
  },

  // ── Barrell Craft Spirits ─────────────────────────────────────────────────
  {
    name:        "Barrell Craft Spirits 12yr French Oak Finished Bourbon",
    objectID:    "173557",
    url:         "https://www.binnys.com/spirits/whiskey/barrell-craft-spirits-year-old-french-oak-cask-finished-bourbon-173557/",
    distributor: "BC Merchants",
  },

  // ── Bardstown Bourbon Company ─────────────────────────────────────────────
  {
    name:        "Bardstown Bourbon Company Origin Series Bourbon",
    objectID:    "138660",
    url:         "https://www.binnys.com/spirits/whiskey/bardstown-bourbon-company-origin-series-kentucky-straight-bourbon-138660/",
    distributor: "Breakthru Beverage",
  },
  {
    name:        "Bardstown Bourbon Company Collaborative Series Silver Oak",
    objectID:    "159191",
    url:         "https://www.binnys.com/spirits/whiskey/bardstown-bourbon-company-collaborative-series-silver-oak-159191/",
    distributor: "Breakthru Beverage",
  },

  // ── Rye Whiskeys ──────────────────────────────────────────────────────────
  {
    name:        "Sazerac Straight Rye",
    objectID:    "196996",
    url:         "https://www.binnys.com/spirits/whiskey/sazerac-straight-rye-196996/",
    distributor: "Breakthru Beverage",
  },
  {
    name:        "Sazerac 100 Proof Straight Rye",
    objectID:    "172767",
    url:         "https://www.binnys.com/spirits/whiskey/sazerac-proof-straight-rye-172767/",
    distributor: "Breakthru Beverage",
  },
  {
    name:        "Rittenhouse Rye BIB 100 Proof",
    objectID:    "196941",
    url:         "https://www.binnys.com/spirits/whiskey/rittenhouse-rye-proof-196941/",
    distributor: "Southern Glazer's",
  },
  {
    name:        "WhistlePig 10yr Straight Rye",
    objectID:    "198401",
    url:         "https://www.binnys.com/spirits/whiskey/whistlepig-year-old-straight-rye-whiskey-198401/",
    distributor: "Southern Glazer's",
  },
]

// ── WHISKEY HOTLINE BOTTLES ───────────────────────────────────────────────────
// Sold exclusively via Binny's Whiskey Hotline lottery.
// NOT in Algolia — cannot be API-checked. Sign up at binnys.com/whiskey-hotline/
//
// `distributor` here is used by truck-detection logic to build the "check for"
// list when a canary bottle from the same distributor comes in stock.

export const hotlineBottles = [
  // ── Unicorn Tier ──────────────────────────────────────────────────────────
  { divider: "🦄 Unicorn Tier" },
  // Pappy Van Winkle — Buffalo Trace / Sazerac → Breakthru Beverage
  { name: "Pappy Van Winkle 10yr",              url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "Pappy Van Winkle 12yr",              url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "Pappy Van Winkle 15yr",              url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "Pappy Van Winkle 20yr",              url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "Pappy Van Winkle 23yr",              url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  // BTAC — George T. Stagg (Buffalo Trace / Sazerac)
  { name: "George T. Stagg (BTAC)",             url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  // Old Fitzgerald Decanter — Heaven Hill → Southern Glazer's
  { name: "Old Fitzgerald Decanter Series",     url: "https://www.binnys.com/whiskey-hotline/", distributor: "Southern Glazer's" },

  // ── Tier 1 — Highly Allocated ─────────────────────────────────────────────
  { divider: "🔴 Tier 1 — Highly Allocated" },
  // Blanton's — Buffalo Trace / Sazerac → Breakthru Beverage
  { name: "Blanton's Original Single Barrel",   url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "Blanton's Straight from the Barrel", url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  // Weller — Buffalo Trace / Sazerac → Breakthru Beverage
  { name: "Weller Special Reserve",             url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "Weller 12yr",                        url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "Weller Antique 107",                 url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "Weller CYPB",                        url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "Weller Full Proof",                  url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "William Larue Weller (BTAC)",        url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  // E.H. Taylor — Buffalo Trace / Sazerac → Breakthru Beverage
  { name: "E.H. Taylor Small Batch",            url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "E.H. Taylor Single Barrel",          url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "E.H. Taylor Bottled-in-Bond",        url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },

  // ── Tier 2 — Allocated ────────────────────────────────────────────────────
  { divider: "🟠 Tier 2 — Allocated" },
  // BTAC Rye — Sazerac → Breakthru Beverage
  { name: "Thomas H. Handy Sazerac (BTAC)",    url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "Sazerac 18yr Rye (BTAC)",           url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  // Eagle Rare — Buffalo Trace / Sazerac → Breakthru Beverage
  { name: "Eagle Rare 10yr",                   url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "Eagle Rare 17yr",                   url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  // Russell's Reserve Limited — Campari → Southern Glazer's
  { name: "Russell's Reserve 13yr",            url: "https://www.binnys.com/whiskey-hotline/", distributor: "Southern Glazer's" },
  { name: "Russell's Reserve 15yr",            url: "https://www.binnys.com/whiskey-hotline/", distributor: "Southern Glazer's" },
  // Other
  { name: "Old Forester Birthday Bourbon",     url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "Parker's Heritage Collection",      url: "https://www.binnys.com/whiskey-hotline/", distributor: "Southern Glazer's" },
  { name: "King of Kentucky",                  url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },
  { name: "Michter's 10yr Bourbon",            url: "https://www.binnys.com/whiskey-hotline/", distributor: null },
  { name: "Michter's 20yr Bourbon",            url: "https://www.binnys.com/whiskey-hotline/", distributor: null },
  { name: "Michter's 25yr Bourbon",            url: "https://www.binnys.com/whiskey-hotline/", distributor: null },
  { name: "Stagg Jr.",                         url: "https://www.binnys.com/whiskey-hotline/", distributor: "Breakthru Beverage" },

  // ── Not in Algolia — Check In Store Manually ──────────────────────────────
  { divider: "⬛ Not API-trackable — Check In Store" },
  // Buffalo Trace / Sazerac → Breakthru Beverage
  { name: "Buffalo Trace Bourbon",                    url: "https://www.binnys.com/spirits/whiskey/", distributor: "Breakthru Beverage" },
  // Heaven Hill → Southern Glazer's
  { name: "Elijah Craig 18yr",                        url: "https://www.binnys.com/spirits/whiskey/", distributor: "Southern Glazer's" },
  // Campari → Southern Glazer's
  { name: "Wild Turkey Rare Breed Rye",               url: "https://www.binnys.com/spirits/whiskey/", distributor: "Southern Glazer's" },
  { name: "Russell's Reserve Single Barrel Bourbon",  url: "https://www.binnys.com/spirits/whiskey/", distributor: "Southern Glazer's" },
  // Beam Suntory → Southern Glazer's
  { name: "Knob Creek 9yr",                           url: "https://www.binnys.com/spirits/whiskey/", distributor: "Southern Glazer's" },
  { name: "Knob Creek Single Barrel Reserve",         url: "https://www.binnys.com/spirits/whiskey/", distributor: "Southern Glazer's" },
  // Michter's — unconfirmed
  { name: "Michter's Toasted Barrel Finish Bourbon",  url: "https://www.binnys.com/spirits/whiskey/", distributor: null },
  // Willett — BC Merchants
  { name: "Willett Pot Still Reserve",                url: "https://www.binnys.com/spirits/whiskey/", distributor: "BC Merchants" },
  { name: "Willett Family Estate Rye",                url: "https://www.binnys.com/spirits/whiskey/", distributor: "BC Merchants" },
  // Constellation → Southern Glazer's
  { name: "High West Rendezvous Rye",                 url: "https://www.binnys.com/spirits/whiskey/", distributor: "Southern Glazer's" },
  // Bardstown → Breakthru Beverage
  { name: "Bardstown Bourbon Company Discovery Series", url: "https://www.binnys.com/spirits/whiskey/", distributor: "Breakthru Beverage" },
  // Smokewagon — distributor unknown
  { name: "Smokewagon Uncut Unfiltered",              url: "https://www.binnys.com/spirits/whiskey/", distributor: null },
]
