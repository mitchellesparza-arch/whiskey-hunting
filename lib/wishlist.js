/**
 * Structured wishlist / hunt list per user.
 *
 * Redis key: wh:wishlist:{email}  →  JSON array of WishlistEntry
 *
 * WishlistEntry:
 *   id          string  — timestamp + random hex
 *   name        string  — bottle name
 *   upc         string | null
 *   targetPrice number | null
 *   rarity      'Common' | 'Allocated' | 'Unicorn'
 *   storeNotes  string | null
 *   status      'Hunting' | 'Found' | 'Paused'
 *   addedAt     ISO string
 */

import { randomBytes } from 'crypto'
import { Redis }       from '@upstash/redis'

function redis() { return Redis.fromEnv() }
function key(email) { return `wh:wishlist:${email.toLowerCase()}` }

async function readList(email) {
  try {
    const raw = await redis().get(key(email))
    if (!raw) return []
    return Array.isArray(raw) ? raw : JSON.parse(raw)
  } catch { return [] }
}

async function writeList(email, list) {
  await redis().set(key(email), JSON.stringify(list))
}

export async function getWishlist(email) {
  return readList(email)
}

export async function addToWishlist(email, { name, upc, targetPrice, rarity, storeNotes }) {
  const list  = await readList(email)
  const entry = {
    id:          `${Date.now()}-${randomBytes(4).toString('hex')}`,
    name:        name.trim(),
    upc:         upc          || null,
    targetPrice: targetPrice != null && targetPrice !== '' ? Number(targetPrice) : null,
    rarity:      rarity       || 'Allocated',
    storeNotes:  storeNotes?.trim() || null,
    status:      'Hunting',
    addedAt:     new Date().toISOString(),
  }
  await writeList(email, [...list, entry])
  return entry
}

export async function updateWishlistEntry(email, id, updates) {
  const list = await readList(email)
  const idx  = list.findIndex(e => e.id === id)
  if (idx === -1) return null
  list[idx] = { ...list[idx], ...updates }
  await writeList(email, list)
  return list[idx]
}

export async function removeFromWishlist(email, id) {
  const list = await readList(email)
  const next = list.filter(e => e.id !== id)
  await writeList(email, next)
  return next
}

/**
 * Returns all wishlisted bottle names (status: Hunting) for a user.
 * Used by the find-posting flow to check for notifications.
 */
export async function getHuntingBottles(email) {
  const list = await readList(email)
  return list.filter(e => e.status === 'Hunting').map(e => e.name)
}
