/**
 * lib/friends.js — user registry + friend relationship helpers
 *
 * Redis keys:
 *   wh:users                  — Hash: email → JSON { name, joinedAt }
 *   wh:friends:{email}        — Set of friend emails (accepted, mutual)
 *   wh:friend_req:{email}     — Set of emails that sent requests TO this user
 *   wh:friend_sent:{email}    — Set of emails this user has sent requests TO
 */

import { Redis } from '@upstash/redis'

const USERS_KEY = 'wh:users'

function getRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Redis env vars not set')
  return new Redis({ url, token })
}

const friendsKey = e  => `wh:friends:${e}`
const reqKey     = e  => `wh:friend_req:${e}`
const sentKey    = e  => `wh:friend_sent:${e}`

// ── User registry ─────────────────────────────────────────────────────────────

/**
 * Register or update a user's display name on sign-in.
 * Silently skips if name is unchanged.
 */
export async function registerUser(email, name) {
  if (!email) return
  const redis   = getRedis()
  const current = await redis.hget(USERS_KEY, email)
  const parsed  = current ? (typeof current === 'string' ? JSON.parse(current) : current) : null
  const entry   = {
    name:     name ?? parsed?.name ?? email.split('@')[0],
    joinedAt: parsed?.joinedAt ?? new Date().toISOString(),
  }
  await redis.hset(USERS_KEY, { [email]: JSON.stringify(entry) })
}

/**
 * Get a single user's profile.
 * Returns null if not found.
 */
export async function getUserProfile(email) {
  if (!email) return null
  try {
    const raw = await getRedis().hget(USERS_KEY, email)
    if (!raw) return null
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    return { email, ...data }
  } catch { return null }
}

/**
 * Get all registered users.
 * Returns [{email, name, joinedAt}].
 */
export async function getAllUsers() {
  try {
    const hash = (await getRedis().hgetall(USERS_KEY)) ?? {}
    return Object.entries(hash).map(([email, val]) => {
      const data = typeof val === 'string' ? JSON.parse(val) : val
      return { email, ...data }
    })
  } catch { return [] }
}

// ── Friendship queries ────────────────────────────────────────────────────────

export async function getFriends(email) {
  if (!email) return []
  try {
    return (await getRedis().smembers(friendsKey(email))) ?? []
  } catch { return [] }
}

export async function getReceivedRequests(email) {
  if (!email) return []
  try {
    return (await getRedis().smembers(reqKey(email))) ?? []
  } catch { return [] }
}

export async function getSentRequests(email) {
  if (!email) return []
  try {
    return (await getRedis().smembers(sentKey(email))) ?? []
  } catch { return [] }
}

export async function areFriends(emailA, emailB) {
  if (!emailA || !emailB) return false
  try {
    return !!(await getRedis().sismember(friendsKey(emailA), emailB))
  } catch { return false }
}

// ── Friendship mutations ──────────────────────────────────────────────────────

/**
 * Send a friend request from → to.
 * No-ops if already friends or request already exists.
 */
export async function sendFriendRequest(fromEmail, toEmail) {
  if (!fromEmail || !toEmail || fromEmail === toEmail) return
  const redis = getRedis()

  // Already friends?
  const already = await redis.sismember(friendsKey(fromEmail), toEmail)
  if (already) return

  // Add toEmail to sender's sent-set, and fromEmail to recipient's req-set
  await Promise.all([
    redis.sadd(sentKey(fromEmail),  toEmail),
    redis.sadd(reqKey(toEmail),     fromEmail),
  ])
}

/**
 * Accept a pending friend request (myEmail accepts fromEmail's request).
 * Creates a mutual friendship and cleans up request entries.
 */
export async function acceptFriendRequest(myEmail, fromEmail) {
  if (!myEmail || !fromEmail) return
  const redis = getRedis()
  await Promise.all([
    // Mutual friend entries
    redis.sadd(friendsKey(myEmail),   fromEmail),
    redis.sadd(friendsKey(fromEmail), myEmail),
    // Clean up request tracking
    redis.srem(reqKey(myEmail),       fromEmail),
    redis.srem(sentKey(fromEmail),    myEmail),
  ])
}

/**
 * Reject / ignore a pending request.
 */
export async function rejectFriendRequest(myEmail, fromEmail) {
  if (!myEmail || !fromEmail) return
  const redis = getRedis()
  await Promise.all([
    redis.srem(reqKey(myEmail),    fromEmail),
    redis.srem(sentKey(fromEmail), myEmail),
  ])
}

/**
 * Remove an existing friendship (mutual).
 */
export async function removeFriend(myEmail, friendEmail) {
  if (!myEmail || !friendEmail) return
  const redis = getRedis()
  await Promise.all([
    redis.srem(friendsKey(myEmail),     friendEmail),
    redis.srem(friendsKey(friendEmail), myEmail),
  ])
}
