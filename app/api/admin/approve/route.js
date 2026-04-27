import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'
import { approveUser }  from '../../../../lib/auth-users.js'
import crypto           from 'crypto'

// ── Auth helpers ──────────────────────────────────────────────────────────────

function hasBearerToken(req) {
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

async function isOwner(req) {
  const token      = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const ownerEmail = process.env.ALERT_EMAIL?.toLowerCase()
  return ownerEmail && token?.email?.toLowerCase() === ownerEmail
}

// ── HMAC token helpers (for one-click email links) ────────────────────────────

export function makeApproveToken(email) {
  return crypto
    .createHmac('sha256', process.env.CRON_SECRET ?? '')
    .update(email.toLowerCase())
    .digest('hex')
}

function verifyApproveToken(email, token) {
  try {
    const expected = makeApproveToken(email)
    return (
      token.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'))
    )
  } catch {
    return false
  }
}

// ── GET /api/admin/approve?email=xxx&token=yyy ────────────────────────────────
// One-click approve link from the notification email.
// Token is HMAC-SHA256(email, CRON_SECRET) — no session required.

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')?.trim()?.toLowerCase()
  const token = searchParams.get('token')?.trim()

  if (!email || !token) {
    return new Response('Missing email or token.', { status: 400, headers: { 'Content-Type': 'text/plain' } })
  }

  if (!verifyApproveToken(email, token)) {
    return new Response('Invalid or expired approval link.', { status: 403, headers: { 'Content-Type': 'text/plain' } })
  }

  await approveUser(email)

  // Redirect to a simple success page (or just show a plain HTML response)
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://whiskey-hunter.vercel.app'
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>User Approved</title>
  <style>
    body { margin:0; background:#0f0a05; color:#f5e6cc; font-family:'Segoe UI',Arial,sans-serif;
           display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background:#1a1008; border:1px solid #3d2b10; border-radius:12px; padding:40px 48px;
            text-align:center; max-width:420px; }
    .icon { font-size:48px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:22px; font-weight:800; }
    p  { margin:0 0 24px; color:#9a7c55; font-size:14px; line-height:1.5; }
    a  { display:inline-block; background:linear-gradient(135deg,#c46c1a,#e8943a); color:#fff;
         font-weight:700; font-size:14px; text-decoration:none; padding:12px 28px; border-radius:8px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>${email} approved</h1>
    <p>They'll be able to access the app as soon as they reload their pending page.</p>
    <a href="${appUrl}/admin">Back to Admin</a>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  )
}

// ── POST /api/admin/approve ───────────────────────────────────────────────────
// Accepts either a Bearer token (curl) or an owner session (admin page).
// Body: { "email": "someone@example.com" }

export async function POST(req) {
  const authorized = hasBearerToken(req) || await isOwner(req)
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = body?.email?.trim()?.toLowerCase()
  if (!email) return NextResponse.json({ error: '"email" field required' }, { status: 400 })

  await approveUser(email)
  return NextResponse.json({ ok: true, approved: email })
}
