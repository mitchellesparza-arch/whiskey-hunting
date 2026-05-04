'use client'
import Link        from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const TABS = [
  { id: 'finds',   label: 'Finds',   icon: '📍', href: '/'        },
  { id: 'tracker', label: 'Tracker', icon: '🚛', href: '/tracker' },
  { id: 'marketplace', label: 'Marketplace', icon: '🏪', href: '/marketplace' },
  { id: 'profile', label: 'Profile', icon: '👤', href: '/profile' },
]

// Pages where the nav should not appear
const HIDDEN_ON = ['/login', '/pending']

export default function BottomNav() {
  const pathname    = usePathname()
  const [badge, setBadge] = useState(0)

  // Fetch recent-finds count for the Finds notification badge (< 6 h old)
  useEffect(() => {
    fetch('/api/finds')
      .then(r => r.json())
      .then(d => {
        const cutoff = Date.now() - 6 * 3600000
        setBadge((d.finds ?? []).filter(f => f.timestamp > cutoff).length)
      })
      .catch(() => {})
  }, [pathname])

  if (HIDDEN_ON.includes(pathname)) return null

  function isActive(href) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav style={{
      position:             'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex:               100,
      background:           'rgba(15,10,5,0.97)',
      borderTop:            '1px solid #3d2b10',
      display:              'flex',
      backdropFilter:       'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      paddingBottom:        'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(t => {
        const active    = isActive(t.href)
        const showBadge = t.id === 'finds' && badge > 0
        return (
          <Link
            key={t.id}
            href={t.href}
            style={{
              flex:           1,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              gap:            3,
              padding:        '10px 0',
              textDecoration: 'none',
            }}
          >
            {/* Icon + optional notification badge */}
            <span style={{ fontSize: 20, position: 'relative', lineHeight: 1 }}>
              {t.icon}
              {showBadge && (
                <span style={{
                  position:     'absolute',
                  top: -4, right: -6,
                  background:   '#f87171',
                  color:        '#fff',
                  fontSize:     9,
                  fontWeight:   700,
                  borderRadius: 999,
                  padding:      '1px 4px',
                  lineHeight:   1.2,
                }}>
                  {badge}
                </span>
              )}
            </span>

            {/* Label */}
            <span style={{
              fontSize:      10,
              fontWeight:    active ? 700 : 500,
              color:         active ? '#e8943a' : '#6b5030',
              letterSpacing: '0.01em',
            }}>
              {t.label}
            </span>

            {/* Active underline pip */}
            {active && (
              <span style={{ width: 18, height: 2, background: '#e8943a', borderRadius: 1 }} />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
