import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'
import {
  getAllUsers,
  getUserProfile,
  getFriends,
  getReceivedRequests,
  getSentRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
} from '../../../lib/friends.js'
import { getApprovedUsers } from '../../../lib/auth-users.js'
import { sendToUser }       from '../../../lib/push.js'

async function getMe(request) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  return token?.email?.toLowerCase() ?? null
}

/**
 * GET /api/friends
 * Returns the full social graph for the current user:
 * {
 *   friends:  [{email, name, joinedAt}]   — accepted friends
 *   requests: [{email, name, joinedAt}]   — pending requests I received
 *   sent:     [email, ...]                — emails I've sent requests to
 *   discover: [{email, name, joinedAt}]   — other approved users (not friends, not me)
 * }
 */
export async function GET(request) {
  const me = await getMe(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [allUsers, approvedEmails, friends, receivedEmails, sentEmails] = await Promise.all([
    getAllUsers(),
    getApprovedUsers(),
    getFriends(me),
    getReceivedRequests(me),
    getSentRequests(me),
  ])

  const approvedSet = new Set(approvedEmails.map(e => e.toLowerCase()))
  const friendSet   = new Set(friends.map(e => e.toLowerCase()))
  const userMap     = Object.fromEntries(allUsers.map(u => [u.email.toLowerCase(), u]))

  // Enrich an email array with profile data (includes muleRequests)
  const enrich = emails =>
    emails
      .map(e => {
        const u = userMap[e.toLowerCase()] ?? { email: e, name: e.split('@')[0], joinedAt: null }
        return { muleRequests: [], ...u }
      })
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))

  const receivedSet = new Set(receivedEmails.map(e => e.toLowerCase()))

  // Build discover from approvedEmails (source of truth) — not from wh:users,
  // which only contains users who have signed in since registerUser() was added.
  // Users approved before that code was deployed (e.g. manually approved) show up
  // here with their email prefix as a name until they sign in and populate wh:users.
  const discover = approvedEmails
    .map(e => e.toLowerCase())
    .filter(e => e !== me && !friendSet.has(e) && !receivedSet.has(e))
    .map(e => {
      const u = userMap[e] ?? { email: e, name: e.split('@')[0], joinedAt: null }
      return { muleRequests: [], ...u }
    })
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))

  return NextResponse.json({
    friends:  enrich(friends),
    requests: enrich(receivedEmails),
    sent:     sentEmails.map(e => e.toLowerCase()),
    discover,
  })
}

/**
 * POST /api/friends
 * Body: { targetEmail }
 * Sends a friend request.
 */
export async function POST(request) {
  const me = await getMe(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { targetEmail } = await request.json()
    if (!targetEmail) return NextResponse.json({ error: 'targetEmail required' }, { status: 400 })
    const target = targetEmail.toLowerCase()
    await sendFriendRequest(me, target)

    // Push notification to the recipient
    const senderProfile = await getUserProfile(me)
    const senderName    = senderProfile?.name ?? me.split('@')[0]
    sendToUser(target, {
      title: '👥 New Friend Request',
      body:  `${senderName} sent you a friend request`,
      url:   '/profile/friends',
      tag:   'friend-request',
    }).catch(() => {}) // fire-and-forget, don't block response

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/friends
 * Body: { targetEmail, action: 'accept' | 'reject' }
 */
export async function PATCH(request) {
  const me = await getMe(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { targetEmail, action } = await request.json()
    if (!targetEmail || !action) return NextResponse.json({ error: 'targetEmail + action required' }, { status: 400 })
    const target = targetEmail.toLowerCase()
    if (action === 'accept') await acceptFriendRequest(me, target)
    else if (action === 'reject') await rejectFriendRequest(me, target)
    else return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/friends?email=xxx
 * Removes an existing friendship (mutual).
 */
export async function DELETE(request) {
  const me = await getMe(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email param required' }, { status: 400 })
  await removeFriend(me, email.toLowerCase())
  return NextResponse.json({ ok: true })
}
