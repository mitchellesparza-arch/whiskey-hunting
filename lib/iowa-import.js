/**
 * Iowa Liquor Products → Redis UPC cache.
 *
 * Iowa is a control state — the state government wholesales every spirit sold
 * within state lines and publishes the master catalog as a free Socrata JSON
 * dataset.  Every record carries a manufacturer-set bottle UPC, including
 * allocated lines (Pappy, BTAC, Weller, Eagle Rare, EHT, ECBP, Birthday Bourbon).
 * These UPCs are GS1-assigned by the producer, so they match the barcodes
 * printed on bottles sold nationwide — including at Binny's.
 *
 * Source:  https://data.iowa.gov/Sales-Distribution/Iowa-Liquor-Products/gckp-fe7r
 * API:     https://data.iowa.gov/resource/gckp-fe7r.json   (no auth, no rate limit)
 * Refresh: monthly (the dataset's own update cadence)
 *
 * Writes Redis key  wh:upc:{upc}  → { name, imageUrl, source: 'iowa-abd', sizeMl, vendor }
 *
 * Records tagged source:'user-scan' (set by POST /api/upc) are NEVER overwritten —
 * a member's manual confirmation always wins over the wholesaler catalog.
 */

import { Redis } from '@upstash/redis'

const SOCRATA_URL = 'https://data.iowa.gov/resource/gckp-fe7r.json'
const PAGE_SIZE   = 50000   // Socrata maximum

// Iowa's catalog mixes two kinds of records:
//   1. National SKUs (bottle UPC matches what's on shelves anywhere) — KEEP
//   2. Iowa-only programs (private barrel picks, state-store exclusives) — SKIP
//      Their UPCs only exist on bottles sold in Iowa stores, so indexing them
//      would map a UPC to the wrong bottle name when scanned at Binny's.
const IOWA_PROGRAM_PATTERNS = [
  /BUY THE BARREL/i,
  /BARREL SELECT/i,
  /SAZERAC BARREL/i,
  /MYERS SIGNATURE CASK/i,
  /EXPRESIONES CORAZON/i,
]

const KEEP_CATEGORY_PATTERNS = [
  /BOURBON/i, /WHISKEY/i, /WHISKY/i, /RYE/i, /SCOTCH/i,
  /TENNESSEE/i, /TEMPORARY/i, /SPECIALTY/i,
]

const KEEP_SIZES_ML = new Set([750, 1750, 1000, 375])

function normalizeUpc(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length < 11 || digits.length > 14) return null
  return digits.length === 11 ? `0${digits}` : digits
}

function cleanName(imDesc) {
  if (!imDesc) return null
  let s = String(imDesc).trim().replace(/^HA\s+/i, '')
  s = s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase())
  s = s.replace(/\b(Yr|Sp|Bib|Cypb|Wlw|Btac|Mgp|Otb|Sr)\b/gi, m => m.toUpperCase())
  s = s.replace(/\bBlantons\b/g, "Blanton's")
   .replace(/\bMichters\b/g, "Michter's")
   .replace(/\bBookers\b/g, "Booker's")
   .replace(/\bBakers\b/g, "Baker's")
   .replace(/\bAngels Envy\b/g, "Angel's Envy")
   .replace(/\bMakers Mark\b/g, "Maker's Mark")
   .replace(/\bRussells Reserve\b/g, "Russell's Reserve")
   .replace(/\bParkers Heritage\b/g, "Parker's Heritage")
   .replace(/\bJeffersons\b/g, "Jefferson's")
  return s
}

async function fetchIowaCatalog() {
  const out = []
  let offset = 0
  while (true) {
    const url = `${SOCRATA_URL}?$limit=${PAGE_SIZE}&$offset=${offset}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`Iowa Socrata ${res.status}: ${await res.text()}`)
    const page = await res.json()
    out.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return out
}

function filterAndDedupe(rows) {
  const stats   = { total: rows.length, noUpc: 0, badSize: 0, wrongCategory: 0, iowaProgram: 0, kept: 0 }
  const records = []
  const byUpc   = new Map()

  for (const row of rows) {
    const upc = normalizeUpc(row.upc)
    if (!upc) { stats.noUpc++; continue }

    const sizeMl = parseInt(row.bottle_volume_ml, 10)
    if (!KEEP_SIZES_ML.has(sizeMl)) { stats.badSize++; continue }

    const category = row.category_name ?? ''
    if (!KEEP_CATEGORY_PATTERNS.some(p => p.test(category))) { stats.wrongCategory++; continue }

    const desc = row.im_desc ?? ''
    if (IOWA_PROGRAM_PATTERNS.some(p => p.test(desc))) { stats.iowaProgram++; continue }

    const name = cleanName(desc)
    if (!name) continue

    // Iowa lists the same UPC under multiple itemnos (base SKU + "HA" hard-
    // allocation listing).  Prefer the non-HA row for cleaner display.
    const existing = byUpc.get(upc)
    const thisIsHa = /^HA\s/i.test(desc)
    if (existing) {
      if (/^HA\s/i.test(existing.rawDesc) && !thisIsHa) {
        existing.name    = name
        existing.rawDesc = desc
      }
      continue
    }

    const rec = { upc, name, sizeMl, vendor: row.vendor_name ?? null, rawDesc: desc }
    byUpc.set(upc, rec)
    records.push(rec)
    stats.kept++
  }

  return { records, stats }
}

async function fetchExisting(redis, keys) {
  const out = new Map()
  if (!keys.length) return out
  const SIZE = 200
  for (let i = 0; i < keys.length; i += SIZE) {
    const batch = keys.slice(i, i + SIZE)
    const vals  = await redis.mget(...batch)
    batch.forEach((k, idx) => { if (vals[idx] != null) out.set(k, vals[idx]) })
  }
  return out
}

/**
 * Run the full Iowa import.
 * @param {object} opts
 * @param {boolean} [opts.dryRun=false]   Skip Redis writes; return planned actions.
 * @param {(msg:string)=>void} [opts.log] Progress logger (default: console.log).
 * @returns {Promise<{stats, written, protected, watchlist}>}
 */
export async function runIowaImport({ dryRun = false, log = console.log } = {}) {
  log(`Iowa Liquor Products → Redis  ${dryRun ? '(DRY RUN)' : '(LIVE)'}`)

  log('Fetching catalog…')
  const rows = await fetchIowaCatalog()
  log(`  ${rows.length.toLocaleString()} rows received`)

  const { records, stats } = filterAndDedupe(rows)
  log(`Filter: kept ${stats.kept.toLocaleString()} unique UPCs · skipped ${stats.iowaProgram} Iowa-only programs · ${stats.badSize} non-standard sizes · ${stats.wrongCategory} off-category · ${stats.noUpc} no-UPC`)

  // Build watchlist preview for sanity-checking allocated coverage
  const watchTerms = ['BLANTON', 'PAPPY', 'VAN WINKLE', 'WELLER', 'STAGG', 'HANDY', 'EAGLE RARE', 'TAYLOR', 'BIRTHDAY', 'CRAIG BARREL', 'PARKER']
  const watchlist  = {}
  for (const term of watchTerms) {
    watchlist[term] = records
      .filter(r => r.rawDesc.toUpperCase().includes(term))
      .map(r => ({ upc: r.upc, name: r.name, sizeMl: r.sizeMl }))
  }

  if (dryRun) {
    return { stats, written: 0, protected: 0, watchlist }
  }

  // Live: Redis writes with user-scan protection
  const redis = Redis.fromEnv()
  const keys     = records.map(r => `wh:upc:${r.upc}`)
  const existing = await fetchExisting(redis, keys)

  let protectedCount = 0
  const writes = []
  for (const r of records) {
    const key = `wh:upc:${r.upc}`
    const ex  = existing.get(key)
    if (ex) {
      const parsed = typeof ex === 'string' ? safeParse(ex) : ex
      if (parsed?.source === 'user-scan') { protectedCount++; continue }
    }
    writes.push({
      key,
      value: {
        name:     r.name,
        imageUrl: null,
        source:   'iowa-abd',
        sizeMl:   r.sizeMl,
        vendor:   r.vendor,
      },
    })
  }
  log(`Writing ${writes.length.toLocaleString()} records · ${protectedCount} user-confirmed preserved`)

  let written = 0
  const BATCH = 200
  for (let i = 0; i < writes.length; i += BATCH) {
    const chunk = writes.slice(i, i + BATCH)
    const pipe  = redis.pipeline()
    for (const { key, value } of chunk) pipe.set(key, JSON.stringify(value))
    await pipe.exec()
    written += chunk.length
  }

  return { stats, written, protected: protectedCount, watchlist }
}

function safeParse(s) {
  try { return JSON.parse(s) } catch { return null }
}
