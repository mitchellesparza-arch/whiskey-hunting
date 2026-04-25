import { NextResponse } from 'next/server'
import { approveUser }  from '../../../../lib/auth-users.js'

function authorized(req) {
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

/**
 * POST /api/admin/approve
 * Protected by CRON_SECRET Bearer token.
 * Body: { "email": "someone@example.com" }
 *
 * curl -X POST \
 *      -H "Authorization: Bearer YOUR_CRON_SECRET" \
 *      -H "Content-Type: application/json" \
 *      -d '{"email":"someone@example.com"}' \
 *      https://whiskey-hunter-esparza1.vercel.app/api/admin/approve
 */
export async function POST(req) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = body?.email?.trim()?.toLowerCase()
  if (!email) {
    return NextResponse.json({ error: '"email" field required' }, { status: 400 })
  }

  await approveUser(email)
  return NextResponse.json({ ok: true, approved: email })
}
