/**
 * Redis helpers for user authentication and approval.
 *
 * Redis keys:
 *   wh:auth:approved  — Set of approved email addresses (lowercase)
 *   wh:auth:pending   — Hash of email → JSON { name, requestedAt }
 */

import { Redis } from '@upstash/redis'

const APPROVED_KEY = 'wh:auth:approved'
const PENDING_KEY  = 'wh:auth:pending'

function getRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set')
  return new Redis({ url, token })
}

/** Returns true if the email is in the approved set. */
export async function isApproved(email) {
  if (!email) return false
  try {
    const result = await getRedis().sismember(APPROVED_KEY, email.toLowerCase())
    return !!result  // Upstash returns true/false or 1/0 depending on version
  } catch { return false }
}

/** Adds email to the approved set and removes it from pending. */
export async function approveUser(email) {
  const redis = getRedis()
  const e = email.toLowerCase()
  await Promise.all([
    redis.sadd(APPROVED_KEY, e),
    redis.hdel(PENDING_KEY, e),
  ])
}

/**
 * Registers an email as pending (if not already approved or already pending).
 * Returns true if this is a brand-new registration, false if already known.
 */
export async function addPendingUser(email, name) {
  const redis = getRedis()
  const e = email.toLowerCase()

  // Already approved — nothing to do
  const alreadyApproved = await redis.sismember(APPROVED_KEY, e)
  if (alreadyApproved) return false

  // Already pending — don't overwrite or re-notify
  const existing = await redis.hget(PENDING_KEY, e)
  if (existing) return false

  await redis.hset(PENDING_KEY, {
    [e]: JSON.stringify({ name: name ?? email, requestedAt: new Date().toISOString() }),
  })
  return true   // brand-new registration
}

/** Returns all pending users as [{ email, name, requestedAt }]. */
export async function getPendingUsers() {
  try {
    const hash = (await getRedis().hgetall(PENDING_KEY)) ?? {}
    return Object.entries(hash).map(([email, val]) => {
      try { return { email, ...JSON.parse(val) } }
      catch { return { email, name: email, requestedAt: null } }
    })
  } catch { return [] }
}

/** Returns all approved email addresses. */
export async function getApprovedUsers() {
  try {
    return (await getRedis().smembers(APPROVED_KEY)) ?? []
  } catch { return [] }
}
