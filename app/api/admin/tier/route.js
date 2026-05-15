import { NextResponse }        from 'next/server'
import { getToken }            from 'next-auth/jwt'
import { updateUserProfile, getAllUsers } from '../../../../lib/friends.js'
import { TIERS, tierLabel }   from '../../../../lib/tier.js'

const VALID_TIERS = Object.values(TIERS)

async function isOwner(req) {
  const token      = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const ownerEmail = process.env.ALERT_EMAIL?.trim().toLowerCase()
  return ownerEmail && token?.email?.toLowerCase() === ownerEmail
}

/**
 * GET /api/admin/tier
 * Returns all approved users with their current tier and Stripe metadata.
 * Owner only.
 */
export async function GET(req) {
  if (!await isOwner(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const users = await getAllUsers()
  return NextResponse.json({
    users: users.map(u => ({
      email:              u.email,
      name:               u.name,
      joinedAt:           u.joinedAt,
      tier:               u.tier               ?? TIERS.FREE,
      stripeCustomerId:   u.stripeCustomerId   ?? null,
      subscriptionId:     u.subscriptionId     ?? null,
      subscriptionStatus: u.subscriptionStatus ?? null,
    })),
  })
}

/**
 * POST /api/admin/tier
 * Body: { email, tier }
 * Sets the tier for a user. Owner only.
 */
export async function POST(req) {
  if (!await isOwner(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, tier } = await req.json()
  if (!email)                    return NextResponse.json({ error: 'email required' },           { status: 400 })
  if (!VALID_TIERS.includes(tier)) return NextResponse.json({ error: `tier must be one of: ${VALID_TIERS.join(', ')}` }, { status: 400 })

  await updateUserProfile(email.toLowerCase(), { tier })

  return NextResponse.json({ ok: true, email, tier, label: tierLabel(tier) })
}
