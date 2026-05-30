'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Truck, ChevronDown, ChevronUp } from 'lucide-react'
import AppHeader from '../components/AppHeader.jsx'
import CostcoTracker from '../components/CostcoTracker.jsx'
import SectionHeader from '../components/ui/SectionHeader.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import ProGate from '../components/ProGate.jsx'
import { hotlineBottles } from '../../lib/bottles.js'
import { isPro } from '../../lib/tier.js'

const TAB_LS_KEY = 'wh:tracker-tab'

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
  'Breakthru Beverage': {
    bg:     'rgba(217,126,44,0.06)',
    border: 'rgba(217,126,44,0.25)',
    text:   'var(--dist-breakthru)',
    badge:  'rgba(217,126,44,0.10)',
  },
  "Southern Glazer's": {
    bg:     'rgba(93,211,158,0.06)',
    border: 'rgba(93,211,158,0.25)',
    text:   'var(--dist-southern)',
    badge:  'rgba(93,211,158,0.10)',
  },
  'RNDC': {
    bg:     'rgba(143,181,255,0.06)',
    border: 'rgba(143,181,255,0.25)',
    text:   'var(--dist-rndc)',
    badge:  'rgba(143,181,255,0.10)',
  },
  'BC Merchants': {
    bg:     'rgba(185,164,255,0.06)',
    border: 'rgba(185,164,255,0.25)',
    text:   'var(--dist-bcm)',
    badge:  'rgba(185,164,255,0.10)',
  },
}
const DEFAULT_COLOR = { bg: 'var(--bg-elev-2)', border: 'var(--hairline-2)', text: 'var(--text-muted)', badge: 'var(--bg-elev-3)' }

function distColor(distributor) {
  return DIST_COLOR[distributor] ?? DEFAULT_COLOR
}

// RGB base colors for heatmap cells (matches distributor brand colors above)
const DIST_RGB = {
  'Breakthru Beverage': [217, 126,  44],
  "Southern Glazer's":  [ 93, 211, 158],
  'RNDC':               [143, 181, 255],
  'BC Merchants':       [185, 164, 255],
}
const DEFAULT_RGB = [154, 124, 85]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function weekStart(date) {
  const d = new Date(date)
  const dow = d.getDay() // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow // shift to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function calcStreak(evts) {
  if (!evts.length) return 0
  const weekSet = new Set(evts.map(e => weekStart(new Date(e.timestamp))))
  let cursor = weekStart(new Date())
  // If no delivery yet this week, start checking from last week
  if (!weekSet.has(cursor)) cursor -= WEEK_MS
  let streak = 0
  while (weekSet.has(cursor) && streak < 52) { streak++; cursor -= WEEK_MS }
  return streak
}

function computePatterns(events, storeFilter) {
  const evts = storeFilter
    ? events.filter(e => (e.storeName ?? e.storeCode ?? 'Orland Park') === storeFilter)
    : events

  const byDist = {}
  for (const e of evts) {
    const d = e.distributor ?? 'Unknown'
    if (!byDist[d]) byDist[d] = []
    byDist[d].push(e)
  }

  const result = {}
  for (const [dist, de] of Object.entries(byDist)) {
    const dayCounts = [0, 0, 0, 0, 0, 0, 0] // Mon–Sun
    for (const e of de) {
      const dow = new Date(e.timestamp).getDay() // 0=Sun
      dayCounts[dow === 0 ? 6 : dow - 1]++
    }
    const sorted = [...de].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    result[dist] = {
      dayCounts,
      lastTs:  sorted[0]?.timestamp ?? null,
      streak:  calcStreak(de),
      total:   de.length,
    }
  }
  return result
}

// ── Distributor Map builder ───────────────────────────────────────────────────

function buildDistributorMap() {
  const map = {}
  const order = []
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

function DistributorMapColumn({ distributor, bottles }) {
  const col = distColor(distributor)

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
      <div
        style={{
          background:   col.badge,
          color:        col.text,
          borderBottom: `1px solid ${col.border}`,
          padding:      'var(--sp-3) var(--sp-4)',
          fontWeight:   700,
          fontSize:     'var(--fs-body)',
          display:      'flex',
          alignItems:   'center',
          gap:          6,
        }}
      >
        <Truck size={14} color={col.text} />
        {distributor}
      </div>
      <div style={{ padding: 'var(--sp-3) var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {tiers.map(({ tier, names }) => (
          <div key={tier}>
            <div className="text-xs font-semibold mb-1.5" style={{ color: col.text, opacity: 0.7 }}>
              {tier}
            </div>
            <ul className="space-y-1">
              {names.map(name => (
                <li key={name} style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)' }}>· {name}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function TruckCard({ event }) {
  const col            = distColor(event.distributor)
  const { date, time } = formatDate(event.timestamp)
  const storeName      = event.storeName ?? event.storeCode ?? 'Orland Park'

  const flatCheckFor = (event.checkFor ?? []).flatMap(item =>
    typeof item === 'string' ? [item] : item.names
  )

  return (
    <div className="card overflow-hidden">
      <div
        className="px-4 py-2.5 flex items-center justify-between gap-2"
        style={{ background: col.badge, borderBottom: `1px solid ${col.border}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: col.text }}>
            <Truck size={13} /> {event.distributor}
          </span>
          <span className="truncate" style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)' }}>
            — Binny&apos;s {storeName}
          </span>
        </div>
        <div className="text-right leading-snug shrink-0" style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>
          <div>{date}</div>
          <div>{time}</div>
        </div>
      </div>

      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="uppercase tracking-wide mb-1.5" style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>Triggered by</p>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(event.triggeredBy ?? []).map((name, j) => (
              <li key={j} style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)' }}>· {name}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="uppercase tracking-wide mb-1.5" style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>Allocated bottles from this distributor</p>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {flatCheckFor.slice(0, 8).map((name, j) => (
              <li key={j} style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-2)' }}>· {name}</li>
            ))}
            {flatCheckFor.length > 8 && (
              <li style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>· +{flatCheckFor.length - 8} more</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}

function StoreActivityCard({ storeName, events, isSelected, onSelect, isFavorite, onFavoriteToggle, canAddFavorite }) {
  const byDist = {}
  for (const e of events) {
    if (!byDist[e.distributor]) byDist[e.distributor] = e
  }

  return (
    <div
      className="card p-4 text-left w-full transition-all"
      style={isSelected ? { borderColor: 'var(--copper-500)', boxShadow: 'var(--shadow-glow)' } : {}}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <button onClick={onSelect} className="text-left flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            📍 Binny&apos;s {storeName}
            {isSelected && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--copper-400)' }}>● filtered</span>}
          </p>
        </button>
        <button
          onClick={e => { e.stopPropagation(); onFavoriteToggle() }}
          title={isFavorite ? 'Remove from favorites' : canAddFavorite ? 'Add to favorites' : 'Max 3 favorites'}
          style={{
            background: 'none',
            border:     'none',
            fontSize:   16,
            cursor:     isFavorite || canAddFavorite ? 'pointer' : 'default',
            opacity:    !isFavorite && !canAddFavorite ? 0.3 : 1,
            padding:    '0 2px',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {isFavorite ? '⭐' : '☆'}
        </button>
      </div>
      <button onClick={onSelect} className="text-left w-full">
        <div className="space-y-2">
          {Object.entries(byDist).map(([dist, event]) => {
            const col = distColor(dist)
            return (
              <div key={dist} className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold" style={{ color: col.text }}>{dist}</span>
                <span style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)' }}>{timeAgo(event.timestamp)}</span>
              </div>
            )
          })}
          {!Object.keys(byDist).length && (
            <p style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>No trucks detected yet</p>
          )}
        </div>
      </button>
    </div>
  )
}

// ── Delivery Patterns heatmap ─────────────────────────────────────────────────

function DeliveryPatterns({ events, selectedStore }) {
  const patterns = useMemo(() => computePatterns(events, selectedStore), [events, selectedStore])
  const dists = Object.keys(patterns)
  if (!dists.length) return null

  return (
    <section>
      <SectionHeader overline="Delivery Patterns" title="" />
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-meta)', marginTop: 'var(--sp-1)', marginBottom: 'var(--sp-4)' }}>
        Day-of-week frequency across all recorded deliveries
        {selectedStore ? ` · Binny's ${selectedStore}` : ' · all stores'}
      </p>
      <div className="space-y-3">
        {dists.map(dist => {
          const col  = distColor(dist)
          const rgb  = DIST_RGB[dist] ?? DEFAULT_RGB
          const { dayCounts, lastTs, streak, total } = patterns[dist]
          const maxCount = Math.max(...dayCounts, 1)
          const topDay   = DAYS[dayCounts.indexOf(Math.max(...dayCounts))]

          return (
            <div key={dist} className="card px-4 py-3">
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: col.text, fontWeight: 700, fontSize: 'var(--fs-body)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Truck size={13} color={col.text} strokeWidth={2.5} />
                  {dist}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {streak >= 2 && (
                    <span style={{
                      color: streak >= 8 ? 'var(--green)' : streak >= 4 ? 'var(--amber)' : 'var(--text-muted)',
                      fontSize: 'var(--fs-overline)', fontWeight: 700,
                    }}>
                      🔥 {streak}wk
                    </span>
                  )}
                  <span style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>
                    {lastTs ? timeAgo(lastTs) : '—'}
                  </span>
                </div>
              </div>

              {/* Day heatmap */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
                {DAYS.map((day, i) => {
                  const count     = dayCounts[i]
                  const intensity = count / maxCount
                  const alpha     = count > 0 ? 0.15 + intensity * 0.75 : 0.06
                  return (
                    <div key={day} style={{ textAlign: 'center' }}>
                      <div
                        title={`${day}: ${count} delivery${count !== 1 ? 's' : ''}`}
                        style={{
                          height:       32,
                          borderRadius: 6,
                          background:   `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`,
                          border:       count > 0
                            ? `1px solid rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.min(alpha + 0.2, 1)})`
                            : '1px solid var(--hairline)',
                          marginBottom: 4,
                          display:      'flex',
                          alignItems:   'center',
                          justifyContent: 'center',
                          fontSize:     '0.65rem',
                          fontWeight:   count > 0 ? 700 : 400,
                          color:        count > 0
                            ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.min(0.6 + intensity * 0.4, 1)})`
                            : 'var(--text-dim)',
                          transition:   'background 0.2s',
                        }}
                      >
                        {count > 0 ? count : ''}
                      </div>
                      <span style={{
                        fontSize:   '0.6rem',
                        fontWeight: count === Math.max(...dayCounts) && count > 0 ? 700 : 400,
                        color:      count === Math.max(...dayCounts) && count > 0
                          ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.9)`
                          : 'var(--text-dim)',
                      }}>
                        {day.slice(0, 2)}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Footer meta */}
              <div style={{ marginTop: 10, display: 'flex', gap: 12, fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>
                <span>{total} delivery{total !== 1 ? 's' : ''} recorded</span>
                {Math.max(...dayCounts) > 0 && (
                  <span style={{ color: col.text, opacity: 0.8 }}>
                    Most common: {topDay}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TrackerPage() {
  const { data: session, status } = useSession()

  const [tab,            setTab]            = useState('binnys')
  const [truckEvents,    setTruckEvents]    = useState([])
  const [lastCheckedAt,  setLastCheckedAt]  = useState(null)
  const [historyLoaded,  setHistoryLoaded]  = useState(false)
  const [refreshing,     setRefreshing]     = useState(false)
  const [selectedStore,  setSelectedStore]  = useState(null)
  const [showAllEvents,  setShowAllEvents]  = useState(false)
  const [favoriteStores, setFavoriteStores] = useState(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('wh:fav-stores') ?? '[]') } catch { return [] }
  })
  const [storesCollapsed, setStoresCollapsed] = useState(false)

  // Auto-collapse store grid when the 3rd favorite is selected
  useEffect(() => {
    if (favoriteStores.length === 3) setStoresCollapsed(true)
  }, [favoriteStores.length])

  // Initial tab: ?tab=costco wins, then localStorage, then default 'binnys'
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('tab')
    if (fromQuery === 'costco' || fromQuery === 'binnys') {
      setTab(fromQuery)
      return
    }
    const stored = localStorage.getItem(TAB_LS_KEY)
    if (stored === 'costco' || stored === 'binnys') setTab(stored)
  }, [])

  function switchTab(next) {
    setTab(next)
    try { localStorage.setItem(TAB_LS_KEY, next) } catch {}
  }

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

  const { map: distMap, order: distOrder } = buildDistributorMap()

  const storeMap = {}
  for (const e of truckEvents) {
    const key = e.storeName ?? e.storeCode ?? 'Orland Park'
    if (!storeMap[key]) storeMap[key] = []
    storeMap[key].push(e)
  }

  // Sort: favorites first, then alphabetical
  const favSet    = new Set(favoriteStores)
  const storeNames = Object.keys(storeMap).sort((a, b) => {
    const aFav = favSet.has(a) ? 0 : 1
    const bFav = favSet.has(b) ? 0 : 1
    if (aFav !== bFav) return aFav - bFav
    return a.localeCompare(b)
  })

  function toggleFavorite(name) {
    setFavoriteStores(prev => {
      const next = prev.includes(name)
        ? prev.filter(s => s !== name)
        : prev.length < 3 ? [...prev, name] : prev
      try { localStorage.setItem('wh:fav-stores', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const visibleStoreNames = (favoriteStores.length === 3 && storesCollapsed)
    ? storeNames.filter(n => favSet.has(n))
    : storeNames

  const lastEvent      = truckEvents[0]
  const filteredEvents = selectedStore
    ? truckEvents.filter(e => (e.storeName ?? e.storeCode ?? 'Orland Park') === selectedStore)
    : truckEvents

  // Reset collapse when filter changes
  useEffect(() => { setShowAllEvents(false) }, [selectedStore])

  // Gate: tracker is Pro-only (must be after all hooks)
  if (status !== 'loading' && session && !isPro(session.user?.tier)) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <AppHeader sub="Tracker" />
        <ProGate
          feature="The Tracker"
          icon="🚛"
          bullets={[
            'Real-time distributor truck arrivals at Chicagoland Binny\'s',
            'Know exactly which stores to hit for allocated bottles',
            'Live Costco bourbon alerts across Illinois',
            'Checked every hour, around the clock',
          ]}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>

      <AppHeader
        sub={tab === 'costco'
          ? 'Illinois Costco · Bourbon Alerts'
          : "Chicagoland Binny's · Truck Tracker"}
      />

      <main className="max-w-6xl mx-auto px-4 pt-8 space-y-10" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>

        {/* Source toggle */}
        <div
          role="tablist"
          aria-label="Tracker source"
          style={{
            display:      'inline-flex',
            background:   'var(--bg-elev-2)',
            border:       '1px solid var(--hairline-2)',
            borderRadius: 999,
            padding:      4,
            gap:          2,
          }}
        >
          {[
            { key: 'binnys', label: "🚛 Binny's" },
            { key: 'costco', label: '🥃 Costco'  },
          ].map(({ key, label }) => {
            const active = tab === key
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => switchTab(key)}
                style={{
                  padding:      '7px 18px',
                  borderRadius: 999,
                  border:       'none',
                  background:   active ? 'var(--copper-500)' : 'transparent',
                  color:        active ? 'var(--text-inverse)' : 'var(--text-muted)',
                  fontWeight:   active ? 800 : 600,
                  fontSize:     13,
                  cursor:       'pointer',
                  transition:   'all 0.15s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {tab === 'costco' && <CostcoTracker />}

        {tab === 'binnys' && <>
        {/* Store Activity Summary */}
        {historyLoaded && storeNames.length > 0 && (
          <section>
            <div className="section-header">
              <span className="text-xl">📍</span>
              <div style={{ flex: 1 }}>
                <h2 className="section-title">Store Activity</h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {favoriteStores.length === 3 && storesCollapsed
                    ? `Showing your ${favoriteStores.length} favorite stores · tap ☆ to manage`
                    : 'Latest truck detection per distributor at each location · tap ☆ to save up to 3'}
                </p>
              </div>
              {favoriteStores.length === 3 && (
                <button
                  onClick={() => setStoresCollapsed(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 'var(--fs-meta)', fontWeight: 600,
                    color: 'var(--text-muted)', background: 'none',
                    border: '1px solid var(--hairline-2)', borderRadius: 'var(--r-sm)',
                    padding: '5px 10px', cursor: 'pointer',
                  }}
                >
                  {storesCollapsed
                    ? <><ChevronDown size={14} strokeWidth={2} /> Show All</>
                    : <><ChevronUp size={14} strokeWidth={2} /> Favorites Only</>}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleStoreNames.map(name => (
                <StoreActivityCard
                  key={name}
                  storeName={name}
                  events={storeMap[name]}
                  isSelected={selectedStore === name}
                  onSelect={() => setSelectedStore(prev => prev === name ? null : name)}
                  isFavorite={favSet.has(name)}
                  onFavoriteToggle={() => toggleFavorite(name)}
                  canAddFavorite={favoriteStores.length < 3}
                />
              ))}
            </div>
          </section>
        )}

        {/* Delivery Patterns */}
        {historyLoaded && truckEvents.length > 0 && (
          <DeliveryPatterns events={truckEvents} selectedStore={selectedStore} />
        )}

        {/* Truck History */}
        <section>
          <SectionHeader overline="Truck History" title="" />
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-meta)', marginTop: 'var(--sp-1)', marginBottom: 'var(--sp-3)' }}>
            {selectedStore
              ? `Binny's ${selectedStore} · ${filteredEvents.length} event${filteredEvents.length !== 1 ? 's' : ''}`
              : `All Chicagoland locations · ${truckEvents.length} event${truckEvents.length !== 1 ? 's' : ''} · checked hourly`}
          </p>

          {historyLoaded && storeNames.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <select
                value={selectedStore ?? ''}
                onChange={e => { setSelectedStore(e.target.value || null); setShowAllEvents(false) }}
                style={{
                  background:  'var(--bg-base)',
                  border:      '1px solid var(--hairline-2)',
                  borderRadius: 'var(--r-md)',
                  padding:     'var(--sp-2) var(--sp-3)',
                  fontSize:    'var(--fs-body)',
                  color:       'var(--text-primary)',
                  cursor:      'pointer',
                  appearance:  'none',
                  outline:     'none',
                }}
                className="flex-1 sm:flex-none sm:w-64"
              >
                <option value="">All Stores</option>
                {storeNames.map(name => (
                  <option key={name} value={name}>
                    {favSet.has(name) ? '⭐ ' : ''}{name} · {timeAgo(storeMap[name][0]?.timestamp)}
                  </option>
                ))}
              </select>
              {selectedStore && (
                <button
                  onClick={() => setSelectedStore(null)}
                  style={{
                    fontSize:     'var(--fs-meta)',
                    color:        'var(--text-muted)',
                    border:       '1px solid var(--hairline-2)',
                    borderRadius: 'var(--r-md)',
                    padding:      'var(--sp-2) var(--sp-3)',
                    background:   'none',
                    cursor:       'pointer',
                  }}
                >
                  ✕ Clear
                </button>
              )}
            </div>
          )}

          {!historyLoaded ? (
            <div className="card px-4 py-6 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
              Loading…
            </div>
          ) : truckEvents.length === 0 ? (
            /* Empty state */
            <div>
              <EmptyState
                icon="Truck"
                title="No truck deliveries detected yet"
                body="Checked every hour. When a delivery truck is detected at any Chicagoland location, it shows up here."
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 16 }}>
                {[
                  { step: '1', label: 'Canary scan',    desc: 'Every hour, the tracker checks if high-volume bottles (Old Forester, Benchmark, etc.) have restocked at each store.' },
                  { step: '2', label: 'Truck detected', desc: 'A sudden restock of canary bottles means a delivery truck likely just visited. We flag it and log which distributor.' },
                  { step: '3', label: 'Check the map',  desc: 'Use the Distributor Map below to know which allocated bottles may be on that truck — then head to the store.' },
                ].map(s => (
                  <div key={s.step} className="card" style={{ padding: 'var(--sp-4)' }}>
                    <div style={{ fontWeight: 800, fontSize: 28, color: 'var(--copper-500)', opacity: 0.3, marginBottom: 4 }}>{s.step}</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="card px-4 py-6 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
              No truck events recorded for Binny&apos;s {selectedStore} yet.
            </div>
          ) : (
            <div className="space-y-3">
              {(showAllEvents ? filteredEvents : filteredEvents.slice(0, 10)).map((event, i) => (
                <TruckCard key={i} event={event} />
              ))}
              {filteredEvents.length > 10 && (
                <button
                  onClick={() => setShowAllEvents(v => !v)}
                  className="w-full text-center py-3 rounded-lg transition-colors"
                  style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', background: 'var(--bg-elev-3)', border: '1px solid var(--hairline-2)', cursor: 'pointer' }}
                >
                  {showAllEvents
                    ? '▲ Show less'
                    : `▼ Show ${filteredEvents.length - 10} more events`}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Distributor Map */}
        <section>
          <SectionHeader overline="Distributor Map" title="" />
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-meta)', marginTop: 'var(--sp-1)', marginBottom: 'var(--sp-3)' }}>
            Which truck brings which allocated bottles — reference when a delivery is detected
          </p>
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
        </>}

      </main>

      <footer
        className="mt-16 py-6 text-center"
        style={{ borderTop: '1px solid', borderColor: 'var(--hairline)', fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}
      >
        {tab === 'costco'
          ? 'Tater Tracker · Live Costco alerts across Illinois'
          : 'Tater Tracker · Checked every hour'}
      </footer>

    </div>
  )
}
