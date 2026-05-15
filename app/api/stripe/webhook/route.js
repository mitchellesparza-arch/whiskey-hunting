import { NextResponse }       from 'next/server'
import { getStripe }          from '../../../../lib/stripe.js'
import { updateUserProfile, getAllUsers } from '../../../../lib/friends.js'
import { TIERS }              from '../../../../lib/tier.js'

/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe webhook events and updates user subscription state.
 *
 * Handled events:
 *   customer.subscription.created  — set tier → 'pro'
 *   customer.subscription.updated  — sync status; cancel = set tier → 'free'
 *   customer.subscription.deleted  — set tier → 'free'
 *
 * The user email is stored in subscription.metadata.email at checkout creation.
 * As a fallback, we look up by Stripe customer ID in our user registry.
 */
export async function POST(req) {
  const rawBody = await req.text()
  const sig     = req.headers.get('stripe-signature')

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 })
  }

  let event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const subscription = event.data?.object
  const eventType    = event.type

  if (!['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(eventType)) {
    return NextResponse.json({ received: true })
  }

  // Resolve the user email from subscription metadata
  let email = subscription.metadata?.email ?? null

  // Fallback: scan user registry for matching stripeCustomerId
  if (!email && subscription.customer) {
    try {
      const users = await getAllUsers()
      const match = users.find(u => u.stripeCustomerId === subscription.customer)
      if (match) email = match.email
    } catch {}
  }

  if (!email) {
    console.warn('[stripe/webhook] Could not resolve user email for subscription:', subscription.id)
    return NextResponse.json({ received: true })
  }

  const status = subscription.status  // 'active' | 'canceled' | 'past_due' | 'trialing' etc.
  const isActive = ['active', 'trialing'].includes(status)

  try {
    await updateUserProfile(email, {
      tier:               isActive && eventType !== 'customer.subscription.deleted' ? TIERS.PRO : TIERS.FREE,
      stripeCustomerId:   subscription.customer         ?? null,
      subscriptionId:     subscription.id               ?? null,
      subscriptionStatus: eventType === 'customer.subscription.deleted' ? 'canceled' : status,
    })
    console.log(`[stripe/webhook] ${eventType} → ${email} tier=${isActive ? 'pro' : 'free'} status=${status}`)
  } catch (err) {
    console.error('[stripe/webhook] Failed to update user profile:', err.message)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// Note: raw body is read via req.text() above — no body parser config needed in App Router
