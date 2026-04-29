import { NextResponse }                              from 'next/server'
import { getToken }                                  from 'next-auth/jwt'
import { saveSubscription, removeSubscription }      from '../../../lib/push.js'

async function getMe(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  return token?.email?.toLowerCase() ?? null
}

/** GET /api/push — returns the VAPID public key for client-side subscription */
export async function GET() {
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? '' })
}

/** POST /api/push — save a push subscription for the current user's device */
export async function POST(req) {
  const me = await getMe(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { subscription } = body
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 })
  }

  await saveSubscription(me, subscription)
  return NextResponse.json({ ok: true })
}

/** DELETE /api/push — remove push subscription for a specific device */
export async function DELETE(req) {
  const me = await getMe(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await req.json() } catch { body = {} }

  if (body.endpoint) {
    await removeSubscription(me, body.endpoint)
  }
  return NextResponse.json({ ok: true })
}
