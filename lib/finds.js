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

import { randomBytes }   from 'crypto'
import { Redis }          from '@upstash/redis'
import { postFindAlert }  from './discord.js'
import { sendToUser }     from './push.js'

const KEY        = 'wh:finds'
const ACTIVE_MS  =      24 * 60 * 60 * 1000   // 24 h  — active window
const TTL_MS     = 7 * 24 * 60 * 60 * 1000   // 7 days — archive retention

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
 * Scans all per-user watchlists and fires a Discord alert + push notification
 * for any bottle name that fuzzy-matches `find.bottleName`.
 * Runs fire-and-forget — never throws.
 */
async function checkWatchlistsForFind(redis, find) {
  try {
    let cursor  = 0
    // Track which (email, bottle) pairs already alerted to avoid duplicates
    const alerted = new Set()
    do {
      const [next, keys] = await redis.scan(cursor, { match: 'wh:watchlist:*', count: 50 })
      cursor = Number(next)
      for (const k of keys) {
        // Key format: wh:watchlist:{email}
        const email = k.replace(/^wh:watchlist:/, '')
        const raw = await redis.get(k)
        if (!raw) continue
        const bottles = Array.isArray(raw) ? raw
          : typeof raw === 'string' ? JSON.parse(raw) : []
        for (const bottle of bottles) {
          const bLower   = bottle.toLowerCase()
          const alertKey = `${email}:${bLower}`
          if (!alerted.has(alertKey) && find.bottleName.toLowerCase().includes(bLower)) {
            alerted.add(alertKey)
            // Discord alert (fire-and-forget)
            postFindAlert(bottle, find).catch(() => {})
            // Push notification to the watchlist owner specifically
            sendToUser(email, {
              title: '👀 Find Alert',
              body:  `${find.submitterName ?? 'Someone'} spotted ${find.bottleName}${find.store?.name ? ` at ${find.store.name}` : ''}`,
              url:   '/finds',
              tag:   'watchlist-find',
            }).catch(() => {})
          }
        }
      }
    } while (cursor !== 0)
  } catch (err) {
    console.warn('[watchlist] Match check failed:', err.message)
  }
}

/**
 * Adds a find to the sorted set.
 * Purges entries older than 72 hours after adding.
 * Triggers watchlist matching in background.
 * Returns the new find entry.
 */
export async function addFind({ bottleName, upc, store, photoUrl, notes, price, submittedBy, submitterName }) {
  const redis = getRedis()
  // Use timestamp + random hex suffix so two rapid submissions never collide
  // on the same sorted-set member string (which would silently overwrite).
  const id = `${Date.now()}-${randomBytes(4).toString('hex')}`
  const entry = {
    id,
    bottleName:    (bottleName ?? '').trim(),
    upc:           upc   || null,
    store:         store ?? null,
    photoUrl:      photoUrl || null,
    notes:         (notes ?? '').trim() || null,
    price:         price  != null && price !== '' ? Number(price) : null,
    submittedBy:   (submittedBy  ?? '').toLowerCase(),
    submitterName: submitterName ?? submittedBy ?? 'Unknown',
    timestamp:     Date.now(),
    votes:         { up: [], down: [] },
  }
  try {
    await redis.zadd(KEY, { score: entry.timestamp, member: JSON.stringify(entry) })
  } catch (err) {
    console.error('[finds] zadd error:', err?.message ?? err, 'member preview:', JSON.stringify(entry).slice(0, 200))
    throw err
  }
  // Purge entries older than 72h
  await redis.zremrangebyscore(KEY, 0, cutoffMs())
  // Check watchlists in the background — don't await so response isn't delayed
  checkWatchlistsForFind(redis, entry)
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

/**
 * Toggle a vote (up = "Still There", down = "Gone") on a find.
 * - If the user already voted in this direction, remove their vote (un-vote).
 * - If the user voted the other way, switch their vote.
 * Returns the updated find object, or null if not found.
 */
export async function voteFind(id, type, userEmail) {
  if (!['up', 'down'].includes(type)) return null
  const redis   = getRedis()
  const members = await redis.zrange(KEY, 0, -1)

  for (const m of members) {
    try {
      const entry = typeof m === 'string' ? JSON.parse(m) : m
      if (entry.id !== id) continue

      const votes = entry.votes ?? { up: [], down: [] }
      const other = type === 'up' ? 'down' : 'up'

      if (votes[type].includes(userEmail)) {
        // Un-vote: remove from this side
        votes[type] = votes[type].filter(e => e !== userEmail)
      } else {
        // Vote: add to this side, remove from other
        votes[type]  = [...new Set([...votes[type], userEmail])]
        votes[other] = votes[other].filter(e => e !== userEmail)
      }

      const updated = { ...entry, votes }
      const score   = await redis.zscore(KEY, m)
      await redis.zrem(KEY, m)
      await redis.zadd(KEY, { score: Number(score), member: JSON.stringify(updated) })
      return updated
    } catch {}
  }
  return null
}
