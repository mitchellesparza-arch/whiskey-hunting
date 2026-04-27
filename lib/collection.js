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

export async function addToCollection(userId, { name, distillery, category, proof, msrp, secondary, qty, flavors, upc, photoUrl }) {
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
  const updated = current.map(b =>
    b.id === id ? { ...b, ...updates, id, userId } : b
  )
  await redis.set(key(userId), JSON.stringify(updated))
  return updated
}
