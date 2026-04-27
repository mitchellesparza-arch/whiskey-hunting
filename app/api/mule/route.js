import { NextResponse }        from 'next/server'
import { getToken }            from 'next-auth/jwt'
import { getMuleLeaderboard }  from '../../../lib/samples.js'

/**
 * GET /api/mule
 * Returns the mule leaderboard — who has given the most samples (mule deliveries).
 * Requires auth.
 */
export async function GET(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token)          return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (!token.approved) return NextResponse.json({ error: 'Not approved' },    { status: 403 })

    const leaderboard = await getMuleLeaderboard()
    return NextResponse.json({ leaderboard })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
