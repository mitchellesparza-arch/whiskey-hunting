'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Bell, X } from 'lucide-react'
import Sheet from './ui/Sheet.jsx'
import SectionHeader from './ui/SectionHeader.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64     = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(b64)
  const arr     = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ on, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => !disabled && onChange(!on)}
      style={{
        width:        40,
        height:       22,
        borderRadius: 'var(--r-pill)',
        background:   on ? 'var(--copper-500)' : 'var(--bg-elev-3)',
        border:       `1px solid ${on ? 'var(--copper-600)' : 'var(--hairline-2)'}`,
        cursor:       disabled ? 'not-allowed' : 'pointer',
        position:     'relative',
        transition:   'background var(--t-base) var(--ease-out), border-color var(--t-base) var(--ease-out)',
        flexShrink:   0,
        opacity:      disabled ? 0.45 : 1,
      }}
    >
      <span style={{
        position:     'absolute',
        top:          3,
        left:         on ? 19 : 3,
        width:        14,
        height:       14,
        borderRadius: '50%',
        background:   '#fff',
        transition:   'left var(--t-base) var(--ease-spring)',
        boxShadow:    'var(--shadow-1)',
      }} />
    </button>
  )
}

const DEFAULT_PREFS = { trucks: true, finds: true, watchlist: true, auctions: true, friends: true, costco: true }

// ── Drawer ────────────────────────────────────────────────────────────────────
export default function NotificationsDrawer({ open, onClose }) {
  const { data: session } = useSession()

  const [watchlist,  setWatchlist]  = useState([])
  const [newBottle,  setNewBottle]  = useState('')
  const [adding,     setAdding]     = useState(false)
  const inputRef = useRef(null)

  const [prefs,      setPrefs]      = useState(DEFAULT_PREFS)
  const [costcoMode, setCostcoMode] = useState('all')

  const [pushSupported,  setPushSupported]  = useState(false)
  const [pushPermission, setPushPermission] = useState('default')
  const [pushEnabled,    setPushEnabled]    = useState(false)
  const [enabling,       setEnabling]       = useState(false)
  const [pushStatus,     setPushStatus]     = useState('')

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

  useEffect(() => {
    if (!open || !session?.user) return
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(d => setWatchlist(d.bottles ?? []))
      .catch(() => {})
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        if (d.profile?.notifPrefs) setPrefs(prev => ({ ...DEFAULT_PREFS, ...d.profile.notifPrefs }))
        if (d.profile?.costcoMode === 'favorites' || d.profile?.costcoMode === 'all') {
          setCostcoMode(d.profile.costcoMode)
        }
      })
      .catch(() => {})
  }, [open, session])

  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 300)
  }, [open])

  async function enablePush() {
    setEnabling(true)
    setPushStatus('Requesting permission…')
    try {
      const permission = await Notification.requestPermission()
      setPushPermission(permission)
      if (permission !== 'granted') {
        setPushStatus(permission === 'denied'
          ? 'Notifications blocked — check your browser settings'
          : 'Permission not granted')
        return
      }
      setPushStatus('Fetching server key…')
      const keyRes = await fetch('/api/push')
      if (!keyRes.ok) throw new Error(`Key fetch failed: ${keyRes.status}`)
      const { publicKey } = await keyRes.json()
      if (!publicKey) { setPushStatus('VAPID_PUBLIC_KEY not set in Vercel — contact admin'); return }
      setPushStatus('Registering service worker…')
      let reg
      try { reg = await navigator.serviceWorker.register('/sw.js') }
      catch (err) { throw new Error(`SW registration failed: ${err.message}`) }
      if (!reg.active) {
        setPushStatus('Activating service worker…')
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('SW did not activate')), 8000
          )
          const worker = reg.installing || reg.waiting
          if (!worker) { clearTimeout(timeout); resolve(); return }
          worker.addEventListener('statechange', function () {
            if (this.state === 'activated') { clearTimeout(timeout); resolve() }
            if (this.state === 'redundant')  { clearTimeout(timeout); reject(new Error('SW became redundant')) }
          })
        })
        reg = await navigator.serviceWorker.getRegistration('/sw.js')
        if (!reg?.active) throw new Error('SW active but registration lost')
      }
      setPushStatus('Subscribing…')
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      setPushStatus('Saving subscription…')
      const res = await fetch('/api/push', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscription: sub.toJSON() }),
      })
      if (!res.ok) throw new Error(`Server save failed: ${res.status}`)
      setPushEnabled(true)
      setPushStatus('✓ Push notifications enabled!')
    } catch (err) {
      console.error('[push] enable failed:', err)
      setPushStatus(`Failed: ${err.message}`)
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

  async function updatePref(key, value) {
    const newPrefs = { ...prefs, [key]: value }
    setPrefs(newPrefs)
    await fetch('/api/profile', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ notifPrefs: newPrefs }),
    }).catch(() => {})
  }

  async function updateCostcoMode(mode) {
    setCostcoMode(mode)
    await fetch('/api/profile', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ costcoMode: mode }),
    }).catch(() => {})
  }

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

  const isIOS        = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone = typeof window   !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)

  const divider = { borderTop: '1px solid var(--hairline)', margin: 0 }

  const row = {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        'var(--sp-3) 0',
    gap:            'var(--sp-3)',
    borderBottom:   '1px solid var(--hairline)',
  }

  return (
    <Sheet open={open} onClose={onClose} side title="Notifications">
      {/* ── Push Notifications ────────────────────────────────────────────── */}
      <SectionHeader overline="Push Notifications" style={{ marginBottom: 'var(--sp-3)' }} />

      <div style={{ marginBottom: 'var(--sp-5)' }}>
        {!pushSupported ? (
          <p style={{ margin: 0, fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', lineHeight: 'var(--lh-body)' }}>
            Push notifications are not supported in this browser.
          </p>
        ) : isIOS && !isStandalone ? (
          <p style={{ margin: 0, fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', lineHeight: 'var(--lh-body)' }}>
            Add Tater Tracker to your home screen first, then open from there to enable push notifications.
          </p>
        ) : pushPermission === 'denied' ? (
          <p style={{ margin: 0, fontSize: 'var(--fs-meta)', color: 'var(--red)', lineHeight: 'var(--lh-body)' }}>
            Notifications are blocked. Allow them in your browser settings, then come back here.
          </p>
        ) : pushEnabled ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
            <div>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--green)' }}>Enabled on this device</div>
              <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', marginTop: 2 }}>You'll receive the alerts below</div>
            </div>
            <button
              onClick={disablePush}
              style={{
                padding:      '5px 12px',
                background:   'none',
                border:       '1px solid var(--hairline-2)',
                borderRadius: 'var(--r-sm)',
                color:        'var(--text-muted)',
                fontSize:     'var(--fs-meta)',
                fontWeight:   600,
                cursor:       'pointer',
                fontFamily:   'inherit',
              }}
            >
              Disable
            </button>
          </div>
        ) : (
          <div>
            <p style={{ margin: '0 0 var(--sp-3)', fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', lineHeight: 'var(--lh-body)' }}>
              Get notified when trucks arrive, friends send requests, and more.
            </p>
            <button
              onClick={enablePush}
              disabled={enabling}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {enabling ? 'Enabling…' : 'Enable Push Notifications'}
            </button>
          </div>
        )}

        {pushStatus && (
          <p style={{
            margin:     'var(--sp-2) 0 0',
            fontSize:   'var(--fs-overline)',
            color:      pushStatus.includes('!') ? 'var(--green)' : 'var(--red)',
            textAlign:  'center',
          }}>
            {pushStatus}
          </p>
        )}
      </div>

      <hr style={divider} />

      {/* ── Alert Settings ────────────────────────────────────────────────── */}
      <SectionHeader overline="Alert Settings" style={{ marginTop: 'var(--sp-5)', marginBottom: 'var(--sp-2)' }} />

      {[
        { key: 'trucks',    label: 'Truck deliveries detected' },
        { key: 'costco',    label: 'Costco bourbon alerts'     },
        { key: 'finds',     label: 'New club finds'            },
        { key: 'friends',   label: 'Friend requests'           },
        { key: 'watchlist', label: 'Watchlist matches'         },
        { key: 'auctions',  label: 'Auction price drops'       },
      ].map(({ key, label }) => (
        <div key={key} style={row}>
          <div>
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>{label}</span>
            {!pushEnabled && (
              <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', marginTop: 1 }}>
                Enable push to receive alerts
              </div>
            )}
          </div>
          <Toggle on={prefs[key] ?? true} onChange={v => updatePref(key, v)} disabled={!pushEnabled} />
        </div>
      ))}

      <hr style={{ ...divider, marginTop: 'var(--sp-2)' }} />

      {/* ── Costco Alert Scope ────────────────────────────────────────────── */}
      <SectionHeader overline="Costco Alert Scope" style={{ marginTop: 'var(--sp-5)', marginBottom: 'var(--sp-3)' }} />

      <p style={{ margin: '0 0 var(--sp-3)', fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', lineHeight: 'var(--lh-body)' }}>
        Choose which Illinois Costco warehouses send you push notifications. Pin favorites on the Tracker tab.
      </p>

      {[
        { key: 'all',       label: 'All Illinois stores', desc: 'Every alert from every IL Costco we track' },
        { key: 'favorites', label: 'Favorites only',      desc: 'Only your pinned stores (max 3)' },
      ].map(({ key, label, desc }) => {
        const active = costcoMode === key
        return (
          <button
            key={key}
            onClick={() => updateCostcoMode(key)}
            disabled={!pushEnabled || prefs.costco === false}
            style={{
              display:       'flex',
              alignItems:    'center',
              gap:           'var(--sp-3)',
              width:         '100%',
              padding:       'var(--sp-3)',
              marginBottom:  'var(--sp-2)',
              background:    active ? 'rgba(217,126,44,0.10)' : 'var(--bg-elev-3)',
              border:        `1px solid ${active ? 'var(--copper-600)' : 'var(--hairline-2)'}`,
              borderRadius:  'var(--r-md)',
              cursor:        (!pushEnabled || prefs.costco === false) ? 'not-allowed' : 'pointer',
              opacity:       (!pushEnabled || prefs.costco === false) ? 0.45 : 1,
              textAlign:     'left',
              fontFamily:    'inherit',
              transition:    'background var(--t-base) var(--ease-out), border-color var(--t-base) var(--ease-out)',
            }}
          >
            <span style={{
              width:        16,
              height:       16,
              borderRadius: '50%',
              border:       `2px solid ${active ? 'var(--copper-500)' : 'var(--text-dim)'}`,
              background:   active ? 'var(--copper-500)' : 'transparent',
              flexShrink:   0,
              transition:   'background var(--t-base) var(--ease-out)',
            }} />
            <div>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: active ? 'var(--copper-400)' : 'var(--text-primary)' }}>
                {label}
              </div>
              <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', marginTop: 2 }}>{desc}</div>
            </div>
          </button>
        )
      })}

      <hr style={{ ...divider, marginTop: 'var(--sp-2)' }} />

      {/* ── Bottle Watchlist ──────────────────────────────────────────────── */}
      <SectionHeader overline="Bottle Watchlist" style={{ marginTop: 'var(--sp-5)', marginBottom: 'var(--sp-3)' }} />

      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
        <input
          ref={inputRef}
          value={newBottle}
          onChange={e => setNewBottle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addBottle()}
          placeholder="e.g. Blanton's Original"
          style={{
            flex:         1,
            padding:      'var(--sp-2) var(--sp-3)',
            background:   'var(--bg-base)',
            border:       '1px solid var(--hairline-2)',
            borderRadius: 'var(--r-md)',
            color:        'var(--text-primary)',
            fontSize:     'var(--fs-body)',
            fontFamily:   'inherit',
            outline:      'none',
            transition:   'border-color var(--t-fast) var(--ease-out)',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--copper-500)'}
          onBlur={e  => e.target.style.borderColor = 'var(--hairline-2)'}
        />
        <button
          onClick={addBottle}
          disabled={adding || !newBottle.trim()}
          style={{
            padding:      '0 var(--sp-4)',
            background:   'var(--copper-500)',
            border:       'none',
            borderRadius: 'var(--r-md)',
            color:        'var(--text-inverse)',
            fontWeight:   700,
            fontSize:     20,
            lineHeight:   1,
            cursor:       adding ? 'not-allowed' : 'pointer',
            opacity:      adding ? 0.45 : 1,
            fontFamily:   'inherit',
            transition:   'background var(--t-base) var(--ease-out), transform var(--t-fast) var(--ease-out)',
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.94)'}
          onMouseUp={e   => e.currentTarget.style.transform = 'scale(1)'}
        >
          +
        </button>
      </div>

      {watchlist.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', textAlign: 'center', margin: 'var(--sp-4) 0' }}>
          No bottles on your watchlist yet
        </p>
      ) : (
        <div>
          {watchlist.map(bottle => (
            <div key={bottle} style={row}>
              <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>{bottle}</span>
              <button
                onClick={() => removeBottle(bottle)}
                style={{
                  background:   'none',
                  border:       'none',
                  color:        'var(--text-dim)',
                  cursor:       'pointer',
                  lineHeight:   0,
                  padding:      'var(--sp-1)',
                  borderRadius: 'var(--r-sm)',
                  transition:   'color var(--t-fast) var(--ease-out)',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                aria-label={`Remove ${bottle}`}
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', textAlign: 'center', marginTop: 'var(--sp-5)' }}>
        Watchlist is stored in your account and syncs across devices.
      </p>
    </Sheet>
  )
}
