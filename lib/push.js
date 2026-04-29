/**
 * lib/push.js — Web Push notification helpers
 *
 * Redis keys:
 *   wh:push:{email}    — JSON array of Web Push subscription objects (one per device)
 *   wh:push_enabled    — Set of emails that have at least one active push subscription
 */

import webpush    from 'web-push'
import { Redis }  from '@upstash/redis'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT    ?? 'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY ?? '',
  process.env.VAPID_PRIVATE_KEY ?? '',
)

function getRedis() {
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

const subKey     = email => `wh:push:${email.toLowerCase()}`
const ENABLED_SET = 'wh:push_enabled'

// ── Subscription management ───────────────────────────────────────────────

export async function getSubscriptions(email) {
  try {
    const raw = await getRedis().get(subKey(email))
    if (!raw) return []
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) ?? []
  } catch { return [] }
}

export async function saveSubscription(email, subscription) {
  const redis   = getRedis()
  const key     = subKey(email)
  const current = await getSubscriptions(email)
  // Replace subscription with same endpoint (re-subscribe), otherwise append
  const updated = current.filter(s => s.endpoint !== subscription.endpoint)
  updated.push(subscription)
  await Promise.all([
    redis.set(key, JSON.stringify(updated)),
    redis.sadd(ENABLED_SET, email.toLowerCase()),
  ])
}

export async function removeSubscription(email, endpoint) {
  const redis   = getRedis()
  const key     = subKey(email)
  const current = await getSubscriptions(email)
  const updated = current.filter(s => s.endpoint !== endpoint)
  if (updated.length === 0) {
    await Promise.all([
      redis.del(key),
      redis.srem(ENABLED_SET, email.toLowerCase()),
    ])
  } else {
    await redis.set(key, JSON.stringify(updated))
  }
}

// ── Sending ───────────────────────────────────────────────────────────────

/**
 * Send a push notification to a single user (all their subscribed devices).
 * Automatically removes expired/invalid subscriptions.
 */
export async function sendToUser(email, payload) {
  const subs    = await getSubscriptions(email)
  if (!subs.length) return

  const payloadStr = JSON.stringify(payload)
  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(sub, payloadStr).catch(async err => {
        // 410 Gone / 404 Not Found = subscription no longer valid
        if (err.statusCode === 410 || err.statusCode === 404) {
          await removeSubscription(email, sub.endpoint)
        }
      })
    )
  )
}

/**
 * Broadcast a push notification to all users that:
 *  1. Have an active push subscription (in wh:push_enabled)
 *  2. Have the given pref key enabled (defaults to true if never set)
 *
 * prefKey: 'trucks' | 'finds' | 'watchlist' | 'auctions' | 'friends'
 *          Pass null to send to everyone with a subscription.
 */
export async function sendBroadcast(payload, prefKey = null) {
  try {
    const redis  = getRedis()
    const emails = await redis.smembers(ENABLED_SET)
    if (!emails?.length) return

    if (!prefKey) {
      await Promise.allSettled(emails.map(e => sendToUser(e, payload)))
      return
    }

    // Check each user's notifPrefs — default to enabled if not set
    const allProfiles = await redis.hgetall('wh:users')
    const profileMap  = {}
    for (const [k, v] of Object.entries(allProfiles ?? {})) {
      try { profileMap[k.toLowerCase()] = typeof v === 'string' ? JSON.parse(v) : v } catch {}
    }

    const eligible = emails.filter(email => {
      const profile = profileMap[email.toLowerCase()]
      if (!profile) return true
      const prefs = profile.notifPrefs
      if (!prefs) return true  // never configured = all enabled
      return prefs[prefKey] !== false
    })

    await Promise.allSettled(eligible.map(e => sendToUser(e, payload)))
  } catch (err) {
    console.error('[push] sendBroadcast error:', err)
  }
}
