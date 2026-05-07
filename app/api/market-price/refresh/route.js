import { NextResponse } from 'next/server'
import { readFileSync }  from 'fs'
import path              from 'path'

const DATA_PATH = path.join(process.cwd(), 'lib', 'market-prices-data.json')
const UA_GQL    = 'https://graphql.beta.unicornauctions.com/graphql'
const ALG_APP   = process.env.ALGOLIA_APP_ID  || 'Z25A2A928M'
const ALG_KEY   = process.env.ALGOLIA_API_KEY || '88b6125855a0bbd845447e35de8d51c5'
const ALG_INDEX = 'Products_Production_AB_Test'
const TTL       = 7 * 24 * 60 * 60 // 7 days

// ─── helpers ──────────────────────────────────────────────────────────────────

function normName(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/['''''']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreMatch(norm, candidate) {
  const qWords = norm.split(/\s+/).filter(w => w.length >= 3)
  const cWords = candidate.split(/\s+/).filter(w => w.length >= 3)
  if (!qWords.length || !cWords.length) return 0
  const hits  = qWords.filter(w => cWords.some(c => c.includes(w) || w.includes(c))).length
  const score = hits / Math.max(qWords.length, cWords.length)
  const exact = norm.includes(candidate) || candidate.includes(norm)
  return exact ? Math.max(score, 0.8) : score
}

function matchEntry(lotTitle, entries) {
  const norm = normName(lotTitle)
  let best = null, bestScore = 0
  for (const entry of entries) {
    for (const candidate of [entry.name, ...(entry.aliases ?? [])].map(normName)) {
      const s = scoreMatch(norm, candidate)
      if (s > bestScore && s >= 0.6) { bestScore = s; best = entry }
    }
  }
  return best
}

function median(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

async function redisSet(key, value) {
  const { Redis } = await import('@upstash/redis')
  const redis     = Redis.fromEnv()
  await redis.set(key, JSON.stringify(value), { ex: TTL })
}

async function redisHset(key, fields) {
  const { Redis } = await import('@upstash/redis')
  const redis     = Redis.fromEnv()
  await redis.hset(key, fields)
}

// ─── C1: Unicorn Auctions ─────────────────────────────────────────────────────
//
// Schema (verified against the live API): searchLots takes a SearchLotInput and
// returns { results: [Lot] }.  For state:'ENDED' lots, currentBid.amount is the
// final hammer price.  Sort by end_datetime_desc + offset pagination lets us
// stop early once we cross the 12-month cutoff.

const UA_QUERY = `
  query SearchLots($input: SearchLotInput!) {
    searchLots(input: $input) {
      results {
        title
        state
        currentBid { amount }
        endDatetime
      }
    }
  }
`

const UA_PAGE_SIZE     = 1000                              // server caps observed at 1000
const UA_MAX_PAGES     = 5                                  // 5k lots is well past 12 months of bourbon ENDED
const UA_LOOKBACK_DAYS = 365

// Lots whose titles match these patterns are special editions whose prices
// would skew aggregate hammer prices for standard releases (Pappy 15 standard
// = $1k-$2k; private barrels = $15k-$25k).
const SPECIAL_EDITION_PATTERNS = [
  /'[^']{2,}'/,                       // 'Husk', 'Civic Center', 'Sam's Wines'
  /private barrel|private selection|store pick/i,
  /barrel #?\d/i,                     // Barrel #11, Barrel 1789B
  /cask\s+[a-z]?\d/i,                 // Cask 2, Cask C49
  /local pickup only/i,
  /decanter/i,
  /\(1[89]\d{2}\)/,                   // pre-2000 vintage year in parens
  /warehouse [a-z] tornado/i,         // EH Taylor Warehouse C Tornado limited release
]

function isSpecialEdition(title) {
  return SPECIAL_EDITION_PATTERNS.some(p => p.test(title))
}

async function fetchUALots(diag) {
  const lots   = []
  const cutoff = Date.now() - UA_LOOKBACK_DAYS * 86400_000

  for (let page = 0; page < UA_MAX_PAGES; page++) {
    const offset = page * UA_PAGE_SIZE

    const res = await fetch(UA_GQL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({
        query:     UA_QUERY,
        variables: {
          input: {
            category: 'Bourbon',
            state:    'ENDED',
            sortBy:   'end_datetime_desc',
            limit:    UA_PAGE_SIZE,
            offset,
          },
        },
      }),
    })
    if (!res.ok) { diag.errors.push(`UA HTTP ${res.status}`); break }

    const json = await res.json()
    if (json.errors?.length) { diag.errors.push(`UA GQL: ${json.errors[0].message}`); break }

    const results = json?.data?.searchLots?.results
    if (!Array.isArray(results)) { diag.errors.push('UA: unexpected response shape'); break }
    if (results.length === 0) break

    let crossedCutoff = false
    for (const lot of results) {
      const ts = lot.endDatetime ? Date.parse(lot.endDatetime) : NaN
      if (Number.isFinite(ts) && ts < cutoff) { crossedCutoff = true; continue }
      if (isSpecialEdition(lot.title)) { diag.specialFiltered++; continue }
      const hammer = Number(lot.currentBid?.amount)
      if (!hammer || hammer <= 0) continue
      lots.push({ title: lot.title, hammer, endDatetime: lot.endDatetime })
    }

    if (results.length < UA_PAGE_SIZE || crossedCutoff) break
  }

  diag.lotsFetched = lots.length
  return lots
}

// ─── C2: Binny's Algolia MSRP ─────────────────────────────────────────────────

const BINNYS_IDS = [
  { objectID: '104979', name: 'Elijah Craig Barrel Proof' },
  { objectID: '192384', name: 'Elijah Craig Small Batch' },
  { objectID: '173648', name: "Angel's Envy Cask Strength" },
  { objectID: '171477', name: "Angel's Envy Bottled in Bond" },
  { objectID: '190031', name: "Angel's Envy Port Barrel Finish" },
  { objectID: '101259', name: 'Four Roses Small Batch Select' },
  { objectID: '197773', name: 'Wild Turkey Rare Breed' },
  { objectID: '982098', name: 'Heaven Hill 7 Year Bottled in Bond' },
  { objectID: '194814', name: "Michter's US*1 Small Batch Bourbon" },
  { objectID: '197823', name: "Wild Turkey Russell's Reserve 10 Year" },
  { objectID: '68108',  name: "Jefferson's Ocean Aged at Sea" },
  { objectID: '194801', name: "Michter's US*1 Rye" },
]

async function fetchBinnysAlgoliaMsrp() {
  const msrpMap = new Map()
  await Promise.allSettled(
    BINNYS_IDS.map(async ({ objectID, name }) => {
      try {
        const res = await fetch(
          `https://${ALG_APP}-dsn.algolia.net/1/indexes/${ALG_INDEX}/${objectID}`,
          { headers: { 'X-Algolia-Application-Id': ALG_APP, 'X-Algolia-API-Key': ALG_KEY } }
        )
        if (!res.ok) return
        const data  = await res.json()
        const price = data?.storesPriceAndInventory?.find(s => s.storeCode === '47')?.prices?.bestPrice
          ?? data?.prices?.bestPrice
        if (price) msrpMap.set(name, Number(price))
      } catch {}
    })
  )
  return msrpMap
}

// ─── shared handler ───────────────────────────────────────────────────────────

async function handleRefresh(request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth  = request.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const start   = Date.now()
  const entries = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
  const diag    = { lotsFetched: 0, specialFiltered: 0, errors: [] }

  const [uaLots, binnysMap] = await Promise.allSettled([
    fetchUALots(diag),
    fetchBinnysAlgoliaMsrp(),
  ]).then(([ua, bi]) => [
    ua.status === 'fulfilled' ? ua.value : [],
    bi.status === 'fulfilled' ? bi.value : new Map(),
  ])

  // Build UA match map — one hammer price per ENDED lot
  const uaMatches = new Map()
  for (const lot of uaLots) {
    const entry = matchEntry(lot.title, entries)
    if (!entry) continue
    if (!uaMatches.has(entry.name)) uaMatches.set(entry.name, { hammers: [], entry })
    uaMatches.get(entry.name).hammers.push(lot.hammer)
  }

  // Write to Redis
  let written = 0
  const now   = new Date().toISOString().slice(0, 7)

  await Promise.allSettled(
    entries.map(async entry => {
      const uaData      = uaMatches.get(entry.name)
      const binnysPrice = binnysMap.get(entry.name)

      const secondary = uaData
        ? { low: Math.min(...uaData.hammers), avg: median(uaData.hammers), high: Math.max(...uaData.hammers) }
        : entry.secondary

      const value = {
        low:         secondary.low,
        avg:         secondary.avg,
        high:        secondary.high,
        rarity:      entry.rarity,
        msrp:        binnysPrice ?? entry.msrp,
        source:      uaData ? 'Unicorn Auctions hammer prices' : 'Secondary market estimate',
        lastUpdated: uaData ? now : entry.lastUpdated,
        distillery:  entry.distillery  ?? null,
        proof:       entry.proof       ?? null,
        age:         entry.age         ?? null,
        sizes:       entry.sizes       ?? null,
        origin:      entry.origin      ?? null,
        region:      entry.region      ?? null,
        type:        entry.type        ?? null,
      }

      try {
        const norm = normName(entry.name)
        await redisSet(`wh:market-prices:live:${norm}`, value)
        for (const alias of (entry.aliases ?? []))
          await redisSet(`wh:market-prices:live:${normName(alias)}`, value)

        // Price history — one snapshot per month stored in a hash (field = YYYY-MM)
        const histKey   = `wh:price-history:${norm}`
        const histPoint = JSON.stringify({ avg: value.avg, low: value.low, high: value.high })
        await redisHset(histKey, { [now]: histPoint })
        // Seed the static-JSON baseline as a separate historical data point the first time
        if (entry.secondary?.avg && entry.lastUpdated && entry.lastUpdated < now) {
          const baseline = JSON.stringify({ avg: entry.secondary.avg, low: entry.secondary.low, high: entry.secondary.high })
          await redisHset(histKey, { [entry.lastUpdated]: baseline })
        }

        written++
      } catch {}
    })
  )

  // Surface a clear failure signal when the UA pipeline returns nothing — the
  // previous schema break went unnoticed for months because the cron's success
  // path didn't distinguish "0 matches" from "fetch errored silently".
  const uaHealthy = uaLots.length > 0 && uaMatches.size > 0
  if (!uaHealthy) {
    console.warn('[market-price/refresh] UA pipeline produced no matches — possible schema break', diag)
  }

  return NextResponse.json({
    ok:            uaHealthy,
    entriesTotal:  entries.length,
    written,
    uaLots:        uaLots.length,
    uaMatched:     uaMatches.size,
    uaSpecialFiltered: diag.specialFiltered,
    uaErrors:      diag.errors,
    binnysMatched: binnysMap.size,
    ms:            Date.now() - start,
  })
}

// GET — Vercel cron (Authorization: Bearer CRON_SECRET)
export async function GET(request) { return handleRefresh(request) }

// POST — manual curl trigger
export async function POST(request) { return handleRefresh(request) }
