import { NextResponse }                    from 'next/server'
import { getPendingUsers, getApprovedUsers } from '../../../../lib/auth-users.js'

function authorized(req) {
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

/**
 * GET /api/admin/users
 * Protected by CRON_SECRET Bearer token.
 * Returns pending and approved user lists.
 *
 * curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
 *      https://whiskey-hunter-esparza1.vercel.app/api/admin/users
 */
export async function GET(req) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [pending, approved] = await Promise.all([getPendingUsers(), getApprovedUsers()])
  return NextResponse.json({ pending, approved })
}
