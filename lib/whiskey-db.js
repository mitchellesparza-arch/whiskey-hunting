/**
 * Whiskey database — seed data + Redis UPC cache.
 *
 * Lookup priority:
 *  1. Redis UPC cache  (populated on first scan)
 *  2. upcitemdb.com   (free tier, 100/day — no key required)
 *     → product name cross-referenced against seed data
 *  3. Seed data name search (fuzzy match)
 *
 * Redis keys:
 *   wh:upc:{upc}  →  JSON bottle data
 */

import { Redis } from '@upstash/redis'

function getRedis() {
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

// ── Local UPC map ─────────────────────────────────────────────────────────────
// Static lookup for common rare/allocated bottles — checked before any external
// API call.  imageUrl is null (no CDN hosting) unless a stable URL is known.
export const UPC_MAP = {
  // Buffalo Trace / Sazerac
  '080686003519': { name: "Blanton's Original Single Barrel",       imageUrl: null },
  '080686004001': { name: "Blanton's Gold Edition",                 imageUrl: null },
  '080686004018': { name: "Blanton's Straight From The Barrel",     imageUrl: null },
  '080686004011': { name: "Eagle Rare 10 Year",                     imageUrl: null },
  '088004003761': { name: "Buffalo Trace Bourbon",                  imageUrl: null },
  '096749026005': { name: "Weller Special Reserve",                 imageUrl: null },
  '088004051847': { name: "Weller Antique 107",                     imageUrl: null },
  '088004003723': { name: "Weller 12 Year",                         imageUrl: null },
  '088004003730': { name: "Weller Full Proof",                      imageUrl: null },
  '088004012411': { name: "Weller CYPB",                            imageUrl: null },
  '088004011827': { name: "George T. Stagg",                        imageUrl: null },
  '088004011834': { name: "William Larue Weller",                   imageUrl: null },
  '088004011810': { name: "Thomas H. Handy Sazerac Rye",            imageUrl: null },
  '088004011803': { name: "Sazerac Rye 18 Year",                    imageUrl: null },
  '096749026203': { name: "Pappy Van Winkle 15 Year",               imageUrl: null },
  '096749026302': { name: "Pappy Van Winkle 20 Year",               imageUrl: null },
  '096749026401': { name: "Pappy Van Winkle 23 Year",               imageUrl: null },
  '096749026104': { name: "Pappy Van Winkle 12 Year",               imageUrl: null },
  '096749026005': { name: "Pappy Van Winkle 10 Year",               imageUrl: null },
  '088004012305': { name: "E.H. Taylor Small Batch",                imageUrl: null },
  '088004012312': { name: "E.H. Taylor Single Barrel",              imageUrl: null },
  '088004012329': { name: "E.H. Taylor Barrel Proof",               imageUrl: null },
  '088004012336': { name: "E.H. Taylor Straight Rye",               imageUrl: null },
  '088004012435': { name: "Stagg Jr.",                              imageUrl: null },

  // Heaven Hill
  '096749904411': { name: "Elijah Craig Barrel Proof",              imageUrl: null },
  '096749000105': { name: "Elijah Craig Small Batch",               imageUrl: null },
  '096749000211': { name: "Elijah Craig 18 Year",                   imageUrl: null },
  '096749012108': { name: "Old Fitzgerald Bottled in Bond 8yr",     imageUrl: null },
  '096749012115': { name: "Old Fitzgerald Bottled in Bond 11yr",    imageUrl: null },
  '096749012122': { name: "Old Fitzgerald Bottled in Bond 13yr",    imageUrl: null },
  '096749012139': { name: "Old Fitzgerald Bottled in Bond 15yr",    imageUrl: null },
  '096749003106': { name: "Parker's Heritage Collection",           imageUrl: null },
  '096749031008': { name: "Larceny Barrel Proof",                   imageUrl: null },

  // Four Roses
  '081753800018': { name: "Four Roses Small Batch Select",          imageUrl: null },
  '081753800001': { name: "Four Roses Single Barrel",               imageUrl: null },
  '081753800025': { name: "Four Roses Limited Small Batch",         imageUrl: null },

  // Brown-Forman
  '086785580028': { name: "Old Forester Birthday Bourbon",          imageUrl: null },
  '086785580516': { name: "Old Forester 1920 Prohibition Style",    imageUrl: null },
  '086785580509': { name: "Old Forester 1910 Old Fine Whisky",      imageUrl: null },
  '086785580497': { name: "Old Forester 1897 Bottled in Bond",      imageUrl: null },
  '086785016125': { name: "Woodford Reserve Batch Proof",           imageUrl: null },
  '086785016026': { name: "Woodford Reserve Double Oaked",          imageUrl: null },

  // Wild Turkey / Campari
  '080432400417': { name: "Wild Turkey Rare Breed",                 imageUrl: null },
  '080432102121': { name: "Russell's Reserve Single Barrel",        imageUrl: null },

  // Angel's Envy
  '857537003020': { name: "Angel's Envy Cask Strength",             imageUrl: null },
  '857537003013': { name: "Angel's Envy Bottled in Bond",           imageUrl: null },

  // Beam Suntory
  '080686976874': { name: "Knob Creek Single Barrel Reserve",       imageUrl: null },
  '080686976881': { name: "Knob Creek 12 Year",                     imageUrl: null },
  '080686003588': { name: "Booker's Bourbon",                       imageUrl: null },

  // Michter's
  '859711006061': { name: "Michter's 10 Year Bourbon",              imageUrl: null },
  '859711006078': { name: "Michter's 20 Year Bourbon",              imageUrl: null },
  '859711006085': { name: "Michter's 25 Year Bourbon",              imageUrl: null },
  '859711006016': { name: "Michter's US*1 Small Batch Bourbon",     imageUrl: null },
  '859711006023': { name: "Michter's US*1 Rye",                     imageUrl: null },
  '859711006030': { name: "Michter's US*1 Toasted Barrel Bourbon",  imageUrl: null },
}

// ── Seed data ─────────────────────────────────────────────────────────────────
// name, distillery, category, proof, msrp (USD typical retail)

export const SEED_BOTTLES = [
  // ── Buffalo Trace Distillery ──────────────────────────────────────────────
  { name: "Buffalo Trace Bourbon",                  distillery: "Buffalo Trace",  category: "Bourbon", proof: 90,    msrp: 28  },
  { name: "Blanton's Original Single Barrel",       distillery: "Buffalo Trace",  category: "Bourbon", proof: 93,    msrp: 65  },
  { name: "Blanton's Straight From The Barrel",     distillery: "Buffalo Trace",  category: "Bourbon", proof: null,  msrp: 120 },
  { name: "Blanton's Gold Edition",                 distillery: "Buffalo Trace",  category: "Bourbon", proof: 103,   msrp: 80  },
  { name: "Eagle Rare 10 Year",                     distillery: "Buffalo Trace",  category: "Bourbon", proof: 90,    msrp: 40  },
  { name: "E.H. Taylor Small Batch",                distillery: "Buffalo Trace",  category: "Bourbon", proof: 100,   msrp: 40  },
  { name: "E.H. Taylor Single Barrel",              distillery: "Buffalo Trace",  category: "Bourbon", proof: 100,   msrp: 70  },
  { name: "E.H. Taylor Barrel Proof",               distillery: "Buffalo Trace",  category: "Bourbon", proof: null,  msrp: 70  },
  { name: "E.H. Taylor Straight Rye",               distillery: "Buffalo Trace",  category: "Rye",     proof: 100,   msrp: 40  },
  { name: "Weller Special Reserve",                 distillery: "Buffalo Trace",  category: "Bourbon", proof: 90,    msrp: 25  },
  { name: "Weller 12 Year",                         distillery: "Buffalo Trace",  category: "Bourbon", proof: 90,    msrp: 35  },
  { name: "Weller Antique 107",                     distillery: "Buffalo Trace",  category: "Bourbon", proof: 107,   msrp: 50  },
  { name: "Weller Full Proof",                      distillery: "Buffalo Trace",  category: "Bourbon", proof: 114,   msrp: 50  },
  { name: "Weller CYPB",                            distillery: "Buffalo Trace",  category: "Bourbon", proof: 95,    msrp: 150 },
  { name: "Stagg Jr.",                              distillery: "Buffalo Trace",  category: "Bourbon", proof: null,  msrp: 50  },
  { name: "George T. Stagg",                        distillery: "Buffalo Trace",  category: "Bourbon", proof: null,  msrp: 100 },
  { name: "Sazerac Rye 6 Year",                     distillery: "Buffalo Trace",  category: "Rye",     proof: 90,    msrp: 25  },
  { name: "Thomas H. Handy Sazerac Rye",            distillery: "Buffalo Trace",  category: "Rye",     proof: null,  msrp: 100 },
  { name: "Pappy Van Winkle 10 Year",               distillery: "Buffalo Trace",  category: "Bourbon", proof: 107,   msrp: 70  },
  { name: "Pappy Van Winkle 12 Year",               distillery: "Buffalo Trace",  category: "Bourbon", proof: 90,    msrp: 80  },
  { name: "Pappy Van Winkle 15 Year",               distillery: "Buffalo Trace",  category: "Bourbon", proof: 107,   msrp: 120 },
  { name: "Pappy Van Winkle 20 Year",               distillery: "Buffalo Trace",  category: "Bourbon", proof: 90.4,  msrp: 200 },
  { name: "Pappy Van Winkle 23 Year",               distillery: "Buffalo Trace",  category: "Bourbon", proof: 95.6,  msrp: 300 },

  // ── Heaven Hill ───────────────────────────────────────────────────────────
  { name: "Elijah Craig Small Batch",               distillery: "Heaven Hill",    category: "Bourbon", proof: 94,    msrp: 30  },
  { name: "Elijah Craig Barrel Proof",              distillery: "Heaven Hill",    category: "Bourbon", proof: null,  msrp: 55  },
  { name: "Elijah Craig Toasted Barrel",            distillery: "Heaven Hill",    category: "Bourbon", proof: 94,    msrp: 40  },
  { name: "Elijah Craig 18 Year",                   distillery: "Heaven Hill",    category: "Bourbon", proof: 90,    msrp: 130 },
  { name: "Evan Williams Black Label",              distillery: "Heaven Hill",    category: "Bourbon", proof: 86,    msrp: 16  },
  { name: "Evan Williams Bottled in Bond",          distillery: "Heaven Hill",    category: "Bourbon", proof: 100,   msrp: 20  },
  { name: "Evan Williams 1783 Small Batch",         distillery: "Heaven Hill",    category: "Bourbon", proof: 86,    msrp: 22  },
  { name: "Heaven Hill 7 Year Bottled in Bond",     distillery: "Heaven Hill",    category: "Bourbon", proof: 100,   msrp: 30  },
  { name: "Larceny Small Batch",                    distillery: "Heaven Hill",    category: "Bourbon", proof: 92,    msrp: 27  },
  { name: "Larceny Barrel Proof",                   distillery: "Heaven Hill",    category: "Bourbon", proof: null,  msrp: 50  },
  { name: "Old Fitzgerald Bottled in Bond",         distillery: "Heaven Hill",    category: "Bourbon", proof: 100,   msrp: 50  },
  { name: "Bernheim Original Wheat Whiskey",        distillery: "Heaven Hill",    category: "American",proof: 90,    msrp: 35  },
  { name: "Rittenhouse Rye Bottled in Bond",        distillery: "Heaven Hill",    category: "Rye",     proof: 100,   msrp: 28  },
  { name: "Parker's Heritage Collection",           distillery: "Heaven Hill",    category: "Bourbon", proof: null,  msrp: 100 },

  // ── Wild Turkey / Campari ─────────────────────────────────────────────────
  { name: "Wild Turkey 101",                        distillery: "Wild Turkey",    category: "Bourbon", proof: 101,   msrp: 25  },
  { name: "Wild Turkey 81",                         distillery: "Wild Turkey",    category: "Bourbon", proof: 81,    msrp: 22  },
  { name: "Wild Turkey Rare Breed",                 distillery: "Wild Turkey",    category: "Bourbon", proof: 116.8, msrp: 60  },
  { name: "Wild Turkey Longbranch",                 distillery: "Wild Turkey",    category: "Bourbon", proof: 86,    msrp: 35  },
  { name: "Russell's Reserve 10 Year",              distillery: "Wild Turkey",    category: "Bourbon", proof: 90,    msrp: 40  },
  { name: "Russell's Reserve Single Barrel",        distillery: "Wild Turkey",    category: "Bourbon", proof: 110,   msrp: 80  },
  { name: "Russell's Reserve 6 Year Rye",           distillery: "Wild Turkey",    category: "Rye",     proof: 90,    msrp: 40  },

  // ── Four Roses ───────────────────────────────────────────────────────────
  { name: "Four Roses Yellow Label",                distillery: "Four Roses",     category: "Bourbon", proof: 80,    msrp: 28  },
  { name: "Four Roses Small Batch",                 distillery: "Four Roses",     category: "Bourbon", proof: 90,    msrp: 35  },
  { name: "Four Roses Small Batch Select",          distillery: "Four Roses",     category: "Bourbon", proof: 104,   msrp: 55  },
  { name: "Four Roses Single Barrel",               distillery: "Four Roses",     category: "Bourbon", proof: 100,   msrp: 50  },
  { name: "Four Roses Single Barrel Limited OBSK",  distillery: "Four Roses",     category: "Bourbon", proof: null,  msrp: 80  },
  { name: "Four Roses Single Barrel Limited OBSF",  distillery: "Four Roses",     category: "Bourbon", proof: null,  msrp: 80  },

  // ── Brown-Forman (Old Forester / Woodford) ────────────────────────────────
  { name: "Old Forester 86",                        distillery: "Brown-Forman",   category: "Bourbon", proof: 86,    msrp: 22  },
  { name: "Old Forester Signature 100 Proof",       distillery: "Brown-Forman",   category: "Bourbon", proof: 100,   msrp: 26  },
  { name: "Old Forester 1897 Bottled in Bond",      distillery: "Brown-Forman",   category: "Bourbon", proof: 100,   msrp: 45  },
  { name: "Old Forester 1910 Old Fine Whisky",      distillery: "Brown-Forman",   category: "Bourbon", proof: 93,    msrp: 50  },
  { name: "Old Forester 1920 Prohibition Style",    distillery: "Brown-Forman",   category: "Bourbon", proof: 115,   msrp: 55  },
  { name: "Old Forester Statesman",                 distillery: "Brown-Forman",   category: "Bourbon", proof: 95,    msrp: 40  },
  { name: "Old Forester Rye 100 Proof",             distillery: "Brown-Forman",   category: "Rye",     proof: 100,   msrp: 30  },
  { name: "Old Forester Birthday Bourbon",          distillery: "Brown-Forman",   category: "Bourbon", proof: null,  msrp: 100 },
  { name: "Woodford Reserve",                       distillery: "Brown-Forman",   category: "Bourbon", proof: 90.4,  msrp: 35  },
  { name: "Woodford Reserve Double Oaked",          distillery: "Brown-Forman",   category: "Bourbon", proof: 90.4,  msrp: 50  },
  { name: "Woodford Reserve Batch Proof",           distillery: "Brown-Forman",   category: "Bourbon", proof: null,  msrp: 60  },
  { name: "Woodford Reserve Distiller's Select",    distillery: "Brown-Forman",   category: "Bourbon", proof: 90.4,  msrp: 35  },

  // ── Beam Suntory ─────────────────────────────────────────────────────────
  { name: "Jim Beam White Label",                   distillery: "Beam Suntory",   category: "Bourbon", proof: 80,    msrp: 20  },
  { name: "Jim Beam Black",                         distillery: "Beam Suntory",   category: "Bourbon", proof: 86,    msrp: 25  },
  { name: "Jim Beam Double Oak",                    distillery: "Beam Suntory",   category: "Bourbon", proof: 86,    msrp: 28  },
  { name: "Knob Creek 9 Year Small Batch",          distillery: "Beam Suntory",   category: "Bourbon", proof: 100,   msrp: 35  },
  { name: "Knob Creek Single Barrel Reserve",       distillery: "Beam Suntory",   category: "Bourbon", proof: 120,   msrp: 55  },
  { name: "Knob Creek 12 Year",                     distillery: "Beam Suntory",   category: "Bourbon", proof: 100,   msrp: 55  },
  { name: "Knob Creek Rye",                         distillery: "Beam Suntory",   category: "Rye",     proof: 100,   msrp: 35  },
  { name: "Basil Hayden's",                         distillery: "Beam Suntory",   category: "Bourbon", proof: 80,    msrp: 40  },
  { name: "Basil Hayden Dark Rye",                  distillery: "Beam Suntory",   category: "Rye",     proof: 80,    msrp: 40  },
  { name: "Baker's 7 Year",                         distillery: "Beam Suntory",   category: "Bourbon", proof: 107,   msrp: 50  },
  { name: "Booker's Bourbon",                       distillery: "Beam Suntory",   category: "Bourbon", proof: null,  msrp: 90  },
  { name: "Little Book",                            distillery: "Beam Suntory",   category: "Bourbon", proof: null,  msrp: 90  },
  { name: "Maker's Mark",                           distillery: "Maker's Mark",   category: "Bourbon", proof: 90,    msrp: 30  },
  { name: "Maker's Mark 46",                        distillery: "Maker's Mark",   category: "Bourbon", proof: 94,    msrp: 40  },
  { name: "Maker's Mark Cask Strength",             distillery: "Maker's Mark",   category: "Bourbon", proof: null,  msrp: 55  },
  { name: "Maker's Mark 101",                       distillery: "Maker's Mark",   category: "Bourbon", proof: 101,   msrp: 40  },

  // ── Sazerac / MGP ────────────────────────────────────────────────────────
  { name: "Old Grand-Dad Bonded",                   distillery: "Sazerac",        category: "Bourbon", proof: 100,   msrp: 28  },
  { name: "Old Grand-Dad 114",                      distillery: "Sazerac",        category: "Bourbon", proof: 114,   msrp: 28  },
  { name: "Very Old Barton Bottled in Bond",         distillery: "Sazerac",        category: "Bourbon", proof: 100,   msrp: 15  },
  { name: "Bulleit Bourbon",                        distillery: "Bulleit",         category: "Bourbon", proof: 90,    msrp: 30  },
  { name: "Bulleit Rye",                            distillery: "Bulleit",         category: "Rye",     proof: 90,    msrp: 30  },
  { name: "Bulleit 10 Year",                        distillery: "Bulleit",         category: "Bourbon", proof: 91.2,  msrp: 50  },

  // ── Independent / Craft ──────────────────────────────────────────────────
  { name: "Angel's Envy Port Barrel Finish",        distillery: "Angel's Envy",   category: "Bourbon", proof: 86.6,  msrp: 40  },
  { name: "Angel's Envy Bottled in Bond",           distillery: "Angel's Envy",   category: "Bourbon", proof: 100,   msrp: 55  },
  { name: "Angel's Envy Rye",                       distillery: "Angel's Envy",   category: "Rye",     proof: 100,   msrp: 70  },
  { name: "Angel's Envy Cask Strength",             distillery: "Angel's Envy",   category: "Bourbon", proof: null,  msrp: 180 },
  { name: "Jefferson's Reserve",                    distillery: "Jefferson's",     category: "Bourbon", proof: 90.2,  msrp: 50  },
  { name: "Jefferson's Ocean Aged at Sea",          distillery: "Jefferson's",     category: "Bourbon", proof: 82.3,  msrp: 60  },
  { name: "Jefferson's Marian McLain",              distillery: "Jefferson's",     category: "Bourbon", proof: 90,    msrp: 45  },
  { name: "Michter's US*1 Small Batch Bourbon",     distillery: "Michter's",       category: "Bourbon", proof: 91.4,  msrp: 45  },
  { name: "Michter's US*1 Rye",                     distillery: "Michter's",       category: "Rye",     proof: 84.8,  msrp: 45  },
  { name: "Michter's US*1 Sour Mash Whiskey",       distillery: "Michter's",       category: "American",proof: 91.4,  msrp: 45  },
  { name: "Michter's US*1 Toasted Barrel Bourbon",  distillery: "Michter's",       category: "Bourbon", proof: 91.4,  msrp: 55  },
  { name: "Michter's 10 Year Bourbon",              distillery: "Michter's",       category: "Bourbon", proof: 94.4,  msrp: 160 },
  { name: "WhistlePig 10 Year",                     distillery: "WhistlePig",      category: "Rye",     proof: 100,   msrp: 70  },
  { name: "WhistlePig PiggyBack 6 Year",            distillery: "WhistlePig",      category: "Rye",     proof: 96.56, msrp: 40  },
  { name: "WhistlePig 12 Year",                     distillery: "WhistlePig",      category: "Rye",     proof: 86,    msrp: 120 },
  { name: "High West Rendezvous Rye",               distillery: "High West",       category: "Rye",     proof: 92,    msrp: 55  },
  { name: "High West Double Rye",                   distillery: "High West",       category: "Rye",     proof: 92,    msrp: 35  },
  { name: "High West American Prairie",             distillery: "High West",       category: "Bourbon", proof: 92,    msrp: 30  },
  { name: "Heaven's Door Double Barrel",            distillery: "Heaven's Door",   category: "Bourbon", proof: 100,   msrp: 60  },
  { name: "Widow Jane 10 Year",                     distillery: "Widow Jane",      category: "Bourbon", proof: 91,    msrp: 90  },
  { name: "Laws Whiskey Four Grain Straight Bourbon",distillery: "Laws Whiskey",   category: "Bourbon", proof: 101,   msrp: 65  },

  // ── Scotch ───────────────────────────────────────────────────────────────
  { name: "Glenfiddich 12 Year",                    distillery: "Glenfiddich",     category: "Scotch",  proof: 80,    msrp: 40  },
  { name: "Glenfiddich 18 Year",                    distillery: "Glenfiddich",     category: "Scotch",  proof: 80,    msrp: 100 },
  { name: "The Macallan 12 Year Double Cask",       distillery: "The Macallan",    category: "Scotch",  proof: 86,    msrp: 60  },
  { name: "The Macallan 12 Year Sherry Oak",        distillery: "The Macallan",    category: "Scotch",  proof: 86,    msrp: 70  },
  { name: "The Macallan 18 Year",                   distillery: "The Macallan",    category: "Scotch",  proof: 86,    msrp: 230 },
  { name: "Laphroaig 10 Year",                      distillery: "Laphroaig",       category: "Scotch",  proof: 86,    msrp: 45  },
  { name: "Lagavulin 16 Year",                      distillery: "Lagavulin",       category: "Scotch",  proof: 86,    msrp: 90  },
  { name: "The Glenlivet 12 Year",                  distillery: "The Glenlivet",   category: "Scotch",  proof: 80,    msrp: 35  },
  { name: "Monkey Shoulder",                        distillery: "William Grant",   category: "Scotch",  proof: 86,    msrp: 35  },
  { name: "Johnnie Walker Black Label",             distillery: "Diageo",          category: "Scotch",  proof: 80,    msrp: 35  },
  { name: "Johnnie Walker Blue Label",              distillery: "Diageo",          category: "Scotch",  proof: 80,    msrp: 230 },
  { name: "Oban 14 Year",                           distillery: "Oban",            category: "Scotch",  proof: 86,    msrp: 80  },
  { name: "Glenmorangie The Original 10 Year",      distillery: "Glenmorangie",    category: "Scotch",  proof: 80,    msrp: 40  },
  { name: "Balvenie 12 Year DoubleWood",            distillery: "Balvenie",        category: "Scotch",  proof: 80,    msrp: 55  },
  { name: "Balvenie 14 Year Caribbean Cask",        distillery: "Balvenie",        category: "Scotch",  proof: 86,    msrp: 70  },

  // ── Japanese ─────────────────────────────────────────────────────────────
  { name: "Suntory Toki",                           distillery: "Suntory",         category: "Japanese",proof: 86,    msrp: 35  },
  { name: "Hibiki Japanese Harmony",                distillery: "Suntory",         category: "Japanese",proof: 86,    msrp: 65  },
  { name: "Yamazaki 12 Year",                       distillery: "Suntory",         category: "Japanese",proof: 86,    msrp: 150 },
  { name: "Nikka From the Barrel",                  distillery: "Nikka",           category: "Japanese",proof: 102.4, msrp: 50  },
  { name: "Nikka Coffey Grain",                     distillery: "Nikka",           category: "Japanese",proof: 90,    msrp: 70  },
  { name: "Nikka Days",                             distillery: "Nikka",           category: "Japanese",proof: 80,    msrp: 40  },

  // ── Irish ────────────────────────────────────────────────────────────────
  { name: "Jameson Irish Whiskey",                  distillery: "Midleton",        category: "Irish",   proof: 80,    msrp: 25  },
  { name: "Redbreast 12 Year",                      distillery: "Midleton",        category: "Irish",   proof: 80,    msrp: 55  },
  { name: "Redbreast 15 Year",                      distillery: "Midleton",        category: "Irish",   proof: 92,    msrp: 90  },
  { name: "Green Spot",                             distillery: "Midleton",        category: "Irish",   proof: 80,    msrp: 50  },
  { name: "Yellow Spot 12 Year",                    distillery: "Midleton",        category: "Irish",   proof: 92,    msrp: 90  },
  { name: "Powers John's Lane 12 Year",             distillery: "Midleton",        category: "Irish",   proof: 92,    msrp: 65  },
]

// ── Name normalization + matching ─────────────────────────────────────────────

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchScore(query, bottle) {
  const q = normalize(query)
  const n = normalize(bottle.name)
  if (n === q)              return 100
  if (n.startsWith(q))     return 80
  if (q.startsWith(n))     return 75
  if (n.includes(q))       return 60
  if (q.includes(n))       return 55
  // word-overlap score
  const qWords = new Set(q.split(' ').filter(w => w.length > 2))
  const nWords = n.split(' ').filter(w => w.length > 2)
  const hits   = nWords.filter(w => qWords.has(w)).length
  if (hits >= 2)            return 40 + hits * 5
  if (hits === 1)           return 20
  return 0
}

/** Find best matching bottle from seed data by name. Returns null if no good match. */
export function findByName(query) {
  if (!query?.trim()) return null
  let best = null, bestScore = 0
  for (const bottle of SEED_BOTTLES) {
    const s = matchScore(query, bottle)
    if (s > bestScore) { bestScore = s; best = bottle }
  }
  return bestScore >= 40 ? best : null
}

// ── Redis UPC cache ───────────────────────────────────────────────────────────

async function getCachedUpc(upc) {
  try {
    const data = await getRedis().get(`wh:upc:${upc}`)
    return data ?? null
  } catch { return null }
}

async function setCachedUpc(upc, data) {
  try {
    await getRedis().set(`wh:upc:${upc}`, JSON.stringify(data))
  } catch {}
}

// ── upcitemdb.com lookup ──────────────────────────────────────────────────────

async function lookupUpcExternal(upc) {
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`, {
      headers: { 'Accept': 'application/json' },
      signal:  AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.code === 'OK' && data.items?.length) {
      return data.items[0].title ?? null
    }
    return null
  } catch { return null }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up a bottle by UPC.
 * Returns enriched bottle data or null.
 * Source: 'cache' | 'seed' | 'external' | null
 */
export async function getBottleByUpc(upc) {
  const clean = upc.replace(/\D/g, '')

  // 1. Redis cache
  const cached = await getCachedUpc(clean)
  if (cached) return { ...cached, source: 'cache' }

  // 2. upcitemdb.com → name → seed match
  const productName = await lookupUpcExternal(clean)
  if (productName) {
    const seedMatch = findByName(productName)
    const result = seedMatch
      ? { ...seedMatch, upc: clean, rawName: productName }
      : { name: productName, upc: clean, distillery: null, category: 'Bourbon', proof: null, msrp: null }
    await setCachedUpc(clean, result)
    return { ...result, source: seedMatch ? 'seed' : 'external' }
  }

  return null
}

/**
 * Look up a bottle by name (fuzzy match against seed data).
 * Returns the best matching seed entry or null.
 */
export function getBottleByName(name) {
  const match = findByName(name)
  return match ? { ...match, source: 'seed' } : null
}

/**
 * Save a user-confirmed UPC → bottle mapping to Redis for future lookups.
 */
export async function saveUpcMapping(upc, bottleData) {
  if (!upc) return
  await setCachedUpc(upc.replace(/\D/g, ''), bottleData)
}

/**
 * Search seed data and return top matches (for autocomplete).
 */
export function searchBottles(query, limit = 5) {
  if (!query || query.trim().length < 2) return []
  return SEED_BOTTLES
    .map(b => ({ ...b, _score: matchScore(query, b) }))
    .filter(b => b._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...b }) => b)
}
