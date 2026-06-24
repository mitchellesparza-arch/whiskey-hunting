/**
 * Unified bottle catalog — 400+ bottles with MSRP, metadata, and optional
 * secondary market pricing. Powers catalog search and bottle detail pages
 * independently of the Binny's Algolia index.
 *
 * Year-specific entries (e.g. "George T. Stagg 2025") carry a `year` field
 * so the UI can offer a year selector on the detail page.
 */

import data from './market-prices-data.json'
import { sameBottleLine } from './bottle-match.js'

// A fuzzy catalog match must clear this score before its metadata (MSRP,
// distillery, proof…) is trusted. Previously getCatalogEntry returned ANY
// score > 0, so a wrong-brand bottle's spec sheet leaked onto the page.
const CATALOG_ENTRY_FLOOR = 40

// ── Normalization ─────────────────────────────────────────────────────────────

function norm(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/['''''']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function score(query, candidate) {
  const q = norm(query)
  const c = norm(candidate)
  if (!q || !c) return 0
  if (c === q)              return 100
  if (c.startsWith(q) || q.startsWith(c)) return 80
  if (c.includes(q) || q.includes(c))     return 60
  // Brand + numeric gate: the candidate must share the query's distinctive
  // (longest) brand token and all of its age/year numbers before any token-
  // overlap score is awarded. Stops "Jack Daniels 10 Year" scoring against
  // "Eagle Rare 10 Year" on the shared "10"/"year" tokens alone.
  if (!sameBottleLine(query, candidate)) return 0
  const qWords = new Set(q.split(' ').filter(w => w.length >= 2))
  const cWords = c.split(' ').filter(w => w.length >= 2)
  const hits   = cWords.filter(w => qWords.has(w)).length
  if (hits === 0) return 0
  return Math.round(20 + 10 * hits - Math.max(0, cWords.length - hits) * 2)
}

function bestScore(query, entry) {
  const candidates = [entry.name, ...(entry.aliases ?? [])]
  return Math.max(...candidates.map(c => score(query, c)))
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Search the full catalog by name. Returns top matches sorted by relevance.
 * @param {string} query
 * @param {number} limit
 * @returns {Array<CatalogEntry>}
 */
export function searchCatalog(query, limit = 10) {
  if (!query || query.trim().length < 2) return []
  return data
    .map(entry => ({ entry, s: bestScore(query, entry) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ entry }) => formatEntry(entry))
}

/**
 * Find one catalog entry by exact name (case-insensitive, alias-aware).
 * Returns the best fuzzy match if no exact match exists, or null if none.
 * @param {string} name
 * @returns {CatalogEntry|null}
 */
export function getCatalogEntry(name) {
  if (!name) return null
  let best = null
  let bestS = 0
  for (const entry of data) {
    const s = bestScore(name, entry)
    if (s > bestS) { bestS = s; best = entry }
  }
  // Require a strong match — a weak token overlap must NOT return a wrong-brand
  // bottle's MSRP/metadata. This is the fix for the "correct photo, wrong specs"
  // bug: the market-price route falls back here when no secondary data exists.
  if (!best || bestS < CATALOG_ENTRY_FLOOR) return null
  return formatEntry(best)
}

/**
 * Return all year-specific variants for a base bottle name.
 * e.g. "George T. Stagg" → [2024 entry, 2025 entry, ...]
 * @param {string} baseName
 * @returns {Array<{year: number, entry: CatalogEntry}>}
 */
export function getYearVariants(baseName) {
  const normBase = norm(baseName).replace(/\d{4}/, '').trim()
  return data
    .filter(e => e.year && norm(e.name).replace(/\d{4}/, '').trim() === normBase)
    .map(e => ({ year: e.year, entry: formatEntry(e) }))
    .sort((a, b) => b.year - a.year)
}

/**
 * Return all entries (for browsing / indexing).
 */
export function getAllEntries() {
  return data.map(formatEntry)
}

// ── Formatting ────────────────────────────────────────────────────────────────

function formatEntry(e) {
  return {
    name:        e.name,
    year:        e.year        ?? null,
    distillery:  e.distillery  ?? null,
    category:    e.type        ?? e.category ?? null,
    proof:       e.proof       ?? null,
    age:         e.age         ?? null,
    msrp:        e.msrp        ?? null,
    rarity:      e.rarity      ?? null,
    origin:      e.origin      ?? null,
    region:      e.region      ?? null,
    sizes:       e.sizes       ?? null,
    secondary:   e.secondary   ?? null,
    lastUpdated: e.lastUpdated ?? null,
  }
}
