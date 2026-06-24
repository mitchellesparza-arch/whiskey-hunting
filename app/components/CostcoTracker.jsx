'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return null
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDay(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StoreChip({ store, selected, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding:      'var(--sp-1) var(--sp-3)',
        borderRadius: 999,
        border:       selected ? '1px solid var(--copper-500)' : '1px solid var(--hairline-2)',
        background:   selected ? 'rgba(217,126,44,0.12)' : 'var(--bg-elev-2)',
        color:        selected ? 'var(--copper-500)' : disabled ? 'var(--text-dim)' : 'var(--text-muted)',
        fontSize:     'var(--fs-meta)',
        fontWeight:   selected ? 700 : 500,
        cursor:       disabled ? 'not-allowed' : 'pointer',
        opacity:      disabled ? 0.5 : 1,
        transition:   'all 0.15s',
      }}
    >
      {selected ? '⭐' : ''} {store.name} <span style={{ opacity: 0.6 }}>({store.number})</span>
    </button>
  )
}

function AlertRow({ alert, dim, storeLookup }) {
  const inStock = alert.status === 'in_stock'
  const store   = storeLookup?.[alert.storeNumber]
  const label   = store ? store.name : alert.storeName
  return (
    <div
      style={{
        padding:      'var(--sp-3) var(--sp-3)',
        borderBottom: '1px solid var(--bg-elev-2)',
        opacity:      dim ? 0.55 : 1,
      }}
    >
      {/* Line 1 — status icon + full product name (wraps if needed) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 14, lineHeight: 1.35, flexShrink: 0 }}>
          {inStock ? '✅' : '❌'}
        </span>
        <span
          style={{
            flex:       1,
            minWidth:   0,
            color:      inStock ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: inStock ? 600 : 500,
            fontSize:   'var(--fs-body)',
            lineHeight: 1.35,
            wordBreak:  'break-word',
          }}
        >
          {alert.productName}
        </span>
      </div>

      {/* Line 2 — timestamp · store (indented under the product name) */}
      <div
        style={{
          marginTop:    4,
          paddingLeft:  22,
          display:      'flex',
          alignItems:   'center',
          gap:          6,
          flexWrap:     'wrap',
          fontSize:     'var(--fs-meta)',
          color:        'var(--text-dim)',
        }}
      >
        <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {timeAgo(alert.observedAt)}
        </span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {label} ({alert.storeNumber})
        </span>
      </div>
    </div>
  )
}

function FavoriteStoreCard({ store, alerts }) {
  // alerts are newest-first; keep only the most recent alert per product so a
  // stale in_stock entry can't surface behind a newer out_of_stock for the same item
  const latestByProduct = []
  const seenProducts = new Set()
  for (const a of alerts) {
    const key = a.itemNumber || a.productName
    if (!seenProducts.has(key)) {
      seenProducts.add(key)
      latestByProduct.push(a)
    }
  }

  const inStockAlerts = latestByProduct.filter(a => a.status === 'in_stock').slice(0, 3)
  const lastAlert     = alerts[0]
  const hasAny        = inStockAlerts.length > 0

  return (
    <div className="card overflow-hidden">
      <div
        style={{
          padding:      'var(--sp-2) 14px',
          borderBottom: '1px solid var(--hairline-2)',
          background:   'var(--bg-elev-2)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--copper-500)' }}>
            ⭐ {store.name}
          </div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>
            Costco #{store.number}, {store.state}
          </div>
        </div>
        {lastAlert && (
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', textAlign: 'right' }}>
            <div>last activity</div>
            <div>{timeAgo(lastAlert.observedAt)}</div>
          </div>
        )}
      </div>

      {hasAny ? (
        <div>
          {inStockAlerts.map(a => (
            <div key={a.discordMessageId} style={{ padding: 'var(--sp-2) 14px', borderBottom: '1px solid var(--bg-elev-2)' }}>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-1)' }}>
                ✅ {a.productName}
              </div>
              <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>
                Item #{a.itemNumber} · {formatDay(a.observedAt)} · {formatTime(a.observedAt)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: 'var(--sp-4) 14px', fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', textAlign: 'center' }}>
          No recent in-stock alerts at this store
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CostcoTracker() {
  const [alerts,        setAlerts]        = useState([])
  const [stores,        setStores]        = useState([])
  const [loaded,        setLoaded]        = useState(false)
  const [refreshing,    setRefreshing]    = useState(false)
  const [favorites,     setFavorites]     = useState([])
  const [savingFavs,    setSavingFavs]    = useState(false)
  const [lastChecked,   setLastChecked]   = useState(null)
  const [pickerOpen,    setPickerOpen]    = useState(false)

  const loadAlerts = useCallback(async () => {
    try {
      const r = await fetch('/api/costco/history')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setAlerts(d.alerts ?? [])
      setLastChecked(d.lastObservedAt ?? null)
    } catch {
      setAlerts([])
    } finally {
      setLoaded(true)
    }
  }, [])

  const loadStores = useCallback(async () => {
    try {
      const r = await fetch('/api/costco/stores')
      if (!r.ok) return
      const d = await r.json()
      setStores(Array.isArray(d.stores) ? d.stores : [])
    } catch {}
  }, [])

  const loadProfile = useCallback(async () => {
    try {
      const r = await fetch('/api/profile')
      if (!r.ok) return
      const d = await r.json()
      const favs = Array.isArray(d.profile?.costcoFavorites) ? d.profile.costcoFavorites.map(String) : []
      setFavorites(favs)
    } catch {}
  }, [])

  useEffect(() => { loadAlerts(); loadStores(); loadProfile() }, [loadAlerts, loadStores, loadProfile])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([loadAlerts(), loadStores()])
    setRefreshing(false)
  }, [loadAlerts, loadStores])

  const storeLookup = useMemo(
    () => Object.fromEntries(stores.map(s => [s.number, s])),
    [stores]
  )

  // Save favorites to server (debounced via savingFavs state — simple optimistic UI)
  async function toggleFavorite(storeNumber) {
    const has  = favorites.includes(storeNumber)
    const next = has
      ? favorites.filter(n => n !== storeNumber)
      : favorites.length < 3
        ? [...favorites, storeNumber]
        : favorites
    if (next === favorites) return  // hit max, do nothing

    setFavorites(next)
    setSavingFavs(true)
    try {
      await fetch('/api/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ costcoFavorites: next }),
      })
    } catch {
      setFavorites(favorites)  // rollback on failure
    } finally {
      setSavingFavs(false)
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  // Group alerts by store for the favorites view
  const alertsByStore = useMemo(() => {
    const map = {}
    for (const a of alerts) {
      if (!map[a.storeNumber]) map[a.storeNumber] = []
      map[a.storeNumber].push(a)
    }
    return map
  }, [alerts])

  const favoriteStoreObjects = useMemo(
    () => favorites.map(n => storeLookup[n]).filter(Boolean),
    [favorites, storeLookup]
  )

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-10">

      {/* Favorites picker + favorite-store cards */}
      <section>
        <div className="section-header">
          <span className="text-xl">⭐</span>
          <div style={{ flex: 1 }}>
            <h2 className="section-title">Your Favorite Costcos</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Pick up to 3 stores to surface here and (optionally) get push notifications for
            </p>
          </div>
          <button
            onClick={() => setPickerOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 'var(--fs-meta)', fontWeight: 600,
              color: 'var(--text-muted)', background: 'none',
              border: '1px solid var(--hairline-2)', borderRadius: 'var(--r-sm)',
              padding: '5px 10px', cursor: 'pointer',
            }}
          >
            {pickerOpen ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
            {pickerOpen ? 'Done' : 'Edit Stores'}
          </button>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="btn-primary"
            style={{ fontSize: 'var(--fs-body)', padding: 'var(--sp-1) 14px' }}
          >
            {refreshing ? 'Refreshing…' : '↺ Refresh'}
          </button>
        </div>

        {pickerOpen && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--sp-4)' }}>
            {stores.length === 0 ? (
              <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', padding: 'var(--sp-1) 0' }}>
                Loading store list…
              </div>
            ) : stores.map(store => {
              const isFav = favorites.includes(store.number)
              const atMax = !isFav && favorites.length >= 3
              return (
                <StoreChip
                  key={store.number}
                  store={store}
                  selected={isFav}
                  disabled={atMax || savingFavs}
                  onClick={() => toggleFavorite(store.number)}
                />
              )
            })}
          </div>
        )}

        {favoriteStoreObjects.length === 0 ? (
          <div className="card px-4 py-6 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
            Pick up to 3 favorite Costco warehouses above to pin them here.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {favoriteStoreObjects.map(store => (
              <FavoriteStoreCard
                key={store.number}
                store={store}
                alerts={alertsByStore[store.number] ?? []}
              />
            ))}
          </div>
        )}
      </section>

      {/* Live ticker — all IL stores */}
      <section>
        <div className="section-header">
          <span className="text-xl">📡</span>
          <div>
            <h2 className="section-title">Live Ticker — All Illinois</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {lastChecked
                ? `${alerts.length} recent ${alerts.length === 1 ? 'alert' : 'alerts'} · last update ${timeAgo(lastChecked)}`
                : 'Most recent alerts across every Illinois Costco we track'}
            </p>
          </div>
        </div>

        {!loaded ? (
          <div className="card px-4 py-6 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
            Loading…
          </div>
        ) : alerts.length === 0 ? (
          <div className="card" style={{ padding: 'var(--sp-6) var(--sp-4)', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 'var(--sp-2)' }}>🥃</div>
            <div style={{ fontWeight: 700, fontSize: 'var(--fs-h3)', color: 'var(--text-primary)', marginBottom: 6 }}>
              No Costco alerts yet
            </div>
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
              Once the relay catches a status change in any Illinois Costco, it lands here.
              Make sure your Discord tab is open and the relay userscript is running.
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {alerts.map(a => (
              <AlertRow
                key={a.discordMessageId}
                alert={a}
                dim={a.status === 'out_of_stock'}
                storeLookup={storeLookup}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
