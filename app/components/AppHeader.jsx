'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bell, Settings } from 'lucide-react'
import NotificationsDrawer from './NotificationsDrawer.jsx'
import SettingsDrawer      from './SettingsDrawer.jsx'

const SUBTITLES = {
  '/':           'Community Finds · Chicagoland',
  '/tracker':    "Chicagoland Binny's · Truck Tracker",
  '/unicorn':    'Unicorn Auctions · Live Deals',
  '/profile':    'Your Collection & Tastings',
  '/search':     'Search bottles',
  '/marketplace':'Buy · Sell · Trade',
}

export default function AppHeader({ sub, action, unreadCount = 0 }) {
  const pathname = usePathname()
  const [notifOpen,    setNotifOpen]    = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const subtitle = sub ?? SUBTITLES[pathname] ?? SUBTITLES['/']

  return (
    <>
      <header style={{
        position:             'sticky',
        top:                  0,
        zIndex:               50,
        background:           'rgba(12, 8, 5, 0.96)',
        borderBottom:         '1px solid var(--hairline-2)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        height:               'var(--header-h)',
      }}>
        <div style={{
          maxWidth:       'var(--container)',
          margin:         '0 auto',
          padding:        '0 var(--sp-4)',
          height:         '100%',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            'var(--sp-3)',
        }}>

          {/* Left: logo pill + title + breadcrumb subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', minWidth: 0 }}>
            {/* App icon */}
            <img
              src="/tater-icon.png"
              alt=""
              style={{
                width:        28,
                height:       28,
                borderRadius: 'var(--r-pill)',
                flexShrink:   0,
                boxShadow:    'var(--shadow-1)',
                objectFit:    'cover',
              }}
            />

            <div style={{ minWidth: 0 }}>
              <div style={{
                fontWeight:    800,
                fontSize:      'var(--fs-h3)',
                color:         'var(--text-primary)',
                lineHeight:    1.1,
                letterSpacing: 'var(--tracking-head)',
                whiteSpace:    'nowrap',
              }}>
                Tater Tracker
              </div>
              {subtitle && (
                <div style={{
                  fontSize:      'var(--fs-overline)',
                  fontWeight:    700,
                  color:         'var(--text-muted)',
                  letterSpacing: 'var(--tracking-overline)',
                  textTransform: 'uppercase',
                  marginTop:     1,
                  overflow:      'hidden',
                  textOverflow:  'ellipsis',
                  whiteSpace:    'nowrap',
                }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          {/* Right: optional action + lucide icon buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)', flexShrink: 0 }}>
            {action && <div style={{ marginRight: 'var(--sp-2)' }}>{action}</div>}

            {/* Bell */}
            <button
              onClick={() => { setNotifOpen(true); setSettingsOpen(false) }}
              title="Notifications"
              style={{
                position:     'relative',
                display:      'grid',
                placeItems:   'center',
                width:        36,
                height:       36,
                borderRadius: 'var(--r-md)',
                background:   notifOpen ? 'var(--bg-elev-3)' : 'none',
                border:       'none',
                cursor:       'pointer',
                color:        'var(--text-2)',
                transition:   'background var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elev-3)'}
              onMouseLeave={e => e.currentTarget.style.background = notifOpen ? 'var(--bg-elev-3)' : 'none'}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.94)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Bell size={18} strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span style={{
                  position:     'absolute',
                  top:          5,
                  right:        5,
                  width:        8,
                  height:       8,
                  borderRadius: 'var(--r-pill)',
                  background:   'var(--red)',
                  border:       '1.5px solid var(--bg-base)',
                }} />
              )}
            </button>

            {/* Settings gear */}
            <button
              onClick={() => { setSettingsOpen(true); setNotifOpen(false) }}
              title="Settings"
              style={{
                display:      'grid',
                placeItems:   'center',
                width:        36,
                height:       36,
                borderRadius: 'var(--r-md)',
                background:   settingsOpen ? 'var(--bg-elev-3)' : 'none',
                border:       'none',
                cursor:       'pointer',
                color:        'var(--text-2)',
                transition:   'background var(--t-fast) var(--ease-out)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elev-3)'}
              onMouseLeave={e => e.currentTarget.style.background = settingsOpen ? 'var(--bg-elev-3)' : 'none'}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.94)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Settings size={18} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </header>

      <NotificationsDrawer open={notifOpen}    onClose={() => setNotifOpen(false)} />
      <SettingsDrawer      open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
