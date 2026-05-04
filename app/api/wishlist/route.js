import { NextResponse }      from 'next/server'
import { getToken }           from 'next-auth/jwt'
import { Redis }              from '@upstash/redis'
import { areFriends }         from '../../../lib/friends.js'
import {
  getWishlist,
  addToWishlist,
  updateWishlistEntry,
  removeFromWishlist,
} from '../../../lib/wishlist.js'

/**
 * Wishlist API — structured hunt list per user.
 *
 * GET    /api/wishlist                   → { wishlist: WishlistEntry[] }  (own)
 * GET    /api/wishlist?userId=email      → { wishlist: WishlistEntry[] }  (friend's Hunting items)
 * GET    /api/wishlist?friends=1         → { wishlists: { [email]: WishlistEntry[] } } (all friends)
 * POST   /api/wishlist   { name, upc?, targetPrice?, rarity?, storeNotes? }
 * PATCH  /api/wishlist   { id, ...updates }
 * DELETE /api/wishlist?id=...
 */

async function auth(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  return token?.email?.toLowerCase() ?? null
}

export async function GET(request) {
  const me = await auth(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const userId  = searchParams.get('userId')?.toLowerCase()
  const friends = searchParams.get('friends')

  // /api/wishlist?friends=1 — return Hunting entries for all friends
  if (friends) {
    const redis   = Redis.fromEnv()
    const raw     = await redis.smembers(`wh:friends:${me}`)
    const emails  = Array.isArray(raw) ? raw : []
    const entries   = await Promise.all(
      emails.map(async email => {
        const list = await getWishlist(email)
        return [email, list.filter(e => e.status === 'Hunting')]
      })
    )
    return NextResponse.json({ wishlists: Object.fromEntries(entries) })
  }

  // /api/wishlist?userId=email — friend's public Hunting list
  if (userId && userId !== me) {
    const ok = await areFriends(me, userId)
    if (!ok) return NextResponse.json({ error: 'Not friends' }, { status: 403 })
    const list = await getWishlist(userId)
    return NextResponse.json({ wishlist: list.filter(e => e.status === 'Hunting') })
  }

  const list = await getWishlist(me)
  return NextResponse.json({ wishlist: list })
}

export async function POST(request) {
  const me = await auth(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const entry = await addToWishlist(me, body)
  return NextResponse.json({ entry }, { status: 201 })
}

export async function PATCH(request) {
  const me = await auth(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { id, ...rest } = body
  const allowed = ['name', 'targetPrice', 'rarity', 'storeNotes', 'status']
  const updates = Object.fromEntries(Object.entries(rest).filter(([k]) => allowed.includes(k)))

  const entry = await updateWishlistEntry(me, id, updates)
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ entry })
}

export async function DELETE(request) {
  const me = await auth(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id param required' }, { status: 400 })

  const wishlist = await removeFromWishlist(me, id)
  return NextResponse.json({ wishlist })
}
