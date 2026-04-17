import { NextResponse }                                     from 'next/server'
import { getCollection, addToCollection, removeFromCollection } from '../../../lib/collection.js'

/**
 * GET /api/collection
 *
 * Returns the full collection, newest first.
 */
export async function GET() {
  const collection = await getCollection()
  return NextResponse.json({ collection })
}

/**
 * POST /api/collection
 *
 * Body: { name: string, purchasedAt?: string, store?: string }
 * Adds a bottle and returns the created entry.
 */
export async function POST(request) {
  try {
    const body = await request.json()
    if (!body?.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    const entry = await addToCollection({
      name:        body.name,
      purchasedAt: body.purchasedAt ?? null,
      store:       body.store ?? null,
    })
    return NextResponse.json({ ok: true, entry })
  } catch (err) {
    console.error('[collection] POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/collection?id=<id>
 *
 * Removes the entry with the given id.
 * Returns the updated collection.
 */
export async function DELETE(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
  }
  try {
    const collection = await removeFromCollection(id)
    return NextResponse.json({ ok: true, collection })
  } catch (err) {
    console.error('[collection] DELETE error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
