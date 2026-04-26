/**
 * lib/collection.js — personal bottle collection stored in Redis.
 *
 * Redis key: wh:collection
 * Value: JSON array of entries, newest first.
 *
 * Entry schema:
 *   {
 *     id:          string   (Date.now().toString())
 *     name:        string   (free text, trimmed)
 *     purchasedAt: string | null  ("YYYY-MM-DD")
 *     store:       string | null  (free text)
 *     addedAt:     string   (ISO timestamp)
 *   }
 */

import { Redis } from '@upstash/redis'

const KEY = 'wh:collection'

function getRedis() {
  return Redis.fromEnv()
}

async function readCollection(redis) {
  try {
    const raw = await redis.get(KEY)
    if (!raw) return []
    return Array.isArray(raw) ? raw
      : typeof raw === 'string' ? JSON.parse(raw) : []
  } catch { return [] }
}

/** Returns the full collection array (newest first). */
export async function getCollection() {
  return readCollection(getRedis())
}

/**
 * Prepends a new entry to the collection.
 * @returns the new entry object
 */
export async function addToCollection({ name, purchasedAt, store }) {
  const redis = getRedis()
  const col   = await readCollection(redis)
  const entry = {
    id:          Date.now().toString(),
    name:        (name ?? '').trim(),
    purchasedAt: purchasedAt || null,
    store:       (store ?? '').trim() || null,
    addedAt:     new Date().toISOString(),
  }
  col.unshift(entry)
  await redis.set(KEY, JSON.stringify(col))
  return entry
}

/**
 * Removes the entry with the given id.
 * @returns the updated collection array
 */
export async function removeFromCollection(id) {
  const redis = getRedis()
  const col   = (await readCollection(redis)).filter(e => e.id !== id)
  await redis.set(KEY, JSON.stringify(col))
  return col
}
