/**
 * Redis helpers for the Tater Tracker Marketplace.
 *
 * Redis keys:
 *   wh:marketplace          — sorted set, score = timestamp (ms), member = JSON listing
 *   wh:marketplace-photos   — hash, listingId → JSON array of photo URLs
 *                             (stored separately — Blob URLs with / and : break Upstash sorted-set validation)
 *
 * Listing schema:
 *   {
 *     id:             string (timestamp + random hex)
 *     type:           'selling' | 'trading' | 'iso'
 *     bottles:        Array<{ name, category?, condition?, notes? }>
 *     askingPrice:    number | null      (per bottle, or total for lots)
 *     binPrice:       number | null      (Buy It Now — reserves the listing)
 *     zip:            string             (5-digit, for local context)
 *     notes:          string | null
 *     discordHandle:  string | null      (contact method)
 *     submittedBy:    string (email)
 *     submitterName:  string
 *     timestamp:      number (ms)
 *     active:         boolean
 *     binReservedBy:  string | null      (email of BIN claimer)
 *     binReservedAt:  number | null
 *   }
 *
 * photoUrls are stored in wh:marketplace-photos as a JSON array per listing id
 * and merged in at read time.
 */

import { randomBytes } from 'crypto'
import { Redis }       from '@upstash/redis'

const KEY        = 'wh:marketplace'
const PHOTOS_KEY = 'wh:marketplace-photos'
const TTL_MS     = 60 * 24 * 60 * 60 * 1000  // 60 days

function getRedis() {
  return Redis.fromEnv()
}

function cutoffMs() {
  return Date.now() - TTL_MS
}

/**
 * Fetch all active marketplace listings, newest first.
 * Includes listings up to 60 days old.
 */
export async function getListings({ type, activeOnly = false } = {}) {
  try {
    const redis   = getRedis()
    const members = await redis.zrange(KEY, 0, -1, { rev: true })

    const parsed = members
      .map(m => {
        try { return typeof m === 'string' ? JSON.parse(m) : m }
        catch { return null }
      })
      .filter(m => m && m.timestamp >= cutoffMs())
      .filter(m => !activeOnly || m.active !== false)
      .filter(m => !type || m.type === type)

    // Bulk-fetch all photo arrays
    let photosMap = {}
    try {
      const raw = await redis.hgetall(PHOTOS_KEY)
      if (raw) photosMap = raw
    } catch {}

    return parsed.map(m => ({
      ...m,
      photos: photosMap[m.id]
        ? (typeof photosMap[m.id] === 'string' ? JSON.parse(photosMap[m.id]) : photosMap[m.id])
        : (m.photos ?? []),
    }))
  } catch { return [] }
}

/**
 * Add a new marketplace listing.
 * photos[] kept out of the sorted-set member; stored in the photos hash.
 */
export async function addListing({
  type, bottles, askingPrice, binPrice, zip, notes, discordHandle,
  photos, submittedBy, submitterName,
}) {
  const redis = getRedis()
  const id    = `${Date.now()}-${randomBytes(4).toString('hex')}`

  const entry = {
    id,
    type:          type ?? 'selling',
    bottles:       bottles ?? [],
    askingPrice:   askingPrice != null && askingPrice !== '' ? Number(askingPrice) : null,
    binPrice:      binPrice    != null && binPrice    !== '' ? Number(binPrice)    : null,
    zip:           (zip ?? '').trim().slice(0, 10) || null,
    notes:         (notes ?? '').trim() || null,
    discordHandle: (discordHandle ?? '').trim() || null,
    submittedBy:   (submittedBy  ?? '').toLowerCase(),
    submitterName: submitterName ?? submittedBy ?? 'Unknown',
    timestamp:     Date.now(),
    active:        true,
    binReservedBy: null,
    binReservedAt: null,
  }

  await redis.zadd(KEY, { score: entry.timestamp, member: JSON.stringify(entry) })

  try {
    if (photos?.length) {
      await redis.hset(PHOTOS_KEY, { [id]: JSON.stringify(photos) })
    }
    // purge stale entries
    await redis.zremrangebyscore(KEY, 0, cutoffMs())
  } catch (err) {
    console.warn('[marketplace] post-zadd error (listing saved ok):', err?.message)
  }

  return { ...entry, photos: photos ?? [] }
}

/**
 * Claim BIN on a listing.
 * Marks binReservedBy / binReservedAt and sets active = false.
 * Returns the updated listing, or null if not found / already claimed.
 */
export async function claimBin(id, claimerEmail, claimerName) {
  const redis   = getRedis()
  const members = await redis.zrange(KEY, 0, -1)

  for (const m of members) {
    try {
      const entry = typeof m === 'string' ? JSON.parse(m) : m
      if (entry.id !== id) continue
      if (entry.binReservedBy) return null  // already claimed

      const updated = {
        ...entry,
        active:        false,
        binReservedBy: claimerEmail,
        binReservedAt: Date.now(),
      }
      const score = await redis.zscore(KEY, m)
      await redis.zrem(KEY, m)
      await redis.zadd(KEY, { score: Number(score), member: JSON.stringify(updated) })

      // Merge photos back
      let photos = entry.photos ?? []
      try {
        const raw = await redis.hget(PHOTOS_KEY, id)
        if (raw) photos = typeof raw === 'string' ? JSON.parse(raw) : raw
      } catch {}

      return { ...updated, photos, claimerName }
    } catch {}
  }
  return null
}

/**
 * Mark a listing inactive (soft-delete / mark as sold/traded).
 * Only the original poster can do this (enforced at the API layer).
 */
export async function deactivateListing(id) {
  const redis   = getRedis()
  const members = await redis.zrange(KEY, 0, -1)

  for (const m of members) {
    try {
      const entry = typeof m === 'string' ? JSON.parse(m) : m
      if (entry.id !== id) continue

      const updated = { ...entry, active: false }
      const score   = await redis.zscore(KEY, m)
      await redis.zrem(KEY, m)
      await redis.zadd(KEY, { score: Number(score), member: JSON.stringify(updated) })
      return updated
    } catch {}
  }
  return null
}

/**
 * Hard-delete a listing + its photos. Admin or poster only — enforced at API layer.
 */
export async function deleteListing(id) {
  const redis   = getRedis()
  const members = await redis.zrange(KEY, 0, -1)

  for (const m of members) {
    try {
      const entry = typeof m === 'string' ? JSON.parse(m) : m
      if (entry.id !== id) continue
      await redis.zrem(KEY, m)
      break
    } catch {}
  }
  try { await redis.hdel(PHOTOS_KEY, id) } catch {}
}
