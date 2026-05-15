import { NextResponse }    from 'next/server'
import { getToken }        from 'next-auth/jwt'
import { getStripe }       from '../../../../lib/stripe.js'
import { getUserProfile }  from '../../../../lib/friends.js'
import { isPro }           from '../../../../lib/tier.js'

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session so Pro members can manage
 * their subscription (cancel, update payment method, view invoices).
 *
 * Returns: { url: string }
 */
export async function POST(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email)        return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!isPro(token.tier))   return NextResponse.json({ error: 'Pro required' },    { status: 403 })

  const profile = await getUserProfile(token.email)
  if (!profile?.stripeCustomerId) {
    return NextResponse.json({ error: 'No Stripe customer found' }, { status: 404 })
  }

  const base   = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const stripe = getStripe()

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer:   profile.stripeCustomerId,
      return_url: `${base}/profile`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/portal] error:', err?.message)
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 })
  }
}
