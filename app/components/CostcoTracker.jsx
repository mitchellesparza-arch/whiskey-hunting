'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

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
        padding:      '6px 12px',
        borderRadius: 999,
        border:       `1px solid ${selected ? '#e8943a' : '#3d2b10'}`,
        background:   selected ? '#2a1500' : '#1a1008',
        color:        selected ? '#e8943a' : disabled ? '#4a3520' : '#9a7c55',
        fontSize:     12,
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
        display:        'grid',
        gridTemplateColumns: 'auto auto 1fr auto',
        alignItems:     'center',
        gap:            10,
        padding:        '8px 12px',
        borderBottom:   '1px solid #1f1308',
        fontSize:       13,
        opacity:        dim ? 0.55 : 1,
      }}
    >
      <span style={{ fontSize: 14 }}>{inStock ? '✅' : '❌'}</span>
      <span style={{ color: '#6b5030', fontSize: 11, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {timeAgo(alert.observedAt)}
      </span>
      <span style={{ color: inStock ? '#f5e6cc' : '#9a7c55', fontWeight: inStock ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {alert.productName}
      </span>
      <span style={{ color: '#9a7c55', fontSize: 11, whiteSpace: 'nowrap' }}>
        {label} ({alert.storeNumber})
      </span>
    </div>
  )
}

function FavoriteStoreCard({ store, alerts }) {
  const inStockAlerts = alerts.filter(a => a.status === 'in_stock').slice(0, 3)
  const lastAlert     = alerts[0]
  const hasAny        = inStockAlerts.length > 0

  return (
    <div className="card overflow-hidden">
      <div
        style={{
          padding:      '10px 14px',
          borderBottom: '1px solid #2a1c08',
          background:   '#1f1308',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e8943a' }}>
            ⭐ {store.name}
          </div>
          <div style={{ fontSize: 11, color: '#6b5030' }}>
            Costco #{store.number}, {store.state}
          </div>
        </div>
        {lastAlert && (
          <div style={{ fontSize: 11, color: '#6b5030', textAlign: 'right' }}>
            <div>last activity</div>
            <div>{timeAgo(lastAlert.observedAt)}</div>
          </div>
        )}
      </div>

      {hasAny ? (
        <div>
          {inStockAlerts.map(a => (
            <div key={a.discordMessageId} style={{ padding: '10px 14px', borderBottom: '1px solid #1f1308' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f5e6cc', marginBottom: 4 }}>
                ✅ {a.productName}
              </div>
              <div style={{ fontSize: 11, color: '#9a7c55' }}>
                Item #{a.itemNumber} · {formatDay(a.observedAt)} · {formatTime(a.observedAt)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '16px 14px', fontSize: 12, color: '#6b5030', textAlign: 'center' }}>
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
            <p className="text-xs text-[#9a7c55]">
              Pick up to 3 stores to surface here and (optionally) get push notifications for
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="btn-primary"
            style={{ fontSize: 13, padding: '6px 14px' }}
          >
            {refreshing ? 'Refreshing…' : '↺ Refresh'}
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {stores.length === 0 ? (
            <div style={{ fontSize: 12, color: '#6b5030', padding: '4px 0' }}>
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

        {favoriteStoreObjects.length === 0 ? (
          <div className="card px-4 py-6 text-center text-sm text-[#6b5030]">
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
            <p className="text-xs text-[#9a7c55]">
              {lastChecked
                ? `${alerts.length} recent ${alerts.length === 1 ? 'alert' : 'alerts'} · last update ${timeAgo(lastChecked)}`
                : 'Most recent alerts across every Illinois Costco we track'}
            </p>
          </div>
        </div>

        {!loaded ? (
          <div className="card px-4 py-6 text-center text-sm text-[#6b5030]">
            Loading…
          </div>
        ) : alerts.length === 0 ? (
          <div className="card" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🥃</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#f5e6cc', marginBottom: 6 }}>
              No Costco alerts yet
            </div>
            <div style={{ fontSize: 12, color: '#9a7c55', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
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
