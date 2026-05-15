/**
 * lib/tier.js — subscription tier constants and helpers
 *
 * Tiers:
 *   'free'          — default for all new sign-ups; limited features
 *   'pro'           — active $8/mo Stripe subscriber; full access
 *   'grandfathered' — existing member granted full access by admin; never billed
 */

export const TIERS = {
  FREE:          'free',
  PRO:           'pro',
  GRANDFATHERED: 'grandfathered',
}

/**
 * Returns true if the given tier has full pro-level access.
 * Both 'pro' (paying) and 'grandfathered' (admin-granted) qualify.
 */
export function isPro(tier) {
  return tier === TIERS.PRO || tier === TIERS.GRANDFATHERED
}

/** Human-readable label for display in admin UI. */
export function tierLabel(tier) {
  switch (tier) {
    case TIERS.PRO:           return 'Pro'
    case TIERS.GRANDFATHERED: return 'Grandfathered'
    default:                  return 'Free'
  }
}

/** Badge color token for each tier (maps to CSS vars). */
export function tierColor(tier) {
  switch (tier) {
    case TIERS.PRO:           return 'var(--copper-400)'
    case TIERS.GRANDFATHERED: return 'var(--green)'
    default:                  return 'var(--text-dim)'
  }
}
