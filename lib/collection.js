/**
 * lib/collection.js — per-user bottle collection helpers
 *
 * Redis key: collection:{userId}  → JSON array of BottleEntry[]
 *
 * BottleEntry {
 *   id, userId, name, distillery, category, proof, msrp, secondary,
 *   qty, blindScore, tastings, flavors, addedAt, upc?, photoUrl?
 * }
 */

import { Redis } from '@upstash/redis'

function getRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Redis env vars not set')
  return new Redis({ url, token })
}

function key(userId) {
  return `collection:${userId}`
}

export async function getCollection(userId) {
  if (!userId) return []
  try {
    const raw = await getRedis().get(key(userId))
    if (!raw) return []
    return Array.isArray(raw) ? raw : JSON.parse(raw)
  } catch { return [] }
}

export async function addToCollection(userId, { name, distillery, category, proof, msrp, secondary, qty, flavors, upc, photoUrl, forSale, forTrade }) {
  const redis   = getRedis()
  const current = await getCollection(userId)

  const entry = {
    id:         Date.now().toString(),
    userId,
    name:       (name ?? '').trim(),
    distillery: (distillery ?? '').trim(),
    category:   category ?? 'Bourbon',
    proof:      Number(proof)     || 0,
    msrp:       Number(msrp)     || 0,
    secondary:  Number(secondary) || 0,
    qty:        Number(qty)       || 1,
    blindScore: null,
    tastings:   0,
    flavors:    Array.isArray(flavors) ? flavors : [],
    addedAt:    new Date().toISOString(),
    upc:        upc       ?? null,
    photoUrl:   photoUrl  ?? null,
    forSale:    forSale   ?? false,
    forTrade:   forTrade  ?? false,
  }

  const updated = [entry, ...current]
  await redis.set(key(userId), JSON.stringify(updated))
  return { entry, bottles: updated }
}

export async function removeFromCollection(userId, id) {
  const redis   = getRedis()
  const current = await getCollection(userId)
  const updated = current.filter(b => b.id !== id)
  await redis.set(key(userId), JSON.stringify(updated))
  return updated
}

export async function updateInCollection(userId, id, updates) {
  const redis   = getRedis()
  const current = await getCollection(userId)

  // Coerce numeric fields — same as addToCollection does — so edits don't
  // store strings and break page-level reduce() calls.
  const safeUpdates = {
    ...updates,
    qty:       Number(updates.qty)       || 1,
    proof:     updates.proof     != null && updates.proof     !== '' ? Number(updates.proof)     : (updates.proof     === '' ? 0 : undefined),
    msrp:      updates.msrp      != null && updates.msrp      !== '' ? Number(updates.msrp)      : (updates.msrp      === '' ? 0 : undefined),
    secondary: updates.secondary != null && updates.secondary !== '' ? Number(updates.secondary) : (updates.secondary === '' ? 0 : undefined),
  }
  // Remove keys that came back as undefined (don't override existing values with nothing)
  Object.keys(safeUpdates).forEach(k => safeUpdates[k] === undefined && delete safeUpdates[k])

  const updated = current.map(b =>
    b.id === id ? { ...b, ...safeUpdates, id, userId } : b
  )
  await redis.set(key(userId), JSON.stringify(updated))
  return updated
}
