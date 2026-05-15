/**
 * lib/stripe.js — Stripe client and subscription helpers
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY       — Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET   — Webhook signing secret (whsec_...)
 *   STRIPE_PRICE_ID         — Price ID for $8/mo recurring plan (price_...)
 *   NEXT_PUBLIC_BASE_URL    — App base URL for redirect URLs
 */

import Stripe from 'stripe'

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-04-30.basil',
  })
}

export const PRICE_ID = process.env.STRIPE_PRICE_ID
