'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64     = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(b64)
  const arr     = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

// ── Toggle component ──────────────────────────────────────────────────────────
function Toggle({ on, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => !disabled && onChange(!on)}
      style={{
        width:        40,
        height:       22,
        borderRadius: 11,
        background:   on ? '#e8943a' : '#3d2b10',
        border:       'none',
        cursor:       disabled ? 'not-allowed' : 'pointer',
        position:     'relative',
        transition:   'background 0.2s',
        flexShrink:   0,
        opacity:      disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position:     'absolute',
        top:          3,
        left:         on ? 21 : 3,
        width:        16,
        height:       16,
        borderRadius: '50%',
        background:   '#fff',
        transition:   'left 0.2s',
      }} />
    </button>
  )
}

const DEFAULT_PREFS = { trucks: true, finds: true, watchlist: true, auctions: true, friends: true }

// ── Drawer ────────────────────────────────────────────────────────────────────
export default function NotificationsDrawer({ open, onClose }) {
  const { data: session } = useSession()

  // Watchlist
  const [watchlist,  setWatchlist]  = useState([])
  const [newBottle,  setNewBottle]  = useState('')
  const [adding,     setAdding]     = useState(false)
  const inputRef = useRef(null)

  // Notification preferences (server-backed)
  const [prefs,       setPrefs]       = useState(DEFAULT_PREFS)

  // Push subscription state
  const [pushSupported,  setPushSupported]  = useState(false)
  const [pushPermission, setPushPermission] = useState('default')
  const [pushEnabled,    setPushEnabled]    = useState(false)
  const [enabling,       setEnabling]       = useState(false)
  const [pushStatus,     setPushStatus]     = useState('') // user-facing status message

  // ── Check push support on mount ─────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setPushSupported(true)
    setPushPermission(Notification.permission)
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setPushEnabled(!!sub))
      .catch(() => {})
  }, [])

  // ── Load watchlist + prefs when drawer opens ─────────────────────────────
  useEffect(() => {
    if (!open || !session?.user) return

    fetch('/api/watchlist')
      .then(r => r.json())
      .then(d => setWatchlist(d.bottles ?? []))
      .catch(() => {})

    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        if (d.profile?.notifPrefs) {
          setPrefs(prev => ({ ...DEFAULT_PREFS, ...d.profile.notifPrefs }))
        }
      })
      .catch(() => {})
  }, [open, session])

  // ── Focus input ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 250)
  }, [open])

  // ── Push enable / disable ────────────────────────────────────────────────
  async function enablePush() {
    setEnabling(true)
    setPushStatus('')
    try {
      // Request permission (must be triggered by user gesture)
      const permission = await Notification.requestPermission()
      setPushPermission(permission)
      if (permission !== 'granted') {
        setPushStatus(permission === 'denied'
          ? 'Notifications blocked — check your browser settings'
          : 'Permission not granted')
        return
      }

      // Fetch VAPID public key
      const { publicKey } = await fetch('/api/push').then(r => r.json())
      if (!publicKey) { setPushStatus('Server config missing — contact admin'); return }

      // Subscribe
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      // Save to server
      const res = await fetch('/api/push', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscription: sub.toJSON() }),
      })
      if (!res.ok) throw new Error('Server save failed')

      setPushEnabled(true)
      setPushStatus('Push notifications enabled!')
    } catch (err) {
      console.error('[push] enable failed:', err)
      setPushStatus('Something went wrong — try again')
    } finally {
      setEnabling(false)
    }
  }

  async function disablePush() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push', {
          method:  'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setPushEnabled(false)
      setPushStatus('Push notifications disabled')
    } catch (err) {
      console.error('[push] disable failed:', err)
    }
  }

  // ── Preference toggle ────────────────────────────────────────────────────
  async function updatePref(key, value) {
    const newPrefs = { ...prefs, [key]: value }
    setPrefs(newPrefs)
    await fetch('/api/profile', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ notifPrefs: newPrefs }),
    }).catch(() => {})
  }

  // ── Watchlist handlers ───────────────────────────────────────────────────
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
    } finally { setAdding(false) }
  }

  async function removeBottle(bottle) {
    try {
      const res = await fetch(`/api/watchlist?bottle=${encodeURIComponent(bottle)}`, { method: 'DELETE' })
      const d   = await res.json()
      if (d.bottles) setWatchlist(d.bottles)
    } catch {}
  }

  if (!open) return null

  const isIOS        = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone = typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)

  const sectionStyle = {
    fontWeight:    700,
    fontSize:      11,
    color:         '#9a7c55',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    padding:       '16px 16px 8px',
    borderBottom:  '1px solid #2a1c08',
  }

  const rowStyle = {
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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 149 }} />

      {/* Panel */}
      <div style={{
        position:      'fixed',
        top:           0,
        right:         0,
        bottom:        0,
        width:         'min(360px, 100vw)',
        background:    '#1a1008',
        borderLeft:    '1px solid #3d2b10',
        zIndex:        150,
        display:       'flex',
        flexDirection: 'column',
        animation:     'slideLeft 0.25s ease',
        overflowY:     'auto',
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
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a7c55', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {/* ── Push Notifications section ──────────────────────────────── */}
        <div style={sectionStyle}>Push Notifications</div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a1c08' }}>
          {!pushSupported ? (
            <div style={{ fontSize: 12, color: '#6b5030' }}>
              Push notifications are not supported in this browser.
            </div>
          ) : isIOS && !isStandalone ? (
            <div style={{ fontSize: 12, color: '#9a7c55', lineHeight: 1.5 }}>
              📲 On iPhone, add Tater Tracker to your home screen first, then open from there to enable push notifications.
            </div>
          ) : pushPermission === 'denied' ? (
            <div style={{ fontSize: 12, color: '#f87171', lineHeight: 1.5 }}>
              Notifications are blocked. Allow them in your browser/phone settings, then come back here.
            </div>
          ) : pushEnabled ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>✓ Enabled on this device</div>
                <div style={{ fontSize: 11, color: '#6b5030', marginTop: 2 }}>You'll receive notifications below</div>
              </div>
              <button
                onClick={disablePush}
                style={{ padding: '5px 12px', background: 'none', border: '1px solid #3d2b10', borderRadius: 7, color: '#9a7c55', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Disable
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: '#9a7c55', marginBottom: 10, lineHeight: 1.5 }}>
                Get notified on this device when trucks arrive, friends send requests, and more.
              </div>
              <button
                onClick={enablePush}
                disabled={enabling}
                style={{
                  width:        '100%',
                  padding:      '9px 0',
                  background:   enabling ? '#3d2b10' : '#e8943a',
                  border:       'none',
                  borderRadius: 8,
                  color:        '#fff',
                  fontWeight:   700,
                  fontSize:     13,
                  cursor:       enabling ? 'not-allowed' : 'pointer',
                }}
              >
                {enabling ? 'Enabling…' : '🔔 Enable Push Notifications'}
              </button>
            </div>
          )}

          {pushStatus && (
            <div style={{ fontSize: 11, color: pushStatus.includes('!') ? '#4ade80' : '#f87171', marginTop: 8, textAlign: 'center' }}>
              {pushStatus}
            </div>
          )}
        </div>

        {/* ── Alert Settings ──────────────────────────────────────────── */}
        <div style={sectionStyle}>Alert Settings</div>

        {[
          { key: 'trucks',    label: 'Truck deliveries detected' },
          { key: 'finds',     label: 'New club finds'            },
          { key: 'friends',   label: 'Friend requests'           },
          { key: 'watchlist', label: 'Watchlist matches'         },
          { key: 'auctions',  label: 'Auction price drops'       },
        ].map(({ key, label }) => (
          <div key={key} style={rowStyle}>
            <div>
              <span style={{ fontSize: 13, color: '#f5e6cc' }}>{label}</span>
              {!pushEnabled && <div style={{ fontSize: 10, color: '#6b5030', marginTop: 1 }}>Enable push to receive alerts</div>}
            </div>
            <Toggle
              on={prefs[key] ?? true}
              onChange={v => updatePref(key, v)}
              disabled={!pushEnabled}
            />
          </div>
        ))}

        {/* ── Bottle Watchlist ────────────────────────────────────────── */}
        <div style={sectionStyle}>Bottle Watchlist</div>

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
            >+</button>
          </div>
        </div>

        {watchlist.length === 0 ? (
          <div style={{ padding: '16px', fontSize: 13, color: '#6b5030', textAlign: 'center' }}>
            No bottles on your watchlist yet
          </div>
        ) : (
          <div>
            {watchlist.map(bottle => (
              <div key={bottle} style={rowStyle}>
                <span style={{ fontSize: 13, color: '#f5e6cc' }}>🔔 {bottle}</span>
                <button
                  onClick={() => removeBottle(bottle)}
                  style={{ background: 'none', border: 'none', color: '#6b5030', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                >✕</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: '16px', fontSize: 11, color: '#6b5030', textAlign: 'center' }}>
          Watchlist is stored in your account. Alert toggles sync across devices.
        </div>
      </div>
    </>
  )
}
