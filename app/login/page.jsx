'use client'

import { signIn }        from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Suspense }      from 'react'

const FREE_FEATURES = [
  { icon: '🥃', label: 'Community finds feed',     desc: 'See every bottle spotted by the community, in real time' },
  { icon: '🔍', label: 'Full catalog search',       desc: 'Search thousands of allocated and limited releases' },
  { icon: '🏪', label: 'Marketplace',               desc: 'Browse and post buy, sell, and trade listings' },
  { icon: '📦', label: 'Personal collection',       desc: 'Log your bottles and track your tasting notes' },
  { icon: '📋', label: 'Watchlist (3 bottles)',     desc: 'Get notified when watched bottles are spotted' },
  { icon: '👥', label: 'Friends & community',       desc: 'Follow other hunters and see their finds' },
]

const PRO_FEATURES = [
  { icon: '🚛', label: 'Truck Tracker',             desc: 'Real-time distributor truck alerts at stores near you' },
  { icon: '⚡', label: 'Instant push alerts',       desc: 'Get notified the moment a find is posted' },
  { icon: '📸', label: 'AI label scanner',          desc: 'Point your camera at any bottle to instantly identify it' },
  { icon: '🔍', label: 'AI bottle search',          desc: 'AI-powered search for rare releases not in the catalog' },
  { icon: '🦄', label: 'Unicorn Auctions',          desc: 'Browse and track live secondary market auction deals' },
  { icon: '📊', label: 'Market price index',        desc: 'Secondary market pricing and premium-over-MSRP trends' },
  { icon: '📋', label: 'Unlimited watchlist',       desc: 'Track as many bottles as you want — no cap' },
  { icon: '📈', label: 'Find history & analytics',  desc: 'Deep-dive per-store find history and activity patterns' },
  { icon: '🏷️', label: 'Sample label maker',       desc: 'Generate NIIMBOT-ready labels for your whiskey samples' },
]

function LoginContent() {
  const params = useSearchParams()
  const error  = params.get('error')

  return (
    <div style={{
      minHeight:   '100dvh',
      background:  'var(--bg-base)',
      display:     'flex',
      flexDirection: 'column',
    }}>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        padding:        'var(--sp-10) var(--sp-4) var(--sp-8)',
        textAlign:      'center',
      }}>
        <div style={{
          width:        72,
          height:       72,
          borderRadius: 'var(--r-xl)',
          overflow:     'hidden',
          background:   '#1e1209',
          marginBottom: 'var(--sp-4)',
          boxShadow:    'var(--shadow-glow)',
        }}>
          <img
            src="/icon-384.png"
            alt="Tater Tracker"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>

        <h1 style={{
          margin:        0,
          fontSize:      'var(--fs-display)',
          fontWeight:    800,
          color:         'var(--text-primary)',
          letterSpacing: 'var(--tracking-head)',
          marginBottom:  'var(--sp-2)',
        }}>
          Tater Tracker
        </h1>
        <p style={{
          fontSize:      'var(--fs-overline)',
          fontWeight:    700,
          color:         'var(--copper-400)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--tracking-overline)',
          marginBottom:  'var(--sp-4)',
        }}>
          Chicagoland Bourbon Hunters
        </p>
        <p style={{
          fontSize:    'var(--fs-body)',
          color:       'var(--text-muted)',
          lineHeight:  1.6,
          maxWidth:    320,
          marginBottom: 0,
        }}>
          Track limited releases, spot distributor trucks, and connect with
          fellow hunters across Chicagoland.
        </p>
      </div>

      {/* ── Feature comparison ──────────────────────────────────────── */}
      <div style={{
        flex:       1,
        maxWidth:   520,
        width:      '100%',
        margin:     '0 auto',
        padding:    '0 var(--sp-4) var(--sp-4)',
        display:    'flex',
        flexDirection: 'column',
        gap:        'var(--sp-4)',
      }}>

        {/* Free section */}
        <div style={{
          background:   'var(--bg-elev-2)',
          border:       '1px solid var(--hairline-2)',
          borderRadius: 'var(--r-xl)',
          overflow:     'hidden',
        }}>
          <div style={{
            padding:       'var(--sp-3) var(--sp-4)',
            borderBottom:  '1px solid var(--hairline)',
            display:       'flex',
            alignItems:    'center',
            justifyContent:'space-between',
          }}>
            <span style={{
              fontSize:      'var(--fs-overline)',
              fontWeight:    800,
              color:         'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-overline)',
            }}>
              Free — always included
            </span>
            <span style={{
              fontSize:   'var(--fs-overline)',
              fontWeight: 700,
              color:      'var(--green)',
            }}>
              $0
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {FREE_FEATURES.map((f, i) => (
              <div key={f.label} style={{
                display:      'flex',
                alignItems:   'flex-start',
                gap:          'var(--sp-3)',
                padding:      'var(--sp-3) var(--sp-4)',
                borderBottom: i < FREE_FEATURES.length - 1 ? '1px solid var(--hairline)' : 'none',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-meta)', color: 'var(--text-primary)', marginBottom: 1 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                    {f.desc}
                  </div>
                </div>
                <span style={{ color: 'var(--green)', fontSize: 14, flexShrink: 0, marginTop: 2 }}>✓</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pro section */}
        <div style={{
          background:   'var(--bg-elev-2)',
          border:       '1px solid rgba(217,126,44,0.4)',
          borderRadius: 'var(--r-xl)',
          overflow:     'hidden',
          boxShadow:    '0 0 0 1px rgba(217,126,44,0.1), 0 4px 24px rgba(217,126,44,0.06)',
        }}>
          <div style={{
            padding:        'var(--sp-3) var(--sp-4)',
            borderBottom:   '1px solid rgba(217,126,44,0.2)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            background:     'rgba(217,126,44,0.06)',
          }}>
            <span style={{
              fontSize:      'var(--fs-overline)',
              fontWeight:    800,
              color:         'var(--copper-400)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-overline)',
            }}>
              Pro — unlock everything
            </span>
            <span style={{
              fontSize:   'var(--fs-overline)',
              fontWeight: 700,
              color:      'var(--copper-400)',
            }}>
              $8/mo
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {PRO_FEATURES.map((f, i) => (
              <div key={f.label} style={{
                display:      'flex',
                alignItems:   'flex-start',
                gap:          'var(--sp-3)',
                padding:      'var(--sp-3) var(--sp-4)',
                borderBottom: i < PRO_FEATURES.length - 1 ? '1px solid var(--hairline)' : 'none',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-meta)', color: 'var(--text-primary)', marginBottom: 1 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                    {f.desc}
                  </div>
                </div>
                <span style={{ color: 'var(--copper-400)', fontSize: 14, flexShrink: 0, marginTop: 2 }}>✓</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Sticky sign-in footer ────────────────────────────────────── */}
      <div style={{
        position:    'sticky',
        bottom:      0,
        background:  'var(--bg-base)',
        borderTop:   '1px solid var(--hairline)',
        padding:     'var(--sp-4)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {error && (
            <div style={{
              padding:      'var(--sp-2) var(--sp-3)',
              borderRadius: 'var(--r-md)',
              background:   'rgba(248,113,113,0.08)',
              border:       '1px solid rgba(248,113,113,0.25)',
              fontSize:     'var(--fs-meta)',
              color:        'var(--red)',
              textAlign:    'center',
            }}>
              Sign-in failed — please try again.
            </div>
          )}
          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--copper-400)'}
            style={{
              width:          '100%',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            'var(--sp-2)',
              padding:        'var(--sp-3) var(--sp-4)',
              background:     'var(--copper-500)',
              color:          'var(--text-inverse)',
              border:         'none',
              borderRadius:   'var(--r-md)',
              fontSize:       'var(--fs-body)',
              fontWeight:     700,
              fontFamily:     'inherit',
              cursor:         'pointer',
              transition:     'background var(--t-base) var(--ease-out), transform var(--t-fast) var(--ease-out)',
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google — it's free
          </button>
          <p style={{
            textAlign:  'center',
            fontSize:   'var(--fs-overline)',
            color:      'var(--text-dim)',
            margin:     0,
          }}>
            Free access. No credit card. Upgrade to Pro anytime for $8/mo.
          </p>
        </div>
      </div>

    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
