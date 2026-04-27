'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import NotificationsDrawer from './NotificationsDrawer.jsx'
import SettingsDrawer      from './SettingsDrawer.jsx'

/**
 * AppHeader — shared sticky header used by all pages.
 *
 * Props:
 *   sub     string    — override the contextual subtitle
 *   action  ReactNode — additional right-side content (deprecated; use drawers instead)
 */

const SUBTITLES = {
  '/':        'Community Finds · Chicagoland',
  '/tracker': "Chicagoland Binny's · Truck Tracker",
  '/unicorn': 'Unicorn Auctions · Live Deals',
  '/profile': 'Your Collection & Tastings',
}

const iconBtn = {
  background:   'none',
  border:       'none',
  cursor:       'pointer',
  fontSize:     18,
  padding:      '6px 8px',
  borderRadius: 8,
  position:     'relative',
  lineHeight:   1,
  color:        '#f5e6cc',
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
        background:           'rgba(15,10,5,0.95)',
        borderBottom:         '1px solid #3d2b10',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{
          maxWidth:       960,
          margin:         '0 auto',
          padding:        '11px 16px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
        }}>
          {/* Left: logo + title + subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>🥃</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#f5e6cc', lineHeight: 1.1 }}>
                Tater Tracker
              </div>
              {subtitle && (
                <div style={{ fontSize: 11, color: '#9a7c55', marginTop: 1 }}>{subtitle}</div>
              )}
            </div>
          </div>

          {/* Right: optional action slot + bell + gear */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {action && <div style={{ marginRight: 4 }}>{action}</div>}

            {/* 🔔 Notifications */}
            <button
              style={iconBtn}
              onClick={() => { setNotifOpen(true); setSettingsOpen(false) }}
              title="Notifications"
            >
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position:     'absolute',
                  top:          2,
                  right:        2,
                  background:   '#f87171',
                  color:        '#fff',
                  fontSize:     8,
                  fontWeight:   700,
                  borderRadius: 999,
                  padding:      '1px 3px',
                  lineHeight:   1.2,
                  minWidth:     14,
                  textAlign:    'center',
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {/* ⚙️ Settings */}
            <button
              style={iconBtn}
              onClick={() => { setSettingsOpen(true); setNotifOpen(false) }}
              title="Settings"
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      {/* Drawers — rendered as fixed overlays */}
      <NotificationsDrawer open={notifOpen}    onClose={() => setNotifOpen(false)} />
      <SettingsDrawer      open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
