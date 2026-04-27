import { NextResponse }    from 'next/server'
import { getToken }         from 'next-auth/jwt'
import { getCollection, addToCollection, removeFromCollection, updateInCollection } from '../../../lib/collection.js'
import { areFriends }       from '../../../lib/friends.js'

/**
 * Collection API — per-user bottle inventory stored in Redis.
 * All routes require an active session.
 *
 * GET    /api/collection               → { bottles: BottleEntry[] }          (own)
 * GET    /api/collection?userId=email  → { bottles: BottleEntry[] }          (friend's — read-only)
 * POST   /api/collection  { ...fields }    → { bottles }
 * DELETE /api/collection?id=xxx            → { bottles }
 * PATCH  /api/collection  { id, ...updates } → { bottles }
 */

async function getUserId(request) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  return token?.email?.toLowerCase() ?? null
}

export async function GET(request) {
  const me = await getUserId(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const targetId = searchParams.get('userId')?.toLowerCase()

  // Viewing someone else's collection — must be friends
  if (targetId && targetId !== me) {
    const ok = await areFriends(me, targetId)
    if (!ok) return NextResponse.json({ error: 'Not friends' }, { status: 403 })
    const bottles = await getCollection(targetId)
    return NextResponse.json({ bottles, readOnly: true })
  }

  const bottles = await getCollection(me)
  return NextResponse.json({ bottles })
}

export async function POST(request) {
  const userId = await getUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    const { bottles } = await addToCollection(userId, body)
    return NextResponse.json({ bottles })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  const userId = await getUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id param required' }, { status: 400 })
  const bottles = await removeFromCollection(userId, id)
  return NextResponse.json({ bottles })
}

export async function PATCH(request) {
  const userId = await getUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id, ...updates } = await request.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const bottles = await updateInCollection(userId, id, updates)
    return NextResponse.json({ bottles })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
