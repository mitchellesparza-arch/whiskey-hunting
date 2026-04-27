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
  return NextResponse.json({ profile: profile ?? { email: me, name: null, discordHandle: null } })
}

/** PATCH /api/profile — saves display name + discord handle */
export async function PATCH(req) {
  const me = await getMe(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { name, discordHandle } = body
  const updated = await updateUserProfile(me, { name: name?.trim() || undefined, discordHandle: discordHandle?.trim() || undefined })
  return NextResponse.json({ ok: true, profile: updated })
}
