/**
 * Secondary market price reference.
 * Lookup order: Redis live cache (populated by scripts/refresh-market-prices.mjs) → static JSON seed.
 *
 * Name matching uses word-overlap scoring so partial names work
 * (e.g. "Blanton's Original" finds "Blanton's Original Single Barrel").
 */

import { Redis } from '@upstash/redis'
import data from './market-prices-data.json'

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

  const hits = qWords.filter(w => cWords.some(c => c.includes(w) || w.includes(c))).length
  const score = hits / Math.max(qWords.length, cWords.length)
  const exactMatch = norm.includes(candidate) || candidate.includes(norm)
  return exactMatch ? Math.max(score, 0.8) : score
}

function lookupStatic(bottleName) {
  const norm = normName(bottleName)
  if (!norm) return null

  let best = null
  let bestScore = 0

  for (const entry of data) {
    const names = [entry.name, ...(entry.aliases ?? [])].map(normName)
    for (const candidate of names) {
      const s = scoreMatch(norm, candidate)
      if (s > bestScore && s >= 0.5) {
        bestScore = s
        best = entry
      }
    }
  }

  if (!best) return null
  return {
    low:         best.secondary.low,
    avg:         best.secondary.avg,
    high:        best.secondary.high,
    rarity:      best.rarity,
    msrp:        best.msrp,
    source:      'Secondary market estimate',
    lastUpdated: best.lastUpdated,
    distillery:  best.distillery  ?? null,
    proof:       best.proof       ?? null,
    age:         best.age         ?? null,
    sizes:       best.sizes       ?? null,
    origin:      best.origin      ?? null,
    region:      best.region      ?? null,
    type:        best.type        ?? null,
  }
}

/**
 * Returns a market price object for the given bottle name, or null if unknown.
 * Checks Redis live cache first; falls back to static JSON.
 *
 * @param {string} bottleName
 * @returns {Promise<{ low: number, avg: number, high: number, rarity: string, msrp: number, source: string, lastUpdated: string } | null>}
 */
export async function getMarketPrice(bottleName) {
  if (!bottleName) return null
  const norm = normName(bottleName)
  if (!norm) return null

  try {
    const redis = Redis.fromEnv()
    const cached = await redis.get(`wh:market-prices:live:${norm}`)
    if (cached) {
      return typeof cached === 'string' ? JSON.parse(cached) : cached
    }
  } catch {
    // Redis unavailable — fall through to static JSON
  }

  return lookupStatic(bottleName)
}

/**
 * Synchronous static-only lookup — for server-side builds or non-async contexts.
 */
export function getMarketPriceSync(bottleName) {
  return lookupStatic(bottleName)
}
