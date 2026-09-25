/**
 * lib/collection-csv.js — CSV import/export for My Collection (Pro feature)
 *
 * Pure functions only (no Redis, no DOM) so the page can build exports
 * client-side and the import route can parse server-side.
 *
 * Import accepts our own export format plus other trackers' exports
 * (e.g. BarrelBook) by matching header aliases. Unknown columns are ignored.
 */

export const CSV_CATEGORIES = ['Bourbon', 'Rye', 'Scotch', 'Japanese', 'American', 'Irish']

export const MAX_IMPORT_ROWS = 2000

// Columns written on export, in order. Import reads these back losslessly.
export const EXPORT_COLUMNS = [
  'name', 'distillery', 'category', 'proof', 'qty', 'msrp', 'secondary',
  'upc', 'blindScore', 'tastings', 'flavors', 'forSale', 'forTrade',
  'addedAt', 'photoUrl', 'id',
]

// Normalized header → our field. Headers are lowercased with non-alphanumerics stripped.
const HEADER_ALIASES = {
  name:       ['name', 'bottle', 'bottlename', 'product', 'productname', 'whiskey'],
  brand:      ['brand'],
  distillery: ['distillery', 'distilledby', 'producer', 'distiller'],
  category:   ['category', 'type', 'style'],
  proof:      ['proof'],
  abv:        ['abv'],
  qty:        ['qty', 'quantity', 'count', 'bottles'],
  msrp:       ['msrp', 'retail', 'retailprice'],
  secondary:  ['secondary', 'secondaryprice', 'marketprice', 'value'],
  upc:        ['upc', 'barcode'],
  blindScore: ['blindscore', 'score'],
  tastings:   ['tastings'],
  flavors:    ['flavors'],
  forSale:    ['forsale'],
  forTrade:   ['fortrade'],
  addedAt:    ['addedat', 'createdat', 'dateadded'],
  photoUrl:   ['photourl', 'imageurl', 'image'],
  status:     ['status'],
  id:         ['id'],
}

const WHISKEY_TYPES = new Set([
  'whiskey', 'whisky', 'wheat', 'wheat whiskey', 'tennessee', 'canadian', 'corn',
  'corn whiskey', 'malt whiskey', 'american single malt', 'blended whiskey',
  'flavored whiskey', 'rice whiskey', 'moonshine',
])

// Statuses (from other trackers) meaning the bottle is gone — not imported.
const GONE_STATUSES = new Set(['finished', 'empty', 'killed', 'sold', 'gifted', 'traded'])

// ── Parsing ───────────────────────────────────────────────────────────────────

/** RFC 4180 CSV → array of string arrays. Handles quotes, escaped quotes, CRLF, BOM. */
export function parseCsv(text) {
  const src  = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows = []
  let row = [], field = '', quoted = false

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',')   { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }

  return rows.filter(r => r.some(f => f.trim() !== ''))
}

function headerKey(h) {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function num(v) {
  const n = parseFloat(String(v ?? '').replace(/[$,]/g, ''))
  return Number.isFinite(n) ? n : null
}

function bool(v) {
  return /^(true|yes|y|1)$/i.test(String(v ?? '').trim())
}

export function normalizeCategory(raw) {
  const t = (raw ?? '').trim()
  if (!t) return 'Bourbon'
  const hit = CSV_CATEGORIES.find(c => c.toLowerCase() === t.toLowerCase())
  if (hit) return hit
  const lower = t.toLowerCase()
  if (WHISKEY_TYPES.has(lower) || /whiske?y/.test(lower)) return 'American'
  return t   // non-whiskey (Gin, Rum, …) — keep as-is rather than mislabel
}

/**
 * Map parsed CSV rows to collection entries (without id/userId/addedAt
 * defaults — the caller assigns those).
 *
 * Returns { entries, skipped: [{ row, reason }], unmatchedHeaders }
 */
export function rowsToEntries(rows) {
  if (!rows.length) return { entries: [], skipped: [], unmatchedHeaders: [] }

  const [header, ...data] = rows
  const colFor = {}
  const unmatchedHeaders = []
  header.forEach((h, i) => {
    const k = headerKey(h)
    const field = Object.keys(HEADER_ALIASES).find(f => HEADER_ALIASES[f].includes(k))
    if (field && colFor[field] == null) colFor[field] = i
    else if (!field && h.trim()) unmatchedHeaders.push(h.trim())
  })

  if (colFor.name == null) {
    throw new Error('CSV needs a "name" column (the bottle name).')
  }

  const get = (r, f) => (colFor[f] != null ? (r[colFor[f]] ?? '').trim() : '')
  const entries = []
  const skipped = []

  data.forEach((r, idx) => {
    const rowNum = idx + 2   // 1-based, after header — matches what a spreadsheet shows
    let name = get(r, 'name')
    const brand = get(r, 'brand')
    if (!name) { skipped.push({ row: rowNum, reason: 'Missing bottle name' }); return }
    if (brand && !name.toLowerCase().includes(brand.toLowerCase())) name = `${brand} ${name}`

    const status = get(r, 'status').toLowerCase()
    if (GONE_STATUSES.has(status)) {
      skipped.push({ row: rowNum, name, reason: `Status "${get(r, 'status')}"` })
      return
    }

    const proof = num(get(r, 'proof')) ?? (num(get(r, 'abv')) != null ? num(get(r, 'abv')) * 2 : null)
    const flavors = get(r, 'flavors')
    const addedAt = get(r, 'addedAt')
    const score = num(get(r, 'blindScore'))

    entries.push({
      ...(get(r, 'id') ? { id: get(r, 'id') } : {}),
      name,
      distillery: get(r, 'distillery') || brand,
      category:   normalizeCategory(get(r, 'category')),
      proof:      proof ?? 0,
      msrp:       num(get(r, 'msrp')) ?? 0,
      secondary:  num(get(r, 'secondary')) ?? 0,
      qty:        Math.max(1, Math.round(num(get(r, 'qty')) ?? 1)),
      blindScore: score,
      tastings:   Math.max(0, Math.round(num(get(r, 'tastings')) ?? 0)),
      flavors:    flavors ? flavors.split(/[;|,]/).map(s => s.trim()).filter(Boolean) : [],
      addedAt:    addedAt && !Number.isNaN(Date.parse(addedAt)) ? new Date(addedAt).toISOString() : null,
      upc:        get(r, 'upc') || null,
      photoUrl:   /^https:\/\//.test(get(r, 'photoUrl')) ? get(r, 'photoUrl') : null,
      forSale:    bool(get(r, 'forSale')),
      forTrade:   bool(get(r, 'forTrade')),
    })
  })

  return { entries, skipped, unmatchedHeaders }
}

// ── Export ────────────────────────────────────────────────────────────────────

function csvCell(v) {
  if (v == null) return ''
  let s = Array.isArray(v) ? v.join('; ') : String(v)
  // Neutralize spreadsheet formula injection (=, +, -, @ at start of text)
  if (/^[=+\-@]/.test(s) && !/^-?\d/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Collection entries → CSV text (with header row). */
export function bottlesToCsv(bottles) {
  const lines = [EXPORT_COLUMNS.join(',')]
  for (const b of bottles) lines.push(EXPORT_COLUMNS.map(c => csvCell(b[c])).join(','))
  return lines.join('\r\n') + '\r\n'
}
