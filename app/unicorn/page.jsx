'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Category metadata ─────────────────────────────────────────────────────────
const CATEGORY_META = {
  Bourbon:           { color: '#e8943a', bg: 'rgba(232,148,58,0.15)',  label: 'Bourbon'           },
  Rye:               { color: '#f87171', bg: 'rgba(248,113,113,0.15)', label: 'Rye'               },
  Scotch:            { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  label: 'Scotch'            },
  Tennessee:         { color: '#4ade80', bg: 'rgba(74,222,128,0.15)',  label: 'Tennessee'         },
  Japanese:          { color: '#c084fc', bg: 'rgba(192,132,252,0.15)', label: 'Japanese'          },
  Irish:             { color: '#34d399', bg: 'rgba(52,211,153,0.15)',  label: 'Irish'             },
  American:          { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  label: 'American'          },
  Canadian:          { color: '#fb923c', bg: 'rgba(251,146,60,0.15)',  label: 'Canadian'          },
  'Distilled Spirits':{ color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', label: 'Distilled Spirits'},
  Blended:           { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', label: 'Blended'          },
}

function getCategoryStyle(cat) {
  return CATEGORY_META[cat] ?? { color: '#9a7c55', bg: 'rgba(154,124,85,0.15)', label: cat }
}

// ── Discount tier ─────────────────────────────────────────────────────────────
function discountTier(pct) {
  if (pct == null) return { color: '#9a7c55', label: '—',        glow: false }
  if (pct >= 50)   return { color: '#22c55e', label: `${pct.toFixed(1)}%`, glow: true  }
  if (pct >= 30)   return { color: '#4ade80', label: `${pct.toFixed(1)}%`, glow: false }
  if (pct >= 20)   return { color: '#a3e635', label: `${pct.toFixed(1)}%`, glow: false }
  if (pct >= 10)   return { color: '#facc15', label: `${pct.toFixed(1)}%`, glow: false }
  if (pct > 0)     return { color: '#fb923c', label: `${pct.toFixed(1)}%`, glow: false }
  return               { color: '#f87171', label: `${Math.abs(pct).toFixed(1)}% over`, glow: false }
}

// ── Time-remaining urgency ────────────────────────────────────────────────────
function timeUrgency(endDatetime) {
  if (!endDatetime) return { label: '—', color: '#9a7c55', urgent: false }
  const ms = new Date(endDatetime).getTime() - Date.now()
  if (ms <= 0)          return { label: 'Ended',   color: '#f87171', urgent: false }
  const hours = ms / 3600000
  if (hours < 2)        return { label: fmtMs(ms), color: '#f87171', urgent: true  }
  if (hours < 12)       return { label: fmtMs(ms), color: '#fb923c', urgent: true  }
  if (hours < 24)       return { label: fmtMs(ms), color: '#facc15', urgent: false }
  return                       { label: fmtMs(ms), color: '#9a7c55', urgent: false }
}

function fmtMs(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0)  return `${d}d ${h % 24}h`
  if (h > 0)  return `${h}h ${m % 60}m`
  return `${m}m`
}

function fmtUSD(val) {
  if (val == null) return '—'
  return val >= 1000
    ? `$${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`
    : `$${val.toLocaleString()}`
}

function timeAgo(iso) {
  if (!iso) return '—'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Weekend awareness ─────────────────────────────────────────────────────────
function getWeekendStatus() {
  const day = new Date().getDay() // 0=Sun, 6=Sat
  if (day === 0) return 'sunday'
  if (day === 6) return 'saturday'
  return null
}

// ── Deal card ─────────────────────────────────────────────────────────────────
function DealCard({ deal, rank }) {
  const catStyle  = getCategoryStyle(deal.category)
  const disc      = discountTier(deal.discount_vs_estimate)
  const timeInfo  = timeUrgency(deal.end_datetime)
  const barWidth  = Math.min(Math.max(deal.discount_vs_estimate ?? 0, 0), 100)

  return (
    <div
      className="card flex flex-col gap-0 overflow-hidden"
      style={{ borderColor: disc.glow ? 'rgba(34,197,94,0.4)' : undefined }}
    >
      {/* Top bar: rank + category + section */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span style={{ color: '#6b5030', fontSize: '0.72rem', fontWeight: 600 }}>
          #{rank} &nbsp;·&nbsp; Lot {deal.lot_number ?? '—'}
        </span>
        <div className="flex items-center gap-1.5">
          {deal.section !== 'General' && (
            <span style={{
              background: deal.section === 'Horn of Unicorn' ? 'rgba(201,168,76,0.2)' : 'rgba(58,175,169,0.2)',
              color:       deal.section === 'Horn of Unicorn' ? '#c9a84c' : '#3aafa9',
              border:      `1px solid ${deal.section === 'Horn of Unicorn' ? 'rgba(201,168,76,0.4)' : 'rgba(58,175,169,0.4)'}`,
              borderRadius: '999px', padding: '1px 8px', fontSize: '0.68rem', fontWeight: 700,
            }}>
              {deal.section === 'Horn of Unicorn' ? '🦄' : '💰'} {deal.section}
            </span>
          )}
          <span style={{
            background: catStyle.bg, color: catStyle.color,
            border: `1px solid ${catStyle.color}40`,
            borderRadius: '999px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700,
          }}>
            {deal.category}
          </span>
        </div>
      </div>

      {/* Bottle name */}
      <div className="px-4 pb-3" style={{ borderBottom: '1px solid #2a1a08' }}>
        <a
          href={deal.lot_url}
          target="_blank"
          rel="noopener noreferrer"
          className="group"
          style={{ textDecoration: 'none' }}
        >
          <h3 style={{
            color: '#f5e6cc', fontWeight: 700, fontSize: '0.9rem',
            lineHeight: '1.3', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
            className="group-hover:text-[#e8943a] transition-colors"
          >
            {deal.bottle_name}
          </h3>
        </a>
      </div>

      {/* Pricing block */}
      <div className="px-4 py-3 flex items-end justify-between gap-2">
        <div>
          <div style={{ color: '#9a7c55', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            Current Bid
          </div>
          <div style={{ color: '#f5e6cc', fontSize: '1.5rem', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {fmtUSD(deal.current_bid)}
          </div>
          {deal.ua_estimate_display && (
            <div style={{ color: '#9a7c55', fontSize: '0.75rem', marginTop: 3 }}>
              est. {deal.ua_estimate_display}
            </div>
          )}
        </div>

        {/* Discount badge */}
        <div style={{
          background: `${disc.color}18`,
          border: `1px solid ${disc.color}50`,
          borderRadius: 10, padding: '6px 12px', textAlign: 'center', flexShrink: 0,
        }}>
          <div style={{ color: disc.color, fontSize: '1.25rem', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {disc.label}
          </div>
          <div style={{ color: disc.color + 'aa', fontSize: '0.6rem', marginTop: 2 }}>
            {(deal.discount_vs_estimate ?? 0) > 0 ? 'below est.' : 'above est.'}
          </div>
        </div>
      </div>

      {/* Discount progress bar */}
      <div className="px-4" style={{ paddingBottom: '10px' }}>
        <div style={{ background: '#2a1a08', borderRadius: 4, height: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${barWidth}%`, height: '100%', borderRadius: 4,
            background: `linear-gradient(90deg, ${disc.color}88, ${disc.color})`,
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      {/* Footer: time + reserve + bid button */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-2"
        style={{ background: '#12080200', borderTop: '1px solid #2a1a08' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: timeInfo.color, fontSize: '0.75rem', fontWeight: 600 }}>
            {timeInfo.urgent && <span style={{ marginRight: 3 }}>⏱</span>}
            {timeInfo.label}
          </span>
          {deal.reserve_price != null && (
            <span style={{
              fontSize: '0.68rem', fontWeight: 600,
              color: deal.reserve_met ? '#4ade80' : '#9a7c55',
            }}>
              {deal.reserve_met ? '✓ Reserve met' : 'No reserve'}
            </span>
          )}
        </div>
        <a
          href={deal.lot_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: '#e8943a', color: '#fff', fontWeight: 700, fontSize: '0.72rem',
            borderRadius: 7, padding: '5px 12px', textDecoration: 'none',
            whiteSpace: 'nowrap', transition: 'background 0.15s',
          }}
          onMouseOver={e => e.currentTarget.style.background = '#d4832a'}
          onMouseOut={e => e.currentTarget.style.background = '#e8943a'}
        >
          Bid Now →
        </a>
      </div>
    </div>
  )
}

// ── Filter chip ───────────────────────────────────────────────────────────────
function FilterChip({ label, active, onClick, color, count }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? (color ? `${color}22` : 'rgba(232,148,58,0.2)') : 'transparent',
        color:  active ? (color ?? '#e8943a') : '#9a7c55',
        border: `1px solid ${active ? (color ?? '#e8943a') + '60' : '#3d2b10'}`,
        borderRadius: '999px', padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {label}{count != null ? <span style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span> : null}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function UnicornPage() {
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [category,   setCategory]   = useState('')
  const [sort,       setSort]       = useState('discount')
  const [minBid,     setMinBid]     = useState(0)
  const [showCount,  setShowCount]  = useState(20)
  const [now,        setNow]        = useState(Date.now())

  const weekend = getWeekendStatus()

  // Tick every 30s to keep time-remaining fresh
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const fetchDeals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        limit:    '100',
        sort,
        ...(category ? { category } : {}),
        ...(minBid > 0 ? { minBid: String(minBid) } : {}),
      })
      const res  = await fetch(`/api/unicorn-deals?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Unknown error')
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [category, sort, minBid])

  useEffect(() => { fetchDeals() }, [fetchDeals])

  // Reset show count when filters change
  useEffect(() => setShowCount(20), [category, sort, minBid])

  const deals       = data?.deals ?? []
  const visibleDeals = deals.slice(0, showCount)

  // Build category chips from available data
  const catCounts = data?.category_counts ?? {}
  const whiskeyCats = [
    'Bourbon','Rye','Tennessee','Scotch','American','Japanese','Irish','Canadian',
    'Distilled Spirits','Blended',
  ].filter(c => catCounts[c])

  const MIN_BID_OPTIONS = [0, 50, 100, 250, 500, 1000]

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">

      {/* ── Back nav ── */}
      <div>
        <Link href="/"
          style={{ color: '#9a7c55', fontSize: '0.82rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          ← Whiskey Hunter
        </Link>
      </div>

      {/* ── Header ── */}
      <div style={{ borderBottom: '2px solid #3d2b10', paddingBottom: 20 }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 style={{ color: '#f5e6cc', fontSize: '1.8rem', fontWeight: 800, lineHeight: 1.1 }}>
              🦄 Unicorn Auctions
            </h1>
            <p style={{ color: '#9a7c55', fontSize: '0.85rem', marginTop: 4 }}>
              Whiskey bargains — bids below UA estimated value
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchDeals}
              disabled={loading}
              className="btn-primary"
              style={{ fontSize: '0.82rem', padding: '8px 16px' }}
            >
              {loading ? 'Loading…' : '↺ Refresh'}
            </button>
            <a
              href="https://www.unicornauctions.com/auctions"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                border: '1px solid #3d2b10', borderRadius: 8, padding: '8px 16px',
                color: '#9a7c55', fontSize: '0.82rem', textDecoration: 'none',
                whiteSpace: 'nowrap', transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.color = '#f5e6cc'; e.currentTarget.style.borderColor = '#e8943a' }}
              onMouseOut={e => { e.currentTarget.style.color = '#9a7c55'; e.currentTarget.style.borderColor = '#3d2b10' }}
            >
              View All Auctions ↗
            </a>
          </div>
        </div>
      </div>

      {/* ── Weekend urgency banner ── */}
      {weekend && !loading && !error && (
        <div style={{
          background:  weekend === 'sunday' ? 'rgba(248,113,113,0.1)' : 'rgba(232,148,58,0.1)',
          border:      `1px solid ${weekend === 'sunday' ? 'rgba(248,113,113,0.3)' : 'rgba(232,148,58,0.3)'}`,
          borderRadius: 12, padding: '12px 18px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '1.2rem' }}>{weekend === 'sunday' ? '🔴' : '🟡'}</span>
          <div>
            <span style={{ color: weekend === 'sunday' ? '#f87171' : '#e8943a', fontWeight: 700, fontSize: '0.9rem' }}>
              {weekend === 'sunday' ? 'Auctions closing today' : 'Auctions closing tomorrow'}
            </span>
            <span style={{ color: '#9a7c55', fontSize: '0.82rem', marginLeft: 8 }}>
              {weekend === 'sunday'
                ? 'Final bids — watch closely for last-minute sniping'
                : 'Plenty of time to plan your bids before Sunday close'}
            </span>
          </div>
        </div>
      )}

      {/* ── Stats row ── */}
      {data && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Whiskey Lots',      value: data.total_lots?.toLocaleString() ?? '—', color: '#f5e6cc' },
            { label: 'Below Estimate',    value: data.total_with_discount?.toLocaleString() ?? '—', color: '#4ade80' },
            { label: 'Showing',           value: `${data.total_filtered ?? deals.length} filtered`, color: '#e8943a' },
            { label: 'Data Age',          value: timeAgo(data.scraped_at), color: '#9a7c55' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card px-4 py-3">
              <div style={{ color: '#9a7c55', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              <div style={{ color, fontSize: '1.1rem', fontWeight: 700, marginTop: 3 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="space-y-3">
        {/* Category chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span style={{ color: '#6b5030', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Category
          </span>
          <FilterChip label="All" active={!category} onClick={() => setCategory('')} />
          {whiskeyCats.map(c => (
            <FilterChip
              key={c}
              label={c}
              active={category === c}
              onClick={() => setCategory(category === c ? '' : c)}
              color={getCategoryStyle(c).color}
              count={catCounts[c]}
            />
          ))}
        </div>

        {/* Sort + min bid row */}
        <div className="flex flex-wrap gap-2 items-center">
          <span style={{ color: '#6b5030', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sort
          </span>
          <FilterChip label="Best Discount" active={sort === 'discount'} onClick={() => setSort('discount')} />
          <FilterChip label="Closing Soon"  active={sort === 'closing'}  onClick={() => setSort('closing')} />

          <span style={{ color: '#6b5030', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: 8 }}>
            Min Bid
          </span>
          {MIN_BID_OPTIONS.map(v => (
            <FilterChip
              key={v}
              label={v === 0 ? 'Any' : `$${v.toLocaleString()}+`}
              active={minBid === v}
              onClick={() => setMinBid(v)}
            />
          ))}
        </div>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div style={{
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 12, padding: '16px 20px',
        }}>
          <p style={{ color: '#f87171', fontWeight: 600 }}>Failed to load deals</p>
          <p style={{ color: '#9a7c55', fontSize: '0.85rem', marginTop: 4 }}>{error}</p>
          <p style={{ color: '#6b5030', fontSize: '0.8rem', marginTop: 8 }}>
            Run the scraper first:{' '}
            <code style={{ background: '#1a1008', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
              cd unicorn_scraper && python scraper.py --now
            </code>
          </p>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3 animate-pulse">
              <div style={{ height: 12, background: '#2a1a08', borderRadius: 4, width: '40%' }} />
              <div style={{ height: 16, background: '#2a1a08', borderRadius: 4, width: '90%' }} />
              <div style={{ height: 16, background: '#2a1a08', borderRadius: 4, width: '70%' }} />
              <div style={{ height: 32, background: '#2a1a08', borderRadius: 4, width: '50%' }} />
              <div style={{ height: 4,  background: '#2a1a08', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && deals.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b5030' }}>
          <div style={{ fontSize: '3rem' }}>🦄</div>
          <p style={{ marginTop: 12, fontWeight: 600, color: '#9a7c55' }}>No deals match your filters</p>
          <p style={{ fontSize: '0.85rem', marginTop: 4 }}>Try removing a category or min bid filter</p>
        </div>
      )}

      {/* ── Deal grid ── */}
      {!loading && !error && visibleDeals.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleDeals.map((deal, i) => (
              <DealCard key={deal.lot_id ?? i} deal={deal} rank={i + 1} />
            ))}
          </div>

          {/* Show more */}
          {deals.length > showCount && (
            <div style={{ textAlign: 'center', paddingTop: 8 }}>
              <button
                onClick={() => setShowCount(c => c + 20)}
                style={{
                  border: '1px solid #3d2b10', borderRadius: 8, padding: '10px 24px',
                  color: '#9a7c55', background: 'transparent', fontSize: '0.85rem',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.color = '#f5e6cc'; e.currentTarget.style.borderColor = '#e8943a' }}
                onMouseOut={e => { e.currentTarget.style.color = '#9a7c55'; e.currentTarget.style.borderColor = '#3d2b10' }}
              >
                Show more ({deals.length - showCount} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Footer ── */}
      <div style={{ borderTop: '1px solid #2a1a08', paddingTop: 16, textAlign: 'center', color: '#6b5030', fontSize: '0.78rem' }}>
        Data scraped from{' '}
        <a href="https://www.unicornauctions.com" target="_blank" rel="noopener noreferrer"
          style={{ color: '#9a7c55', textDecoration: 'none' }}>
          unicornauctions.com
        </a>
        {data?.scraped_at && (
          <> &nbsp;·&nbsp; Last updated {new Date(data.scraped_at).toLocaleString()}</>
        )}
        &nbsp;·&nbsp; Discounts vs UA estimated value &nbsp;·&nbsp; Always verify before bidding
      </div>

    </main>
  )
}
