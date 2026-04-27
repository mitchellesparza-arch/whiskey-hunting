import { NextResponse }                          from 'next/server'
import { getToken }                              from 'next-auth/jwt'
import { getBottleByUpc, getBottleByName, searchBottles } from '../../../lib/whiskey-db.js'

async function authed(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  return !!token?.email
}

/**
 * GET /api/lookup?upc=xxx        — barcode scan lookup
 * GET /api/lookup?name=xxx       — name-based lookup (best match)
 * GET /api/lookup?search=xxx     — name search (returns top 5 for autocomplete)
 */
export async function GET(req) {
  if (!await authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const upc    = searchParams.get('upc')?.trim()
  const name   = searchParams.get('name')?.trim()
  const search = searchParams.get('search')?.trim()

  if (upc) {
    const result = await getBottleByUpc(upc)
    if (!result) return NextResponse.json({ found: false })
    return NextResponse.json({ found: true, bottle: result })
  }

  if (name) {
    const result = getBottleByName(name)
    if (!result) return NextResponse.json({ found: false })
    return NextResponse.json({ found: true, bottle: result })
  }

  if (search) {
    const results = searchBottles(search, 5)
    return NextResponse.json({ results })
  }

  return NextResponse.json({ error: 'Provide upc, name, or search param' }, { status: 400 })
}
