import { Redis } from '@upstash/redis'

const COLLECTION_KEY = 'wh:collection'

/**
 * Lazily create the Redis client from env vars.
 */
function getRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set')
  }
  return new Redis({ url, token })
}

/**
 * Returns the full collection array, newest first.
 * Returns [] if nothing saved yet or Redis is unavailable.
 */
export async function getCollection() {
  try {
    const data = await getRedis().get(COLLECTION_KEY)
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.warn('[collection] getCollection error:', err.message)
    return []
  }
}

/**
 * Adds a new bottle to the collection (prepended, so newest first).
 * Returns the new entry.
 *
 * @param {{ name: string, purchasedAt: string|null, store: string|null }} entry
 */
export async function addToCollection({ name, purchasedAt, store }) {
  const collection = await getCollection()
  const newEntry = {
    id:          Date.now().toString(),
    name:        name.trim(),
    purchasedAt: purchasedAt || null,
    store:       store?.trim() || null,
    addedAt:     new Date().toISOString(),
  }
  collection.unshift(newEntry)
  await getRedis().set(COLLECTION_KEY, collection)
  return newEntry
}

/**
 * Removes a bottle from the collection by its id.
 * Returns the updated collection array.
 *
 * @param {string} id
 */
export async function removeFromCollection(id) {
  const collection = await getCollection()
  const filtered = collection.filter((e) => e.id !== id)
  await getRedis().set(COLLECTION_KEY, filtered)
  return filtered
}
