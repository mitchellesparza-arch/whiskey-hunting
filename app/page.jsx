'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { hotlineBottles } from '../lib/bottles.js'

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

function formatDate(iso) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  }
}

// Distributor brand colors
const DIST_COLOR = {
  'Breakthru Beverage': { bg: '#1a0e05', border: '#7c3a0a', text: '#e8943a', badge: '#2a1500' },
  "Southern Glazer's":  { bg: '#0d1a0d', border: '#2d5a2d', text: '#4ade80', badge: '#0f2010' },
  'RNDC':               { bg: '#0d0d1a', border: '#2d2d7c', text: '#818cf8', badge: '#10102a' },
  'BC Merchants':       { bg: '#1a0d1a', border: '#5a2d7c', text: '#c084fc', badge: '#1e0f26' },
}
const DEFAULT_COLOR = { bg: '#1a1208', border: '#3d2b10', text: '#9a7c55', badge: '#1f1508' }

function distColor(distributor) {
  return DIST_COLOR[distributor] ?? DEFAULT_COLOR
}

// ── Distributor Map builder ───────────────────────────────────────────────────
// Groups hotlineBottles by distributor, preserving tier dividers.

function buildDistributorMap() {
  const map = {}   // distributor → [{tier, name}]
  const order = [] // preserve first-seen distributor order
  let currentTier = null

  for (const b of hotlineBottles) {
    if (b.divider) { currentTier = b.divider; continue }
    if (!b.distributor) continue
    if (!map[b.distributor]) { map[b.distributor] = []; order.push(b.distributor) }
    map[b.distributor].push({ tier: currentTier, name: b.name })
  }

  return { map, order }
}

// ── Components ────────────────────────────────────────────────────────────────

function DistributorBadge({ distributor }) {
  const col = distColor(distributor)
  return (
    <span
      className="inline-block text-xs font-bold px-2 py-0.5 rounded"
      style={{ background: col.badge, color: col.text, border: `1px solid ${col.border}` }}
    >
      {distributor}
    </span>
  )
}

function DistributorMapColumn({ distributor, bottles }) {
  const col = distColor(distributor)

  // Group bottles by tier for display
  const tiers = []
  let curTier = null
  for (const b of bottles) {
    if (b.tier !== curTier) {
      tiers.push({ tier: b.tier, names: [] })
      curTier = b.tier
    }
    tiers[tiers.length - 1].names.push(b.name)
  }

  return (
    <div
      className="rounded-xl overflow-hidden flex-1 min-w-[200px]"
      style={{ background: col.bg, border: `1px solid ${col.border}` }}
    >
      {/* Column header */}
      <div
        className="px-4 py-3 font-bold text-sm"
        style={{ background: col.badge, color: col.text, borderBottom: `1px solid ${col.border}` }}
      >
        🚛 {distributor}
      </div>

      {/* Tier groups */}
      <div className="px-4 py-3 space-y-4">
        {tiers.map(({ tier, names }) => (
          <div key={tier}>
            <div className="text-xs font-semibold mb-1.5" style={{ color: col.text, opacity: 0.7 }}>
              {tier}
            </div>
            <ul className="space-y-1">
              {names.map(name => (
                <li key={name} className="text-xs text-[#9a7c55]">· {name}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function TruckCard({ event }) {
  const col          = distColor(event.distributor)
  const { date, time } = formatDate(event.timestamp)
  // Legacy events (pre-multi-store) have no storeName/storeCode — default to Orland Park
  const storeName    = event.storeName ?? event.storeCode ?? 'Orland Park'

  // checkFor may be {tier,names}[] (new) or string[] (legacy Redis entries)
  const flatCheckFor = (event.checkFor ?? []).flatMap(item =>
    typeof item === 'string' ? [item] : item.names
  )

  return (
    <div className="card overflow-hidden">
      {/* Card header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between gap-2"
        style={{ background: col.badge, borderBottom: `1px solid ${col.border}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold" style={{ color: col.text }}>
            🚛 {event.distributor}
          </span>
          <span className="text-xs text-[#9a7c55] truncate">
            — Binny's {storeName}
          </span>
        </div>
        <div className="text-xs text-[#6b5030] text-right leading-snug shrink-0">
          <div>{date}</div>
          <div>{time}</div>
        </div>
      </div>

      {/* Card body */}
      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <p className="text-xs text-[#6b5030] uppercase tracking-wide mb-1.5">Allocated bottles from this distributor</p>
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
}

// ── Per-store summary ─────────────────────────────────────────────────────────
// Shows the most recent truck event per distributor for each store.
// Clicking a card filters the Truck History below to that store.

function StoreActivityCard({ storeName, events, isSelected, onSelect }) {
  // Latest event per distributor for this store
  const byDist = {}
  for (const e of events) {
    if (!byDist[e.distributor]) byDist[e.distributor] = e
  }

  return (
    <button
      onClick={onSelect}
      className="card p-4 text-left w-full transition-all"
      style={isSelected ? { borderColor: '#e8943a', boxShadow: '0 0 0 1px #e8943a' } : {}}
    >
      <p className="text-sm font-bold text-[#f5e6cc] mb-3">
        📍 Binny's {storeName}
        {isSelected && <span className="ml-2 text-xs font-normal text-[#e8943a]">● filtered</span>}
      </p>
      <div className="space-y-2">
        {Object.entries(byDist).map(([dist, event]) => {
          const col = distColor(dist)
          return (
            <div key={dist} className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold" style={{ color: col.text }}>
                {dist}
              </span>
              <span className="text-xs text-[#9a7c55]">
                {timeAgo(event.timestamp)}
              </span>
            </div>
          )
        })}
        {!Object.keys(byDist).length && (
          <p className="text-xs text-[#6b5030]">No trucks detected yet</p>
        )}
      </div>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const { data: session } = useSession()

  const [truckEvents,    setTruckEvents]    = useState([])
  const [lastCheckedAt,  setLastCheckedAt]  = useState(null)
  const [historyLoaded,  setHistoryLoaded]  = useState(false)
  const [refreshing,     setRefreshing]     = useState(false)
  const [selectedStore,  setSelectedStore]  = useState(null)  // null = all stores

  const loadHistory = useCallback(async () => {
    try {
      const res  = await fetch('/api/history')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setTruckEvents(data.events ?? [])
      setLastCheckedAt(data.lastCheckedAt ?? null)
    } catch {
      setTruckEvents([])
    } finally {
      setHistoryLoaded(true)
    }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await loadHistory()
    setRefreshing(false)
  }, [loadHistory])

  // Distributor map (static, derived from hotlineBottles)
  const { map: distMap, order: distOrder } = buildDistributorMap()

  // Group truck events by store for the activity summary.
  // Legacy Redis events (pre-multi-store) have no storeName/storeCode — they
  // were always from Orland Park, so default to that.
  const storeMap = {}
  for (const e of truckEvents) {
    const key = e.storeName ?? e.storeCode ?? 'Orland Park'
    if (!storeMap[key]) storeMap[key] = []
    storeMap[key].push(e)
  }
  const storeNames = Object.keys(storeMap).sort()

  const lastEvent     = truckEvents[0]
  const filteredEvents = selectedStore
    ? truckEvents.filter(e => (e.storeName ?? e.storeCode ?? 'Orland Park') === selectedStore)
    : truckEvents

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>

      {/* ── Header ── */}
      <header className="border-b border-[#3d2b10] sticky top-0 z-10 backdrop-blur-sm"
              style={{ background: 'rgba(15,10,5,0.92)' }}>
        {/* Main header row */}
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🥃</span>
            <div>
              <h1 className="font-bold text-base leading-tight text-[#f5e6cc]">Whiskey Hunter</h1>
              <p className="text-xs text-[#9a7c55]">Chicagoland Binny's · Truck Tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right leading-snug">
              {lastCheckedAt && (
                <p className="text-xs text-[#9a7c55]">Checked {timeAgo(lastCheckedAt)}</p>
              )}
              {lastEvent && (
                <p className="text-xs text-[#6b5030]">Last truck {timeAgo(lastEvent.timestamp)}</p>
              )}
            </div>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="btn-primary"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            {session?.user && (
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                title={session.user.email}
                className="text-xs text-[#6b5030] hover:text-[#9a7c55] transition-colors border border-[#3d2b10] rounded-lg px-2.5 py-1.5"
              >
                Sign out
              </button>
            )}
          </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">

        {/* ── Store Activity Summary ── */}
        {historyLoaded && storeNames.length > 0 && (
          <section>
            <div className="section-header">
              <span className="text-xl">📍</span>
              <div>
                <h2 className="section-title">Store Activity</h2>
                <p className="text-xs text-[#9a7c55]">
                  Latest truck detection per distributor at each location
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {storeNames.map(name => (
                <StoreActivityCard
                  key={name}
                  storeName={name}
                  events={storeMap[name]}
                  isSelected={selectedStore === name}
                  onSelect={() => setSelectedStore(prev => prev === name ? null : name)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Truck History ── */}
        <section>
          <div className="section-header">
            <span className="text-xl">🚛</span>
            <div>
              <h2 className="section-title">Truck History</h2>
              <p className="text-xs text-[#9a7c55]">
                {selectedStore
                  ? `Binny's ${selectedStore} · ${filteredEvents.length} event${filteredEvents.length !== 1 ? 's' : ''}`
                  : `All Chicagoland locations · ${truckEvents.length} event${truckEvents.length !== 1 ? 's' : ''} · checked 6× daily`}
              </p>
            </div>
          </div>

          {/* Store filter bar */}
          {historyLoaded && storeNames.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <select
                value={selectedStore ?? ''}
                onChange={e => setSelectedStore(e.target.value || null)}
                className="flex-1 sm:flex-none sm:w-64 bg-[#0f0a05] border border-[#3d2b10] rounded-lg px-3 py-2 text-sm text-[#f5e6cc] focus:outline-none focus:border-[#e8943a] appearance-none cursor-pointer"
              >
                <option value="">All Stores</option>
                {storeNames.map(name => (
                  <option key={name} value={name}>
                    {name} · {timeAgo(storeMap[name][0]?.timestamp)}
                  </option>
                ))}
              </select>
              {selectedStore && (
                <button
                  onClick={() => setSelectedStore(null)}
                  className="text-xs text-[#9a7c55] hover:text-[#f5e6cc] border border-[#3d2b10] rounded-lg px-3 py-2 transition-colors"
                >
                  ✕ Clear
                </button>
              )}
            </div>
          )}

          {!historyLoaded ? (
            <div className="card px-4 py-6 text-center text-sm text-[#6b5030]">
              Loading…
            </div>
          ) : truckEvents.length === 0 ? (
            /* ── Empty state hero + how-it-works ── */
            <div>
              <div style={{
                background:   'linear-gradient(160deg, #1e1004 0%, #0f0a05 60%)',
                padding:      '32px 16px 28px',
                borderBottom: '1px solid #2a1c08',
                textAlign:    'center',
                borderRadius: 12,
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🚛</div>
                <div style={{ fontWeight: 800, fontSize: 22, color: '#f5e6cc', letterSpacing: '-0.02em', marginBottom: 8 }}>
                  No truck deliveries detected yet
                </div>
                <div style={{ fontSize: 14, color: '#9a7c55', lineHeight: 1.6, marginBottom: 20, maxWidth: 520, margin: '0 auto 20px' }}>
                  The tracker checks Binny's inventory 6× daily — at 7, 9, 11 AM and 1, 3, 5 PM CDT.
                  When a delivery truck is detected at any Chicagoland location, it shows up here.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {['Next check: coming soon', 'All 20+ Binny\'s stores monitored', '6× daily cadence'].map(label => (
                    <span key={label} style={{
                      fontSize: 12, color: '#9a7c55',
                      background: '#1a1008', border: '1px solid #3d2b10',
                      borderRadius: 999, padding: '4px 12px',
                    }}>{label}</span>
                  ))}
                </div>
              </div>

              {/* How it works — 3 cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                {[
                  { step: '1', label: 'Canary scan',   desc: 'Every 6h, the tracker checks if high-volume bottles (Old Forester, Benchmark, etc.) have restocked at each store.' },
                  { step: '2', label: 'Truck detected', desc: 'A sudden restock of canary bottles means a delivery truck likely just visited. We flag it and log which distributor.' },
                  { step: '3', label: 'Check the map', desc: 'Use the Distributor Map below to know which allocated bottles may be on that truck — then head to the store.' },
                ].map(s => (
                  <div key={s.step} className="card" style={{ padding: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 28, color: '#e8943a', opacity: 0.3, marginBottom: 4 }}>{s.step}</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#f5e6cc', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: '#9a7c55', lineHeight: 1.6 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="card px-4 py-6 text-center text-sm text-[#6b5030]">
              No truck events recorded for Binny&apos;s {selectedStore} yet.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.slice(0, 50).map((event, i) => (
                <TruckCard key={i} event={event} />
              ))}
              {filteredEvents.length > 50 && (
                <p className="text-center text-xs text-[#6b5030] py-2">
                  Showing 50 of {filteredEvents.length} events
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Distributor Map ── */}
        <section>
          <div className="section-header">
            <span className="text-xl">📋</span>
            <div>
              <h2 className="section-title">Distributor Map</h2>
              <p className="text-xs text-[#9a7c55]">
                Which truck brings which allocated bottles — use as a reference when a delivery is detected
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {distOrder.map(dist => (
              <DistributorMapColumn
                key={dist}
                distributor={dist}
                bottles={distMap[dist]}
              />
            ))}
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#2a1a08] mt-16 py-6 text-center text-xs text-[#6b5030]">
        Whiskey Hunter · Chicagoland Binny's Beverage Depot · Checked 6× daily: 7 AM · 9 AM · 11 AM · 1 PM · 3 PM · 5 PM CDT
      </footer>

    </div>
  )
}
