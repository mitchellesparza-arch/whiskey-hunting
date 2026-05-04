'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import AppHeader from '../components/AppHeader.jsx'
import BarcodeScanner from '../finds/BarcodeScanner.jsx'

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
  selling: { label: 'Selling',   color: '#4ade80', bg: 'rgba(74,222,128,0.15)',   icon: '💰' },
  trading: { label: 'Trading',   color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',   icon: '🔄' },
  iso:     { label: 'ISO',       color: '#c084fc', bg: 'rgba(192,132,252,0.15)',  icon: '🔍' },
}

function FilterChip({ label, active, onClick, color, count }) {
  return (
    <button onClick={onClick} style={{
      background:   active ? (color ? `${color}22` : 'rgba(232,148,58,0.2)') : 'transparent',
      color:        active ? (color ?? '#e8943a') : '#9a7c55',
      border:       `1px solid ${active ? (color ?? '#e8943a') + '60' : '#3d2b10'}`,
      borderRadius: '999px', padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600,
      cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>
      {label}{count != null ? <span style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span> : null}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AUCTIONS TAB — Unicorn Auctions content
// ─────────────────────────────────────────────────────────────────────────────

const AUCTION_CATEGORY_META = {
  Bourbon:            { color: '#e8943a', bg: 'rgba(232,148,58,0.15)'   },
  Rye:                { color: '#f87171', bg: 'rgba(248,113,113,0.15)'  },
  Scotch:             { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)'   },
  Tennessee:          { color: '#4ade80', bg: 'rgba(74,222,128,0.15)'   },
  Japanese:           { color: '#c084fc', bg: 'rgba(192,132,252,0.15)'  },
  Irish:              { color: '#34d399', bg: 'rgba(52,211,153,0.15)'   },
  American:           { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)'   },
  Canadian:           { color: '#fb923c', bg: 'rgba(251,146,60,0.15)'   },
  'Distilled Spirits':{ color: '#a78bfa', bg: 'rgba(167,139,250,0.15)'  },
  Blended:            { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)'  },
}

function getCatStyle(cat) {
  return AUCTION_CATEGORY_META[cat] ?? { color: '#9a7c55', bg: 'rgba(154,124,85,0.15)' }
}

function discountTier(pct) {
  if (pct == null) return { color: '#9a7c55', label: '—',              glow: false }
  if (pct >= 50)   return { color: '#22c55e', label: `${pct.toFixed(1)}%`, glow: true  }
  if (pct >= 30)   return { color: '#4ade80', label: `${pct.toFixed(1)}%`, glow: false }
  if (pct >= 20)   return { color: '#a3e635', label: `${pct.toFixed(1)}%`, glow: false }
  if (pct >= 10)   return { color: '#facc15', label: `${pct.toFixed(1)}%`, glow: false }
  if (pct > 0)     return { color: '#fb923c', label: `${pct.toFixed(1)}%`, glow: false }
  return               { color: '#f87171', label: `${Math.abs(pct).toFixed(1)}% over`, glow: false }
}

function timeUrgency(endDatetime) {
  if (!endDatetime) return { label: '—', color: '#9a7c55', urgent: false }
  const ms = new Date(endDatetime).getTime() - Date.now()
  if (ms <= 0)         return { label: 'Ended',   color: '#f87171', urgent: false }
  const hours = ms / 3600000
  if (hours < 2)       return { label: fmtMs(ms), color: '#f87171', urgent: true  }
  if (hours < 12)      return { label: fmtMs(ms), color: '#fb923c', urgent: true  }
  if (hours < 24)      return { label: fmtMs(ms), color: '#facc15', urgent: false }
  return                      { label: fmtMs(ms), color: '#9a7c55', urgent: false }
}

function DealCard({ deal, rank }) {
  const catStyle = getCatStyle(deal.category)
  const disc     = discountTier(deal.discount_vs_estimate)
  const timeInfo = timeUrgency(deal.end_datetime)
  const barWidth = Math.min(Math.max(deal.discount_vs_estimate ?? 0, 0), 100)

  return (
    <div className="card flex flex-col gap-0 overflow-hidden"
      style={{ borderColor: disc.glow ? 'rgba(34,197,94,0.4)' : undefined }}>
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span style={{ color: '#6b5030', fontSize: '0.72rem', fontWeight: 600 }}>
          #{rank} · Lot {deal.lot_number ?? '—'}
        </span>
        <div className="flex items-center gap-1.5">
          {deal.section !== 'General' && (
            <span style={{
              background:   deal.section === 'Horn of Unicorn' ? 'rgba(201,168,76,0.2)' : 'rgba(58,175,169,0.2)',
              color:        deal.section === 'Horn of Unicorn' ? '#c9a84c' : '#3aafa9',
              border:       `1px solid ${deal.section === 'Horn of Unicorn' ? 'rgba(201,168,76,0.4)' : 'rgba(58,175,169,0.4)'}`,
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

      <div className="px-4 pb-3" style={{ borderBottom: '1px solid #2a1a08' }}>
        <a href={deal.lot_url} target="_blank" rel="noopener noreferrer" className="group" style={{ textDecoration: 'none' }}>
          <h3 style={{
            color: '#f5e6cc', fontWeight: 700, fontSize: '0.9rem', lineHeight: '1.3',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }} className="group-hover:text-[#e8943a] transition-colors">
            {deal.bottle_name}
          </h3>
        </a>
      </div>

      <div className="px-4 py-3 flex items-end justify-between gap-2">
        <div>
          <div style={{ color: '#9a7c55', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Current Bid</div>
          <div style={{ color: '#f5e6cc', fontSize: '1.5rem', fontWeight: 800, lineHeight: 1 }}>{fmtUSD(deal.current_bid)}</div>
          {deal.ua_estimate_display && <div style={{ color: '#9a7c55', fontSize: '0.75rem', marginTop: 3 }}>est. {deal.ua_estimate_display}</div>}
        </div>
        <div style={{
          background: `${disc.color}18`, border: `1px solid ${disc.color}50`,
          borderRadius: 10, padding: '6px 12px', textAlign: 'center', flexShrink: 0,
        }}>
          <div style={{ color: disc.color, fontSize: '1.25rem', fontWeight: 800, lineHeight: 1 }}>{disc.label}</div>
          <div style={{ color: disc.color + 'aa', fontSize: '0.6rem', marginTop: 2 }}>
            {(deal.discount_vs_estimate ?? 0) > 0 ? 'below est.' : 'above est.'}
          </div>
        </div>
      </div>

      <div className="px-4" style={{ paddingBottom: 10 }}>
        <div style={{ background: '#2a1a08', borderRadius: 4, height: 4, overflow: 'hidden' }}>
          <div style={{ width: `${barWidth}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${disc.color}88, ${disc.color})`, transition: 'width 0.6s ease' }} />
        </div>
      </div>

      <div className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ borderTop: '1px solid #2a1a08' }}>
        <div className="flex items-center gap-3">
          <span style={{ color: timeInfo.color, fontSize: '0.75rem', fontWeight: 600 }}>
            {timeInfo.urgent && <span style={{ marginRight: 3 }}>⏱</span>}{timeInfo.label}
          </span>
          {deal.reserve_price != null && (
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: deal.reserve_met ? '#4ade80' : '#9a7c55' }}>
              {deal.reserve_met ? '✓ Reserve met' : 'No reserve'}
            </span>
          )}
        </div>
        <a href={deal.lot_url} target="_blank" rel="noopener noreferrer" style={{
          background: '#e8943a', color: '#fff', fontWeight: 700, fontSize: '0.72rem',
          borderRadius: 7, padding: '5px 12px', textDecoration: 'none', whiteSpace: 'nowrap',
        }}>Bid Now →</a>
      </div>
    </div>
  )
}

function AuctionsTab() {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [category,  setCategory]  = useState('')
  const [sort,      setSort]      = useState('discount')
  const [minBid,    setMinBid]    = useState(0)
  const [showCount, setShowCount] = useState(20)

  const fetchDeals = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ limit: '100', sort, ...(category ? { category } : {}), ...(minBid > 0 ? { minBid: String(minBid) } : {}) })
      const res  = await fetch(`/api/unicorn-deals?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Unknown error')
      setData(json)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [category, sort, minBid])

  useEffect(() => { fetchDeals() }, [fetchDeals])
  useEffect(() => setShowCount(20), [category, sort, minBid])

  const deals        = data?.deals ?? []
  const visibleDeals = deals.slice(0, showCount)
  const catCounts    = data?.category_counts ?? {}
  const whiskeyCats  = ['Bourbon','Rye','Tennessee','Scotch','American','Japanese','Irish','Canadian','Distilled Spirits','Blended'].filter(c => catCounts[c])
  const MIN_BID_OPTS = [0, 50, 100, 250, 500, 1000]

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
            <span style={{ color: weekend === 'sunday' ? '#f87171' : '#e8943a', fontWeight: 700, fontSize: '0.9rem' }}>
              {weekend === 'sunday' ? 'Auctions closing today' : 'Auctions closing tomorrow'}
            </span>
            <span style={{ color: '#9a7c55', fontSize: '0.82rem', marginLeft: 8 }}>
              {weekend === 'sunday' ? 'Final bids — watch closely' : 'Plenty of time to plan your bids'}
            </span>
          </div>
        </div>
      )}

      {data && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Whiskey Lots',   value: data.total_lots?.toLocaleString() ?? '—',            color: '#f5e6cc' },
            { label: 'Below Estimate', value: data.total_with_discount?.toLocaleString() ?? '—',   color: '#4ade80' },
            { label: 'Showing',        value: `${data.total_filtered ?? deals.length} filtered`,   color: '#e8943a' },
            { label: 'Data Age',       value: timeAgo(new Date(data.scraped_at).getTime()),         color: '#9a7c55' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card px-4 py-3">
              <div style={{ color: '#9a7c55', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              <div style={{ color, fontSize: '1.1rem', fontWeight: 700, marginTop: 3 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span style={{ color: '#6b5030', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</span>
          <FilterChip label="All" active={!category} onClick={() => setCategory('')} />
          {whiskeyCats.map(c => <FilterChip key={c} label={c} active={category === c} onClick={() => setCategory(category === c ? '' : c)} color={getCatStyle(c).color} count={catCounts[c]} />)}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span style={{ color: '#6b5030', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sort</span>
          <FilterChip label="Best Discount" active={sort === 'discount'} onClick={() => setSort('discount')} />
          <FilterChip label="Closing Soon"  active={sort === 'closing'}  onClick={() => setSort('closing')} />
          <span style={{ color: '#6b5030', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: 8 }}>Min Bid</span>
          {MIN_BID_OPTS.map(v => <FilterChip key={v} label={v === 0 ? 'Any' : `$${v.toLocaleString()}+`} active={minBid === v} onClick={() => setMinBid(v)} />)}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={fetchDeals} disabled={loading} className="btn-primary" style={{ fontSize: '0.78rem', padding: '6px 14px' }}>
          {loading ? 'Loading…' : '↺ Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '16px 20px' }}>
          <p style={{ color: '#f87171', fontWeight: 600 }}>Failed to load deals</p>
          <p style={{ color: '#9a7c55', fontSize: '0.85rem', marginTop: 4 }}>{error}</p>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3 animate-pulse">
              <div style={{ height: 12, background: '#2a1a08', borderRadius: 4, width: '40%' }} />
              <div style={{ height: 16, background: '#2a1a08', borderRadius: 4, width: '90%' }} />
              <div style={{ height: 32, background: '#2a1a08', borderRadius: 4, width: '50%' }} />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && deals.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b5030' }}>
          <div style={{ fontSize: '3rem' }}>🦄</div>
          <p style={{ marginTop: 12, fontWeight: 600, color: '#9a7c55' }}>No deals match your filters</p>
        </div>
      )}

      {!loading && !error && visibleDeals.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleDeals.map((deal, i) => <DealCard key={deal.lot_id ?? i} deal={deal} rank={i + 1} />)}
          </div>
          {deals.length > showCount && (
            <div style={{ textAlign: 'center', paddingTop: 8 }}>
              <button onClick={() => setShowCount(c => c + 20)} style={{
                border: '1px solid #3d2b10', borderRadius: 8, padding: '10px 24px',
                color: '#9a7c55', background: 'transparent', fontSize: '0.85rem', cursor: 'pointer',
              }}>
                Show more ({deals.length - showCount} remaining)
              </button>
            </div>
          )}
        </>
      )}

      <div style={{ borderTop: '1px solid #2a1a08', paddingTop: 16, textAlign: 'center', color: '#6b5030', fontSize: '0.78rem' }}>
        Data from <a href="https://www.unicornauctions.com" target="_blank" rel="noopener noreferrer" style={{ color: '#9a7c55' }}>unicornauctions.com</a>
        {data?.scraped_at && <> · Last updated {new Date(data.scraped_at).toLocaleString()}</>}
      </div>
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
          flex: 1, padding: '8px', background: '#1f1308', border: '1px solid #3d2b10',
          borderRadius: 8, color: '#9a7c55', fontSize: 12, cursor: 'pointer',
        }}>📷 Scan Label (AI)</button>
        <button type="button" onClick={() => setScanning('barcode')} disabled={lookingUp} style={{
          flex: 1, padding: '8px', background: '#1f1308', border: '1px solid #3d2b10',
          borderRadius: 8, color: '#9a7c55', fontSize: 12, cursor: 'pointer',
        }}>🔍 Scan Barcode</button>
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment"
          onChange={e => onAiScan(e)} style={{ display: 'none' }} />
      </div>

      {scanning === 'barcode' && (
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #3d2b10' }}>
          <BarcodeScanner onDetected={code => { onBarcode(code); setScanning(false) }} />
          <button type="button" onClick={() => setScanning(false)} style={{ width: '100%', padding: 8, background: '#1f1308', border: 'none', color: '#9a7c55', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
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

      {lookingUp && <p style={{ color: '#e8943a', fontSize: 12, textAlign: 'center' }}>🔍 Reading label…</p>}
      {lookupMsg && <p style={{ color: '#4ade80', fontSize: 12, textAlign: 'center' }}>{lookupMsg}</p>}

      <input
        type="text" placeholder="Bottle name *" value={value.name ?? ''}
        onChange={e => onChange({ ...value, name: e.target.value })}
        style={{ width: '100%', padding: '9px 12px', background: '#1f1308', border: '1px solid #3d2b10', borderRadius: 8, color: '#f5e6cc', fontSize: 14, boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={value.category ?? ''} onChange={e => onChange({ ...value, category: e.target.value })}
          style={{ flex: 1, padding: '9px 12px', background: '#1f1308', border: '1px solid #3d2b10', borderRadius: 8, color: value.category ? '#f5e6cc' : '#6b5030', fontSize: 13 }}>
          <option value="">Category</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={value.condition ?? ''} onChange={e => onChange({ ...value, condition: e.target.value })}
          style={{ flex: 1, padding: '9px 12px', background: '#1f1308', border: '1px solid #3d2b10', borderRadius: 8, color: value.condition ? '#f5e6cc' : '#6b5030', fontSize: 13 }}>
          <option value="">Condition</option>
          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <input
        type="text" placeholder="Bottle notes (optional)" value={value.notes ?? ''}
        onChange={e => onChange({ ...value, notes: e.target.value })}
        style={{ width: '100%', padding: '9px 12px', background: '#1f1308', border: '1px solid #3d2b10', borderRadius: 8, color: '#f5e6cc', fontSize: 13, boxSizing: 'border-box' }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE LISTING MODAL
// ─────────────────────────────────────────────────────────────────────────────

function CreateListingModal({ onClose, onCreated, userEmail }) {
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
  const photoInputRef = useRef(null)

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
      const r = await fetch(`/api/whiskey-db?upc=${encodeURIComponent(code)}`)
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

  const typeColors = { selling: '#4ade80', trading: '#60a5fa', iso: '#c084fc' }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#0f0a05', borderRadius: '18px 18px 0 0',
        border: '1px solid #3d2b10', borderBottom: 'none',
        width: '100%', maxWidth: 560, maxHeight: '92vh',
        overflowY: 'auto', padding: '24px 20px 40px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#f5e6cc', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Create Listing</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b5030', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Type selector */}
          <div>
            <label style={{ display: 'block', color: '#9a7c55', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Listing Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.entries(TYPE_META).map(([key, meta]) => (
                <button key={key} type="button" onClick={() => setType(key)} style={{
                  flex: 1, padding: '10px 8px',
                  background: type === key ? `${meta.color}18` : 'transparent',
                  border: `1px solid ${type === key ? meta.color + '60' : '#3d2b10'}`,
                  borderRadius: 10, color: type === key ? meta.color : '#6b5030',
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
              <label style={{ color: '#9a7c55', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Bottles ({bottles.length})
              </label>
              <button type="button" onClick={addBottle} style={{
                background: 'rgba(232,148,58,0.15)', border: '1px solid rgba(232,148,58,0.4)',
                borderRadius: 6, color: '#e8943a', padding: '3px 10px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600,
              }}>+ Add bottle</button>
            </div>

            {/* Bottle tabs */}
            {bottles.length > 1 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {bottles.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button type="button" onClick={() => setCurrentBottle(i)} style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      background: currentBottle === i ? 'rgba(232,148,58,0.2)' : 'transparent',
                      border: `1px solid ${currentBottle === i ? 'rgba(232,148,58,0.5)' : '#3d2b10'}`,
                      color: currentBottle === i ? '#e8943a' : '#6b5030',
                    }}>
                      {b.name?.slice(0, 12) || `Bottle ${i + 1}`}
                    </button>
                    {bottles.length > 1 && (
                      <button type="button" onClick={() => removeBottle(i)} style={{ background: 'none', border: 'none', color: '#6b5030', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>✕</button>
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
              <label style={{ display: 'block', color: '#9a7c55', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Pricing
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: '#6b5030', fontSize: '0.7rem', marginBottom: 4 }}>Asking Price ($)</label>
                  <input type="number" placeholder="e.g. 75" value={askingPrice}
                    onChange={e => setAskingPrice(e.target.value)} min="0" step="0.01"
                    style={{ width: '100%', padding: '9px 12px', background: '#1f1308', border: '1px solid #3d2b10', borderRadius: 8, color: '#f5e6cc', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: '#6b5030', fontSize: '0.7rem', marginBottom: 4 }}>BIN Price ($) <span style={{ color: '#e8943a' }}>reserves listing</span></label>
                  <input type="number" placeholder="e.g. 95" value={binPrice}
                    onChange={e => setBinPrice(e.target.value)} min="0" step="0.01"
                    style={{ width: '100%', padding: '9px 12px', background: '#1f1308', border: '1px solid #3d2b10', borderRadius: 8, color: '#f5e6cc', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>
          )}

          {/* Location + Discord */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: '#9a7c55', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Zip Code *</label>
              <input type="text" placeholder="60462" value={zip} onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))} maxLength={5}
                style={{ width: '100%', padding: '9px 12px', background: '#1f1308', border: '1px solid #3d2b10', borderRadius: 8, color: '#f5e6cc', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', color: '#9a7c55', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Discord Handle</label>
              <input type="text" placeholder="@YourHandle" value={discordHandle} onChange={e => setDiscordHandle(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: '#1f1308', border: '1px solid #3d2b10', borderRadius: 8, color: '#f5e6cc', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', color: '#9a7c55', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Condition details, story, etc."
              style={{ width: '100%', padding: '9px 12px', background: '#1f1308', border: '1px solid #3d2b10', borderRadius: 8, color: '#f5e6cc', fontSize: 13, resize: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Photos */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ color: '#9a7c55', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Photos ({photos.length}/4)</label>
              {photos.length < 4 && (
                <>
                  <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploading}
                    style={{ background: 'rgba(232,148,58,0.15)', border: '1px solid rgba(232,148,58,0.4)', borderRadius: 6, color: '#e8943a', padding: '3px 10px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>
                    {uploading ? '⏳' : '+ Add photo'}
                  </button>
                </>
              )}
            </div>
            {photos.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {photos.map((url, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #3d2b10' }} />
                    <button type="button" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} style={{
                      position: 'absolute', top: -6, right: -6, background: '#f87171', border: 'none',
                      borderRadius: '50%', width: 18, height: 18, color: '#fff', cursor: 'pointer', fontSize: 10, lineHeight: '18px', padding: 0,
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p style={{ color: '#f87171', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>}

          <button type="submit" disabled={submitting} style={{
            width: '100%', padding: '13px', background: typeColors[type] || '#e8943a',
            border: 'none', borderRadius: 10, color: '#0f0a05', fontWeight: 800, fontSize: '0.95rem',
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? 'Creating…' : `Post ${TYPE_META[type]?.label ?? ''} Listing`}
          </button>
        </form>
      </div>
    </div>
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
      borderColor: reserved ? '#3d2b10' : undefined,
    }}>
      {/* Type badge + meta row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px 8px' }}>
        <span style={{
          background: type.bg, color: type.color,
          border: `1px solid ${type.color}40`,
          borderRadius: '999px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
        }}>{type.icon} {type.label}</span>
        <span style={{ color: '#6b5030', fontSize: '0.68rem' }}>{timeAgo(listing.timestamp)}</span>
      </div>

      {/* Photo strip */}
      {listing.photos?.length > 0 && (
        <div style={{ position: 'relative', height: 160, background: '#0a0603', overflow: 'hidden' }}>
          <img src={listing.photos[photoIdx]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {listing.photos.length > 1 && (
            <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4 }}>
              {listing.photos.map((_, i) => (
                <button key={i} onClick={() => setPhotoIdx(i)} style={{
                  width: 6, height: 6, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
                  background: i === photoIdx ? '#e8943a' : 'rgba(255,255,255,0.4)',
                }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottle list */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #2a1a08' }}>
        {listing.bottles.map((b, i) => (
          <div key={i} style={{ marginBottom: i < listing.bottles.length - 1 ? 6 : 0 }}>
            <div style={{ color: '#f5e6cc', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3 }}>{b.name}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
              {b.category  && <span style={{ color: '#9a7c55', fontSize: '0.68rem' }}>{b.category}</span>}
              {b.condition && <span style={{ color: '#9a7c55', fontSize: '0.68rem' }}>· {b.condition}</span>}
              {b.notes     && <span style={{ color: '#9a7c55', fontSize: '0.68rem' }}>· {b.notes}</span>}
            </div>
          </div>
        ))}
        {listing.bottles.length > 1 && (
          <div style={{ marginTop: 6, color: '#e8943a', fontSize: '0.72rem', fontWeight: 600 }}>📦 Lot of {listing.bottles.length}</div>
        )}
      </div>

      {/* Pricing + location */}
      <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2a1a08' }}>
        <div>
          {listing.askingPrice != null && (
            <div style={{ color: '#f5e6cc', fontWeight: 800, fontSize: '1.1rem', lineHeight: 1 }}>{fmtUSD(listing.askingPrice)}</div>
          )}
          {listing.binPrice != null && (
            <div style={{ color: '#e8943a', fontSize: '0.72rem', fontWeight: 600, marginTop: 2 }}>
              🔒 BIN {fmtUSD(listing.binPrice)}
            </div>
          )}
          {listing.type === 'iso' && !listing.askingPrice && (
            <div style={{ color: '#c084fc', fontWeight: 700, fontSize: '0.85rem' }}>In Search Of</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {listing.zip && <div style={{ color: '#9a7c55', fontSize: '0.72rem' }}>📍 {listing.zip}</div>}
          <div style={{ color: '#6b5030', fontSize: '0.68rem', marginTop: 2 }}>{listing.submitterName}</div>
          {listing.discordHandle && <div style={{ color: '#5865F2', fontSize: '0.68rem', marginTop: 2 }}>{listing.discordHandle}</div>}
        </div>
      </div>

      {listing.notes && (
        <div style={{ padding: '8px 14px', color: '#9a7c55', fontSize: '0.78rem', borderBottom: '1px solid #2a1a08', lineHeight: 1.5 }}>
          {listing.notes}
        </div>
      )}

      {/* Reserved banner */}
      {reserved && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: 'none', padding: '8px 14px', textAlign: 'center', color: '#f87171', fontSize: '0.78rem', fontWeight: 700 }}>
          🔒 BIN Reserved
        </div>
      )}

      {/* Action row */}
      {!reserved && (
        <div style={{ padding: '10px 14px', display: 'flex', gap: 8 }}>
          {/* BIN button — only for selling listings with a BIN price, and not the poster's own */}
          {listing.type === 'selling' && listing.binPrice != null && !isMine && (
            <button onClick={() => onBinClaim(listing.id)} style={{
              flex: 1, padding: '8px', background: 'rgba(232,148,58,0.15)',
              border: '1px solid rgba(232,148,58,0.5)', borderRadius: 8,
              color: '#e8943a', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
            }}>
              🔒 Claim BIN {fmtUSD(listing.binPrice)}
            </button>
          )}

          {/* Discord copy */}
          <button onClick={handleCopy} style={{
            flex: listing.type === 'selling' && listing.binPrice != null && !isMine ? 0 : 1,
            padding: '8px', background: copying ? 'rgba(88,101,242,0.2)' : 'transparent',
            border: `1px solid ${copying ? '#5865F2' : '#3d2b10'}`, borderRadius: 8,
            color: copying ? '#5865F2' : '#6b5030', fontSize: '0.75rem', cursor: 'pointer',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}>
            {copying ? '✓ Copied!' : '📋 Copy for Discord'}
          </button>

          {isMine && !reserved && (
            <button onClick={() => onDeactivate(listing.id)} style={{
              padding: '8px 12px', background: 'transparent', border: '1px solid #3d2b10',
              borderRadius: 8, color: '#6b5030', fontSize: '0.72rem', cursor: 'pointer',
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

function MarketplaceTab({ userEmail }) {
  const [listings,    setListings]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [typeFilter,  setTypeFilter]  = useState('')
  const [activeOnly,  setActiveOnly]  = useState(true)
  const [showCreate,  setShowCreate]  = useState(false)
  const [claiming,    setClaiming]    = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ ...(typeFilter ? { type: typeFilter } : {}), ...(activeOnly ? { activeOnly: '1' } : {}) })
      const r = await fetch(`/api/marketplace?${params}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Failed to load')
      setListings(d.listings ?? [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [typeFilter, activeOnly])

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

  const typeCounts = listings.reduce((acc, l) => {
    acc[l.type] = (acc[l.type] ?? 0) + 1; return acc
  }, {})

  return (
    <div className="space-y-5">
      {/* Stats + New listing */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(TYPE_META).map(([key, meta]) => (
            <div key={key} className="card px-3 py-2" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: meta.color, fontSize: '0.85rem' }}>{meta.icon}</span>
              <span style={{ color: '#9a7c55', fontSize: '0.72rem' }}>{meta.label}</span>
              <span style={{ color: meta.color, fontWeight: 700, fontSize: '0.85rem' }}>{typeCounts[key] ?? 0}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          background: '#e8943a', color: '#0f0a05', border: 'none',
          borderRadius: 9, padding: '9px 18px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>+ List Bottle</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <FilterChip label="All Types" active={!typeFilter} onClick={() => setTypeFilter('')} />
        {Object.entries(TYPE_META).map(([key, meta]) => (
          <FilterChip key={key} label={`${meta.icon} ${meta.label}`} active={typeFilter === key}
            onClick={() => setTypeFilter(typeFilter === key ? '' : key)} color={meta.color}
            count={typeCounts[key]} />
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <FilterChip label={activeOnly ? 'Active only' : 'All listings'} active={activeOnly} onClick={() => setActiveOnly(v => !v)} />
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3 animate-pulse">
              <div style={{ height: 14, background: '#2a1a08', borderRadius: 4, width: '30%' }} />
              <div style={{ height: 18, background: '#2a1a08', borderRadius: 4, width: '85%' }} />
              <div style={{ height: 14, background: '#2a1a08', borderRadius: 4, width: '50%' }} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '14px 18px' }}>
          <p style={{ color: '#f87171', fontWeight: 600 }}>{error}</p>
        </div>
      )}

      {!loading && !error && listings.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: '3rem' }}>🥃</div>
          <p style={{ color: '#9a7c55', fontWeight: 600, marginTop: 12 }}>No listings yet</p>
          <p style={{ color: '#6b5030', fontSize: '0.85rem', marginTop: 4 }}>Be the first to post a bottle</p>
          <button onClick={() => setShowCreate(true)} style={{
            marginTop: 16, background: '#e8943a', color: '#0f0a05', border: 'none',
            borderRadius: 9, padding: '10px 24px', fontWeight: 700, cursor: 'pointer',
          }}>Post a listing</button>
        </div>
      )}

      {!loading && listings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {listings.map(l => (
            <ListingCard
              key={l.id} listing={l}
              currentUserEmail={userEmail}
              onBinClaim={handleBinClaim}
              onDeactivate={handleDeactivate}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateListingModal
          userEmail={userEmail}
          onClose={() => setShowCreate(false)}
          onCreated={listing => {
            setShowCreate(false)
            setListings(prev => [listing, ...prev])
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { data: session } = useSession()
  const [tab, setTab]     = useState('auctions')

  const headerAction = (
    <div style={{ display: 'flex', gap: 6 }}>
      {['auctions', 'marketplace'].map(t => (
        <button key={t} onClick={() => setTab(t)} style={{
          padding: '5px 14px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
          background:   tab === t ? 'rgba(232,148,58,0.2)' : 'transparent',
          border:       `1px solid ${tab === t ? 'rgba(232,148,58,0.6)' : '#3d2b10'}`,
          color:        tab === t ? '#e8943a' : '#6b5030',
          transition:   'all 0.15s',
        }}>
          {t === 'auctions' ? '🦄 Auctions' : '🥃 Marketplace'}
        </button>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <AppHeader sub={tab === 'auctions' ? 'Unicorn Auctions · Live Deals' : 'Buy · Sell · Trade'} action={headerAction} />
      <div className="max-w-6xl mx-auto px-4 py-6">
        {tab === 'auctions'
          ? <AuctionsTab />
          : <MarketplaceTab userEmail={session?.user?.email} />
        }
      </div>
    </div>
  )
}
