import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'

export const dynamic = 'force-dynamic'
import { getCheckins, addCheckin } from '../../../lib/finds.js'
import { getUserProfile }          from '../../../lib/friends.js'

/**
 * GET /api/checkins
 * Returns store check-ins ("saw nothing") from the last 24 h, newest first.
 */
export async function GET() {
  try {
    const checkins = await getCheckins()
    return NextResponse.json({ checkins })
  } catch (err) {
    console.error('[checkins] GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/checkins
 * Requires auth + approval.
 * Body: { store }
 */
export async function POST(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token)          return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (!token.approved) return NextResponse.json({ error: 'Not approved' },    { status: 403 })

    const { store } = await request.json()
    if (!store?.name || store?.lat == null || store?.lng == null) {
      return NextResponse.json({ error: 'store with name, lat, lng is required' }, { status: 400 })
    }

    const profile       = await getUserProfile(token.email)
    const submitterName = profile?.name ?? token.name ?? token.email

    const entry = await addCheckin({ store, submittedBy: token.email, submitterName })

    return NextResponse.json({ ok: true, checkin: entry })
  } catch (err) {
    console.error('[checkins] POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
