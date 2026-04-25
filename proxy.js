import { getToken }     from 'next-auth/jwt'
import { NextResponse } from 'next/server'

/**
 * Route protection proxy (Next.js 16+).
 *
 * - Unauthenticated → /login
 * - Authenticated but not approved → /pending
 * - Approved → through
 *
 * API routes, NextAuth internals, and static assets are excluded via `matcher`.
 */
export async function proxy(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (!token.approved) {
    return NextResponse.redirect(new URL('/pending', req.url))
  }

  return NextResponse.next()
}

export const config = {
  // Only run on page routes — exclude API, auth, static assets, login, pending
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|login|pending).*)'],
}
