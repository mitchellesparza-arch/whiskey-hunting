import { Redis } from '@upstash/redis'

const STATE_KEY  = 'wh:state:last'
const EVENTS_KEY = 'wh:history:events'
const MAX_EVENTS = 500

/**
 * Lazily create the Redis client from env vars.
 * Throws a clear error if the env vars aren't set (won't crash at build time).
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
 * Returns the last saved state snapshot.
 * Shape: { [bottleName]: { objectID, inStock, price, checkedAt } }
 * Returns {} if nothing has been saved yet or Redis is unavailable.
 */
export async function getLastState() {
  try {
    const data = await getRedis().get(STATE_KEY)
    return data ?? {}
  } catch (err) {
    console.warn('[history] getLastState error:', err.message)
    return {}
  }
}

/**
 * Persists the current state snapshot to Redis.
 * stateMap = { [bottleName]: { objectID, inStock, price, checkedAt } }
 */
export async function saveState(stateMap) {
  await getRedis().set(STATE_KEY, stateMap)
}

/**
 * Prepends one event to the history list, then trims to MAX_EVENTS.
 * event = { type, name, objectID, url, price, timestamp }
 *   type: 'in_stock' | 'out_of_stock'
 */
export async function logEvent(event) {
  const redis = getRedis()
  await redis.lpush(EVENTS_KEY, event)
  await redis.ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1)
}

/**
 * Returns the most recent `limit` events, newest first.
 * Returns [] on error (keeps the UI resilient).
 */
export async function getHistory(limit = 200) {
  try {
    const events = await getRedis().lrange(EVENTS_KEY, 0, limit - 1)
    return events ?? []
  } catch (err) {
    console.warn('[history] getHistory error:', err.message)
    return []
  }
}
