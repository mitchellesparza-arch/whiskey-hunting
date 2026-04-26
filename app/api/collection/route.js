import { NextResponse }                                      from 'next/server'
import { getCollection, addToCollection, removeFromCollection } from '../../../lib/collection.js'

/**
 * Collection API — personal bottle inventory stored in Redis.
 *
 * GET    /api/collection              → { collection: Entry[] }
 * POST   /api/collection  { name, purchasedAt?, store? } → { ok, entry }
 * DELETE /api/collection?id=xxx       → { ok, collection }
 */

export async function GET() {
  const collection = await getCollection()
  return NextResponse.json({ collection })
}

export async function POST(request) {
  try {
    const { name, purchasedAt, store } = await request.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    const entry = await addToCollection({ name, purchasedAt, store })
    return NextResponse.json({ ok: true, entry })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id param required' }, { status: 400 })
  }
  const collection = await removeFromCollection(id)
  return NextResponse.json({ ok: true, collection })
}
