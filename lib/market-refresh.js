/**
 * Shared weekly market-price refresh pipeline — used by both the Vercel cron
 * route (app/api/market-price/refresh/route.js) and the manual CLI script
 * (scripts/refresh-market-prices.mjs). Previously these were two hand-copied
 * implementations that had already drifted (the route gained categories,
 * image backfill, etc. that the script never got).
 *
 * Two live sources, merged over the static catalog baseline:
 *   UA      — Unicorn Auctions hammer prices → secondary low/avg/high
 *   Binny's — Algolia MSRP for whatever of the catalog Binny's actually
 *             carries. objectIDs are auto-discovered (not hardcoded) via a
 *             brand-anchored Algolia text search, then cached so future runs
 *             do a cheap direct objectID lookup instead of re-searching.
 *
 * All matching (UA lot title → catalog entry, Algolia hit → catalog entry)
 * goes through bottle-match.js's sameBottleLine gate so a refresh run can't
 * attach the wrong bottle's price the way pre-audit matchers could.
 */

import { normName, sameBottleLine, overlapScore } from './bottle-match.js'
import { upsertBottle }                           from './bottle-db.js'

const ALG_APP   = process.env.ALGOLIA_APP_ID  || 'Z25A2A928M'
const ALG_KEY   = process.env.ALGOLIA_API_KEY || '88b6125855a0bbd845447e35de8d51c5'
const ALG_INDEX = 'Products_Production_AB_Test'
const UA_GQL    = 'https://graphql.beta.unicornauctions.com/graphql'
const TTL       = 7 * 24 * 60 * 60 // 7 days — live price cache

const OBJID_TTL_HIT  = 60 * 24 * 60 * 60 // 60 days — resolved objectID rarely changes
const OBJID_TTL_MISS = 14 * 24 * 60 * 60 // 14 days — retry sooner (allocated bottle may become carried)

// ─── name-match scoring (gated by sameBottleLine, ranked by token overlap) ────
// Shares lib/bottle-match.js's overlapScore with lib/market-prices.js's
// lookupStatic — one scoring implementation instead of one per matcher.

function matchEntry(title, entries, floor = 0.5) {
  let best = null, bestScore = 0
  for (const entry of entries) {
    for (const candidate of [entry.name, ...(entry.aliases ?? [])]) {
      const s = overlapScore(title, candidate)
      if (s > bestScore && s >= floor) { bestScore = s; best = entry }
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

// ─── C1: Unicorn Auctions ──────────────────────────────────────────────────

const UA_QUERY = `
  query SearchLots($input: SearchLotInput!) {
    searchLots(input: $input) {
      results { title state currentBid { amount } endDatetime photos { photo1 photo2 photo3 } }
    }
  }
`

const UA_CDN_BASE = 'https://digqdh912fmd8.cloudfront.net/fit-in/600x600/all'
function lotImageUrl(lot) {
  const p = lot.photos ?? {}
  const f = p.photo1 || p.photo2 || p.photo3
  return f ? `${UA_CDN_BASE}/${f}` : null
}

const UA_PAGE_SIZE     = 1000
const UA_MAX_PAGES     = 10
const UA_LOOKBACK_DAYS = 8
const UA_CATEGORIES    = ['Bourbon', 'Rye', 'Scotch', 'American', 'Japanese', 'Irish', 'Canadian', 'Tennessee', 'Blended']

const SPECIAL_EDITION_PATTERNS = [
  /'[^']{2,}'/,
  /private.*(barrel|selection)|store.*pick/i,
  /barrel #?\d/i,
  /local pickup only/i,
  /decanter/i,
  /warehouse\s*[a-z]?\s*tornado/i,
]
const BOURBON_ONLY_PATTERNS = [
  /cask\s+[a-z]?\d/i,
  /\(1[89]\d{2}\)/,
]
const BOURBON_CATEGORIES = new Set(['Bourbon', 'Rye', 'Tennessee', 'American'])

function isSpecialEdition(title, category = '') {
  if (SPECIAL_EDITION_PATTERNS.some(p => p.test(title))) return true
  if (BOURBON_CATEGORIES.has(category) && BOURBON_ONLY_PATTERNS.some(p => p.test(title))) return true
  return false
}

async function fetchUALotsForCategory(category, cutoff, diag) {
  const lots = [], imageLots = []
  let specialFiltered = 0

  for (let page = 0; page < UA_MAX_PAGES; page++) {
    const offset = page * UA_PAGE_SIZE
    const res = await fetch(UA_GQL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal:  AbortSignal.timeout(20000),
      body:    JSON.stringify({ query: UA_QUERY, variables: { input: { category, state: 'ENDED', sortBy: 'end_datetime_desc', limit: UA_PAGE_SIZE, offset } } }),
    })
    if (!res.ok) { diag.errors.push(`UA HTTP ${res.status} (${category})`); break }
    const json = await res.json()
    if (json.errors?.length) { diag.errors.push(`UA GQL (${category}): ${json.errors[0].message}`); break }
    const results = json?.data?.searchLots?.results
    if (!Array.isArray(results)) { diag.errors.push(`UA: unexpected response shape (${category})`); break }
    if (results.length === 0) break

    let crossedCutoff = false
    for (const lot of results) {
      const ts = lot.endDatetime ? Date.parse(lot.endDatetime) : NaN
      if (Number.isFinite(ts) && ts < cutoff) { crossedCutoff = true; continue }
      const imgUrl = lotImageUrl(lot)
      if (imgUrl) imageLots.push({ title: lot.title, imageUrl: imgUrl })
      if (isSpecialEdition(lot.title, category)) { specialFiltered++; continue }
      const hammer = Number(lot.currentBid?.amount)
      if (!hammer || hammer <= 0) continue
      lots.push({ title: lot.title, hammer, endDatetime: lot.endDatetime })
    }
    if (results.length < UA_PAGE_SIZE || crossedCutoff) break
  }
  return { lots, imageLots, specialFiltered }
}

async function fetchLiveLotImages(diag) {
  const results = await Promise.allSettled(
    UA_CATEGORIES.map(async cat => {
      const res = await fetch(UA_GQL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: AbortSignal.timeout(20000),
        body:   JSON.stringify({ query: UA_QUERY, variables: { input: { category: cat, state: 'LIVE', limit: UA_PAGE_SIZE, offset: 0 } } }),
      })
      if (!res.ok) { diag.errors.push(`UA LIVE HTTP ${res.status} (${cat})`); return [] }
      const json = await res.json()
      if (json.errors?.length) { diag.errors.push(`UA LIVE GQL (${cat}): ${json.errors[0].message}`); return [] }
      return (json?.data?.searchLots?.results ?? [])
        .map(lot => ({ title: lot.title, imageUrl: lotImageUrl(lot) }))
        .filter(l => l.imageUrl)
    })
  )
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
}

async function fetchUALots(diag) {
  const cutoff = Date.now() - UA_LOOKBACK_DAYS * 86400_000
  const [endedResults, liveImages] = await Promise.all([
    Promise.allSettled(UA_CATEGORIES.map(cat => fetchUALotsForCategory(cat, cutoff, diag))),
    fetchLiveLotImages(diag),
  ])
  const lots = [], imageLots = [...liveImages]
  for (const result of endedResults) {
    if (result.status === 'fulfilled') {
      lots.push(...result.value.lots)
      imageLots.push(...result.value.imageLots)
      diag.specialFiltered += result.value.specialFiltered
    }
  }
  diag.lotsFetched = lots.length
  return { lots, imageLots }
}

// ─── C2: Binny's Algolia MSRP — auto-discovered objectIDs ─────────────────

async function algoliaTextSearch(query) {
  try {
    const res = await fetch(`https://${ALG_APP}-dsn.algolia.net/1/indexes/${ALG_INDEX}/query`, {
      method:  'POST',
      headers: { 'X-Algolia-Application-Id': ALG_APP, 'X-Algolia-API-Key': ALG_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query, hitsPerPage: 5, attributesToRetrieve: ['productName', 'objectID'] }),
      signal:  AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.hits ?? []
  } catch {
    return []
  }
}

async function algoliaObjectPrice(objectID) {
  try {
    const res = await fetch(`https://${ALG_APP}-dsn.algolia.net/1/indexes/${ALG_INDEX}/${objectID}`, {
      headers: { 'X-Algolia-Application-Id': ALG_APP, 'X-Algolia-API-Key': ALG_KEY },
      signal:  AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data  = await res.json()
    const price = data?.storesPriceAndInventory?.find(s => s.storeCode === '47')?.prices?.bestPrice
      ?? data?.prices?.bestPrice
    return price ? Number(price) : null
  } catch {
    return null
  }
}

/**
 * Resolve (and cache) a Binny's objectID for a catalog entry via brand-anchored
 * text search. Replaces the old hardcoded 12-entry BINNYS_IDS list — any
 * catalog entry Binny's actually stocks under standard search (i.e. not
 * merchandising-suppressed like allocated/hotline bottles) gets discovered.
 *
 * KNOWN LIMITATION: Binny's redirect/merchandising rules suppress *text
 * search* results entirely for allocated bottles (Blanton's, Eagle Rare,
 * Weller, full BTAC, Pappy, etc. — see MEMORY.md). Text search is the only
 * discovery method available here, so those entries will reliably miss and
 * fall back to the static catalog MSRP — this does NOT extend live coverage
 * to allocated bottles, only to standard-shelf ones. Direct-objectID lookup
 * (the old hardcoded-list approach) is the only way to price those, and would
 * require a curated allocated-bottle objectID list maintained separately.
 */
async function resolveBinnysObjectId(redis, entry) {
  const key = `wh:binnys:objid:${normName(entry.name)}`
  const cached = await redis.get(key)
  if (cached !== null && cached !== undefined) {
    return cached === '' ? null : cached
  }

  const hits = await algoliaTextSearch(entry.name)
  const best = hits.find(h => sameBottleLine(entry.name, h.productName ?? ''))

  if (best?.objectID) {
    await redis.set(key, String(best.objectID), { ex: OBJID_TTL_HIT })
    return String(best.objectID)
  }
  await redis.set(key, '', { ex: OBJID_TTL_MISS })
  return null
}

async function fetchBinnysMsrp(redis, entries) {
  const msrpMap = new Map()
  await Promise.allSettled(
    entries.map(async entry => {
      const objectID = await resolveBinnysObjectId(redis, entry)
      if (!objectID) return
      const price = await algoliaObjectPrice(objectID)
      if (price) msrpMap.set(entry.name, price)
    })
  )
  return msrpMap
}

// ─── main pipeline ──────────────────────────────────────────────────────────

/**
 * @param {object[]} entries   static catalog entries (lib/market-prices-data.json)
 * @param {import('@upstash/redis').Redis} redis
 * @returns {Promise<object>} diagnostics
 */
export async function runMarketRefresh(entries, redis) {
  const diag = { lotsFetched: 0, specialFiltered: 0, errors: [] }

  const [{ lots: uaLots, imageLots: uaImageLots }, binnysMap] = await Promise.allSettled([
    fetchUALots(diag),
    fetchBinnysMsrp(redis, entries),
  ]).then(([ua, bi]) => [
    ua.status === 'fulfilled' ? ua.value : { lots: [], imageLots: [] },
    bi.status === 'fulfilled' ? bi.value : new Map(),
  ])

  const uaMatches = new Map()
  for (const lot of uaLots) {
    const entry = matchEntry(lot.title, entries)
    if (!entry) continue
    if (!uaMatches.has(entry.name)) uaMatches.set(entry.name, { hammers: [], entry })
    uaMatches.get(entry.name).hammers.push(lot.hammer)
  }

  const MAX_IMG_CANDIDATES = 8
  const uaImageCandidates  = new Map()
  for (const lot of uaImageLots) {
    const entry = matchEntry(lot.title, entries)
    if (!entry) continue
    const titleWords = normName(lot.title).split(' ').filter(w => w.length >= 3).length
    const arr = uaImageCandidates.get(entry.name) ?? []
    if (!arr.some(c => c.imageUrl === lot.imageUrl)) arr.push({ imageUrl: lot.imageUrl, titleWords })
    uaImageCandidates.set(entry.name, arr)
  }
  const uaImageMap = new Map()
  for (const [name, arr] of uaImageCandidates) {
    arr.sort((a, b) => a.titleWords - b.titleWords)
    uaImageMap.set(name, arr[0].imageUrl)
    uaImageCandidates.set(name, arr.slice(0, MAX_IMG_CANDIDATES))
  }

  let written = 0
  const now = new Date().toISOString().slice(0, 7)
  const imgCacheWrites = [], imgCandidateWrites = []

  await Promise.allSettled(
    entries.map(async entry => {
      const uaData      = uaMatches.get(entry.name)
      const binnysPrice = binnysMap.get(entry.name)

      const secondary = uaData
        ? { low: Math.min(...uaData.hammers), avg: median(uaData.hammers), high: Math.max(...uaData.hammers) }
        : entry.secondary

      const value = {
        low: secondary.low, avg: secondary.avg, high: secondary.high,
        rarity: entry.rarity,
        msrp:        binnysPrice ?? entry.msrp,
        source:      uaData ? 'Unicorn Auctions hammer prices' : 'Secondary market estimate',
        lastUpdated: uaData ? now : entry.lastUpdated,
        distillery: entry.distillery ?? null, proof: entry.proof ?? null, age: entry.age ?? null,
        sizes: entry.sizes ?? null, origin: entry.origin ?? null, region: entry.region ?? null, type: entry.type ?? null,
      }

      try {
        const norm    = normName(entry.name)
        const imgUrl  = uaImageMap.get(entry.name)
        const aliases = (entry.aliases ?? []).map(normName)
        const histKey = `wh:price-history:${norm}`

        const p = redis.pipeline()
        p.set(`wh:market-prices:live:${norm}`, JSON.stringify(value), { ex: TTL })
        for (const alias of aliases) p.set(`wh:market-prices:live:${alias}`, JSON.stringify(value), { ex: TTL })
        p.hset(histKey, { [now]: JSON.stringify({ avg: value.avg, low: value.low, high: value.high }) })
        if (entry.secondary?.avg && entry.lastUpdated && entry.lastUpdated < now) {
          p.hset(histKey, { [entry.lastUpdated]: JSON.stringify({ avg: entry.secondary.avg, low: entry.secondary.low, high: entry.secondary.high }) })
        }
        await p.exec()

        if (imgUrl) {
          imgCacheWrites.push([norm, imgUrl, ...aliases])
          const cands = uaImageCandidates.get(entry.name)
          if (cands?.length > 1) imgCandidateWrites.push([norm, cands.map(c => c.imageUrl)])
        }

        // Canonical record: write the static baseline as 'seed', then — if we
        // have a live Binny's price — a second call tagged 'algolia' so only
        // the fields that are genuinely live get that provenance. Two calls
        // instead of one because a single upsertBottle call attributes its
        // whole payload to one source, and msrp's real source here can differ
        // from the rest of the row (distillery/proof/etc are still static).
        await upsertBottle({
          name: entry.name, distillery: entry.distillery ?? null, category: entry.type ?? null,
          proof: entry.proof ?? null, age: entry.age ?? null, msrp: entry.msrp ?? null,
          imageUrl: uaImageMap.get(entry.name) ?? null, market: secondary ?? null,
          rarity: entry.rarity ?? null, region: entry.region ?? null, origin: entry.origin ?? null,
          sizes: entry.sizes ?? null, nameAliases: entry.aliases ?? [],
          lastSeenUA: uaData ? Date.now() : undefined,
        }, uaData ? 'ua' : 'seed', { skipFuzzy: true }).catch(() => {})

        if (binnysPrice) {
          await upsertBottle({
            name: entry.name, msrp: binnysPrice, lastSeenBinnys: Date.now(),
          }, 'algolia', { skipFuzzy: true }).catch(() => {})
        }

        written++
      } catch {}
    })
  )

  if (imgCacheWrites.length > 0) {
    try {
      const TTL_IMG = 30 * 24 * 60 * 60
      const p = redis.pipeline()
      for (const [norm, imgUrl, ...aliases] of imgCacheWrites)
        for (const k of [norm, ...aliases]) p.set(`wh:ua:img:${k}`, imgUrl, { ex: TTL_IMG })
      await p.exec()
    } catch (err) {
      diag.errors.push(`image cache write failed: ${err.message}`)
    }
  }
  if (imgCandidateWrites.length > 0) {
    try {
      const TTL_IMG = 30 * 24 * 60 * 60
      const p = redis.pipeline()
      for (const [norm, urls] of imgCandidateWrites) p.set(`wh:ua:imgs:${norm}`, JSON.stringify(urls), { ex: TTL_IMG })
      await p.exec()
    } catch (err) {
      diag.errors.push(`image candidates write failed: ${err.message}`)
    }
  }

  let imagePatched = 0
  if (uaImageLots.length > 0) {
    try {
      const imgMap = new Map()
      for (const lot of uaImageLots) { const nk = normName(lot.title); if (!imgMap.has(nk)) imgMap.set(nk, lot.imageUrl) }
      const catalog = await redis.hgetall('wh:ua:catalog') ?? {}
      const patches = {}
      for (const [key, raw] of Object.entries(catalog)) {
        const e = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (e.imageUrl) continue
        const img = imgMap.get(key)
        if (!img) continue
        patches[key] = JSON.stringify({ ...e, imageUrl: img })
      }
      if (Object.keys(patches).length > 0) {
        await redis.hset('wh:ua:catalog', patches)
        imagePatched = Object.keys(patches).length
      }
    } catch (err) {
      diag.errors.push(`image backfill failed: ${err.message}`)
    }
  }

  const uaHealthy = uaLots.length > 0 && uaMatches.size > 0
  if (!uaHealthy) diag.errors.push('UA pipeline produced no matches — possible schema break')

  return {
    ok: uaHealthy, entriesTotal: entries.length, written,
    uaLots: uaLots.length, uaMatched: uaMatches.size, uaSpecialFiltered: diag.specialFiltered,
    uaErrors: diag.errors, binnysMatched: binnysMap.size, imagesCached: imgCacheWrites.length, imagePatched,
  }
}
