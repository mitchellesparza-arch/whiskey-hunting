import { NextResponse }     from 'next/server'
import { getToken }         from 'next-auth/jwt'
import { Redis }            from '@upstash/redis'
import { isPro }            from '../../../lib/tier.js'
import { getUserProfile }   from '../../../lib/friends.js'

const FREE_WATCHLIST_LIMIT = 3

/**
 * Watchlist API — per-user bottle watchlist stored in Redis.
 *
 * Key: wh:watchlist:{email}   value: JSON array of bottle name strings
 *
 * GET    /api/watchlist              → { bottles: string[] }
 * POST   /api/watchlist   { bottle } → { bottles }
 * DELETE /api/watchlist?bottle=...   → { bottles }
 */

function redis() { return Redis.fromEnv() }

function key(email) {
  return `wh:watchlist:${email.toLowerCase()}`
}

async function getBottles(email) {
  try {
    const raw = await redis().get(key(email))
    if (!raw) return []
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch { return [] }
}

async function saveBottles(email, bottles) {
  await redis().set(key(email), JSON.stringify(bottles))
}

async function requireAuth(request) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  return token ?? null
}

export async function GET(request) {
  const token = await requireAuth(request)
  if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const bottles = await getBottles(token.email)
  return NextResponse.json({ bottles })
}

export async function POST(request) {
  const token = await requireAuth(request)
  if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { bottle } = await request.json()
  if (!bottle?.trim()) return NextResponse.json({ error: 'bottle is required' }, { status: 400 })

  const bottles = await getBottles(token.email)
  const name    = bottle.trim()

  // Re-read tier live from Redis so mid-session upgrades take effect immediately
  let tier = token.tier
  try { const p = await getUserProfile(token.email); tier = p?.tier ?? tier } catch {}

  // Enforce free-tier watchlist limit
  if (!isPro(tier) && !bottles.includes(name) && bottles.length >= FREE_WATCHLIST_LIMIT) {
    return NextResponse.json({
      error:      'Watchlist limit reached',
      limit:      FREE_WATCHLIST_LIMIT,
      upgradeRequired: true,
    }, { status: 403 })
  }

  if (!bottles.includes(name)) {
    bottles.unshift(name)          // add to front
    await saveBottles(token.email, bottles)
  }
  return NextResponse.json({ bottles })
}

export async function DELETE(request) {
  const token = await requireAuth(request)
  if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const bottle = searchParams.get('bottle')
  if (!bottle) return NextResponse.json({ error: 'bottle param required' }, { status: 400 })

  const bottles = (await getBottles(token.email)).filter(b => b !== bottle)
  await saveBottles(token.email, bottles)
  return NextResponse.json({ bottles })
}
