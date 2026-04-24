import { Redis } from '@upstash/redis'

// ── Redis key schema ──────────────────────────────────────────────────────────
const STATE_KEY      = 'wh:state:last'           // bottle state snapshot (cron diff)
const STORES_SET_KEY = 'wh:history:stores'        // set of store codes that have history
const storeKey       = (code) => `wh:history:store:${code}`
const MAX_PER_STORE  = 10                         // last N truck events kept per store

function getRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set')
  return new Redis({ url, token })
}

// ── State snapshot (used by cron for bottle diff) ─────────────────────────────

export async function getLastState() {
  try {
    return (await getRedis().get(STATE_KEY)) ?? {}
  } catch (err) {
    console.warn('[history] getLastState error:', err.message)
    return {}
  }
}

export async function saveState(stateMap) {
  await getRedis().set(STATE_KEY, stateMap)
}

// ── Per-store truck event log ─────────────────────────────────────────────────

/**
 * Prepend a truck_detected event to the store's event list and trim to
 * MAX_PER_STORE. Also registers the store code in the stores set so
 * getHistory() knows which keys to read.
 */
export async function logEvent(event) {
  const redis = getRedis()
  const code  = event.storeCode ?? 'legacy'
  const key   = storeKey(code)

  await Promise.all([
    redis.lpush(key, event).then(() => redis.ltrim(key, 0, MAX_PER_STORE - 1)),
    redis.sadd(STORES_SET_KEY, code),
  ])
}

/**
 * Fetch the last MAX_PER_STORE events for every store that has history,
 * merge them, and return sorted newest-first.
 */
export async function getHistory() {
  try {
    const redis      = getRedis()
    const storeCodes = await redis.smembers(STORES_SET_KEY)
    if (!storeCodes.length) return []

    const perStore = await Promise.all(
      storeCodes.map(code => redis.lrange(storeKey(code), 0, MAX_PER_STORE - 1))
    )

    return perStore
      .flat()
      .filter(e => e && e.type === 'truck_detected')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  } catch (err) {
    console.warn('[history] getHistory error:', err.message)
    return []
  }
}
