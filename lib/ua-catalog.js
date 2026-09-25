import { gzipSync, gunzipSync } from 'zlib'
import { Redis }                from '@upstash/redis'

/**
 * Slim, cached search index over the Unicorn Auctions catalog.
 *
 * `wh:ua:catalog` is a ~22K-field hash (>10 MB) — HGETALL on it exceeds
 * Upstash's 10 MB response limit and, even when it fit, pulled the whole
 * blob on every search keystroke. Search only needs name/category, so we
 * keep a gzipped index of [normKey, name, category, lastSeen] tuples in
 * `wh:ua:index` (~1 MB), rebuilt via HSCAN when it expires, and memoized
 * per warm serverless instance. Full entries are fetched with a single
 * HMGET for just the rows a caller actually returns.
 */

export const CATALOG_KEY = 'wh:ua:catalog'
const INDEX_KEY      = 'wh:ua:index:v1'
const INDEX_TTL_SEC  = 6 * 60 * 60   // Redis copy — rebuilt from the hash after expiry
const MEMORY_TTL_MS  = 60 * 60 * 1000 // per-instance copy

let _redis = null
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv()
  return _redis
}

export function normName(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/['''''']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

let _mem = null          // { at, entries }
let _inflight = null

async function rebuildIndex(redis) {
  const rows = []
  let cursor = '0'
  do {
    const [next, arr] = await redis.hscan(CATALOG_KEY, cursor, { count: 1000 })
    for (let i = 0; i < arr.length; i += 2) {
      const raw  = arr[i + 1]
      let meta
      try { meta = typeof raw === 'string' ? JSON.parse(raw) : raw } catch { continue }
      if (!meta?.name) continue
      rows.push([arr[i], meta.name, meta.category ?? '', (meta.lastSeen ?? '').slice(0, 10)])
    }
    cursor = String(next)
  } while (cursor !== '0')

  const packed = gzipSync(JSON.stringify(rows)).toString('base64')
  await redis.set(INDEX_KEY, packed, { ex: INDEX_TTL_SEC })
  return rows
}

async function loadIndex() {
  const redis  = getRedis()
  const packed = await redis.get(INDEX_KEY)
  const rows   = packed
    ? JSON.parse(gunzipSync(Buffer.from(packed, 'base64')).toString('utf8'))
    : await rebuildIndex(redis)
  return rows.map(([normKey, name, category, lastSeen]) => ({
    normKey, name, category, lastSeen, nameNorm: normName(name),
  }))
}

/**
 * Returns [{ normKey, name, category, lastSeen, nameNorm }] for every catalog
 * entry. Cheap after the first call on a warm instance.
 */
export async function getUAIndex() {
  if (_mem && Date.now() - _mem.at < MEMORY_TTL_MS) return _mem.entries
  if (!_inflight) {
    _inflight = loadIndex()
      .then(entries => { _mem = { at: Date.now(), entries }; return entries })
      .finally(() => { _inflight = null })
  }
  return _inflight
}

/** Fetch full catalog entries for the given hash fields in one HMGET. */
export async function getUAEntries(normKeys) {
  if (!normKeys.length) return []
  const res = await getRedis().hmget(CATALOG_KEY, ...normKeys) ?? {}
  return normKeys
    .map(k => {
      const raw = res[k]
      if (!raw) return null
      const meta = typeof raw === 'string' ? JSON.parse(raw) : raw
      return { normKey: k, ...meta }
    })
    .filter(Boolean)
}
