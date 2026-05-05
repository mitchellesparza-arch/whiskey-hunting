/**
 * Redis helpers for whiskey finds.
 *
 * Redis keys:
 *   wh:finds        — sorted set, score = timestamp (ms)
 *   wh:find-photos  — hash, findId → photoUrl
 *                     Stored separately so Blob URLs (containing / and :) never
 *                     appear inside sorted-set member strings, which can trigger
 *                     Upstash REST "string did not match expected pattern" errors.
 *
 * Sorted-set members are base64-encoded JSON so the Upstash REST layer never
 * encounters special characters (colons, slashes, etc.) in member strings.
 * Legacy members stored as raw JSON are still parsed via the decodeMember fallback.
 *
 * Find schema (as stored in sorted set member):
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
 *     notes:         string | null
 *     price:         number | null
 *     submittedBy:   string (email)
 *     submitterName: string
 *     timestamp:     number (ms)
 *     votes:         { up: string[], down: string[] }
 *   }
 *
 * photoUrl is merged in at read time from wh:find-photos (falls back to the
 * embedded field for legacy entries written before this schema change).
 */

import { randomBytes }   from 'crypto'
import { Redis }          from '@upstash/redis'
import { postFindAlert, postNewFind } from './discord.js'
import { sendToUser }     from './push.js'
import { getWishlist }    from './wishlist.js'

const KEY        = 'wh:finds'
const PHOTOS_KEY = 'wh:find-photos'
const ACTIVE_MS  =      24 * 60 * 60 * 1000   // 24 h  — active window
const TTL_MS     = 7 * 24 * 60 * 60 * 1000   // 7 days — archive retention

// ─── Member encoding ──────────────────────────────────────────────────────────
// Base64 keeps sorted-set member strings free of special characters that trip
// the Upstash REST API ("The string did not match the expected pattern").

function encodeMember(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64')
}

function decodeMember(m) {
  if (typeof m !== 'string') return m
  try {
    return JSON.parse(Buffer.from(m, 'base64').toString('utf-8'))
  } catch {
    try { return JSON.parse(m) } catch { return null }  // legacy raw-JSON fallback
  }
}

// Redis hash key for the monthly leaderboard — separate from the expiring
// finds sorted set so counts survive the 7-day TTL.
// Format: wh:leaderboard:2026-04  →  { "Alice": "3", "Bob": "1" }
function lbKey(date = new Date()) {
  return `wh:leaderboard:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Returns the top-5 submitters for the given year-month as [[name, count], …].
 * Defaults to the current month.
 */
export async function getMonthLeaderboard(date = new Date()) {
  try {
    const raw = await getRedis().hgetall(lbKey(date))
    if (!raw) return []
    return Object.entries(raw)
      .map(([name, count]) => [name, Number(count)])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  } catch { return [] }
}

function getRedis() {
  return Redis.fromEnv()
}

function cutoffMs()     { return Date.now() - TTL_MS    }
function activeCutoff() { return Date.now() - ACTIVE_MS }

/**
 * Returns all finds within the 7-day retention window, newest first.
 * Each find includes a computed `status` field:
 *   'active'   — timestamp < 24 h ago
 *   'archived' — timestamp 24 h – 7 days ago
 * photoUrls are merged from wh:find-photos (with legacy embedded-field fallback).
 */
export async function getFinds() {
  try {
    const redis   = getRedis()
    const cutoff  = cutoffMs()
    const active  = activeCutoff()
    const members = await redis.zrange(KEY, 0, -1, { rev: true })

    const parsed = members
      .map(m => decodeMember(m))
      .filter(m => m && m.timestamp >= cutoff)

    // Bulk-fetch all photo URLs and merge — one round trip regardless of find count
    let photosMap = {}
    try {
      const raw = await redis.hgetall(PHOTOS_KEY)
      if (raw) photosMap = raw
    } catch {}

    return parsed.map(m => ({
      ...m,
      // Prefer hash value; fall back to embedded photoUrl (legacy entries)
      photoUrl: photosMap[m.id] ?? m.photoUrl ?? null,
      status:   m.timestamp >= active ? 'active' : 'archived',
    }))
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
 * Checks all structured wishlists (wh:wishlist:*) for bottles with status 'Hunting'
 * that fuzzy-match the find's bottle name, then fires push notifications.
 * Runs fire-and-forget — never throws.
 */
async function checkWishlistsForFind(redis, find) {
  try {
    let cursor = 0
    const alerted = new Set()
    do {
      const [next, keys] = await redis.scan(cursor, { match: 'wh:wishlist:*', count: 50 })
      cursor = Number(next)
      for (const k of keys) {
        const email = k.replace(/^wh:wishlist:/, '')
        const wishlist = await getWishlist(email)
        const hunting  = wishlist.filter(e => e.status === 'Hunting')
        for (const entry of hunting) {
          const bLower   = entry.name.toLowerCase()
          const alertKey = `${email}:${bLower}`
          if (!alerted.has(alertKey) && find.bottleName.toLowerCase().includes(bLower)) {
            alerted.add(alertKey)
            sendToUser(email, {
              title: '🎯 Wishlist Hit',
              body:  `${find.submitterName ?? 'Someone'} spotted ${find.bottleName}${find.store?.name ? ` at ${find.store.name}` : ''}`,
              url:   '/finds',
              tag:   'wishlist-find',
            }).catch(() => {})
          }
        }
      }
    } while (cursor !== 0)
  } catch (err) {
    console.warn('[wishlist] Match check failed:', err.message)
  }
}

/**
 * Appends a compact record to the permanent per-store find history.
 * Prepends the record and trims to 150 entries. Never throws.
 */
async function appendStoreHistory(redis, placeId, record) {
  const key = `wh:store-history:${placeId}`
  try {
    const raw = await redis.get(key)
    const arr = raw ? (Array.isArray(raw) ? raw : JSON.parse(raw)) : []
    arr.unshift(record)
    if (arr.length > 150) arr.length = 150
    await redis.set(key, JSON.stringify(arr))
  } catch (err) {
    console.warn('[store-history] write failed:', err.message)
  }
}

/**
 * Adds a find to the sorted set.
 *
 * photoUrl is kept OUT of the sorted-set member JSON and stored in the
 * wh:find-photos hash instead. Blob URLs contain characters (/ :) that
 * can cause Upstash REST "string did not match expected pattern" validation
 * failures when embedded in sorted-set member strings.
 *
 * Sorted-set members are base64-encoded to prevent any remaining special
 * characters (email @, Google Places IDs, etc.) from triggering Upstash
 * REST validation errors.
 *
 * All post-zadd operations (photo storage, leaderboard, purge) are wrapped in
 * a single try-catch so secondary failures never surface as submission errors.
 *
 * Purges entries older than 7 days after adding.
 * Triggers watchlist matching in background.
 * Returns the new find entry with photoUrl merged in.
 */
export async function addFind({ bottleName, upc, store, photoUrl, notes, price, submittedBy, submitterName }) {
  const redis = getRedis()
  // Use timestamp + random hex suffix so two rapid submissions never collide
  // on the same sorted-set member string (which would silently overwrite).
  const id           = `${Date.now()}-${randomBytes(4).toString('hex')}`
  const storedPhoto  = photoUrl || null

  // Member stored in the sorted set — NO photoUrl to avoid URL chars
  const entry = {
    id,
    bottleName:    (bottleName ?? '').trim(),
    upc:           upc   || null,
    store:         store ?? null,
    notes:         (notes ?? '').trim() || null,
    price:         price != null && price !== '' ? Number(price) : null,
    submittedBy:   (submittedBy  ?? '').toLowerCase(),
    submitterName: submitterName ?? submittedBy ?? 'Unknown',
    timestamp:     Date.now(),
    votes:         { up: [], down: [] },
  }

  try {
    await redis.zadd(KEY, { score: entry.timestamp, member: encodeMember(entry) })
  } catch (err) {
    console.error('[finds] zadd error:', err?.message ?? err, 'member preview:', JSON.stringify(entry).slice(0, 200))
    throw err
  }

  // Post-zadd: photo storage, leaderboard, purge.
  // Wrapped in a single try-catch — failures here are non-fatal; the find is already saved.
  try {
    if (storedPhoto) {
      await redis.hset(PHOTOS_KEY, { [id]: storedPhoto })
    }
    // Increment the durable monthly leaderboard counter (survives the 7-day finds TTL)
    const lb = lbKey(new Date(entry.timestamp))
    await redis.hincrby(lb, entry.submitterName, 1)
    await redis.expire(lb, 60 * 24 * 60 * 60)   // keep for 60 days then auto-clean
    // Purge entries older than 7 days from the sorted set
    await redis.zremrangebyscore(KEY, 0, cutoffMs())
  } catch (err) {
    console.warn('[finds] post-zadd ops error (find was saved ok):', err?.message ?? err)
  }

  // Check watchlists + wishlists in the background — don't await so response isn't delayed
  checkWatchlistsForFind(redis, { ...entry, photoUrl: storedPhoto })
  checkWishlistsForFind(redis, { ...entry, photoUrl: storedPhoto })

  // Post to Patreon Discord finds channel — fire-and-forget
  postNewFind({ ...entry, photoUrl: storedPhoto }).catch(() => {})

  // Permanent per-store find history (survives the 7-day TTL) — fire-and-forget
  if (entry.store?.placeId) {
    appendStoreHistory(redis, entry.store.placeId, {
      bottleName:    entry.bottleName,
      price:         entry.price,
      submitterName: entry.submitterName,
      timestamp:     entry.timestamp,
    }).catch(() => {})
  }

  // Return the full entry with photoUrl for the submission response
  return { ...entry, photoUrl: storedPhoto }
}

/**
 * Removes a find by id.
 * Scans all members and removes the one matching.
 * Also cleans up the wh:find-photos hash entry.
 * Returns the updated list.
 */
export async function removeFind(id) {
  const redis   = getRedis()
  const members = await redis.zrange(KEY, 0, -1)
  for (const m of members) {
    try {
      const entry = decodeMember(m)
      if (entry?.id === id) {
        await redis.zrem(KEY, m)
        break
      }
    } catch {}
  }
  // Clean up photo entry — non-fatal if it fails
  try { await redis.hdel(PHOTOS_KEY, id) } catch {}
  return getFinds()
}

/**
 * Toggle a vote (up = "Still There", down = "Gone") on a find.
 * - If the user already voted in this direction, remove their vote (un-vote).
 * - If the user voted the other way, switch their vote.
 * Returns the updated find object (with photoUrl merged from hash), or null if not found.
 */
export async function voteFind(id, type, userEmail) {
  if (!['up', 'down'].includes(type)) return null
  const redis   = getRedis()
  const members = await redis.zrange(KEY, 0, -1)

  for (const m of members) {
    try {
      const entry = decodeMember(m)
      if (!entry || entry.id !== id) continue

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
      await redis.zadd(KEY, { score: Number(score), member: encodeMember(updated) })

      // Merge photoUrl from hash for the response so the client keeps the photo visible
      // (legacy entries may still have photoUrl embedded in the member)
      let photoUrl = entry.photoUrl ?? null
      if (!photoUrl) {
        try { photoUrl = (await redis.hget(PHOTOS_KEY, id)) ?? null } catch {}
      }

      return { ...updated, photoUrl }
    } catch {}
  }
  return null
}
