'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

// ── Toggle component ──────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        width:          40,
        height:         22,
        borderRadius:   11,
        background:     on ? '#e8943a' : '#3d2b10',
        border:         'none',
        cursor:         'pointer',
        position:       'relative',
        transition:     'background 0.2s',
        flexShrink:     0,
      }}
    >
      <span style={{
        position:   'absolute',
        top:        3,
        left:       on ? 21 : 3,
        width:      16,
        height:     16,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────
export default function NotificationsDrawer({ open, onClose }) {
  const { data: session } = useSession()
  const [watchlist,  setWatchlist]  = useState([])
  const [newBottle,  setNewBottle]  = useState('')
  const [adding,     setAdding]     = useState(false)
  const [alerts, setAlerts] = useState({
    trucks:    true,
    finds:     true,
    watchlist: true,
    auctions:  true,
  })
  const inputRef = useRef(null)

  // Load watchlist when drawer opens
  useEffect(() => {
    if (!open || !session?.user) return
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(d => setWatchlist(d.bottles ?? []))
      .catch(() => {})
  }, [open, session])

  // Focus input when drawer opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 250)
    }
  }, [open])

  async function addBottle() {
    const name = newBottle.trim()
    if (!name) return
    setAdding(true)
    try {
      const res = await fetch('/api/watchlist', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ bottle: name }),
      })
      const d = await res.json()
      if (d.bottles) { setWatchlist(d.bottles); setNewBottle('') }
    } finally {
      setAdding(false)
    }
  }

  async function removeBottle(bottle) {
    try {
      const res = await fetch(`/api/watchlist?bottle=${encodeURIComponent(bottle)}`, { method: 'DELETE' })
      const d   = await res.json()
      if (d.bottles) setWatchlist(d.bottles)
    } catch {}
  }

  if (!open) return null

  const section = {
    fontWeight:     700,
    fontSize:       11,
    color:          '#9a7c55',
    textTransform:  'uppercase',
    letterSpacing:  '0.07em',
    padding:        '16px 16px 8px',
    borderBottom:   '1px solid #2a1c08',
  }

  const row = {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '10px 16px',
    borderBottom:   '1px solid #1f1308',
    gap:            12,
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          background: 'rgba(0,0,0,0.5)',
          zIndex:     149,
        }}
      />

      {/* Panel */}
      <div style={{
        position:    'fixed',
        top:         0,
        right:       0,
        bottom:      0,
        width:       'min(360px, 100vw)',
        background:  '#1a1008',
        borderLeft:  '1px solid #3d2b10',
        zIndex:      150,
        display:     'flex',
        flexDirection:'column',
        animation:   'slideLeft 0.25s ease',
        overflowY:   'auto',
      }}>

        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '14px 16px',
          borderBottom:   '1px solid #3d2b10',
          background:     '#1a1008',
          position:       'sticky',
          top:            0,
          zIndex:         1,
        }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#f5e6cc' }}>🔔 Notifications</div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a7c55', fontSize: 20, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Section: Bottle Watchlist */}
        <div style={section}>Bottle Watchlist</div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a1c08' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              value={newBottle}
              onChange={e => setNewBottle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addBottle()}
              placeholder="e.g. Blanton's Original"
              style={{
                flex:         1,
                padding:      '8px 12px',
                background:   '#0f0a05',
                border:       '1px solid #3d2b10',
                borderRadius: 8,
                color:        '#f5e6cc',
                fontSize:     13,
                fontFamily:   'inherit',
                outline:      'none',
              }}
            />
            <button
              onClick={addBottle}
              disabled={adding || !newBottle.trim()}
              style={{
                padding:      '8px 14px',
                background:   '#e8943a',
                border:       'none',
                borderRadius: 8,
                color:        '#fff',
                fontWeight:   700,
                cursor:       adding ? 'not-allowed' : 'pointer',
                opacity:      adding ? 0.6 : 1,
                fontSize:     18,
                lineHeight:   1,
              }}
            >
              +
            </button>
          </div>
        </div>

        {watchlist.length === 0 ? (
          <div style={{ padding: '16px', fontSize: 13, color: '#6b5030', textAlign: 'center' }}>
            No bottles on your watchlist yet
          </div>
        ) : (
          <div>
            {watchlist.map(bottle => (
              <div key={bottle} style={row}>
                <span style={{ fontSize: 13, color: '#f5e6cc' }}>🔔 {bottle}</span>
                <button
                  onClick={() => removeBottle(bottle)}
                  style={{ background: 'none', border: 'none', color: '#6b5030', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Section: Alert Settings */}
        <div style={section}>Alert Settings</div>

        {[
          { key: 'trucks',    label: 'Truck deliveries detected' },
          { key: 'finds',     label: 'New club finds'            },
          { key: 'watchlist', label: 'Watchlist matches'         },
          { key: 'auctions',  label: 'Auction price drops'       },
        ].map(({ key, label }) => (
          <div key={key} style={row}>
            <span style={{ fontSize: 13, color: '#f5e6cc' }}>{label}</span>
            <Toggle
              on={alerts[key]}
              onChange={v => setAlerts(prev => ({ ...prev, [key]: v }))}
            />
          </div>
        ))}

        <div style={{ padding: '16px', fontSize: 11, color: '#6b5030', textAlign: 'center' }}>
          Alert settings are stored locally on this device
        </div>
      </div>
    </>
  )
}
