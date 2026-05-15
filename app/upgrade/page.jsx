'use client'

import { useState, useEffect } from 'react'
import { useSession }           from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense }             from 'react'
import AppHeader                from '../components/AppHeader.jsx'
import { isPro }                from '../../lib/tier.js'

const FEATURES = [
  { icon: '🚛', label: 'Truck Tracker',         desc: 'Real-time distributor truck alerts across Chicagoland Binny\'s' },
  { icon: '⚡', label: 'Instant find alerts',   desc: 'Get notified the moment a find is posted — no 1-hour delay' },
  { icon: '📸', label: 'AI label scanner',      desc: 'Point your camera at any bottle to instantly identify it' },
  { icon: '🔍', label: 'AI bottle search',      desc: 'AI-powered search for rare and limited releases not in the catalog' },
  { icon: '🦄', label: 'Unicorn Auctions',      desc: 'Browse and track live Unicorn Auction deals' },
  { icon: '📊', label: 'Market price index',    desc: 'Secondary market pricing and trend data' },
  { icon: '📋', label: 'Unlimited watchlist',   desc: 'Watch as many bottles as you want (free tier: 3 max)' },
  { icon: '📈', label: 'Find history & analytics', desc: 'Full per-store find history and activity analytics' },
]

function UpgradePageContent() {
  const { data: session, update } = useSession()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const success      = searchParams.get('success') === '1'

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const tier    = session?.user?.tier ?? 'free'
  const already = isPro(tier)

  // After successful Stripe checkout, force a JWT tier refresh
  useEffect(() => {
    if (success && session) {
      update({ checkTier: true })
    }
  }, [success, session])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpgrade() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePortal() {
    setLoading(true)
    try {
      const res  = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      setError('Could not open billing portal.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <AppHeader sub="Upgrade" />

      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--sp-6) var(--sp-4)' }}>

        {/* Success banner */}
        {success && (
          <div style={{
            background:   'rgba(74,222,128,0.08)',
            border:       '1px solid rgba(74,222,128,0.25)',
            borderRadius: 'var(--r-lg)',
            padding:      'var(--sp-4)',
            marginBottom: 'var(--sp-6)',
            textAlign:    'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 'var(--sp-2)' }}>🎉</div>
            <div style={{ fontWeight: 800, color: 'var(--green)', marginBottom: 4 }}>Welcome to Pro!</div>
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>
              Your account has been upgraded. All features are now unlocked.
            </div>
          </div>
        )}

        {/* Pricing card */}
        <div style={{
          background:   'var(--bg-elev-2)',
          border:       already ? '1px solid rgba(74,222,128,0.35)' : '1px solid var(--copper-400)',
          borderRadius: 'var(--r-xl)',
          padding:      'var(--sp-6)',
          marginBottom: 'var(--sp-6)',
          textAlign:    'center',
        }}>
          <div style={{ fontSize: 'var(--fs-overline)', fontWeight: 700, color: 'var(--copper-400)',
                        letterSpacing: 'var(--tracking-overline)', textTransform: 'uppercase', marginBottom: 'var(--sp-2)' }}>
            {tier === 'grandfathered' ? 'Grandfathered Member' : 'Tater Tracker Pro'}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, marginBottom: 'var(--sp-1)' }}>
            {tier === 'grandfathered' ? (
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--green)' }}>Free</span>
            ) : (
              <>
                <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)' }}>$8</span>
                <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>/month</span>
              </>
            )}
          </div>

          {tier !== 'grandfathered' && (
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', marginBottom: 'var(--sp-5)' }}>
              Cancel anytime with one month's notice
            </div>
          )}

          {error && (
            <div style={{ marginBottom: 'var(--sp-4)', padding: 'var(--sp-3)', borderRadius: 'var(--r-md)',
                          background: 'rgba(248,113,113,0.08)', color: 'var(--red)',
                          fontSize: 'var(--fs-meta)', border: '1px solid rgba(248,113,113,0.2)' }}>
              {error}
            </div>
          )}

          {already ? (
            <>
              <div style={{ marginBottom: 'var(--sp-4)', fontSize: 'var(--fs-body)', color: 'var(--green)', fontWeight: 700 }}>
                ✓ You have full Pro access
              </div>
              {tier === 'pro' && (
                <button
                  onClick={handlePortal}
                  disabled={loading}
                  style={{
                    width: '100%', padding: 'var(--sp-3)', background: 'var(--bg-elev-3)',
                    color: 'var(--text-secondary)', border: '1px solid var(--hairline-2)',
                    borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: 'var(--fs-meta)',
                    cursor: loading ? 'default' : 'pointer',
                  }}
                >
                  {loading ? 'Opening portal…' : 'Manage subscription →'}
                </button>
              )}
            </>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={loading || !session}
              style={{
                width:        '100%',
                padding:      'var(--sp-4)',
                background:   'var(--copper-400)',
                color:        'var(--text-inverse)',
                border:       'none',
                borderRadius: 'var(--r-lg)',
                fontWeight:   800,
                fontSize:     'var(--fs-body)',
                cursor:       loading || !session ? 'default' : 'pointer',
                opacity:      loading ? 0.7 : 1,
                letterSpacing:'-0.01em',
              }}
            >
              {loading ? 'Redirecting to checkout…' : 'Upgrade to Pro'}
            </button>
          )}
        </div>

        {/* Feature list */}
        <div style={{ marginBottom: 'var(--sp-6)' }}>
          <div style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: 'var(--tracking-overline)',
                        marginBottom: 'var(--sp-3)' }}>
            What's included
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {FEATURES.map(f => (
              <div key={f.label} style={{
                display:      'flex',
                alignItems:   'flex-start',
                gap:          'var(--sp-3)',
                background:   'var(--bg-elev-2)',
                border:       '1px solid var(--hairline)',
                borderRadius: 'var(--r-md)',
                padding:      'var(--sp-3) var(--sp-4)',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-meta)', color: 'var(--text-primary)', marginBottom: 2 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {f.desc}
                  </div>
                </div>
                <span style={{ marginLeft: 'auto', color: already ? 'var(--green)' : 'var(--copper-400)',
                               fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                  {already ? '✓' : '→'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Free tier reminder */}
        {!already && (
          <div style={{
            background:   'var(--bg-elev-2)',
            border:       '1px solid var(--hairline)',
            borderRadius: 'var(--r-lg)',
            padding:      'var(--sp-4)',
            fontSize:     'var(--fs-meta)',
            color:        'var(--text-muted)',
            lineHeight:   1.6,
          }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Free tier still includes:</strong> finds feed
            (1-hour delay), full search, marketplace browse &amp; post, full profile, and watching up to 3 bottles.
          </div>
        )}

      </div>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <Suspense>
      <UpgradePageContent />
    </Suspense>
  )
}
