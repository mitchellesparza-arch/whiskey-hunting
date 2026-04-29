import { NextResponse }                       from 'next/server'
import { getToken }                           from 'next-auth/jwt'
import { getUserProfile, updateUserProfile }  from '../../../lib/friends.js'

async function getMe(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  return token?.email?.toLowerCase() ?? null
}

/** GET /api/profile — returns the current user's stored profile */
export async function GET(req) {
  const me = await getMe(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getUserProfile(me)
  return NextResponse.json({ profile: profile ?? { email: me, name: null, discordHandle: null, muleRequests: [] } })
}

/** PATCH /api/profile — saves display name, discord handle, and/or mule requests */
export async function PATCH(req) {
  const me = await getMe(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { name, discordHandle, muleRequests, notifPrefs } = body

  let muleReqs
  if (muleRequests !== undefined) {
    if (!Array.isArray(muleRequests))
      return NextResponse.json({ error: 'muleRequests must be an array' }, { status: 400 })
    muleReqs = muleRequests.map(r => String(r).trim()).filter(Boolean).slice(0, 5)
  }

  let prefs
  if (notifPrefs !== undefined) {
    if (typeof notifPrefs !== 'object' || Array.isArray(notifPrefs))
      return NextResponse.json({ error: 'notifPrefs must be an object' }, { status: 400 })
    const allowed = ['trucks', 'finds', 'watchlist', 'auctions', 'friends']
    prefs = {}
    for (const key of allowed) {
      if (key in notifPrefs) prefs[key] = !!notifPrefs[key]
    }
  }

  const updated = await updateUserProfile(me, {
    name:          name?.trim() || undefined,
    discordHandle: discordHandle?.trim() || undefined,
    muleRequests:  muleReqs,
    notifPrefs:    prefs,
  })
  return NextResponse.json({ ok: true, profile: updated })
}
