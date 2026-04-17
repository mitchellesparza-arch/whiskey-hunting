'use client'

import { useState, useCallback, useEffect } from 'react'
import { alertBottles, trackBottles, hotlineBottles } from '../lib/bottles.js'

// ── Delivery-pattern analysis ─────────────────────────────────────────────────
// Returns e.g. "Tuesday, Thursday" for the days with the most in-stock transitions,
// or null if there isn't enough data yet.
function timeAgo(iso) {
  if (!iso) return null
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function getDeliveryPattern(events) {
  const inStockEvents = events.filter((e) => e.type === 'in_stock')
  if (inStockEvents.length < 3) return null

  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const e of inStockEvents) {
    counts[new Date(e.timestamp).getDay()]++
  }
  const max = Math.max(...counts)
  if (max < 2) return null
  return DAY.filter((_, i) => counts[i] === max).join(', ')
}

// ── helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status, message }) {
  if (status === 'loading') return <span className="badge-loading">Checking…</span>
  if (status === 'error')   return <span className="badge-error">Error</span>
  if (status === true)      return <span className="badge-in-stock"><span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" /> {message || 'In Stock'}</span>
  return <span className="badge-out-of-stock"><span className="h-1.5 w-1.5 rounded-full bg-stone-600" /> Out of Stock</span>
}

function PriceTag({ price }) {
  if (price == null) return null
  return (
    <span className="text-xs text-[#9a7c55] font-mono">
      ${typeof price === 'number' ? price.toFixed(2) : price}
    </span>
  )
}

// ── Alert card ────────────────────────────────────────────────────────────────

function AlertCard({ bottle, result }) {
  const inStock = result?.inStock
  return (
    <a
      href={result?.url ?? bottle.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`card flex flex-col gap-2 p-4 cursor-pointer no-underline
        ${inStock ? 'ring-1 ring-green-700/60 shadow-lg shadow-green-950/40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-sm leading-snug text-[#f5e6cc]">{bottle.name}</span>
        <StatusBadge status={result == null ? 'loading' : result.error ? 'error' : result.inStock} message={result?.message} />
      </div>
      <div className="flex items-center justify-between gap-2">
        {result?.proof != null
          ? <span className="text-xs text-[#6b5030]">{result.proof}°</span>
          : <span />}
        {result?.price != null && <PriceTag price={result.price} />}
      </div>
      {result?.error && (
        <p className="text-xs text-red-400 truncate" title={result.error}>{result.error}</p>
      )}
    </a>
  )
}

// ── Track row ─────────────────────────────────────────────────────────────────

function TrackRow({ bottle, result }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-[#2a1a08] last:border-0">
      <a
        href={result?.url ?? bottle.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-[#c9a87a] hover:text-[#e8943a] transition-colors truncate"
      >
        {bottle.name}
      </a>
      <div className="flex items-center gap-2 shrink-0">
        {result?.proof != null && (
          <span className="text-xs text-[#6b5030]">{result.proof}°</span>
        )}
        {result?.price != null && <PriceTag price={result.price} />}
        <StatusBadge status={result == null ? 'loading' : result.error ? 'error' : result.inStock} message={result?.message} />
      </div>
    </div>
  )
}

// ── Hotline row ───────────────────────────────────────────────────────────────

function HotlineRow({ bottle }) {
  if (bottle.divider) {
    return (
      <div className="py-2 pt-4 first:pt-2 text-xs font-semibold text-[#9a7c55] tracking-wide border-b border-[#2a1a08]">
        {bottle.divider}
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-[#2a1a08] last:border-0">
      <span className="text-sm text-[#7a6040]">{bottle.name}</span>
      <a
        href={bottle.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-xs text-bourbon-500 hover:text-bourbon-400 transition-colors"
      >
        Hotline →
      </a>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [alertResults, setAlertResults] = useState({})
  const [trackResults, setTrackResults] = useState({})
  const [checking, setChecking]         = useState(false)
  const [checkedAt, setCheckedAt]       = useState(null)
  const [historyEvents, setHistoryEvents] = useState([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [lastState, setLastState]         = useState({})
  const [snapshotOpen, setSnapshotOpen]   = useState(false)

  const [collection, setCollection]             = useState([])
  const [collectionLoaded, setCollectionLoaded] = useState(false)
  const [newBottleName, setNewBottleName]       = useState('')
  const [newBottleDate, setNewBottleDate]       = useState('')
  const [newBottleStore, setNewBottleStore]     = useState("Binny's Orland Park")
  const [addingBottle, setAddingBottle]         = useState(false)

  const fetchOne = useCallback(async (bottle) => {
    try {
      const res = await fetch(`/api/check?objectID=${encodeURIComponent(bottle.objectID)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return {
        inStock:  data.inStock  ?? false,
        message:  data.message  ?? null,
        price:    data.price    ?? null,
        quantity: data.quantity ?? null,
        proof:    data.proof    ?? null,
        error:    data.error    ?? null,
      }
    } catch (err) {
      return { inStock: false, message: null, price: null, error: err.message }
    }
  }, [])

  const checkAll = useCallback(async () => {
    setChecking(true)
    setAlertResults({})
    setTrackResults({})

    const runGroup = async (bottles, setter) => {
      await Promise.all(
        bottles.map(async (bottle) => {
          const result = await fetchOne(bottle)
          setter((prev) => ({ ...prev, [bottle.name]: result }))
        })
      )
    }

    await Promise.all([
      runGroup(alertBottles, setAlertResults),
      runGroup(trackBottles, setTrackResults),
    ])

    setCheckedAt(new Date())
    setChecking(false)
  }, [fetchOne])

  useEffect(() => { checkAll() }, [checkAll])

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setHistoryEvents(data.events ?? [])
      setLastState(data.lastState ?? {})
    } catch {
      setHistoryEvents([])
    } finally {
      setHistoryLoaded(true)
    }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const loadCollection = useCallback(async () => {
    try {
      const res = await fetch('/api/collection')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCollection(data.collection ?? [])
    } catch {
      setCollection([])
    } finally {
      setCollectionLoaded(true)
    }
  }, [])

  useEffect(() => { loadCollection() }, [loadCollection])

  const addBottle = useCallback(async () => {
    if (!newBottleName.trim()) return
    setAddingBottle(true)
    try {
      const res = await fetch('/api/collection', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:        newBottleName,
          purchasedAt: newBottleDate || null,
          store:       newBottleStore || null,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setCollection((prev) => [data.entry, ...prev])
        setNewBottleName('')
        setNewBottleDate('')
        setNewBottleStore("Binny's Orland Park")
      }
    } finally {
      setAddingBottle(false)
    }
  }, [newBottleName, newBottleDate, newBottleStore])

  const removeBottle = useCallback(async (id) => {
    const res = await fetch(`/api/collection?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.ok) setCollection(data.collection)
  }, [])

  const deliveryPattern = getDeliveryPattern(historyEvents)

  const inStockAlerts  = alertBottles.filter((b) => alertResults[b.name]?.inStock)
  const totalChecked   = Object.keys(alertResults).length + Object.keys(trackResults).length
  const totalTrackable = alertBottles.length + trackBottles.length

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>

      {/* ── Header ── */}
      <header className="border-b border-[#3d2b10] sticky top-0 z-10 backdrop-blur-sm"
              style={{ background: 'rgba(15,10,5,0.92)' }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🥃</span>
            <div>
              <h1 className="font-bold text-base leading-tight text-[#f5e6cc]">Whiskey Hunter</h1>
              <p className="text-xs text-[#9a7c55]">Binny&apos;s Orland Park</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {checkedAt && (
              <span className="text-xs text-[#9a7c55] hidden sm:block">
                Last check: {checkedAt.toLocaleTimeString()}
              </span>
            )}
            <button onClick={checkAll} disabled={checking} className="btn-primary">
              {checking
                ? `Checking… (${totalChecked}/${totalTrackable})`
                : checkedAt ? 'Refresh' : 'Check Now'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">

        {/* ── In-stock banner ── */}
        {inStockAlerts.length > 0 && (
          <div className="rounded-xl border border-green-700/50 bg-green-950/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-green-400 text-lg">🎉</span>
              <span className="font-bold text-green-300">
                {inStockAlerts.length} alert bottle{inStockAlerts.length > 1 ? 's' : ''} in stock!
              </span>
            </div>
            <ul className="space-y-1">
              {inStockAlerts.map((b) => (
                <li key={b.name}>
                  <a href={b.url} target="_blank" rel="noopener noreferrer"
                     className="text-sm text-green-300 hover:text-green-200 underline underline-offset-2">
                    {b.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Empty state ── */}
        {!checking && !checkedAt && (
          <div className="text-center py-16 text-[#9a7c55]">
            <div className="text-5xl mb-4">🥃</div>
            <p className="text-lg font-medium mb-1">Ready to hunt</p>
            <p className="text-sm mb-2">
              Click &ldquo;Check Now&rdquo; to scan {totalTrackable} bottles at Binny&apos;s Orland Park
            </p>
            <p className="text-xs">
              + {hotlineBottles.length} Whiskey Hotline-only bottles listed below
            </p>
          </div>
        )}

        {/* ── Alert bottles ── */}
        {(checking || checkedAt) && (
          <section>
            <div className="section-header">
              <span className="text-xl">🚨</span>
              <div>
                <h2 className="section-title">Alert Bottles</h2>
                <p className="text-xs text-[#9a7c55]">Email sent the moment any of these are in stock</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {alertBottles.map((bottle) => (
                <AlertCard key={bottle.name} bottle={bottle} result={alertResults[bottle.name] ?? null} />
              ))}
            </div>
          </section>
        )}

        {/* ── Track-only bottles ── */}
        {(checking || checkedAt) && (
          <section>
            <div className="section-header">
              <span className="text-xl">👀</span>
              <div>
                <h2 className="section-title">Track Only</h2>
                <p className="text-xs text-[#9a7c55]">Monitored daily — no email alert</p>
              </div>
            </div>
            <div className="card px-4 divide-y divide-[#2a1a08]">
              {trackBottles.map((bottle) => (
                <TrackRow key={bottle.name} bottle={bottle} result={trackResults[bottle.name] ?? null} />
              ))}
            </div>
          </section>
        )}

        {/* ── My Collection ── */}
        <section>
          <div className="section-header">
            <span className="text-xl">🏠</span>
            <div>
              <h2 className="section-title">My Collection</h2>
              <p className="text-xs text-[#9a7c55]">
                Bottles you own · {collection.length} bottle{collection.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Add form */}
          <div className="card px-4 py-4 mb-3">
            <p className="text-xs text-[#9a7c55] uppercase tracking-wide mb-3">Add a bottle</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Bottle name"
                value={newBottleName}
                onChange={(e) => setNewBottleName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addBottle()}
                className="flex-1 bg-[#0f0a05] border border-[#3d2b10] rounded-lg px-3 py-2 text-sm text-[#f5e6cc] placeholder-[#6b5030] focus:outline-none focus:border-[#e8943a]"
              />
              <input
                type="date"
                value={newBottleDate}
                onChange={(e) => setNewBottleDate(e.target.value)}
                className="bg-[#0f0a05] border border-[#3d2b10] rounded-lg px-3 py-2 text-sm text-[#c9a87a] focus:outline-none focus:border-[#e8943a]"
              />
              <input
                type="text"
                placeholder="Store"
                value={newBottleStore}
                onChange={(e) => setNewBottleStore(e.target.value)}
                className="sm:w-48 bg-[#0f0a05] border border-[#3d2b10] rounded-lg px-3 py-2 text-sm text-[#f5e6cc] placeholder-[#6b5030] focus:outline-none focus:border-[#e8943a]"
              />
              <button
                onClick={addBottle}
                disabled={addingBottle || !newBottleName.trim()}
                className="btn-primary shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {addingBottle ? 'Adding…' : '+ Add'}
              </button>
            </div>
          </div>

          {/* Collection list */}
          {!collectionLoaded ? null : collection.length === 0 ? (
            <div className="card px-4 py-6 text-center text-sm text-[#6b5030]">
              No bottles yet — add your first one above.
            </div>
          ) : (
            <div className="card px-4 divide-y divide-[#2a1a08]">
              {collection.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#f5e6cc] font-medium truncate">{entry.name}</p>
                    <p className="text-xs text-[#6b5030]">
                      {entry.purchasedAt
                        ? new Date(entry.purchasedAt + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : '—'}
                      {' · '}
                      {entry.store ?? '—'}
                    </p>
                  </div>
                  <button
                    onClick={() => removeBottle(entry.id)}
                    className="shrink-0 text-lg leading-none text-[#6b5030] hover:text-red-400 transition-colors px-2 py-1 rounded"
                    title="Remove from collection"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Last Cron Snapshot ── */}
        {historyLoaded && (() => {
          const allTracked   = [...alertBottles, ...trackBottles]
          const snapEntries  = Object.values(lastState)
          const snapTime     = snapEntries.length > 0
            ? snapEntries.reduce((latest, v) => (v.checkedAt > latest ? v.checkedAt : latest), '')
            : null
          const hasSnapshot  = snapEntries.length > 0

          return (
            <section>
              {/* Collapsible header */}
              <button
                onClick={() => setSnapshotOpen((o) => !o)}
                className="section-header w-full text-left"
              >
                <span className="text-xl">📋</span>
                <div className="flex-1">
                  <h2 className="section-title">Last Cron Snapshot</h2>
                  <p className="text-xs text-[#9a7c55]">
                    {hasSnapshot
                      ? `Last cron run: ${timeAgo(snapTime)} · ${snapEntries.filter(v => v.inStock).length} of ${snapEntries.length} bottles in stock`
                      : 'Cron hasn\'t run yet — snapshot will appear after the next scheduled check'}
                  </p>
                </div>
                <span className="text-[#6b5030] text-xs shrink-0">{snapshotOpen ? '▲ Hide' : '▼ Show'}</span>
              </button>

              {snapshotOpen && (
                hasSnapshot ? (
                  <div className="card px-4 divide-y divide-[#2a1a08]">
                    {allTracked.map((bottle) => {
                      const snap = lastState[bottle.name]
                      if (!snap) return null
                      return (
                        <div key={bottle.name} className="flex items-center justify-between gap-3 py-3">
                          <div className="flex-1 min-w-0">
                            <a
                              href={bottle.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[#c9a87a] hover:text-[#e8943a] transition-colors truncate block"
                            >
                              {bottle.name}
                            </a>
                            <p className="text-xs text-[#6b5030]">
                              {bottle.distributor ?? 'Unknown distributor'}
                              {' · '}checked {timeAgo(snap.checkedAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {snap.price != null && <PriceTag price={snap.price} />}
                            <StatusBadge status={snap.inStock} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="card px-4 py-5 text-sm text-[#6b5030]">
                    <p className="mb-2">No snapshot yet. You can trigger the cron manually:</p>
                    <code className="block text-xs text-[#9a7c55] bg-[#0f0a05] rounded p-3 break-all">
                      curl -H &quot;Authorization: Bearer YOUR_CRON_SECRET&quot; https://whiskey-hunter.vercel.app/api/cron
                    </code>
                  </div>
                )
              )}
            </section>
          )
        })()}

        {/* ── Restock History ── */}
        {historyLoaded && (
          <section>
            <div className="section-header">
              <span className="text-xl">📦</span>
              <div>
                <h2 className="section-title">Restock History</h2>
                <p className="text-xs text-[#9a7c55]">
                  In/out-of-stock transitions detected by cron · checked 4× daily
                </p>
              </div>
            </div>

            {deliveryPattern && (
              <div className="mb-3 flex items-center gap-2 text-xs bg-[#1a0e05] rounded-lg px-4 py-2.5 border border-[#3d2b10]">
                <span>📅</span>
                <span className="text-[#9a7c55]">Delivery pattern detected:</span>
                <span className="text-[#c9a87a] font-semibold">{deliveryPattern}</span>
              </div>
            )}

            {historyEvents.length === 0 ? (
              <div className="card px-4 py-6 text-center text-sm text-[#6b5030]">
                No events recorded yet — history builds as the cron detects stock changes.
              </div>
            ) : (
              <div className="card px-4 divide-y divide-[#2a1a08]">
                {historyEvents.slice(0, 60).map((event, i) => {
                  const d = new Date(event.timestamp)
                  const isInStock = event.type === 'in_stock'
                  return (
                    <div key={i} className="flex items-center gap-3 py-3">
                      <span className="text-base shrink-0">{isInStock ? '📦' : '📉'}</span>
                      <div className="flex-1 min-w-0">
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#c9a87a] hover:text-[#e8943a] transition-colors truncate block"
                        >
                          {event.name}
                        </a>
                        <p className="text-xs text-[#6b5030]">
                          {isInStock ? 'Came in stock' : 'Went out of stock'}
                          {event.price != null ? ` · $${Number(event.price).toFixed(2)}` : ''}
                        </p>
                      </div>
                      <div className="text-xs text-[#6b5030] shrink-0 text-right leading-snug">
                        <div>
                          {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                        </div>
                        <div>{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Truck History ── */}
        {historyLoaded && (() => {
          const truckEvents = historyEvents.filter((e) => e.type === 'truck_detected')

          // Distributor badge colors
          const distColor = {
            'Breakthru Beverage': { bg: '#1a0e05', border: '#7c3a0a', text: '#e8943a' },
            "Southern Glazer's":  { bg: '#0d1a0d', border: '#2d5a2d', text: '#4ade80' },
            'RNDC':               { bg: '#0d0d1a', border: '#2d2d7c', text: '#818cf8' },
            'BC Merchants':       { bg: '#1a0d1a', border: '#5a2d7c', text: '#c084fc' },
          }
          const defaultColor = { bg: '#1a1208', border: '#3d2b10', text: '#9a7c55' }

          return (
            <section>
              <div className="section-header">
                <span className="text-xl">🚛</span>
                <div>
                  <h2 className="section-title">Truck History</h2>
                  <p className="text-xs text-[#9a7c55]">
                    Delivery activity inferred from canary bottle restocks · indicates when to check for allocated bottles
                  </p>
                </div>
              </div>

              {truckEvents.length === 0 ? (
                <div className="card px-4 py-6 text-center text-sm text-[#6b5030]">
                  No deliveries detected yet — truck events appear when tracked canary bottles restock.
                </div>
              ) : (
                <div className="space-y-3">
                  {truckEvents.slice(0, 20).map((event, i) => {
                    const d   = new Date(event.timestamp)
                    const col = distColor[event.distributor] ?? defaultColor
                    // checkFor may be string[] (old format) or {tier,names}[] (new format)
                    const flatCheckFor = (event.checkFor ?? []).flatMap((item) =>
                      typeof item === 'string' ? [item] : item.names
                    )
                    return (
                      <div key={i} className="card overflow-hidden">
                        {/* Distributor header */}
                        <div
                          className="px-4 py-2.5 flex items-center justify-between gap-2"
                          style={{ background: col.bg, borderBottom: `1px solid ${col.border}` }}
                        >
                          <span className="text-sm font-bold" style={{ color: col.text }}>
                            🚛 {event.distributor}
                          </span>
                          <span className="text-xs text-[#6b5030] text-right leading-snug shrink-0">
                            {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            {' · '}
                            {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Card body */}
                        <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Triggered by */}
                          <div>
                            <p className="text-xs text-[#6b5030] uppercase tracking-wide mb-1.5">Triggered by</p>
                            <ul className="space-y-0.5">
                              {(event.triggeredBy ?? []).map((name, j) => (
                                <li key={j} className="text-xs text-[#9a7c55]">· {name}</li>
                              ))}
                            </ul>
                          </div>
                          {/* Check for */}
                          <div>
                            <p className="text-xs text-[#6b5030] uppercase tracking-wide mb-1.5">Head in and ask about</p>
                            <ul className="space-y-0.5">
                              {flatCheckFor.slice(0, 8).map((name, j) => (
                                <li key={j} className="text-xs text-[#c9a87a]">· {name}</li>
                              ))}
                              {flatCheckFor.length > 8 && (
                                <li className="text-xs text-[#6b5030]">· +{flatCheckFor.length - 8} more</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })()}

        {/* ── Whiskey Hotline bottles ── */}
        <section>
          <div className="section-header">
            <span className="text-xl">🔒</span>
            <div>
              <h2 className="section-title">Whiskey Hotline Only</h2>
              <p className="text-xs text-[#9a7c55]">
                Hotline lottery bottles + anything not indexed in Algolia — cannot be API-tracked, check manually
              </p>
            </div>
          </div>
          <div className="card px-4 divide-y divide-[#2a1a08]">
            {hotlineBottles.map((bottle, i) => (
              <HotlineRow key={bottle.name ?? bottle.divider ?? i} bottle={bottle} />
            ))}
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#2a1a08] mt-16 py-6 text-center text-xs text-[#6b5030]">
        Binny&apos;s Orland Park · 15521 S. LaGrange Rd, Orland Park, IL 60462 · Cron runs 4× daily: 6 AM · 10 AM · 2 PM · 6 PM CST
      </footer>
    </div>
  )
}
