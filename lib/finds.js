/**
 * Redis helpers for whiskey finds.
 *
 * Redis key: wh:finds  — sorted set, score = timestamp (ms), max 500 entries
 *
 * Find schema:
 *   {
 *     id:            string (timestamp-based)
 *     bottleName:    string
 *     upc:           string | null
 *     store: {
 *       name:        string
 *       address:     string
 *       lat:         number
 *       lng:         number
 *       placeId:     string
 *     }
 *     photoUrl:      string | null
 *     notes:         string | null
 *     submittedBy:   string (email)
 *     submitterName: string
 *     timestamp:     number (ms)
 *   }
 */

import { Redis } from '@upstash/redis'

const KEY        = 'wh:finds'
const ACTIVE_MS  = 24 * 60 * 60 * 1000   // 24 h — active window
const TTL_MS     = 72 * 60 * 60 * 1000   // 72 h — retention in Redis

function getRedis() {
  return Redis.fromEnv()
}

function cutoffMs()   { return Date.now() - TTL_MS   }
function activeCutoff() { return Date.now() - ACTIVE_MS }

/**
 * Returns all finds within the 72-hour retention window, newest first.
 * Each find includes a computed `status` field:
 *   'active'   — timestamp < 24 h ago
 *   'archived' — timestamp 24–72 h ago
 */
export async function getFinds() {
  try {
    const redis   = getRedis()
    const cutoff  = cutoffMs()
    const active  = activeCutoff()
    const members = await redis.zrange(KEY, 0, -1, { rev: true })
    return members
      .map(m => {
        try { return typeof m === 'string' ? JSON.parse(m) : m }
        catch { return null }
      })
      .filter(m => m && m.timestamp >= cutoff)
      .map(m => ({ ...m, status: m.timestamp >= active ? 'active' : 'archived' }))
  } catch { return [] }
}

/**
 * Adds a find to the sorted set.
 * Purges entries older than 24 hours after adding.
 * Returns the new find entry.
 */
export async function addFind({ bottleName, upc, store, photoUrl, notes, submittedBy, submitterName }) {
  const redis = getRedis()
  const entry = {
    id:            Date.now().toString(),
    bottleName:    (bottleName ?? '').trim(),
    upc:           upc   || null,
    store:         store ?? null,
    photoUrl:      photoUrl || null,
    notes:         (notes ?? '').trim() || null,
    submittedBy:   (submittedBy  ?? '').toLowerCase(),
    submitterName: submitterName ?? submittedBy ?? 'Unknown',
    timestamp:     Date.now(),
  }
  await redis.zadd(KEY, { score: entry.timestamp, member: JSON.stringify(entry) })
  // Purge anything older than 24 hours
  await redis.zremrangebyscore(KEY, 0, cutoffMs())
  return entry
}

/**
 * Removes a find by id.
 * Scans all members and removes the one matching.
 * Returns the updated list.
 */
export async function removeFind(id) {
  const redis   = getRedis()
  const members = await redis.zrange(KEY, 0, -1)
  for (const m of members) {
    try {
      const entry = typeof m === 'string' ? JSON.parse(m) : m
      if (entry.id === id) {
        await redis.zrem(KEY, m)
        break
      }
    } catch {}
  }
  return getFinds()
}
