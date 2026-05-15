'use client'

import { useRouter } from 'next/navigation'

/**
 * ProGate — full-screen paywall for pages that are entirely Pro-only.
 *
 * Props:
 *   feature  — short feature name, e.g. "Tracker" (shown in the copy)
 *   icon     — emoji to show at the top (default 🔒)
 *   bullets  — array of strings describing what Pro unlocks for this feature
 */
export default function ProGate({ feature = 'this feature', icon = '🔒', bullets = [] }) {
  const router = useRouter()

  return (
    <div style={{
      minHeight:      '70vh',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        'var(--sp-8) var(--sp-5)',
      textAlign:      'center',
    }}>
      <div style={{ fontSize: 48, marginBottom: 'var(--sp-4)' }}>{icon}</div>

      <div style={{
        fontWeight:    800,
        fontSize:      'var(--fs-h2)',
        color:         'var(--text-primary)',
        marginBottom:  'var(--sp-2)',
        letterSpacing: '-0.02em',
      }}>
        Pro feature
      </div>

      <div style={{
        fontSize:     'var(--fs-body)',
        color:        'var(--text-muted)',
        lineHeight:   1.6,
        maxWidth:     320,
        marginBottom: bullets.length ? 'var(--sp-5)' : 'var(--sp-6)',
      }}>
        {feature} is available to Pro members. Upgrade for $8/month and get full access.
      </div>

      {bullets.length > 0 && (
        <div style={{
          background:   'var(--bg-elev-2)',
          border:       '1px solid var(--hairline-2)',
          borderRadius: 'var(--r-lg)',
          padding:      'var(--sp-4) var(--sp-5)',
          marginBottom: 'var(--sp-6)',
          textAlign:    'left',
          width:        '100%',
          maxWidth:     320,
        }}>
          {bullets.map((b, i) => (
            <div key={i} style={{
              display:      'flex',
              alignItems:   'flex-start',
              gap:          'var(--sp-2)',
              fontSize:     'var(--fs-meta)',
              color:        'var(--text-secondary)',
              lineHeight:   1.5,
              marginBottom: i < bullets.length - 1 ? 'var(--sp-2)' : 0,
            }}>
              <span style={{ color: 'var(--copper-400)', flexShrink: 0, marginTop: 1 }}>✓</span>
              {b}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => router.push('/upgrade')}
        style={{
          width:        '100%',
          maxWidth:     320,
          padding:      'var(--sp-4)',
          background:   'var(--copper-400)',
          color:        'var(--text-inverse)',
          border:       'none',
          borderRadius: 'var(--r-lg)',
          fontWeight:   800,
          fontSize:     'var(--fs-body)',
          cursor:       'pointer',
          letterSpacing:'-0.01em',
        }}
      >
        Upgrade to Pro · $8/mo
      </button>

      <div style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>
        Cancel anytime with one month's notice
      </div>
    </div>
  )
}

/**
 * ProInlineBadge — small inline lock shown next to gated UI elements
 * (buttons, tabs, etc.) instead of replacing the whole page.
 */
export function ProInlineBadge({ onClick }) {
  return (
    <span
      onClick={onClick}
      title="Pro feature — tap to upgrade"
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          3,
        fontSize:     10,
        fontWeight:   800,
        color:        'var(--copper-400)',
        background:   'rgba(217,126,44,0.12)',
        border:       '1px solid rgba(217,126,44,0.25)',
        borderRadius: 999,
        padding:      '1px 7px',
        cursor:       onClick ? 'pointer' : 'default',
        letterSpacing:'0.02em',
        userSelect:   'none',
      }}
    >
      PRO
    </span>
  )
}
