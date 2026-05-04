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

// ─── C1: Unicorn Auctions ─────────────────────────────────────────────────────

const UA_QUERY = `
  query SearchLots($first: Int, $after: String, $filter: LotFilterInput) {
    searchLots(first: $first, after: $after, filter: $filter) {
      pageInfo { hasNextPage endCursor }
      edges { node { title lowEstimate highEstimate status } }
    }
  }
`

async function fetchUALots(maxPages = 10) {
  const lots = []
  let cursor = null

  for (let page = 0; page < maxPages; page++) {
    const res = await fetch(UA_GQL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({
        query:     UA_QUERY,
        variables: { first: 100, after: cursor, filter: { category: 'WHISKEY', status: 'CLOSED' } },
      }),
    })
    if (!res.ok) break

    const json   = await res.json()
    const result = json?.data?.searchLots
    if (!result) break

    for (const { node } of (result.edges ?? [])) {
      if (node.lowEstimate && node.highEstimate)
        lots.push({ title: node.title, low: +node.lowEstimate, high: +node.highEstimate })
    }

    if (!result.pageInfo.hasNextPage) break
    cursor = result.pageInfo.endCursor
  }

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

  const [uaLots, binnysMap] = await Promise.allSettled([
    fetchUALots(),
    fetchBinnysAlgoliaMsrp(),
  ]).then(([ua, bi]) => [
    ua.status === 'fulfilled' ? ua.value : [],
    bi.status === 'fulfilled' ? bi.value : new Map(),
  ])

  // Build UA match map
  const uaMatches = new Map()
  for (const lot of uaLots) {
    const entry = matchEntry(lot.title, entries)
    if (!entry) continue
    if (!uaMatches.has(entry.name)) uaMatches.set(entry.name, { lows: [], highs: [], entry })
    const m = uaMatches.get(entry.name)
    m.lows.push(lot.low)
    m.highs.push(lot.high)
  }

  // Write to Redis
  let written = 0
  const now   = new Date().toISOString().slice(0, 7)

  await Promise.allSettled(
    entries.map(async entry => {
      const uaData      = uaMatches.get(entry.name)
      const binnysPrice = binnysMap.get(entry.name)

      const secondary = uaData
        ? { low: Math.min(...uaData.lows), avg: median([...uaData.lows, ...uaData.highs]), high: Math.max(...uaData.highs) }
        : entry.secondary

      const value = {
        low:         secondary.low,
        avg:         secondary.avg,
        high:        secondary.high,
        rarity:      entry.rarity,
        msrp:        binnysPrice ?? entry.msrp,
        source:      uaData ? 'Unicorn Auctions live estimates' : 'Secondary market estimate',
        lastUpdated: uaData ? now : entry.lastUpdated,
      }

      try {
        const norm = normName(entry.name)
        await redisSet(`wh:market-prices:live:${norm}`, value)
        for (const alias of (entry.aliases ?? []))
          await redisSet(`wh:market-prices:live:${normName(alias)}`, value)
        written++
      } catch {}
    })
  )

  return NextResponse.json({
    ok:            true,
    entriesTotal:  entries.length,
    written,
    uaLots:        uaLots.length,
    uaMatched:     uaMatches.size,
    binnysMatched: binnysMap.size,
    ms:            Date.now() - start,
  })
}

// GET — Vercel cron (Authorization: Bearer CRON_SECRET)
export async function GET(request) { return handleRefresh(request) }

// POST — manual curl trigger
export async function POST(request) { return handleRefresh(request) }
