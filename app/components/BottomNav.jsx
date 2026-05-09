'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MapPin, Search, Truck, Store, User } from 'lucide-react'

const TABS = [
  { id: 'finds',       label: 'Finds',       Icon: MapPin,  href: '/'           },
  { id: 'search',      label: 'Search',       Icon: Search,  href: '/search'     },
  { id: 'tracker',     label: 'Tracker',      Icon: Truck,   href: '/tracker'    },
  { id: 'marketplace', label: 'Marketplace',  Icon: Store,   href: '/marketplace'},
  { id: 'profile',     label: 'Profile',      Icon: User,    href: '/profile'    },
]

const HIDDEN_ON = ['/login', '/pending']

export default function BottomNav() {
  const pathname = usePathname()
  const [badge,   setBadge]   = useState(0)
  const [pressed, setPressed] = useState(null)

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
    if (href === '/search') return pathname.startsWith('/search') || pathname.startsWith('/bottle')
    return pathname.startsWith(href)
  }

  return (
    <nav style={{
      position:             'fixed',
      bottom:               0, left: 0, right: 0,
      zIndex:               100,
      background:           'rgba(12, 8, 5, 0.97)',
      borderTop:            '1px solid var(--hairline-2)',
      display:              'flex',
      backdropFilter:       'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      paddingBottom:        'env(safe-area-inset-bottom)',
      height:               'calc(var(--tab-h) + env(safe-area-inset-bottom))',
    }}>
      {TABS.map(({ id, label, Icon, href }) => {
        const active    = isActive(href)
        const showBadge = id === 'finds' && badge > 0

        return (
          <Link
            key={id}
            href={href}
            onMouseDown={() => setPressed(id)}
            onMouseUp={() => setPressed(null)}
            onMouseLeave={() => setPressed(null)}
            onTouchStart={() => setPressed(id)}
            onTouchEnd={() => setPressed(null)}
            style={{
              flex:            1,
              display:         'flex',
              flexDirection:   'column',
              alignItems:      'center',
              justifyContent:  'center',
              gap:             'var(--sp-1)',
              padding:         'var(--sp-2) 0',
              textDecoration:  'none',
              transform:       pressed === id ? 'scale(0.94)' : 'scale(1)',
              transition:      `transform var(--t-fast) var(--ease-spring)`,
              minHeight:       44,
            }}
          >
            {/* Active indicator pill — sits above the icon */}
            <span style={{
              width:        active ? 20 : 0,
              height:       3,
              borderRadius: 'var(--r-pill)',
              background:   'var(--grad-copper)',
              transition:   `width var(--t-base) var(--ease-spring)`,
              marginBottom: 2,
            }} />

            {/* Icon + badge */}
            <span style={{ position: 'relative', lineHeight: 0 }}>
              <Icon
                size={20}
                strokeWidth={active ? 2.25 : 1.75}
                color={active ? 'var(--copper-500)' : 'var(--text-dim)'}
                style={{ transition: `color var(--t-base) var(--ease-out)` }}
              />
              {showBadge && (
                <span style={{
                  position:     'absolute',
                  top:          -4,
                  right:        -6,
                  minWidth:     16,
                  height:       16,
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  background:   'var(--red)',
                  color:        'var(--text-inverse)',
                  fontSize:     9,
                  fontWeight:   700,
                  borderRadius: 'var(--r-pill)',
                  padding:      '0 4px',
                  lineHeight:   1,
                }}>
                  {badge}
                </span>
              )}
            </span>

            {/* Label */}
            <span style={{
              fontSize:      9,
              fontWeight:    active ? 700 : 500,
              color:         active ? 'var(--copper-500)' : 'var(--text-dim)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              transition:    `color var(--t-base) var(--ease-out)`,
            }}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
