import { NextResponse }          from 'next/server'
import { getToken }              from 'next-auth/jwt'
import { getStripe, PRICE_ID }  from '../../../../lib/stripe.js'
import { getUserProfile }       from '../../../../lib/friends.js'
import { isPro }                from '../../../../lib/tier.js'

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for the $8/mo Pro plan.
 * Redirects the user to Stripe-hosted checkout.
 *
 * Returns: { url: string }
 */
export async function POST(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!token.approved) return NextResponse.json({ error: 'Not approved' }, { status: 403 })

  const profile = await getUserProfile(token.email)
  if (isPro(profile?.tier)) {
    return NextResponse.json({ error: 'Already a Pro member' }, { status: 400 })
  }

  if (!PRICE_ID) {
    return NextResponse.json({ error: 'STRIPE_PRICE_ID not configured' }, { status: 503 })
  }

  const base   = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const stripe = getStripe()

  try {
    const session = await stripe.checkout.sessions.create({
      mode:               'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price:    PRICE_ID,
        quantity: 1,
      }],
      customer_email:    token.email,
      metadata:          { email: token.email },
      success_url:       `${base}/upgrade?success=1`,
      cancel_url:        `${base}/upgrade`,
      subscription_data: { metadata: { email: token.email } },
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout] error:', err?.message)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
