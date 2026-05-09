/**
 * lib/costco-history.js — Persistence for Costco bourbon alerts ingested
 * from the Tatera Illinois Discord relay.
 *
 * Redis schema:
 *   wh:costco:recent              List<alert>  — global feed, last 200
 *   wh:costco:store:{number}      List<alert>  — per-store, last 20
 *   wh:costco:stores              Set<string>  — store numbers ever seen
 *   wh:costco:seen:{messageId}    String "1"   — dedup, 14-day TTL
 */

import { Redis } from '@upstash/redis'

const RECENT_KEY     = 'wh:costco:recent'
const STORES_SET_KEY = 'wh:costco:stores'
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
