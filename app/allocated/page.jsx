'use client'
import { useSession }       from 'next-auth/react'
import { useRouter }        from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Search, X, Plus, Check, Filter } from 'lucide-react'
import AppHeader            from '../components/AppHeader.jsx'

// ─── Tier config ─────────────────────────────────────────────────────────────

const TIERS = [
  { id: 'all',    label: 'All'     },
  { id: 'unicorn',label: '🦄 Unicorn' },
  { id: 'tier1',  label: '🔴 Tier 1'  },
  { id: 'tier2',  label: '🟠 Tier 2'  },
  { id: 'watch',  label: '⬛ Watch'   },
]

const TIER_KEY = {
  '🦄 Unicorn Tier':                     'unicorn',
  '🔴 Tier 1 — Highly Allocated':        'tier1',
  '🟠 Tier 2 — Allocated':               'tier2',
  '⬛ Worth Watching — In-Store Allocation': 'watch',
}

const TIER_LABEL = {
  unicorn: { short: 'Unicorn',  color: 'var(--violet)',   bg: 'rgba(139,92,246,0.10)',   border: 'rgba(139,92,246,0.25)' },
  tier1:   { short: 'Tier 1',   color: 'var(--red)',      bg: 'rgba(248,113,113,0.10)',  border: 'rgba(248,113,113,0.25)' },
  tier2:   { short: 'Tier 2',   color: 'var(--amber)',    bg: 'rgba(217,126,44,0.10)',   border: 'rgba(217,126,44,0.25)' },
  watch:   { short: 'Watch',    color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)' },
}

const DIST_COLOR = {
  'Breakthru Beverage': { color: 'var(--copper-400)',    bg: 'rgba(217,126,44,0.08)'  },
  "Southern Glazer's":  { color: 'var(--dist-southern)', bg: 'rgba(93,211,158,0.08)'  },
  'RNDC':               { color: 'var(--violet)',         bg: 'rgba(139,92,246,0.08)'  },
  'BC Merchants':       { color: '#a78bfa',               bg: 'rgba(167,139,250,0.08)' },
}

// ─── BottleCard ───────────────────────────────────────────────────────────────

function BottleCard({ bottle, watched, onToggleWatch, watchPending }) {
  const tierCfg = TIER_LABEL[bottle.tierKey] ?? TIER_LABEL.watch
  const distCfg = DIST_COLOR[bottle.distributor] ?? { color: 'var(--text-dim)', bg: 'rgba(255,255,255,0.04)' }
  const hasRetailerHit = bottle.retailerHits?.length > 0

  return (
    <div
      style={{
        background:   hasRetailerHit ? 'rgba(93,211,158,0.04)' : 'var(--bg-elev-1)',
        border:       `1px solid ${hasRetailerHit ? 'rgba(93,211,158,0.25)' : 'var(--hairline)'}`,
        borderRadius: 'var(--r-md)',
        padding:      'var(--sp-3) var(--sp-4)',
        display:      'flex',
        gap:          'var(--sp-3)',
        alignItems:   'flex-start',
        transition:   'border-color 0.15s',
      }}
    >
      {/* Left: text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name */}
        <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: 6 }}>
          {bottle.name}
        </div>

        {/* Badges row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: hasRetailerHit ? 8 : 0 }}>
          {/* Tier badge */}
          <span style={{
            fontSize:     'var(--fs-overline)',
            fontWeight:   700,
            color:        tierCfg.color,
            background:   tierCfg.bg,
            border:       `1px solid ${tierCfg.border}`,
            borderRadius: 'var(--r-sm)',
            padding:      '2px 7px',
            lineHeight:   1.6,
          }}>
            {tierCfg.short}
          </span>

          {/* Distributor badge */}
          {bottle.distributor && (
            <span style={{
              fontSize:     'var(--fs-overline)',
              fontWeight:   600,
              color:        distCfg.color,
              background:   distCfg.bg,
              borderRadius: 'var(--r-sm)',
              padding:      '2px 7px',
              lineHeight:   1.6,
            }}>
              {bottle.distributor.replace('Beverage', 'Bev.').replace(" Glazer's", ' G.')}
            </span>
          )}
        </div>

        {/* Live retailer hits */}
        {bottle.retailerHits?.map((hit, i) => (
          <a
            key={i}
            href={hit.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            6,
              marginTop:      i === 0 ? 0 : 4,
              padding:        '4px 8px',
              background:     'rgba(93,211,158,0.08)',
              border:         '1px solid rgba(93,211,158,0.2)',
              borderRadius:   'var(--r-sm)',
              textDecoration: 'none',
              width:          'fit-content',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>● IN STOCK</span>
            <span style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {hit.retailer}
            </span>
            {hit.price && (
              <span style={{ fontSize: 'var(--fs-overline)', color: 'var(--copper-400)', fontWeight: 700 }}>
                ${hit.price.toFixed(2)}
              </span>
            )}
          </a>
        ))}
      </div>

      {/* Right: watchlist toggle */}
      <button
        onClick={() => onToggleWatch(bottle.name)}
        disabled={watchPending === bottle.name}
        title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
        style={{
          flexShrink:   0,
          width:        32,
          height:       32,
          borderRadius: 'var(--r-full)',
          border:       watched
            ? '1px solid rgba(93,211,158,0.4)'
            : '1px solid var(--hairline-2)',
          background:   watched ? 'var(--green-bg)' : 'var(--bg-elev-3)',
          color:        watched ? 'var(--green)'    : 'var(--text-muted)',
          cursor:       watchPending === bottle.name ? 'wait' : 'pointer',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          transition:   'all 0.15s',
          padding:      0,
        }}
      >
        {watchPending === bottle.name
          ? <span style={{ fontSize: 11 }}>…</span>
          : watched ? <Check size={14} /> : <Plus size={14} />
        }
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AllocatedPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated' && session?.user?.approved === false) router.replace('/pending')
  }, [status, session])

  // ── Data ───────────────────────────────────────────────────────────────────
  const [bottles,      setBottles]      = useState([])
  const [checkedAt,    setCheckedAt]    = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [watchlist,    setWatchlist]    = useState([])
  const [watchPending, setWatchPending] = useState(null)

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('')
  const [tierFilter,   setTierFilter]   = useState('all')
  const [distFilter,   setDistFilter]   = useState('all')
  const [showInStock,  setShowInStock]  = useState(false)

  // Load bottles + watchlist on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/allocated').then(r => r.json()),
      fetch('/api/watchlist').then(r => r.json()),
    ]).then(([alloc, wl]) => {
      // Attach tierKey to each bottle
      const enriched = (alloc.bottles ?? []).map(b => ({
        ...b,
        tierKey: TIER_KEY[b.tier] ?? 'watch',
      }))
      setBottles(enriched)
      setCheckedAt(alloc.checkedAt)
      setWatchlist(wl.bottles ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // ── Watchlist toggle ───────────────────────────────────────────────────────
  async function handleToggleWatch(bottleName) {
    const isWatched = watchlist.includes(bottleName)
    setWatchPending(bottleName)
    try {
      if (isWatched) {
        const res  = await fetch(`/api/watchlist?bottle=${encodeURIComponent(bottleName)}`, { method: 'DELETE' })
        const data = await res.json()
        if (res.ok) setWatchlist(data.bottles)
      } else {
        const res  = await fetch('/api/watchlist', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ bottle: bottleName }),
        })
        const data = await res.json()
        if (res.ok) setWatchlist(data.bottles)
      }
    } catch {}
    setWatchPending(null)
  }

  // ── Filtered list ──────────────────────────────────────────────────────────
  const distributors = useMemo(() => {
    const s = new Set()
    bottles.forEach(b => { if (b.distributor) s.add(b.distributor) })
    return [...s].sort()
  }, [bottles])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return bottles.filter(b => {
      if (tierFilter !== 'all' && b.tierKey !== tierFilter) return false
      if (distFilter !== 'all' && b.distributor !== distFilter) return false
      if (showInStock && !b.retailerHits?.length) return false
      if (q && !b.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [bottles, search, tierFilter, distFilter, showInStock])

  // Group by tier for display
  const grouped = useMemo(() => {
    const groups = {}
    const tierOrder = ['unicorn', 'tier1', 'tier2', 'watch']
    tierOrder.forEach(k => { groups[k] = [] })
    filtered.forEach(b => {
      const k = b.tierKey ?? 'watch'
      if (!groups[k]) groups[k] = []
      groups[k].push(b)
    })
    return groups
  }, [filtered])

  const TIER_DISPLAY = {
    unicorn: '🦄 Unicorn Tier',
    tier1:   '🔴 Tier 1 — Highly Allocated',
    tier2:   '🟠 Tier 2 — Allocated',
    watch:   '⬛ Worth Watching — In-Store Allocation',
  }

  const inStockCount = bottles.filter(b => b.retailerHits?.length).length

  if (status === 'loading') return null

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <AppHeader sub="Allocated Bottle Reference" />

      <div style={{
        maxWidth: 700, margin: '0 auto',
        padding: 'var(--sp-4) var(--sp-3)',
        paddingBottom: 'calc(72px + env(safe-area-inset-bottom))',
      }}>

        {/* ── Search + filter bar ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 'var(--sp-4)' }}>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search
              size={15}
              style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)', pointerEvents: 'none',
              }}
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${bottles.length} allocated bottles…`}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 36px 10px 34px',
                background: 'var(--bg-elev-1)',
                border: '1px solid var(--hairline-2)',
                borderRadius: 'var(--r-md)',
                color: 'var(--text-primary)', fontSize: 'var(--fs-body)',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: 10, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: 'var(--text-dim)', cursor: 'pointer', padding: 2,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter chips row */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>

            {/* Tier tabs */}
            {TIERS.map(t => (
              <button
                key={t.id}
                onClick={() => setTierFilter(t.id)}
                style={{
                  padding:      '4px 10px',
                  borderRadius: 'var(--r-pill)',
                  border:       tierFilter === t.id ? '1px solid var(--copper-500)' : '1px solid var(--hairline)',
                  background:   tierFilter === t.id ? 'var(--copper-500)' : 'var(--bg-elev-2)',
                  color:        tierFilter === t.id ? 'var(--text-inverse)' : 'var(--text-muted)',
                  fontSize:     'var(--fs-overline)',
                  fontWeight:   600,
                  cursor:       'pointer',
                  whiteSpace:   'nowrap',
                  transition:   'all 0.12s',
                }}
              >
                {t.label}
              </button>
            ))}

            {/* In-stock toggle */}
            <button
              onClick={() => setShowInStock(s => !s)}
              style={{
                padding:    '4px 10px',
                borderRadius: 'var(--r-pill)',
                border:     showInStock ? '1px solid rgba(93,211,158,0.5)' : '1px solid var(--hairline)',
                background: showInStock ? 'rgba(93,211,158,0.12)' : 'var(--bg-elev-2)',
                color:      showInStock ? 'var(--green)' : 'var(--text-muted)',
                fontSize:   'var(--fs-overline)',
                fontWeight: 600,
                cursor:     'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.12s',
              }}
            >
              ● In Stock {inStockCount > 0 ? `(${inStockCount})` : ''}
            </button>

            {/* Distributor filter */}
            <select
              value={distFilter}
              onChange={e => setDistFilter(e.target.value)}
              style={{
                padding:    '4px 8px',
                borderRadius: 'var(--r-pill)',
                border:     distFilter !== 'all' ? '1px solid var(--copper-500)' : '1px solid var(--hairline)',
                background: 'var(--bg-elev-2)',
                color:      distFilter !== 'all' ? 'var(--copper-400)' : 'var(--text-muted)',
                fontSize:   'var(--fs-overline)',
                fontWeight: 600,
                cursor:     'pointer',
                outline:    'none',
              }}
            >
              <option value="all">All Distributors</option>
              {distributors.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Results count ───────────────────────────────────────────────── */}
        <div style={{
          fontSize: 'var(--fs-meta)', color: 'var(--text-dim)',
          marginBottom: 'var(--sp-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>
            {loading ? 'Loading…' : `${filtered.length} bottle${filtered.length !== 1 ? 's' : ''}`}
            {showInStock && filtered.length > 0 && ' currently in stock at a Chicagoland retailer'}
          </span>
          {checkedAt && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              Checked {new Date(checkedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* ── Bottle groups ────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🥃</div>
            <div style={{ fontSize: 'var(--fs-body)' }}>Loading allocated bottles…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 'var(--fs-body)' }}>No bottles match your filters</div>
          </div>
        ) : (
          Object.entries(grouped).map(([tierKey, group]) => {
            if (!group.length) return null
            const tierLabel = TIER_DISPLAY[tierKey]
            const cfg       = TIER_LABEL[tierKey]

            return (
              <div key={tierKey} style={{ marginBottom: 'var(--sp-6)' }}>
                {/* Tier header — only show when not filtered to a single tier */}
                {(tierFilter === 'all' || tierFilter === tierKey) && (
                  <div style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          8,
                    marginBottom: 'var(--sp-3)',
                    paddingBottom: 'var(--sp-2)',
                    borderBottom: `1px solid ${cfg.border}`,
                  }}>
                    <span style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, color: cfg.color }}>
                      {tierLabel}
                    </span>
                    <span style={{
                      fontSize: 'var(--fs-meta)', color: 'var(--text-dim)',
                      background: 'var(--bg-elev-2)', borderRadius: 'var(--r-pill)',
                      padding: '1px 7px',
                    }}>
                      {group.length}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {group.map(bottle => (
                    <BottleCard
                      key={bottle.name}
                      bottle={bottle}
                      watched={watchlist.includes(bottle.name)}
                      onToggleWatch={handleToggleWatch}
                      watchPending={watchPending}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}

      </div>
    </div>
  )
}
