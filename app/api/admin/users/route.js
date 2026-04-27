import { NextResponse }                    from 'next/server'
import { getToken }                        from 'next-auth/jwt'
import { getPendingUsers, getApprovedUsers } from '../../../../lib/auth-users.js'

function hasBearerToken(req) {
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

async function isOwner(req) {
  const token      = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const ownerEmail = process.env.ALERT_EMAIL?.trim().toLowerCase()
  return ownerEmail && token?.email?.toLowerCase() === ownerEmail
}

/**
 * GET /api/admin/users
 * Accepts a Bearer token (curl) or an owner session (admin page).
 * Returns pending and approved user lists.
 */
export async function GET(req) {
  const authorized = hasBearerToken(req) || await isOwner(req)
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [pending, approved] = await Promise.all([getPendingUsers(), getApprovedUsers()])
  return NextResponse.json({ pending, approved })
}
