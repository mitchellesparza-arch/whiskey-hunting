'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import AppHeader from '../components/AppHeader.jsx'
import BarcodeScanner from '../finds/BarcodeScanner.jsx'
import Sheet from '../components/ui/Sheet.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Button from '../components/ui/Button.jsx'
import Chip from '../components/ui/Chip.jsx'
import ProGate, { ProInlineBadge } from '../components/ProGate.jsx'
import { isPro } from '../../lib/tier.js'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function fmtUSD(val) {
  if (val == null) return '—'
  return val >= 1000
    ? `$${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`
    : `$${Number(val).toLocaleString()}`
}

function fmtMs(ms) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (d > 0)  return `${d}d ${h % 24}h`
  if (h > 0)  return `${h}h ${m % 60}m`
  return `${m}m`
}

const TYPE_META = {
  selling: { label: 'Selling', color: 'var(--green)',  bg: 'var(--green-bg)',  icon: '💰' },
  trading: { label: 'Trading', color: 'var(--blue)',   bg: 'var(--blue-bg)',   icon: '🔄' },
  iso:     { label: 'ISO',     color: 'var(--violet)', bg: 'var(--violet-bg)', icon: '🔍' },
}

// ─────────────────────────────────────────────────────────────────────────────
// AUCTIONS TAB — Unicorn Auctions content
// ─────────────────────────────────────────────────────────────────────────────

const AUCTION_CATEGORY_META = {
  Bourbon:            { color: 'var(--copper-500)', bg: 'rgba(217,126,44,0.15)'  },
  Rye:                { color: 'var(--red)',         bg: 'rgba(248,113,113,0.15)' },
  Scotch:             { color: 'var(--blue)',        bg: 'rgba(96,165,250,0.15)'  },
  Tennessee:          { color: 'var(--green)',       bg: 'rgba(74,222,128,0.15)'  },
  Japanese:           { color: 'var(--violet)',      bg: 'rgba(192,132,252,0.15)' },
  Irish:              { color: 'var(--green)',       bg: 'rgba(52,211,153,0.15)'  },
  American:           { color: 'var(--amber)',       bg: 'rgba(251,191,36,0.15)'  },
  Canadian:           { color: 'var(--copper-400)', bg: 'rgba(251,146,60,0.15)'  },
  'Distilled Spirits':{ color: 'var(--violet)',     bg: 'rgba(167,139,250,0.15)' },
  Blended:            { color: 'var(--text-muted)', bg: 'rgba(148,163,184,0.15)' },
  Rum:                { color: '#e88c3a',            bg: 'rgba(232,140,58,0.15)'  },
  Tequila:            { color: '#4ade80',            bg: 'rgba(74,222,128,0.12)'  },
}

const WHISKEY_CATS = new Set([
  'Bourbon','Rye','Tennessee','Scotch','American','Japanese',
  'Irish','Canadian','Distilled Spirits','Blended',
])

function getCatStyle(cat) {
  return AUCTION_CATEGORY_META[cat] ?? { color: 'var(--text-muted)', bg: 'rgba(154,124,85,0.15)' }
}

function discountTier(pct) {
  if (pct == null) return { color: 'var(--text-muted)', label: '—',                               glow: false }
  if (pct >= 50)   return { color: 'var(--green)',      label: `${pct.toFixed(1)}%`,               glow: true  }
  if (pct >= 30)   return { color: 'var(--green)',      label: `${pct.toFixed(1)}%`,               glow: false }
  if (pct >= 20)   return { color: 'var(--green)',      label: `${pct.toFixed(1)}%`,               glow: false }
  if (pct >= 10)   return { color: 'var(--amber)',      label: `${pct.toFixed(1)}%`,               glow: false }
  if (pct > 0)     return { color: 'var(--copper-400)', label: `${pct.toFixed(1)}%`,               glow: false }
  return                   { color: 'var(--red)',        label: `${Math.abs(pct).toFixed(1)}% over`, glow: false }
}

function timeUrgency(endDatetime) {
  if (!endDatetime) return { label: '—',        color: 'var(--text-muted)',  urgent: false }
  const ms = new Date(endDatetime).getTime() - Date.now()
  if (ms <= 0)         return { label: 'Ended',   color: 'var(--red)',         urgent: false }
  const hours = ms / 3600000
  if (hours < 2)       return { label: fmtMs(ms), color: 'var(--red)',         urgent: true  }
  if (hours < 12)      return { label: fmtMs(ms), color: 'var(--copper-400)',  urgent: true  }
  if (hours < 24)      return { label: fmtMs(ms), color: 'var(--amber)',        urgent: false }
  return                      { label: fmtMs(ms), color: 'var(--text-muted)',  urgent: false }
}

function dealSavings(deal) {
  if (deal.ua_estimate_mid != null && deal.current_bid != null) {
    return deal.ua_estimate_mid - deal.current_bid
  }
  return null
}

function normStr(s) {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function nameMatch(a, b) {
  const wa = normStr(a).split(/\s+/).filter(w => w.length >= 3)
  const wb = new Set(normStr(b).split(/\s+/).filter(w => w.length >= 3))
  if (!wa.length || !wb.size) return 0
  return wa.filter(w => wb.has(w)).length / Math.max(wa.length, wb.size)
}

function DealCard({ deal, rank, starred, onToggleStar, showMsrp, watched, onClick }) {
  const catStyle = getCatStyle(deal.category)
  const disc     = discountTier(deal.discount_vs_estimate)
  const timeInfo = timeUrgency(deal.end_datetime)
  const barWidth = Math.min(Math.max(deal.discount_vs_estimate ?? 0, 0), 100)
  const savings  = dealSavings(deal)
  const msrpDisc = (showMsrp && deal.msrp != null && deal.discount_vs_msrp != null)
    ? discountTier(deal.discount_vs_msrp)
    : null

  return (
    <div
      className="card flex flex-col gap-0 overflow-hidden"
      style={{ borderColor: disc.glow ? 'rgba(34,197,94,0.4)' : undefined, cursor: 'pointer' }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 600 }}>
          #{rank} · Lot {deal.lot_number ?? '—'}
          {watched && (
            <span style={{
              marginLeft: 7, background: 'rgba(96,165,250,0.15)', color: 'var(--blue)',
              border: '1px solid rgba(96,165,250,0.35)', borderRadius: 'var(--r-pill)',
              padding: '1px 6px', fontSize: '0.62rem', fontWeight: 700, verticalAlign: 'middle',
            }}>👁 Watched</span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={e => { e.stopPropagation(); onToggleStar?.(deal.lot_id) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.95rem', lineHeight: 1, padding: '0 2px',
              color: starred ? 'var(--amber)' : 'var(--text-dim)',
              transition: 'color 0.15s',
            }}
            aria-label={starred ? 'Unstar lot' : 'Star lot'}
          >{starred ? '★' : '☆'}</button>
          {deal.section !== 'General' && (
            <span style={{
              background:   deal.section === 'Horn of Unicorn' ? 'rgba(201,168,76,0.2)' : 'rgba(58,175,169,0.2)',
              color:        deal.section === 'Horn of Unicorn' ? '#c9a84c' : '#3aafa9',
              border:       `1px solid ${deal.section === 'Horn of Unicorn' ? 'rgba(201,168,76,0.4)' : 'rgba(58,175,169,0.4)'}`,
              borderRadius: 'var(--r-pill)', padding: '1px 8px', fontSize: '0.68rem', fontWeight: 700,
            }}>
              {deal.section === 'Horn of Unicorn' ? '🦄' : '💰'} {deal.section}
            </span>
          )}
          <span style={{
            background: catStyle.bg, color: catStyle.color,
            border: `1px solid ${catStyle.color}40`,
            borderRadius: 'var(--r-pill)', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700,
          }}>
            {deal.category}
          </span>
        </div>
      </div>

      <div className="px-4 pb-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <a href={deal.lot_url} target="_blank" rel="noopener noreferrer" className="group" style={{ textDecoration: 'none' }}>
          <h3 style={{
            color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem', lineHeight: '1.3',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--copper-500)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-primary)'}
          >
            {deal.bottle_name}
          </h3>
        </a>
      </div>

      <div className="px-4 py-3 flex items-end justify-between gap-2">
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Current Bid</div>
          <div style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 800, lineHeight: 1 }}>{fmtUSD(deal.current_bid)}</div>
          {savings != null && savings > 0 && (
            <div style={{ color: 'var(--green)', fontSize: '0.72rem', fontWeight: 600, marginTop: 2 }}>saves ~{fmtUSD(savings)}</div>
          )}
          {deal.ua_estimate_display && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 3 }}>est. {deal.ua_estimate_display}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
          <div style={{
            background: `${disc.color}18`, border: `1px solid ${disc.color}50`,
            borderRadius: 10, padding: '6px 12px', textAlign: 'center',
          }}>
            <div style={{ color: disc.color, fontSize: '1.25rem', fontWeight: 800, lineHeight: 1 }}>{disc.label}</div>
            <div style={{ color: disc.color + 'aa', fontSize: '0.6rem', marginTop: 2 }}>
              {(deal.discount_vs_estimate ?? 0) > 0 ? 'below est.' : 'above est.'}
            </div>
          </div>
          {msrpDisc && (
            <div style={{
              background: `${msrpDisc.color}12`, border: `1px solid ${msrpDisc.color}40`,
              borderRadius: 8, padding: '4px 10px', textAlign: 'center',
            }}>
              <div style={{ color: msrpDisc.color, fontSize: '0.85rem', fontWeight: 700, lineHeight: 1 }}>{msrpDisc.label}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.58rem', marginTop: 1 }}>vs MSRP ${deal.msrp}</div>
            </div>
          )}
          {showMsrp && deal.msrp == null && (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.62rem', paddingRight: 2 }}>no MSRP</div>
          )}
        </div>
      </div>

      <div className="px-4" style={{ paddingBottom: 10 }}>
        <div style={{ background: 'var(--bg-elev-3)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
          <div style={{ width: `${barWidth}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${disc.color}88, ${disc.color})`, transition: 'width 0.6s ease' }} />
        </div>
      </div>

      <div className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ borderTop: '1px solid var(--hairline)' }}>
        <div className="flex items-center gap-3">
          <span style={{ color: timeInfo.color, fontSize: '0.75rem', fontWeight: 600 }}>
            {timeInfo.urgent && <span style={{ marginRight: 3 }}>⏱</span>}{timeInfo.label}
          </span>
          {deal.reserve_price != null && (
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: deal.reserve_met ? 'var(--green)' : 'var(--text-muted)' }}>
              {deal.reserve_met ? '✓ Reserve met' : 'Reserve not met'}
            </span>
          )}
        </div>
        <a href={deal.lot_url} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--copper-500)', color: 'var(--text-inverse)', fontWeight: 700, fontSize: '0.72rem',
            borderRadius: 'var(--r-sm)', padding: '5px 12px', textDecoration: 'none', whiteSpace: 'nowrap',
          }}>Bid Now →</a>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DEAL DETAIL SHEET
// ─────────────────────────────────────────────────────────────────────────────

const PERIODS = [
  { key: '3m',  label: '3M'  },
  { key: '6m',  label: '6M'  },
  { key: '12m', label: '12M' },
  { key: 'all', label: 'All' },
]

function DealDetailSheet({ deal, open, onClose, starred, onToggleStar, watched, onAddToWatchlist }) {
  const [period,      setPeriod]      = useState('all')
  const [history,     setHistory]     = useState(null)
  const [histLoading, setHistLoading] = useState(false)
  const [histError,   setHistError]   = useState(null)
  const [adding,      setAdding]      = useState(false)

  useEffect(() => {
    if (!open || !deal?.bottle_name) { if (!open) { setHistory(null); setHistError(null) }; return }
    let cancelled = false
    setHistLoading(true); setHistError(null)
    fetch(`/api/ua-price-history?title=${encodeURIComponent(deal.bottle_name)}&period=${period}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setHistory(d) })
      .catch(e => { if (!cancelled) setHistError(e.message) })
      .finally(() => { if (!cancelled) setHistLoading(false) })
    return () => { cancelled = true }
  }, [open, deal?.bottle_name, period])

  async function handleAddToWatchlist() {
    if (!onAddToWatchlist) return
    setAdding(true)
    await onAddToWatchlist(deal.bottle_name)
    setAdding(false)
  }

  if (!deal) return null

  const catStyle = getCatStyle(deal.category)
  const disc     = discountTier(deal.discount_vs_estimate)
  const savings  = dealSavings(deal)
  const timeInfo = timeUrgency(deal.end_datetime)

  return (
    <Sheet open={open} onClose={onClose} title="">
      <div style={{ padding: 'var(--sp-5)' }}>
      <div className="space-y-5">

        {/* Image */}
        {deal.image_url && (
          <div style={{ borderRadius: 12, overflow: 'hidden', background: 'var(--bg-elev-2)', maxHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={deal.image_url} alt="" style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain' }} />
          </div>
        )}

        {/* Badges + title */}
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {deal.section !== 'General' && (
              <span style={{
                background:   deal.section === 'Horn of Unicorn' ? 'rgba(201,168,76,0.2)' : 'rgba(58,175,169,0.2)',
                color:        deal.section === 'Horn of Unicorn' ? '#c9a84c' : '#3aafa9',
                border:       `1px solid ${deal.section === 'Horn of Unicorn' ? 'rgba(201,168,76,0.4)' : 'rgba(58,175,169,0.4)'}`,
                borderRadius: 'var(--r-pill)', padding: '2px 9px', fontSize: '0.72rem', fontWeight: 700,
              }}>{deal.section === 'Horn of Unicorn' ? '🦄' : '💰'} {deal.section}</span>
            )}
            <span style={{
              background: catStyle.bg, color: catStyle.color,
              border: `1px solid ${catStyle.color}40`,
              borderRadius: 'var(--r-pill)', padding: '2px 9px', fontSize: '0.72rem', fontWeight: 700,
            }}>{deal.category}</span>
            {watched && (
              <span style={{
                background: 'rgba(96,165,250,0.15)', color: 'var(--blue)',
                border: '1px solid rgba(96,165,250,0.35)',
                borderRadius: 'var(--r-pill)', padding: '2px 9px', fontSize: '0.72rem', fontWeight: 700,
              }}>👁 On Your Watchlist</span>
            )}
          </div>
          <h2 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.35, margin: 0 }}>
            {deal.bottle_name}
          </h2>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: 5 }}>
            Lot #{deal.lot_number}{deal.auction_name ? ` · ${deal.auction_name}` : ''}
          </div>
        </div>

        {/* Current bid + discount */}
        <div className="card px-4 py-3" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Current Bid</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{fmtUSD(deal.current_bid)}</div>
            {savings != null && savings > 0 && (
              <div style={{ color: 'var(--green)', fontSize: '0.78rem', fontWeight: 600, marginTop: 3 }}>saves ~{fmtUSD(savings)}</div>
            )}
            {deal.ua_estimate_display && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 3 }}>est. {deal.ua_estimate_display}</div>
            )}
            {deal.msrp && (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: 2 }}>MSRP ${deal.msrp}</div>
            )}
          </div>
          <div style={{
            background: `${disc.color}18`, border: `1px solid ${disc.color}50`,
            borderRadius: 10, padding: '8px 14px', textAlign: 'center', flexShrink: 0,
          }}>
            <div style={{ color: disc.color, fontSize: '1.5rem', fontWeight: 800, lineHeight: 1 }}>{disc.label}</div>
            <div style={{ color: disc.color + 'aa', fontSize: '0.65rem', marginTop: 2 }}>
              {(deal.discount_vs_estimate ?? 0) > 0 ? 'below est.' : 'above est.'}
            </div>
          </div>
        </div>

        {/* Reserve + time row */}
        <div style={{ display: 'flex', gap: 10 }}>
          {deal.reserve_price != null && (
            <div className="card flex-1 px-3 py-2" style={{ textAlign: 'center' }}>
              <div style={{ color: deal.reserve_met ? 'var(--green)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.82rem' }}>
                {deal.reserve_met ? '✓ Reserve Met' : 'Reserve Not Met'}
              </div>
            </div>
          )}
          {deal.end_datetime && (
            <div className="card flex-1 px-3 py-2" style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Closes</div>
              <div style={{ color: timeInfo.color, fontWeight: 700, fontSize: '0.82rem', marginTop: 2 }}>
                {new Date(deal.end_datetime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            </div>
          )}
        </div>

        {/* ── Sale History ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>Sale History</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                  padding: '4px 11px', borderRadius: 'var(--r-pill)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                  background: period === p.key ? 'var(--copper-500)' : 'transparent',
                  border:     period === p.key ? 'none' : '1px solid var(--hairline-2)',
                  color:      period === p.key ? 'var(--text-inverse)' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}>{p.label}</button>
              ))}
            </div>
          </div>

          {histLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse" style={{ height: 38, background: 'var(--bg-elev-2)', borderRadius: 8 }} />
              ))}
            </div>
          )}

          {!histLoading && history?.stats && (
            <div className="grid grid-cols-4 gap-2" style={{ marginBottom: 14 }}>
              {[
                { label: 'Avg price', value: history.stats.avg },
                { label: 'Low sale',  value: history.stats.low  },
                { label: 'High sale', value: history.stats.high },
                { label: 'Last sale', value: history.stats.last },
              ].map(({ label, value }) => (
                <div key={label} className="card px-2 py-2" style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--copper-400)', fontWeight: 800, fontSize: '0.88rem', lineHeight: 1 }}>{fmtUSD(value)}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.6rem', marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {!histLoading && history?.total > 0 && (
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.68rem', marginBottom: 8 }}>{history.total} total sales</div>
              {history.sales.map((sale, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 0',
                  borderBottom: i < history.sales.length - 1 ? '1px solid var(--hairline)' : 'none',
                }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    {new Date(sale.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>{fmtUSD(sale.price)}</span>
                </div>
              ))}
            </div>
          )}

          {!histLoading && !histError && history !== null && history.total === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem', textAlign: 'center', padding: '20px 0' }}>
              No sale history found for this bottle
            </div>
          )}

          {histError && (
            <div style={{ color: 'var(--red)', fontSize: '0.82rem', textAlign: 'center', padding: '16px 0' }}>
              Couldn&apos;t load history
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onToggleStar?.(deal.lot_id)}
            style={{
              padding: '12px 16px', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: '1.15rem',
              background: starred ? 'rgba(251,191,36,0.12)' : 'transparent',
              border: `1px solid ${starred ? 'rgba(251,191,36,0.4)' : 'var(--hairline-2)'}`,
              color: starred ? 'var(--amber)' : 'var(--text-dim)',
              transition: 'all 0.15s',
            }}
            aria-label={starred ? 'Unstar' : 'Star'}
          >{starred ? '★' : '☆'}</button>

          {!watched && onAddToWatchlist && (
            <button
              onClick={handleAddToWatchlist}
              disabled={adding}
              style={{
                flex: 1, padding: '12px', borderRadius: 'var(--r-md)', cursor: adding ? 'not-allowed' : 'pointer',
                background: 'transparent', border: '1px solid var(--hairline-2)',
                color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600,
                opacity: adding ? 0.6 : 1,
              }}
            >{adding ? 'Adding…' : '+ Add to Watchlist'}</button>
          )}

          <a
            href={deal.lot_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '12px', borderRadius: 'var(--r-md)',
              background: 'var(--copper-500)', color: 'var(--text-inverse)',
              fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none',
            }}
          >Bid Now on UA →</a>
        </div>

      </div>
      </div>
    </Sheet>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AUCTIONS TAB
// ─────────────────────────────────────────────────────────────────────────────

function AuctionsTab() {
  const [data,            setData]            = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(null)
  const [categories,      setCategories]      = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('wh:auctions:filters') ?? '{}').categories; return new Set(Array.isArray(saved) ? saved : []) } catch { return new Set() }
  })
  const [sort,            setSort]            = useState(() => {
    try { return JSON.parse(localStorage.getItem('wh:auctions:filters') ?? '{}').sort ?? 'discount' } catch { return 'discount' }
  })
  const [minBid,          setMinBid]          = useState(() => {
    try { return JSON.parse(localStorage.getItem('wh:auctions:filters') ?? '{}').minBid ?? 0 } catch { return 0 }
  })
  const [minSavings,      setMinSavings]      = useState(() => {
    try { return JSON.parse(localStorage.getItem('wh:auctions:filters') ?? '{}').minSavings ?? 0 } catch { return 0 }
  })
  const [reserveFilter,   setReserveFilter]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('wh:auctions:filters') ?? '{}').reserveFilter ?? '' } catch { return '' }
  })
  const [searchText,      setSearchText]      = useState('')
  const [showMsrp,        setShowMsrp]        = useState(false)
  const [showStarredOnly,  setShowStarredOnly]  = useState(false)
  const [starredIds,       setStarredIds]       = useState(() => {
    try {
      const raw = localStorage.getItem('wh:ua:starred')
      return new Set(raw ? JSON.parse(raw) : [])
    } catch { return new Set() }
  })
  const [watchedBottles,   setWatchedBottles]   = useState([])
  const [showWatchedOnly,  setShowWatchedOnly]  = useState(false)
  const [selectedDeal,     setSelectedDeal]     = useState(null)
  const [showCount,        setShowCount]        = useState(20)
  const [filtersOpen,      setFiltersOpen]      = useState(false)
  const showMoreRef = useRef(null)

  const fetchDeals = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch('/api/unicorn-deals?limit=1000')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Unknown error')
      setData(json)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchDeals() }, [fetchDeals])
  useEffect(() => setShowCount(20), [categories, sort, minBid, minSavings, reserveFilter, searchText, showStarredOnly, showWatchedOnly])

  // Persist filter state across page loads
  useEffect(() => {
    try {
      localStorage.setItem('wh:auctions:filters', JSON.stringify({ categories: [...categories], sort, minBid, minSavings, reserveFilter }))
    } catch {}
  }, [categories, sort, minBid, minSavings, reserveFilter])

  // Watchlist — serve cached immediately, refresh in background
  useEffect(() => {
    try {
      const cached = localStorage.getItem('wh:watchlist')
      if (cached) setWatchedBottles(JSON.parse(cached))
    } catch {}
    fetch('/api/watchlist')
      .then(r => r.ok ? r.json() : { bottles: [] })
      .then(d => {
        const bottles = d.bottles ?? []
        setWatchedBottles(bottles)
        try { localStorage.setItem('wh:watchlist', JSON.stringify(bottles)) } catch {}
      })
      .catch(() => {})
  }, [])


  function toggleStar(lotId) {
    if (!lotId) return
    setStarredIds(prev => {
      const next = new Set(prev)
      if (next.has(lotId)) next.delete(lotId); else next.add(lotId)
      try { localStorage.setItem('wh:ua:starred', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  async function addToWatchlist(bottleName) {
    try {
      const r = await fetch('/api/watchlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bottle: bottleName }),
      })
      const d = await r.json()
      if (r.ok) setWatchedBottles(d.bottles ?? [])
    } catch {}
  }

  const watchedDealIds = useMemo(() => {
    if (!watchedBottles.length || !data?.deals) return new Set()
    const ids = new Set()
    for (const deal of data.deals) {
      for (const w of watchedBottles) {
        if (nameMatch(w, deal.bottle_name) >= 0.4) { ids.add(deal.lot_id); break }
      }
    }
    return ids
  }, [data, watchedBottles])

  const filteredDeals = useMemo(() => {
    let deals = data?.deals ?? []
    const hasNonWhiskey = [...categories].some(c => !WHISKEY_CATS.has(c))
    if (!hasNonWhiskey) deals = deals.filter(d => WHISKEY_CATS.has(d.category))
    if (categories.size > 0) deals = deals.filter(d => categories.has(d.category))
    if (minBid > 0)  deals = deals.filter(d => (d.current_bid ?? 0) >= minBid)
    if (minSavings > 0) deals = deals.filter(d => (dealSavings(d) ?? 0) >= minSavings)
    if (reserveFilter === 'met-or-none') deals = deals.filter(d => d.reserve_met === true || !d.reserve_price)
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      deals = deals.filter(d => d.bottle_name?.toLowerCase().includes(q))
    }
    if (showStarredOnly)  deals = deals.filter(d => starredIds.has(d.lot_id))
    if (showWatchedOnly)  deals = deals.filter(d => watchedDealIds.has(d.lot_id))
    if (sort === 'savings') {
      deals = [...deals].sort((a, b) => {
        const diff = (dealSavings(b) ?? -Infinity) - (dealSavings(a) ?? -Infinity)
        if (diff !== 0) return diff
        // Tiebreaker: closing soonest first
        const ta = a.end_datetime ? new Date(a.end_datetime).getTime() : Infinity
        const tb = b.end_datetime ? new Date(b.end_datetime).getTime() : Infinity
        return ta - tb
      })
    } else if (sort === 'closing') {
      deals = [...deals].sort((a, b) => {
        const ta = a.end_datetime ? new Date(a.end_datetime).getTime() : Infinity
        const tb = b.end_datetime ? new Date(b.end_datetime).getTime() : Infinity
        return ta - tb
      })
    } else if (sort === 'newest') {
      deals = [...deals].sort((a, b) => (b.lot_number ?? 0) - (a.lot_number ?? 0))
    }
    // 'discount' is pre-sorted by the API
    return deals
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, categories, minBid, minSavings, reserveFilter, searchText, showStarredOnly, showWatchedOnly, sort, starredIds, watchedDealIds])

  // Infinite scroll — auto-load next page when sentinel enters viewport
  // (placed after filteredDeals to avoid temporal dead zone in dep array)
  useEffect(() => {
    if (!showMoreRef.current) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setShowCount(c => c + 20)
    }, { rootMargin: '200px' })
    observer.observe(showMoreRef.current)
    return () => observer.disconnect()
  }, [filteredDeals.length, showCount])

  // Active filter labels — used in empty state hint
  const activeFilterLabels = [
    categories.size > 0 && `category: ${[...categories].join(', ')}`,
    minBid > 0 && `min bid $${minBid.toLocaleString()}`,
    minSavings > 0 && `$${minSavings.toLocaleString()}+ savings`,
    reserveFilter === 'met-or-none' && 'reserve: met or none',
    showStarredOnly && 'starred only',
    showWatchedOnly && 'watchlist only',
    searchText.trim() && `search: "${searchText.trim()}"`,
  ].filter(Boolean)

  const visibleDeals     = filteredDeals.slice(0, showCount)
  const catCounts        = data?.category_counts ?? {}
  const whiskeyCats      = ['Bourbon','Rye','Tennessee','Scotch','American','Japanese','Irish','Canadian','Distilled Spirits','Blended'].filter(c => catCounts[c])
  const dealsCategories  = new Set((data?.deals ?? []).map(d => d.category))
  const otherSpiritCats  = Object.keys(catCounts).filter(c => !WHISKEY_CATS.has(c) && dealsCategories.has(c)).sort()
  const hasNonWhiskeySelected = [...categories].some(c => !WHISKEY_CATS.has(c))

  // Stat card values — computed from live data, not stale scraper aggregates
  const lotTotal = Object.entries(catCounts).reduce((sum, [cat, n]) => {
    if (!hasNonWhiskeySelected && !WHISKEY_CATS.has(cat)) return sum
    return sum + n
  }, 0)
  const belowEstimateCount = filteredDeals.filter(d => (d.discount_vs_estimate ?? 0) > 0).length
  const MIN_BID_OPTS     = [0, 50, 100, 250, 500, 1000]
  const MIN_SAVINGS_OPTS = [0, 50, 100, 250, 500]

  const weekend = (() => { const d = new Date().getDay(); return d === 0 ? 'sunday' : d === 6 ? 'saturday' : null })()

  return (
    <div className="space-y-6">
      {weekend && !loading && !error && (
        <div style={{
          background:  weekend === 'sunday' ? 'rgba(248,113,113,0.1)' : 'rgba(232,148,58,0.1)',
          border:      `1px solid ${weekend === 'sunday' ? 'rgba(248,113,113,0.3)' : 'rgba(232,148,58,0.3)'}`,
          borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '1.2rem' }}>{weekend === 'sunday' ? '🔴' : '🟡'}</span>
          <div>
            <span style={{ color: weekend === 'sunday' ? 'var(--red)' : 'var(--copper-400)', fontWeight: 700, fontSize: '0.9rem' }}>
              {weekend === 'sunday' ? 'Auctions closing today' : 'Auctions closing tomorrow'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginLeft: 8 }}>
              {weekend === 'sunday' ? 'Final bids — watch closely' : 'Plenty of time to plan your bids'}
            </span>
          </div>
        </div>
      )}

      {data && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: hasNonWhiskeySelected ? 'All Lots' : 'Whiskey Lots', value: lotTotal.toLocaleString(),              color: 'var(--text-primary)' },
            { label: 'Below Estimate', value: `${belowEstimateCount} of ${filteredDeals.length}`,  color: 'var(--green)' },
            { label: 'Showing',        value: `${filteredDeals.length} filtered`,                   color: 'var(--copper-400)' },
            { label: 'Data Age',       value: timeAgo(new Date(data.scraped_at).getTime()),         color: 'var(--text-muted)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card px-4 py-3">
              <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              <div style={{ color, fontSize: '1.1rem', fontWeight: 700, marginTop: 3 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <input
          type="search"
          placeholder="Search bottles…"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px 10px 36px', boxSizing: 'border-box',
            background: 'var(--bg-elev-2)', border: '1px solid var(--hairline-2)',
            borderRadius: 'var(--r-md)', color: 'var(--text-primary)', fontSize: '0.9rem',
            outline: 'none',
          }}
        />
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
      </div>

      {/* Mobile filter toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => setFiltersOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', background: filtersOpen ? 'var(--bg-elev-3)' : 'var(--bg-elev-2)',
            border: `1px solid ${activeFilterLabels.length ? 'var(--copper-500)' : 'var(--hairline-2)'}`,
            borderRadius: 'var(--r-pill)', color: activeFilterLabels.length ? 'var(--copper-400)' : 'var(--text-muted)',
            fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
          }}
        >
          ⚙ Filters {activeFilterLabels.length > 0 && `(${activeFilterLabels.length} active)`}
          <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{filtersOpen ? '▲' : '▼'}</span>
        </button>
        {activeFilterLabels.length > 0 && (
          <button
            onClick={() => { setCategories(new Set()); setMinBid(0); setMinSavings(0); setReserveFilter(''); setShowStarredOnly(false); setShowWatchedOnly(false); setSearchText('') }}
            style={{
              padding: '5px 10px', background: 'transparent', border: '1px solid var(--hairline-2)',
              borderRadius: 'var(--r-pill)', color: 'var(--text-dim)', fontSize: '0.72rem', cursor: 'pointer',
            }}
          >
            Clear all
          </button>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="primary" size="sm" onClick={fetchDeals} disabled={loading}>
            {loading ? 'Loading…' : '↺ Refresh'}
          </Button>
        </div>
      </div>

      {filtersOpen && (
        <div className="space-y-3" style={{ padding: '14px 16px', background: 'var(--bg-elev-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--hairline-2)' }}>
          {/* Category */}
          <div className="flex flex-wrap gap-2 items-center">
            <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 60 }}>Category</span>
            <Chip tone={categories.size === 0 ? 'copper' : 'neutral'} onClick={() => setCategories(new Set())}>All</Chip>
            {whiskeyCats.map(c => (
              <Chip key={c} tone={categories.has(c) ? 'copper' : 'neutral'} onClick={() => setCategories(prev => { const next = new Set(prev); next.has(c) ? next.delete(c) : next.add(c); return next })} count={catCounts[c]}>
                {c}
              </Chip>
            ))}
            {otherSpiritCats.length > 0 && (
              <span style={{ color: 'var(--hairline-2)', margin: '0 2px', userSelect: 'none' }}>|</span>
            )}
            {otherSpiritCats.map(c => (
              <Chip key={c} tone={categories.has(c) ? 'copper' : 'neutral'} onClick={() => setCategories(prev => { const next = new Set(prev); next.has(c) ? next.delete(c) : next.add(c); return next })} count={catCounts[c]}>
                {c}
              </Chip>
            ))}
          </div>

          {/* Sort + controls */}
          <div className="flex flex-wrap gap-2 items-center">
            <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 60 }}>Sort</span>
            <Chip tone={sort === 'discount' ? 'copper' : 'neutral'} onClick={() => setSort('discount')}>Best Discount %</Chip>
            <Chip tone={sort === 'savings'  ? 'copper' : 'neutral'} onClick={() => setSort('savings')}>$ Saved</Chip>
            <Chip tone={sort === 'closing'  ? 'copper' : 'neutral'} onClick={() => setSort('closing')}>Closing Soon</Chip>
            <Chip tone={sort === 'newest'   ? 'copper' : 'neutral'} onClick={() => setSort('newest')}>Newest</Chip>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip tone={showStarredOnly ? 'copper' : 'neutral'} onClick={() => setShowStarredOnly(v => !v)}>
                {showStarredOnly ? '★ Starred' : `★${starredIds.size > 0 ? ` (${starredIds.size})` : ''}`}
              </Chip>
              <Chip tone={showWatchedOnly ? 'copper' : 'neutral'} onClick={() => setShowWatchedOnly(v => !v)}>
                {showWatchedOnly ? '👁 Watchlist' : `👁${watchedDealIds.size > 0 ? ` (${watchedDealIds.size})` : ''}`}
              </Chip>
              <Chip tone={showMsrp ? 'copper' : 'neutral'} onClick={() => setShowMsrp(v => !v)}>
                MSRP
              </Chip>
            </span>
          </div>

          {/* Min Bid + Min $ Saved */}
          <div className="flex flex-wrap gap-2 items-center">
            <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 60 }}>Min Bid</span>
            {MIN_BID_OPTS.map(v => (
              <Chip key={v} tone={minBid === v ? 'copper' : 'neutral'} onClick={() => setMinBid(v)}>
                {v === 0 ? 'Any' : `$${v.toLocaleString()}+`}
              </Chip>
            ))}
            <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: 8 }}>$ Saved</span>
            {MIN_SAVINGS_OPTS.map(v => (
              <Chip key={`s${v}`} tone={minSavings === v ? 'copper' : 'neutral'} onClick={() => setMinSavings(v)}>
                {v === 0 ? 'Any' : `$${v.toLocaleString()}+`}
              </Chip>
            ))}
          </div>

          {/* Reserve */}
          <div className="flex flex-wrap gap-2 items-center">
            <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 60 }}>Reserve</span>
            <Chip tone={!reserveFilter ? 'copper' : 'neutral'} onClick={() => setReserveFilter('')}>Any</Chip>
            <Chip tone={reserveFilter === 'met-or-none' ? 'copper' : 'neutral'} onClick={() => setReserveFilter(reserveFilter === 'met-or-none' ? '' : 'met-or-none')}>
              Met or no reserve
            </Chip>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '16px 20px' }}>
          <p style={{ color: 'var(--red)', fontWeight: 600 }}>Failed to load deals</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>{error}</p>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3 animate-pulse">
              <div style={{ height: 12, background: 'var(--bg-elev-3)', borderRadius: 4, width: '40%' }} />
              <div style={{ height: 16, background: 'var(--bg-elev-3)', borderRadius: 4, width: '90%' }} />
              <div style={{ height: 32, background: 'var(--bg-elev-3)', borderRadius: 4, width: '50%' }} />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && filteredDeals.length === 0 && (
        <EmptyState
          icon="Gavel"
          title="No deals match your filters"
          body={activeFilterLabels.length
            ? `Try removing: ${activeFilterLabels.join(', ')}`
            : 'Adjust filters and try again'
          }
        />
      )}

      {!loading && !error && filteredDeals.length > 0 && (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Showing <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{visibleDeals.length}</span> of{' '}
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{filteredDeals.length}</span> lots
          {categories.size > 0 ? ` · ${[...categories].join(', ')}` : ''}
        </div>
      )}

      {!loading && !error && visibleDeals.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleDeals.map((deal, i) => (
              <DealCard
                key={deal.lot_id ?? i}
                deal={deal}
                rank={i + 1}
                starred={starredIds.has(deal.lot_id)}
                onToggleStar={toggleStar}
                showMsrp={showMsrp}
                watched={watchedDealIds.has(deal.lot_id)}
                onClick={() => setSelectedDeal(deal)}
              />
            ))}
          </div>
          {filteredDeals.length > showCount && (
            <div ref={showMoreRef} style={{ textAlign: 'center', paddingTop: 8 }}>
              <button onClick={() => setShowCount(c => c + 20)} style={{
                border: '1px solid var(--hairline-2)', borderRadius: 8, padding: '10px 24px',
                color: 'var(--text-muted)', background: 'transparent', fontSize: '0.85rem', cursor: 'pointer',
              }}>
                Show more ({filteredDeals.length - showCount} remaining)
              </button>
            </div>
          )}
        </>
      )}

      <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: 16, textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
        Data from <a href="https://www.unicornauctions.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }}>unicornauctions.com</a>
        {data?.scraped_at && <> · Last updated {new Date(data.scraped_at).toLocaleString()}</>}
      </div>

      <DealDetailSheet
        open={!!selectedDeal}
        deal={selectedDeal}
        onClose={() => setSelectedDeal(null)}
        starred={starredIds.has(selectedDeal?.lot_id)}
        onToggleStar={toggleStar}
        watched={watchedDealIds.has(selectedDeal?.lot_id)}
        onAddToWatchlist={addToWatchlist}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTTLE FORM — shared between AddBottleModal (multi) and single-add
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = ['Bourbon', 'Rye', 'Scotch', 'Japanese', 'American', 'Irish', 'Tennessee', 'Other']
const CONDITIONS = ['Sealed', 'Open', 'Partial']

function BottleForm({ value, onChange, onAiScan, onBarcode, scanning, setScanning, lookupMsg, lookingUp }) {
  const photoInputRef = useRef(null)

  return (
    <div className="space-y-3">
      {/* Quick-scan row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => setScanning(true)} disabled={lookingUp} style={{
          flex: 1, padding: '8px', background: 'var(--bg-elev-3)', border: '1px solid var(--hairline-2)',
          borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
        }}>📷 Scan Label (AI)</button>
        <button type="button" onClick={() => setScanning('barcode')} disabled={lookingUp} style={{
          flex: 1, padding: '8px', background: 'var(--bg-elev-3)', border: '1px solid var(--hairline-2)',
          borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
        }}>🔍 Scan Barcode</button>
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment"
          onChange={e => onAiScan(e)} style={{ display: 'none' }} />
      </div>

      {scanning === 'barcode' && (
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--hairline-2)' }}>
          <BarcodeScanner onResult={code => { onBarcode(code); setScanning(false) }} />
          <button type="button" onClick={() => setScanning(false)} style={{ width: '100%', padding: 8, background: 'var(--bg-elev-3)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
        </div>
      )}

      {scanning === true && (
        <div>
          <input ref={photoInputRef} type="file" accept="image/*" capture="environment"
            onChange={e => { onAiScan(e); setScanning(false) }} style={{ display: 'none' }} />
          {/* auto-click */}
          {(() => { setTimeout(() => photoInputRef.current?.click(), 50); return null })()}
        </div>
      )}

      {lookingUp && <p style={{ color: 'var(--copper-400)', fontSize: 12, textAlign: 'center' }}>🔍 Reading label…</p>}
      {lookupMsg && <p style={{ color: 'var(--green)', fontSize: 12, textAlign: 'center' }}>{lookupMsg}</p>}

      <input
        type="text" placeholder="Bottle name *" value={value.name ?? ''}
        onChange={e => onChange({ ...value, name: e.target.value })}
        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elev-3)', border: '1px solid var(--hairline-2)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={value.category ?? ''} onChange={e => onChange({ ...value, category: e.target.value })}
          style={{ flex: 1, padding: '9px 12px', background: 'var(--bg-elev-3)', border: '1px solid var(--hairline-2)', borderRadius: 8, color: value.category ? 'var(--text-primary)' : 'var(--text-dim)', fontSize: 13 }}>
          <option value="">Category</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={value.condition ?? ''} onChange={e => onChange({ ...value, condition: e.target.value })}
          style={{ flex: 1, padding: '9px 12px', background: 'var(--bg-elev-3)', border: '1px solid var(--hairline-2)', borderRadius: 8, color: value.condition ? 'var(--text-primary)' : 'var(--text-dim)', fontSize: 13 }}>
          <option value="">Condition</option>
          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <input
        type="text" placeholder="Bottle notes (optional)" value={value.notes ?? ''}
        onChange={e => onChange({ ...value, notes: e.target.value })}
        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elev-3)', border: '1px solid var(--hairline-2)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE LISTING MODAL
// ─────────────────────────────────────────────────────────────────────────────

function CreateListingModal({ onClose, onCreated, userEmail, open }) {
  const [type,          setType]          = useState('selling')
  const [bottles,       setBottles]       = useState([{ name: '', category: '', condition: '', notes: '' }])
  const [currentBottle, setCurrentBottle] = useState(0)
  const [askingPrice,   setAskingPrice]   = useState('')
  const [binPrice,      setBinPrice]      = useState('')
  const [zip,           setZip]           = useState('')
  const [notes,         setNotes]         = useState('')
  const [discordHandle, setDiscordHandle] = useState('')
  const [photos,        setPhotos]        = useState([])  // array of blob URLs
  const [scanning,      setScanning]      = useState(false)
  const [lookupMsg,     setLookupMsg]     = useState(null)
  const [lookingUp,     setLookingUp]     = useState(false)
  const [uploading,     setUploading]     = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState(null)
  const [marketPrice,   setMarketPrice]   = useState(null)
  const photoInputRef = useRef(null)

  // Fetch market price when the primary bottle name changes
  const primaryName = bottles[0]?.name?.trim()
  useEffect(() => {
    if (!primaryName || type === 'iso') { setMarketPrice(null); return }
    const t = setTimeout(() => {
      fetch(`/api/market-price?name=${encodeURIComponent(primaryName)}`)
        .then(r => r.json())
        .then(d => setMarketPrice(d.price ?? null))
        .catch(() => setMarketPrice(null))
    }, 400)
    return () => clearTimeout(t)
  }, [primaryName, type])

  function updateCurrentBottle(val) {
    setBottles(prev => prev.map((b, i) => i === currentBottle ? val : b))
  }

  function addBottle() {
    setBottles(prev => [...prev, { name: '', category: '', condition: '', notes: '' }])
    setCurrentBottle(bottles.length)
  }

  function removeBottle(idx) {
    if (bottles.length === 1) return
    const next = bottles.filter((_, i) => i !== idx)
    setBottles(next)
    setCurrentBottle(Math.min(currentBottle, next.length - 1))
  }

  async function handleAiScan(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLookingUp(true); setLookupMsg(null)
    try {
      const base64 = await new Promise(resolve => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result.split(',')[1])
        reader.readAsDataURL(file)
      })
      const r = await fetch('/api/lookup/photo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: file.type || 'image/jpeg' }),
      })
      const d = await r.json()
      if (d.found) {
        updateCurrentBottle({
          ...bottles[currentBottle],
          name:     d.bottle?.name     || bottles[currentBottle].name,
          category: d.bottle?.category || bottles[currentBottle].category,
        })
        setLookupMsg('✓ Label read by AI — verify details')
      } else {
        setLookupMsg(d.error ?? 'Could not read label — fill in manually')
      }
      // Also upload as listing photo
      await uploadPhoto(file)
    } catch { setLookupMsg('Scan failed') }
    finally { setLookingUp(false) }
  }

  async function handleBarcode(code) {
    setLookingUp(true); setLookupMsg(null)
    try {
      const r = await fetch(`/api/lookup?upc=${encodeURIComponent(code)}`)
      const d = await r.json()
      if (d.found) {
        updateCurrentBottle({
          ...bottles[currentBottle],
          name:     d.bottle?.name     || bottles[currentBottle].name,
          category: d.bottle?.category || bottles[currentBottle].category,
        })
        setLookupMsg('✓ Barcode matched')
      } else {
        setLookupMsg('Barcode not in database — fill in manually')
      }
    } catch { setLookupMsg('Lookup failed') }
    finally { setLookingUp(false) }
  }

  async function uploadPhoto(file) {
    if (photos.length >= 4) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/marketplace/upload', { method: 'POST', body: fd })
      const d = await r.json()
      if (d.url) setPhotos(prev => [...prev, d.url])
    } catch {}
    finally { setUploading(false) }
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (file) await uploadPhoto(file)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const validBottles = bottles.filter(b => b.name?.trim())
    if (!validBottles.length) { setError('Add at least one bottle name'); return }
    if (!zip.trim())          { setError('Zip code is required'); return }

    setSubmitting(true)
    try {
      const r = await fetch('/api/marketplace', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, bottles: validBottles,
          askingPrice: askingPrice || null,
          binPrice:    binPrice    || null,
          zip: zip.trim(), notes: notes.trim() || null,
          discordHandle: discordHandle.trim() || null,
          photos,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Failed to create listing')
      onCreated(d.listing)
    } catch (err) { setError(err.message) }
    finally { setSubmitting(false) }
  }

  const typeColors = { selling: 'var(--green)', trading: 'var(--blue)', iso: 'var(--violet)' }

  // Type selector active bg/border/color per type
  const typeActiveBg     = { selling: 'var(--green-bg)',  trading: 'var(--blue-bg)',  iso: 'var(--violet-bg)'  }
  const typeActiveBorder = { selling: 'rgba(93,211,158,0.5)', trading: 'rgba(143,181,255,0.5)', iso: 'rgba(185,164,255,0.5)' }
  const typeActiveColor  = { selling: 'var(--green)',     trading: 'var(--blue)',     iso: 'var(--violet)'     }

  return (
    <Sheet open={open} onClose={onClose} title="Create Listing">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Type selector */}
        <div>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Listing Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(TYPE_META).map(([key, meta]) => (
              <button key={key} type="button" onClick={() => setType(key)} style={{
                flex: 1, padding: '10px 8px',
                background: type === key ? typeActiveBg[key] : 'transparent',
                border: `1px solid ${type === key ? typeActiveBorder[key] : 'var(--hairline-2)'}`,
                borderRadius: 'var(--r-md)', color: type === key ? typeActiveColor[key] : 'var(--text-dim)',
                fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {meta.icon} {meta.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bottle(s) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Bottles ({bottles.length})
            </label>
            <button type="button" onClick={addBottle} style={{
              background: 'rgba(217,126,44,0.15)', border: '1px solid rgba(217,126,44,0.4)',
              borderRadius: 6, color: 'var(--copper-400)', padding: '3px 10px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600,
            }}>+ Add bottle</button>
          </div>

          {/* Bottle tabs */}
          {bottles.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {bottles.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button type="button" onClick={() => setCurrentBottle(i)} style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    background: currentBottle === i ? 'rgba(217,126,44,0.15)' : 'transparent',
                    border: `1px solid ${currentBottle === i ? 'rgba(217,126,44,0.4)' : 'var(--hairline-2)'}`,
                    color: currentBottle === i ? 'var(--copper-400)' : 'var(--text-dim)',
                  }}>
                    {b.name?.slice(0, 12) || `Bottle ${i + 1}`}
                  </button>
                  {bottles.length > 1 && (
                    <button type="button" onClick={() => removeBottle(i)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}

          <BottleForm
            value={bottles[currentBottle] ?? {}}
            onChange={updateCurrentBottle}
            onAiScan={handleAiScan}
            onBarcode={handleBarcode}
            scanning={scanning}
            setScanning={setScanning}
            lookupMsg={lookupMsg}
            lookingUp={lookingUp}
          />
        </div>

        {/* Pricing */}
        {type !== 'iso' && (
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Pricing
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: 'var(--text-dim)', fontSize: '0.7rem', marginBottom: 4 }}>Asking Price ($)</label>
                <input type="number" placeholder="e.g. 75" value={askingPrice}
                  onChange={e => setAskingPrice(e.target.value)} min="0" step="0.01"
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elev-3)', border: '1px solid var(--hairline-2)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: 'var(--text-dim)', fontSize: '0.7rem', marginBottom: 4 }}>BIN Price ($) <span style={{ color: 'var(--copper-400)' }}>reserves listing</span></label>
                <input type="number" placeholder="e.g. 95" value={binPrice}
                  onChange={e => setBinPrice(e.target.value)} min="0" step="0.01"
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elev-3)', border: '1px solid var(--hairline-2)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>
            {/* Market price reference nudge */}
            {marketPrice && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(143,181,255,0.08)', border: '1px solid rgba(143,181,255,0.2)', borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 600 }}>
                  📊 Secondary market range: ${marketPrice.low}–${marketPrice.high} (avg ${marketPrice.avg})
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 8 }}>
                  · {marketPrice.source} · {marketPrice.lastUpdated}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Location + Discord */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Zip Code *</label>
            <input type="text" placeholder="60462" value={zip} onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))} maxLength={5}
              style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elev-3)', border: '1px solid var(--hairline-2)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Discord Handle</label>
            <input type="text" placeholder="@YourHandle" value={discordHandle} onChange={e => setDiscordHandle(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elev-3)', border: '1px solid var(--hairline-2)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Condition details, story, etc."
            style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elev-3)', border: '1px solid var(--hairline-2)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, resize: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Photos */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Photos ({photos.length}/4)</label>
            {photos.length < 4 && (
              <>
                <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploading}
                  style={{ background: 'rgba(217,126,44,0.15)', border: '1px solid rgba(217,126,44,0.4)', borderRadius: 6, color: 'var(--copper-400)', padding: '3px 10px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>
                  {uploading ? '⏳' : '+ Add photo'}
                </button>
              </>
            )}
          </div>
          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {photos.map((url, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--hairline-2)' }} />
                  <button type="button" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} style={{
                    position: 'absolute', top: -6, right: -6, background: 'var(--red)', border: 'none',
                    borderRadius: '50%', width: 18, height: 18, color: 'var(--text-inverse)', cursor: 'pointer', fontSize: 10, lineHeight: '18px', padding: 0,
                  }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p style={{ color: 'var(--red)', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>}

        <button type="submit" disabled={submitting} style={{
          width: '100%', padding: '13px', background: typeColors[type] || 'var(--copper-500)',
          border: 'none', borderRadius: 'var(--r-md)', color: 'var(--bg-base)', fontWeight: 800, fontSize: '0.95rem',
          cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
        }}>
          {submitting ? 'Creating…' : `Post ${TYPE_META[type]?.label ?? ''} Listing`}
        </button>
      </form>
    </Sheet>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTING CARD
// ─────────────────────────────────────────────────────────────────────────────

function copyDiscordText(listing) {
  const type = TYPE_META[listing.type]
  const isLot = listing.bottles.length > 1

  // Header line
  const headerPrice = [
    listing.askingPrice != null ? `Asking: $${listing.askingPrice}` : null,
    listing.binPrice    != null ? `BIN: $${listing.binPrice}`       : null,
  ].filter(Boolean).join(' · ')

  const lines = [
    `${type?.icon ?? '🥃'} **[${type?.label?.toUpperCase() ?? listing.type.toUpperCase()}]** ${isLot ? `Lot of ${listing.bottles.length}` : listing.bottles[0]?.name ?? ''}${headerPrice ? ` — ${headerPrice}` : ''}`,
  ]

  // Bottle details
  if (isLot) {
    listing.bottles.forEach((b, i) => {
      const meta = [b.category, b.condition, b.notes].filter(Boolean).join(' · ')
      lines.push(`  ${i + 1}. ${b.name}${meta ? ` (${meta})` : ''}`)
    })
  } else {
    const b    = listing.bottles[0] ?? {}
    const meta = [b.category, b.condition].filter(Boolean).join(' · ')
    if (meta)    lines.push(`Category/Condition: ${meta}`)
    if (b.notes) lines.push(`Bottle notes: ${b.notes}`)
  }

  // Location + contact
  const locContact = [
    listing.zip           ? `📍 ${listing.zip}`          : null,
    listing.discordHandle ? `Discord: ${listing.discordHandle}` : null,
  ].filter(Boolean).join('  ·  ')
  if (locContact) lines.push(locContact)

  // Listing notes
  if (listing.notes) lines.push(`Notes: ${listing.notes}`)

  // Posted by
  lines.push(`Posted by ${listing.submitterName} via Tater Tracker`)

  navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
}

function ListingCard({ listing, currentUserEmail, onBinClaim, onDeactivate }) {
  const type     = TYPE_META[listing.type] ?? TYPE_META.selling
  const isMine   = listing.submittedBy === currentUserEmail
  const reserved = !!listing.binReservedBy
  const [copying, setCopying] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)

  function handleCopy() {
    copyDiscordText(listing)
    setCopying(true)
    setTimeout(() => setCopying(false), 1500)
  }

  return (
    <div className="card flex flex-col gap-0 overflow-hidden" style={{
      opacity: reserved ? 0.65 : 1,
      borderColor: reserved ? 'var(--hairline-2)' : undefined,
    }}>
      {/* Type badge + meta row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px 8px' }}>
        <span style={{
          background: type.bg, color: type.color,
          border: `1px solid ${type.color}40`,
          borderRadius: 'var(--r-pill)', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
        }}>{type.icon} {type.label}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>{timeAgo(listing.timestamp)}</span>
      </div>

      {/* Photo strip */}
      {listing.photos?.length > 0 && (
        <div style={{ position: 'relative', height: 160, background: 'var(--bg-base)', overflow: 'hidden' }}>
          <img src={listing.photos[photoIdx]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {listing.photos.length > 1 && (
            <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4 }}>
              {listing.photos.map((_, i) => (
                <button key={i} onClick={() => setPhotoIdx(i)} style={{
                  width: 6, height: 6, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
                  background: i === photoIdx ? 'var(--copper-500)' : 'rgba(255,255,255,0.4)',
                }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottle list */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--hairline)' }}>
        {listing.bottles.map((b, i) => (
          <div key={i} style={{ marginBottom: i < listing.bottles.length - 1 ? 6 : 0 }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3 }}>{b.name}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
              {b.category  && <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{b.category}</span>}
              {b.condition && <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>· {b.condition}</span>}
              {b.notes     && <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>· {b.notes}</span>}
            </div>
          </div>
        ))}
        {listing.bottles.length > 1 && (
          <div style={{ marginTop: 6, color: 'var(--copper-400)', fontSize: '0.72rem', fontWeight: 600 }}>📦 Lot of {listing.bottles.length}</div>
        )}
      </div>

      {/* Pricing + location */}
      <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--hairline)' }}>
        <div>
          {listing.askingPrice != null && (
            <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.1rem', lineHeight: 1 }}>{fmtUSD(listing.askingPrice)}</div>
          )}
          {listing.binPrice != null && (
            <div style={{ color: 'var(--copper-400)', fontSize: '0.72rem', fontWeight: 600, marginTop: 2 }}>
              🔒 BIN {fmtUSD(listing.binPrice)}
            </div>
          )}
          {listing.type === 'iso' && !listing.askingPrice && (
            <div style={{ color: 'var(--violet)', fontWeight: 700, fontSize: '0.85rem' }}>In Search Of</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {listing.zip && <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>📍 {listing.zip}</div>}
          <div style={{ color: 'var(--text-dim)', fontSize: '0.68rem', marginTop: 2 }}>{listing.submitterName}</div>
          {listing.discordHandle && <div style={{ color: 'var(--blue)', fontSize: '0.68rem', marginTop: 2 }}>{listing.discordHandle}</div>}
        </div>
      </div>

      {listing.notes && (
        <div style={{ padding: '8px 14px', color: 'var(--text-muted)', fontSize: '0.78rem', borderBottom: '1px solid var(--hairline)', lineHeight: 1.5 }}>
          {listing.notes}
        </div>
      )}

      {/* Reserved banner */}
      {reserved && (
        <div style={{ background: 'var(--red-bg)', border: 'none', padding: '8px 14px', textAlign: 'center', color: 'var(--red)', fontSize: '0.78rem', fontWeight: 700 }}>
          🔒 BIN Reserved
        </div>
      )}

      {/* Action row */}
      {!reserved && (
        <div style={{ padding: '10px 14px', display: 'flex', gap: 8 }}>
          {/* BIN button — only for selling listings with a BIN price, and not the poster's own */}
          {listing.type === 'selling' && listing.binPrice != null && !isMine && (
            <button onClick={() => onBinClaim(listing.id)} style={{
              flex: 1, padding: '8px', background: 'rgba(217,126,44,0.12)',
              border: '1px solid rgba(217,126,44,0.4)', borderRadius: 'var(--r-md)',
              color: 'var(--copper-400)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
            }}>
              🔒 Claim BIN {fmtUSD(listing.binPrice)}
            </button>
          )}

          {/* Discord copy */}
          <button onClick={handleCopy} style={{
            flex: listing.type === 'selling' && listing.binPrice != null && !isMine ? 0 : 1,
            padding: '8px', background: copying ? 'var(--blue-bg)' : 'transparent',
            border: `1px solid ${copying ? 'var(--blue)' : 'var(--hairline-2)'}`, borderRadius: 8,
            color: copying ? 'var(--blue)' : 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}>
            {copying ? '✓ Copied!' : '📋 Copy for Discord'}
          </button>

          {isMine && !reserved && (
            <button onClick={() => onDeactivate(listing.id)} style={{
              padding: '8px 12px', background: 'transparent', border: 'var(--hairline-2)',
              borderRadius: 'var(--r-md)', color: 'var(--text-dim)', fontSize: '0.72rem', cursor: 'pointer',
            }}>
              Mark Sold
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKETPLACE TAB
// ─────────────────────────────────────────────────────────────────────────────

const MARKETPLACE_CATEGORIES = ['Bourbon', 'Rye', 'Scotch', 'Japanese', 'American', 'Irish', 'Tennessee', 'Other']
const MARKETPLACE_CONDITIONS  = ['Sealed', 'Open', 'Partial']

function MarketplaceTab({ userEmail }) {
  const [listings,        setListings]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(null)
  const [typeFilter,      setTypeFilter]      = useState('')
  const [activeOnly,      setActiveOnly]      = useState(true)
  const [showCreate,      setShowCreate]      = useState(false)
  const [claiming,        setClaiming]        = useState(null)
  const [searchText,      setSearchText]      = useState('')
  const [categoryFilter,  setCategoryFilter]  = useState('')
  const [conditionFilter, setConditionFilter] = useState('')
  const [sort,            setSort]            = useState('newest')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ ...(activeOnly ? { activeOnly: '1' } : {}) })
      const r = await fetch(`/api/marketplace?${params}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Failed to load')
      setListings(d.listings ?? [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [activeOnly])

  useEffect(() => { load() }, [load])

  async function handleBinClaim(id) {
    if (!confirm('Claim BIN on this listing? This marks it reserved and notifies the seller.')) return
    setClaiming(id)
    try {
      const r = await fetch('/api/marketplace', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'bin' }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setListings(prev => prev.map(l => l.id === id ? d.listing : l))
    } catch (e) { alert(e.message) }
    finally { setClaiming(null) }
  }

  async function handleDeactivate(id) {
    if (!confirm('Mark this listing as sold/traded? It will be hidden from the feed.')) return
    try {
      const r = await fetch('/api/marketplace', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'deactivate' }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setListings(prev => activeOnly ? prev.filter(l => l.id !== id) : prev.map(l => l.id === id ? d.listing : l))
    } catch (e) { alert(e.message) }
  }

  const typeCounts = useMemo(() => listings.reduce((acc, l) => {
    acc[l.type] = (acc[l.type] ?? 0) + 1; return acc
  }, {}), [listings])

  const categoryCounts = useMemo(() => {
    const counts = {}
    listings.forEach(l => l.bottles?.forEach(b => {
      if (b.category) counts[b.category] = (counts[b.category] ?? 0) + 1
    }))
    return counts
  }, [listings])

  const filteredListings = useMemo(() => {
    let result = listings
    if (typeFilter) result = result.filter(l => l.type === typeFilter)
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      result = result.filter(l => l.bottles?.some(b => b.name?.toLowerCase().includes(q)))
    }
    if (categoryFilter) result = result.filter(l => l.bottles?.some(b => b.category === categoryFilter))
    if (conditionFilter) result = result.filter(l => l.bottles?.some(b => b.condition === conditionFilter))
    if (sort === 'newest') {
      result = [...result].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    } else if (sort === 'priceLow') {
      result = [...result].sort((a, b) => (a.askingPrice ?? Infinity) - (b.askingPrice ?? Infinity))
    } else if (sort === 'priceHigh') {
      result = [...result].sort((a, b) => (b.askingPrice ?? -Infinity) - (a.askingPrice ?? -Infinity))
    }
    return result
  }, [listings, typeFilter, searchText, categoryFilter, conditionFilter, sort])

  const activeMarketplaceFilters = [
    typeFilter && `type: ${typeFilter}`,
    categoryFilter && `category: ${categoryFilter}`,
    conditionFilter && `condition: ${conditionFilter}`,
    searchText.trim() && `search: "${searchText.trim()}"`,
  ].filter(Boolean)

  const availableCategories = MARKETPLACE_CATEGORIES.filter(c => categoryCounts[c] > 0)
  const availableConditions = MARKETPLACE_CONDITIONS.filter(c => listings.some(l => l.bottles?.some(b => b.condition === c)))

  return (
    <div className="space-y-5">
      {/* Stats + New listing */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(TYPE_META).map(([key, meta]) => (
            <div key={key} className="card px-3 py-2" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: meta.color, fontSize: '0.85rem' }}>{meta.icon}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{meta.label}</span>
              <span style={{ color: meta.color, fontWeight: 700, fontSize: '0.85rem' }}>{typeCounts[key] ?? 0}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          background: 'var(--copper-500)', color: 'var(--text-inverse)', border: 'none',
          borderRadius: 'var(--r-md)', padding: '9px 18px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>+ List Bottle</button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <input
          type="search"
          placeholder="Search bottles…"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px 10px 36px', boxSizing: 'border-box',
            background: 'var(--bg-elev-2)', border: '1px solid var(--hairline-2)',
            borderRadius: 'var(--r-md)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
          }}
        />
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
      </div>

      {/* Type + Active filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</span>
        <Chip tone={!typeFilter ? 'copper' : 'neutral'} onClick={() => setTypeFilter('')}>All</Chip>
        {Object.entries(TYPE_META).map(([key, meta]) => (
          <Chip key={key} tone={typeFilter === key ? 'copper' : 'neutral'}
            onClick={() => setTypeFilter(typeFilter === key ? '' : key)}
            count={typeCounts[key]}>
            {meta.icon} {meta.label}
          </Chip>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <Chip tone={activeOnly ? 'copper' : 'neutral'} onClick={() => setActiveOnly(v => !v)}>
            {activeOnly ? 'Active only' : 'All listings'}
          </Chip>
        </div>
      </div>

      {/* Sort */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sort</span>
        <Chip tone={sort === 'newest'    ? 'copper' : 'neutral'} onClick={() => setSort('newest')}>Newest</Chip>
        <Chip tone={sort === 'priceLow'  ? 'copper' : 'neutral'} onClick={() => setSort('priceLow')}>Price: Low → High</Chip>
        <Chip tone={sort === 'priceHigh' ? 'copper' : 'neutral'} onClick={() => setSort('priceHigh')}>Price: High → Low</Chip>
      </div>

      {/* Category + Condition — only show rows when data is loaded */}
      {availableCategories.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</span>
          <Chip tone={!categoryFilter ? 'copper' : 'neutral'} onClick={() => setCategoryFilter('')}>All</Chip>
          {availableCategories.map(c => (
            <Chip key={c} tone={categoryFilter === c ? 'copper' : 'neutral'} onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)} count={categoryCounts[c]}>
              {c}
            </Chip>
          ))}
        </div>
      )}

      {availableConditions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Condition</span>
          <Chip tone={!conditionFilter ? 'copper' : 'neutral'} onClick={() => setConditionFilter('')}>Any</Chip>
          {availableConditions.map(c => (
            <Chip key={c} tone={conditionFilter === c ? 'copper' : 'neutral'} onClick={() => setConditionFilter(conditionFilter === c ? '' : c)}>
              {c}
            </Chip>
          ))}
        </div>
      )}

      {/* Result count + clear */}
      {!loading && filteredListings.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Showing <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{filteredListings.length}</span> listing{filteredListings.length !== 1 ? 's' : ''}
            {!activeOnly ? ' (incl. inactive)' : ''}
          </span>
          {activeMarketplaceFilters.length > 0 && (
            <button
              onClick={() => { setTypeFilter(''); setSearchText(''); setCategoryFilter(''); setConditionFilter('') }}
              style={{ padding: '3px 10px', background: 'transparent', border: '1px solid var(--hairline-2)', borderRadius: 'var(--r-pill)', color: 'var(--text-dim)', fontSize: '0.72rem', cursor: 'pointer' }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3 animate-pulse">
              <div style={{ height: 14, background: 'var(--bg-elev-3)', borderRadius: 4, width: '30%' }} />
              <div style={{ height: 18, background: 'var(--bg-elev-3)', borderRadius: 4, width: '85%' }} />
              <div style={{ height: 14, background: 'var(--bg-elev-3)', borderRadius: 4, width: '50%' }} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '14px 18px' }}>
          <p style={{ color: 'var(--red)', fontWeight: 600 }}>{error}</p>
        </div>
      )}

      {!loading && !error && filteredListings.length === 0 && (
        <EmptyState
          icon="Store"
          title={listings.length === 0 ? 'No listings yet' : 'No listings match your filters'}
          body={listings.length === 0
            ? 'Be the first to post a bottle'
            : activeMarketplaceFilters.length
              ? `Try removing: ${activeMarketplaceFilters.join(', ')}`
              : 'Adjust filters and try again'
          }
          ctaLabel={listings.length === 0 ? 'Post a listing' : undefined}
          onCta={listings.length === 0 ? () => setShowCreate(true) : undefined}
        />
      )}

      {!loading && filteredListings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredListings.map(l => (
            <ListingCard
              key={l.id} listing={l}
              currentUserEmail={userEmail}
              onBinClaim={handleBinClaim}
              onDeactivate={handleDeactivate}
            />
          ))}
        </div>
      )}

      <CreateListingModal
        open={showCreate}
        userEmail={userEmail}
        onClose={() => setShowCreate(false)}
        onCreated={listing => {
          setShowCreate(false)
          setListings(prev => [listing, ...prev])
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { data: session } = useSession()
  const userIsPro = isPro(session?.user?.tier)
  const [tab, setTab] = useState('marketplace')
  const tabInitialized = useRef(false)
  // Set Pro users to auctions tab on first session load (useState initial value
  // can't use session since it's null on first render)
  useEffect(() => {
    if (!tabInitialized.current && session?.user?.tier) {
      tabInitialized.current = true
      if (isPro(session.user.tier)) setTab('auctions')
    }
  }, [session?.user?.tier])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <AppHeader sub={tab === 'auctions' ? 'Unicorn Auctions · Live Deals' : 'Buy · Sell · Trade'} />
      <div className="max-w-6xl mx-auto px-4 pt-6" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>

        {/* Source toggle — same pattern as Tracker */}
        <div
          role="tablist"
          aria-label="Marketplace section"
          style={{
            display:      'inline-flex',
            background:   'var(--bg-elev-2)',
            border:       '1px solid var(--hairline-2)',
            borderRadius: 'var(--r-pill)',
            padding:      4,
            gap:          2,
            marginBottom: 'var(--sp-6)',
          }}
        >
          {[
            { key: 'auctions',    label: '🦄 Auctions',    pro: true  },
            { key: 'marketplace', label: '🥃 Marketplace',  pro: false },
          ].map(({ key, label, pro }) => {
            const active  = tab === key
            const locked  = pro && !userIsPro
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(key)}
                style={{
                  padding:      '7px 18px',
                  borderRadius: 'var(--r-pill)',
                  border:       'none',
                  background:   active ? 'var(--copper-500)' : 'transparent',
                  color:        active ? 'var(--text-inverse)' : 'var(--text-muted)',
                  fontWeight:   active ? 800 : 600,
                  fontSize:     'var(--fs-meta)',
                  cursor:       'pointer',
                  transition:   'all var(--t-fast) var(--ease-out)',
                  fontFamily:   'inherit',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          6,
                }}
              >
                {label}
                {locked && <ProInlineBadge />}
              </button>
            )
          })}
        </div>

        {tab === 'auctions'
          ? (userIsPro
              ? <AuctionsTab />
              : <ProGate
                  feature="Unicorn Auctions"
                  icon="🦄"
                  bullets={[
                    'Live auction listings for the rarest allocated bottles',
                    'Track bids on Pappy, BTAC, and other unicorns',
                    'Direct links to active auctions',
                  ]}
                />
            )
          : <MarketplaceTab userEmail={session?.user?.email} />
        }
      </div>
    </div>
  )
}
