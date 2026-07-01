/**
 * Secondary market price reference.
 * Lookup order: Redis live cache (populated by scripts/refresh-market-prices.mjs) → static JSON seed.
 *
 * Name matching uses word-overlap scoring so partial names work
 * (e.g. "Blanton's Original" finds "Blanton's Original Single Barrel").
 */

import { Redis } from '@upstash/redis'
import data from './market-prices-data.json'
import { overlapScore } from './bottle-match.js'

function normName(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/['''''']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function lookupStatic(bottleName) {
  const norm = normName(bottleName)
  if (!norm) return null

  let best = null
  let bestScore = 0

  for (const entry of data) {
    const names = [entry.name, ...(entry.aliases ?? [])]
    for (const candidate of names) {
      // Brand + numeric gate (via overlapScore/sameBottleLine): the candidate
      // must share the query's distinctive brand token and all of its
      // age/year/proof numbers. Prevents both "22 Year" → "7 Year" (numbers)
      // and "Old Forester 1920" → "Old Fitzgerald 1920" (brand).
      const s = overlapScore(norm, candidate)
      if (s > bestScore && s >= 0.5) {
        bestScore = s
        best = entry
      }
    }
  }

  if (!best || !best.secondary) return null
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
