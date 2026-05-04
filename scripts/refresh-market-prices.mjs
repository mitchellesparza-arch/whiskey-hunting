/**
 * Market price refresh script — C1 (Unicorn Auctions) + C2 (Binny's Algolia MSRP).
 *
 * Providers:
 *   C1  — Unicorn Auctions GraphQL: fetches recent lot estimates → secondary low/avg/high
 *   C2  — Binny's Algolia:          fetches bestPrice for known objectIDs → MSRP floor
 *
 * Output: writes merged results to Redis (`wh:market-prices:live:{normName}`, 7-day TTL)
 *         and optionally writes back to lib/market-prices-data.json if --write-json flag passed.
 *
 * Run:
 *   node scripts/refresh-market-prices.mjs
 *   node scripts/refresh-market-prices.mjs --write-json
 *   node scripts/refresh-market-prices.mjs --dry-run
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath }               from 'url'
import path                            from 'path'

const __dirname    = path.dirname(fileURLToPath(import.meta.url))
const DATA_PATH    = path.join(__dirname, '..', 'lib', 'market-prices-data.json')
const WRITE_JSON   = process.argv.includes('--write-json')
const DRY_RUN      = process.argv.includes('--dry-run')

// Use .env.local if present (for local runs), otherwise rely on environment
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const ALG_APP     = process.env.ALGOLIA_APP_ID    || 'Z25A2A928M'
const ALG_KEY     = process.env.ALGOLIA_API_KEY   || '88b6125855a0bbd845447e35de8d51c5'
const ALG_INDEX   = 'Products_Production_AB_Test'

const UA_GQL = 'https://graphql.beta.unicornauctions.com/graphql'

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function matchEntry(lotName, entries) {
  const norm = normName(lotName)
  let best = null, bestScore = 0
  for (const entry of entries) {
    const names = [entry.name, ...(entry.aliases ?? [])].map(normName)
    for (const candidate of names) {
      const s = scoreMatch(norm, candidate)
      if (s > bestScore && s >= 0.6) { bestScore = s; best = entry }
    }
  }
  return best
}

async function redisSet(key, value, ttlSec) {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error('Missing UPSTASH_REDIS_REST_URL / TOKEN')
  const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ value: JSON.stringify(value), ex: ttlSec }),
  })
  if (!res.ok) throw new Error(`Redis SET failed: ${res.status}`)
}

function median(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

// ─── C1: Unicorn Auctions GraphQL ────────────────────────────────────────────

const UA_QUERY = `
  query SearchLots($first: Int, $after: String, $filter: LotFilterInput) {
    searchLots(first: $first, after: $after, filter: $filter) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          title
          lowEstimate
          highEstimate
          saleDate
          status
        }
      }
    }
  }
`

async function fetchUALots() {
  const lots = []
  let cursor = null
  let page   = 0
  const maxPages = 20

  console.log('C1: Fetching Unicorn Auctions lots…')

  while (page < maxPages) {
    const variables = {
      first:  100,
      after:  cursor,
      filter: { category: 'WHISKEY', status: 'CLOSED' },
    }

    let res
    try {
      res = await fetch(UA_GQL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify({ query: UA_QUERY, variables }),
      })
    } catch (e) {
      console.warn('  UA fetch error:', e.message)
      break
    }

    if (!res.ok) {
      console.warn(`  UA returned ${res.status}`)
      break
    }

    const json   = await res.json()
    const result = json?.data?.searchLots
    if (!result) { console.warn('  UA: unexpected response shape'); break }

    const edges = result.edges ?? []
    for (const { node } of edges) {
      if (node.lowEstimate && node.highEstimate) {
        lots.push({
          title: node.title,
          low:   Number(node.lowEstimate),
          high:  Number(node.highEstimate),
          avg:   Math.round((Number(node.lowEstimate) + Number(node.highEstimate)) / 2),
        })
      }
    }

    if (!result.pageInfo.hasNextPage) break
    cursor = result.pageInfo.endCursor
    page++

    // polite delay
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`  fetched ${lots.length} UA lots across ${page + 1} pages`)
  return lots
}

function aggregateUA(uaLots, entries) {
  const matches = new Map() // entry.name → { lows[], highs[], avgs[] }

  for (const lot of uaLots) {
    const entry = matchEntry(lot.title, entries)
    if (!entry) continue

    if (!matches.has(entry.name)) matches.set(entry.name, { lows: [], highs: [], avgs: [], entry })
    const m = matches.get(entry.name)
    m.lows.push(lot.low)
    m.highs.push(lot.high)
    m.avgs.push(lot.avg)
  }

  const results = new Map()
  for (const [name, { lows, highs, avgs, entry }] of matches) {
    results.set(name, {
      low:         Math.min(...lows),
      avg:         median(avgs),
      high:        Math.max(...highs),
      rarity:      entry.rarity,
      msrp:        entry.msrp,
      source:      'Unicorn Auctions live estimates',
      lastUpdated: new Date().toISOString().slice(0, 7),
    })
  }

  console.log(`  matched ${results.size} database entries from UA lots`)
  return results
}

// ─── C2: Binny's Algolia MSRP ────────────────────────────────────────────────

// Known Binny's objectIDs mapped to bottle names in our database
const BINNYS_OBJECTIDS = [
  { objectID: '104979', name: 'Elijah Craig Barrel Proof' },
  { objectID: '192384', name: 'Elijah Craig Small Batch' },
  { objectID: '173648', name: "Angel's Envy Cask Strength" },
  { objectID: '171477', name: "Angel's Envy Bottled in Bond" },
  { objectID: '190031', name: "Angel's Envy Port Barrel Finish" },
  { objectID: '101259', name: 'Four Roses Small Batch Select' },
  { objectID: '173006', name: 'Four Roses Single Barrel OBSK' },
  { objectID: '164534', name: 'Four Roses Single Barrel OBSF' },
  { objectID: '197773', name: 'Wild Turkey Rare Breed' },
  { objectID: '982098', name: 'Heaven Hill 7 Year Bottled in Bond' },
  { objectID: '194814', name: "Michter's US*1 Small Batch Bourbon" },
  { objectID: '192384', name: 'Elijah Craig Small Batch' },
  { objectID: '197823', name: "Wild Turkey Russell's Reserve 10 Year" },
  { objectID: '68108',  name: "Jefferson's Ocean Aged at Sea" },
  { objectID: '194801', name: "Michter's US*1 Rye" },
]

async function fetchBinnysAlgoliaMsrp() {
  console.log('C2: Fetching Binny\'s Algolia MSRP…')
  const msrpMap = new Map()

  const objectIDs = [...new Set(BINNYS_OBJECTIDS.map(b => b.objectID))]

  await Promise.allSettled(
    BINNYS_OBJECTIDS.map(async ({ objectID, name }) => {
      try {
        const url = `https://${ALG_APP}-dsn.algolia.net/1/indexes/${ALG_INDEX}/${objectID}`
        const res = await fetch(url, {
          headers: {
            'X-Algolia-Application-Id': ALG_APP,
            'X-Algolia-API-Key':        ALG_KEY,
          },
        })
        if (!res.ok) return
        const data = await res.json()
        const price = data?.storesPriceAndInventory?.find(s => s.storeCode === '47')?.prices?.bestPrice
          ?? data?.prices?.bestPrice
        if (price) msrpMap.set(name, Number(price))
      } catch {}
    })
  )

  console.log(`  resolved ${msrpMap.size} MSRP entries from Binny's`)
  return msrpMap
}

// ─── merge + write ────────────────────────────────────────────────────────────

async function main() {
  const entries = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
  console.log(`Loaded ${entries.length} entries from static JSON`)

  // C1
  let uaResults = new Map()
  try {
    const uaLots = await fetchUALots()
    uaResults    = aggregateUA(uaLots, entries)
  } catch (e) {
    console.warn('C1 failed:', e.message)
  }

  // C2
  let binnysMap = new Map()
  try {
    binnysMap = await fetchBinnysAlgoliaMsrp()
  } catch (e) {
    console.warn('C2 failed:', e.message)
  }

  // Merge: start with static JSON, overlay C1 secondary prices, overlay C2 MSRPs
  const merged = entries.map(entry => {
    const updated = { ...entry }

    const uaData = uaResults.get(entry.name)
    if (uaData) {
      updated.secondary  = { low: uaData.low, avg: uaData.avg, high: uaData.high }
      updated.lastUpdated = uaData.lastUpdated
      updated._source     = 'unicorn-auctions'
    }

    const binnysPrice = binnysMap.get(entry.name)
    if (binnysPrice) {
      updated.msrp    = binnysPrice
      updated._source = updated._source ? `${updated._source}+binny` : 'binny'
    }

    return updated
  })

  // Stats
  const c1Count = merged.filter(e => e._source?.includes('unicorn')).length
  const c2Count = merged.filter(e => e._source?.includes('binny')).length
  console.log(`\nMerge results: ${c1Count} entries updated from UA, ${c2Count} from Binny's`)

  if (DRY_RUN) {
    console.log('\nDry run — no writes')
    const sample = merged.filter(e => e._source)
    console.log('Updated entries:', sample.map(e => `${e.name} (${e._source})`).join('\n  '))
    return
  }

  // Write to Redis
  if (!REDIS_URL) {
    console.warn('\nSkipping Redis write (UPSTASH_REDIS_REST_URL not set)')
  } else {
    console.log('\nWriting to Redis…')
    const TTL = 7 * 24 * 60 * 60 // 7 days

    let written = 0
    await Promise.allSettled(
      merged.map(async entry => {
        const { _source, ...clean } = entry
        const norm  = normName(entry.name)
        const value = {
          low:         entry.secondary.low,
          avg:         entry.secondary.avg,
          high:        entry.secondary.high,
          rarity:      entry.rarity,
          msrp:        entry.msrp,
          source:      _source === 'unicorn-auctions' ? 'Unicorn Auctions live estimates'
                     : _source?.includes('unicorn')   ? 'Unicorn Auctions + Binny\'s'
                     :                                  'Secondary market estimate',
          lastUpdated: entry.lastUpdated,
        }
        try {
          await redisSet(`wh:market-prices:live:${norm}`, value, TTL)
          // Also store aliases so lookups by alias hit the cache
          for (const alias of (entry.aliases ?? [])) {
            await redisSet(`wh:market-prices:live:${normName(alias)}`, value, TTL)
          }
          written++
        } catch (e) {
          console.warn(`  Redis write failed for ${entry.name}:`, e.message)
        }
      })
    )
    console.log(`  wrote ${written} entries to Redis (TTL 7d)`)
  }

  // Optionally update the JSON seed
  if (WRITE_JSON) {
    const clean = merged.map(({ _source, ...e }) => e)
    writeFileSync(DATA_PATH, JSON.stringify(clean, null, 2))
    console.log(`\nWrote updated JSON back to ${DATA_PATH}`)
  }

  console.log('\nRefresh complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
