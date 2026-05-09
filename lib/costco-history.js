/**
 * lib/costco-history.js — Persistence for Costco bourbon alerts ingested
 * from the Tatera Illinois Discord relay, plus a small store-overrides
 * layer that lets the live feed self-correct missing or wrong store info
 * over time.
 *
 * Redis schema:
 *   wh:costco:recent              List<alert>  — global feed, last 200
 *   wh:costco:store:{number}      List<alert>  — per-store, last 20
 *   wh:costco:stores              Set<string>  — store numbers ever seen
 *   wh:costco:seen:{messageId}    String "1"   — dedup, 14-day TTL
 *   wh:costco:store-overrides     Hash<num, JSON>  — discord-sourced
 *                                                    name/state corrections
 *                                                    + adds for unknown nums
 */

import { Redis }                            from '@upstash/redis'
import { COSTCO_STORES_IL, normalizeStoreName } from './costco-stores.js'

const RECENT_KEY     = 'wh:costco:recent'
const STORES_SET_KEY = 'wh:costco:stores'
const OVERRIDES_KEY  = 'wh:costco:store-overrides'
const RECENT_MAX     = 200
const PER_STORE_MAX  = 20
const SEEN_TTL_SEC   = 14 * 24 * 60 * 60

const storeKey = (number) => `wh:costco:store:${number}`
const seenKey  = (id)     => `wh:costco:seen:${id}`

function getRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set')
  return new Redis({ url, token })
}

/**
 * Record a Costco alert.  Atomic dedup via SET NX on the seen key.
 * Returns true if newly recorded, false if it was a duplicate.
 */
export async function recordAlert(alert) {
  const redis = getRedis()
  const id    = alert.discordMessageId
  if (!id) return false

  // Dedup: only the first writer for a given message id proceeds
  const claimed = await redis.set(seenKey(id), '1', { ex: SEEN_TTL_SEC, nx: true })
  if (!claimed) return false

  await Promise.all([
    redis.lpush(RECENT_KEY, alert).then(() => redis.ltrim(RECENT_KEY, 0, RECENT_MAX - 1)),
    redis.lpush(storeKey(alert.storeNumber), alert).then(() => redis.ltrim(storeKey(alert.storeNumber), 0, PER_STORE_MAX - 1)),
    redis.sadd(STORES_SET_KEY, alert.storeNumber),
  ])

  return true
}

/**
 * Last N alerts across all stores, newest first.
 */
export async function getRecentAlerts(limit = RECENT_MAX) {
  try {
    const list = await getRedis().lrange(RECENT_KEY, 0, Math.min(limit, RECENT_MAX) - 1)
    return list.filter(Boolean)
  } catch (err) {
    console.warn('[costco-history] getRecentAlerts error:', err.message)
    return []
  }
}

/**
 * Last N alerts for each requested store number, merged and sorted newest-first.
 */
export async function getAlertsForStores(storeNumbers, perStore = PER_STORE_MAX) {
  if (!Array.isArray(storeNumbers) || !storeNumbers.length) return []
  try {
    const redis  = getRedis()
    const limit  = Math.min(perStore, PER_STORE_MAX)
    const lists  = await Promise.all(
      storeNumbers.map(n => redis.lrange(storeKey(n), 0, limit - 1))
    )
    return lists
      .flat()
      .filter(Boolean)
      .sort((a, b) => new Date(b.observedAt) - new Date(a.observedAt))
  } catch (err) {
    console.warn('[costco-history] getAlertsForStores error:', err.message)
    return []
  }
}

// ── Store-list overrides (auto-correction from incoming alerts) ────────────

const _staticByNumber = Object.fromEntries(COSTCO_STORES_IL.map(s => [s.number, s]))

function namesMatch(a, b) {
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()
}

/**
 * Read all override entries.  Returns an object keyed by store number.
 * Each value: { name, state, source, firstSeenAt, lastSeenAt }
 */
export async function getStoreOverrides() {
  try {
    const raw = await getRedis().hgetall(OVERRIDES_KEY)
    if (!raw) return {}
    const out = {}
    for (const [k, v] of Object.entries(raw)) {
      try { out[k] = typeof v === 'string' ? JSON.parse(v) : v }
      catch { /* skip malformed */ }
    }
    return out
  } catch (err) {
    console.warn('[costco-history] getStoreOverrides error:', err.message)
    return {}
  }
}

/**
 * Merge the static IL seed list with Redis overrides and return a sorted
 * array.  Override wins where present.  Sort by name, alphabetical.
 *
 *   { number, name, state, source: 'static' | 'discord' }
 */
export async function getMergedStores() {
  const overrides = await getStoreOverrides()
  const map = {}
  for (const s of COSTCO_STORES_IL) map[s.number] = { ...s, source: 'static' }
  for (const [number, ov] of Object.entries(overrides)) {
    map[number] = { number, name: ov.name, state: ov.state, source: 'discord' }
  }
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Reconcile an incoming alert's store info against what we know.
 *
 *   - If the static list has this number with a matching (normalized) name,
 *     no-op.
 *   - Otherwise, write/update an override entry with the alert's name+state.
 *
 * Returns one of: 'noop' | 'added' | 'corrected' | 'updated' | 'touched'
 */
export async function recordStoreFromAlert({ number, name, state }) {
  if (!number || !name) return 'noop'
  const num   = String(number).trim()
  const st    = String(state ?? '').trim().toUpperCase()
  const clean = normalizeStoreName(name, st)
  if (!clean) return 'noop'

  const stat = _staticByNumber[num]
  if (stat && namesMatch(stat.name, clean) && stat.state === st) {
    return 'noop'
  }

  try {
    const redis    = getRedis()
    const existing = await redis.hget(OVERRIDES_KEY, num)
    const parsed   = existing ? (typeof existing === 'string' ? JSON.parse(existing) : existing) : null
    const now      = new Date().toISOString()

    if (parsed && namesMatch(parsed.name, clean) && parsed.state === st) {
      // override already matches — just refresh lastSeenAt
      await redis.hset(OVERRIDES_KEY, { [num]: JSON.stringify({ ...parsed, lastSeenAt: now }) })
      return 'touched'
    }

    const entry = {
      name:        clean,
      state:       st || null,
      source:      'discord',
      firstSeenAt: parsed?.firstSeenAt ?? now,
      lastSeenAt:  now,
    }
    await redis.hset(OVERRIDES_KEY, { [num]: JSON.stringify(entry) })

    if (stat)  return 'corrected'  // we had it, but with wrong info
    if (parsed) return 'updated'   // we had an override, now changing it
    return 'added'                  // brand new store
  } catch (err) {
    console.warn('[costco-history] recordStoreFromAlert error:', err.message)
    return 'noop'
  }
}
