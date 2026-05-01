import { NextResponse }        from 'next/server'
import { getToken }            from 'next-auth/jwt'
import { getMuleLeaderboard }  from '../../../lib/samples.js'
import { getFriends, getUserProfile } from '../../../lib/friends.js'

/**
 * GET /api/mule
 * Returns the mule leaderboard — who has given the most samples (mule deliveries).
 * Requires auth.
 *
 * GET /api/mule?friendsOf=email
 * Returns mule requests (wanted-bottle lists) from all of email's friends.
 * Each entry: { email, name, muleRequests: string[] }
 * Requires auth — caller must be friends with the target user or be the user.
 */
export async function GET(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token)          return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (!token.approved) return NextResponse.json({ error: 'Not approved' },    { status: 403 })

    const { searchParams } = new URL(request.url)
    const friendsOf = searchParams.get('friendsOf')

    if (friendsOf) {
      // Return mule request lists for all friends of this user
      const callerEmail = token.email.toLowerCase()
      const targetEmail = friendsOf.toLowerCase()

      // Only allow if caller IS the target, or caller is friends with the target
      const friendEmails = await getFriends(callerEmail)
      const callerIsFriend = callerEmail === targetEmail || friendEmails.map(e => e.toLowerCase()).includes(targetEmail)
      if (!callerIsFriend) {
        return NextResponse.json({ error: 'Not friends with this user' }, { status: 403 })
      }

      // Get all friends' mule requests
      const targetFriends = await getFriends(targetEmail)
      const profiles = await Promise.all(
        targetFriends.map(async email => {
          const p = await getUserProfile(email)
          return {
            email,
            name:         p?.name ?? email.split('@')[0],
            muleRequests: Array.isArray(p?.muleRequests) ? p.muleRequests : [],
          }
        })
      )

      // Filter to only friends who have at least one request
      const withRequests = profiles.filter(p => p.muleRequests.length > 0)
      return NextResponse.json({ friendRequests: withRequests })
    }

    const leaderboard = await getMuleLeaderboard()
    return NextResponse.json({ leaderboard })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
