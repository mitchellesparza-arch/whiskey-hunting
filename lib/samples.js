/**
 * Redis helpers for user sample bottles.
 *
 * Key: wh:samples:{email}  — JSON array of sample entries, newest first.
 * Key: wh:mule:scores      — Hash: email → mule count (for leaderboard)
 *
 * Sample schema:
 *   {
 *     id:        string (timestamp)
 *     name:      string  — bottle/expression name
 *     from:      string  — display name of the person who gave it
 *     fromEmail: string | null — email (if tagged from friends list)
 *     type:      'Mule' | 'Handshake' | 'Other'
 *     notes:     string | null
 *     addedAt:   ISO string
 *   }
 */

import { Redis } from '@upstash/redis'

const MULE_KEY  = 'wh:mule:scores'

function getRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Redis env vars not set')
  return new Redis({ url, token })
}

function samplesKey(email) {
  return `wh:samples:${email.toLowerCase()}`
}

/** Returns the user's sample list (newest first), empty array on error. */
export async function getSamples(email) {
  try {
    const raw = await getRedis().get(samplesKey(email))
    if (!raw) return []
    return Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : [])
  } catch { return [] }
}

/**
 * Adds a sample to the user's list.
 * If type === 'Mule' and fromEmail is set, increments mule leaderboard score.
 * Returns the new entry.
 */
export async function addSample(email, { name, from, fromEmail, type, notes }) {
  const redis = getRedis()
  const entry = {
    id:        Date.now().toString(),
    name:      (name   ?? '').trim(),
    from:      (from   ?? '').trim(),
    fromEmail: fromEmail || null,
    type:      ['Mule', 'Handshake', 'Other'].includes(type) ? type : 'Other',
    notes:     (notes  ?? '').trim() || null,
    addedAt:   new Date().toISOString(),
  }

  const current = await getSamples(email)
  await redis.set(samplesKey(email), JSON.stringify([entry, ...current]))

  // Mule leaderboard: credit the giver
  if (entry.type === 'Mule' && entry.fromEmail) {
    await redis.hincrby(MULE_KEY, entry.fromEmail.toLowerCase(), 1)
  }

  return entry
}

/**
 * Removes a sample by id.
 * Returns the updated list.
 */
export async function removeSample(email, id) {
  const redis   = getRedis()
  const current = await getSamples(email)
  const updated = current.filter(s => s.id !== id)
  await redis.set(samplesKey(email), JSON.stringify(updated))
  return updated
}

/**
 * Returns the mule leaderboard: array of { email, name, count } sorted by count desc.
 * Uses a single bulk hgetall for wh:users and does case-insensitive email matching
 * so name lookups survive any casing differences between the two hashes.
 */
export async function getMuleLeaderboard() {
  try {
    const redis  = getRedis()
    const scores = await redis.hgetall(MULE_KEY)
    if (!scores) return []

    // Bulk-load all profiles once, keyed by lowercase email
    const allProfiles = await redis.hgetall('wh:users')
    const profileMap  = {}
    for (const [k, v] of Object.entries(allProfiles ?? {})) {
      try { profileMap[k.toLowerCase()] = typeof v === 'string' ? JSON.parse(v) : v }
      catch {}
    }

    const entries = Object.keys(scores).map(email => {
      const user = profileMap[email.toLowerCase()]
      return {
        email,
        name:  user?.name ?? email.split('@')[0],
        count: Number(scores[email]),
      }
    })

    return entries.sort((a, b) => b.count - a.count)
  } catch { return [] }
}
