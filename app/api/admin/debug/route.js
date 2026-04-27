import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'

export async function GET(req) {
  const token      = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const ownerEmail = process.env.ALERT_EMAIL ?? null
  const sessionEmail = token?.email ?? null

  return NextResponse.json({
    sessionEmail,
    alertEmailSet:    ownerEmail !== null,
    alertEmailLength: ownerEmail?.length ?? 0,
    alertEmail:       ownerEmail,          // visible only to you — remove after debugging
    match:            sessionEmail?.toLowerCase() === ownerEmail?.toLowerCase()?.trim(),
  })
}
