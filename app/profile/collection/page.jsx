'use client'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Link           from 'next/link'
import BarcodeScanner from '../../finds/BarcodeScanner.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORIES  = ['Bourbon', 'Rye', 'Scotch', 'Japanese', 'American', 'Irish']

// Bar-shelf SVG — replaces the 📦 box emoji throughout this page
function ShelfIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'inline', verticalAlign: 'middle' }}>
      {/* Shelf plank */}
      <rect x="1"    y="17.5" width="22"  height="2.5" rx="1"   fill="#8B4513" />
      {/* Bottle 1 — tall bourbon */}
      <rect x="3"    y="8"    width="3.5" height="9.5" rx="1"   fill="#c46c1a" />
      <rect x="4"    y="5.5"  width="1.5" height="2.5" rx="0.5" fill="#c46c1a" />
      <rect x="3.5"  y="5.5"  width="2.5" height="1"   rx="0.5" fill="#a05010" />
      {/* Bottle 2 — medium */}
      <rect x="9"    y="10"   width="3.5" height="7.5" rx="1"   fill="#d4a054" />
      <rect x="10"   y="7.5"  width="1.5" height="2.5" rx="0.5" fill="#d4a054" />
      {/* Bottle 3 — tall */}
      <rect x="15.5" y="8"    width="3.5" height="9.5" rx="1"   fill="#e8943a" />
      <rect x="16.5" y="5.5"  width="1.5" height="2.5" rx="0.5" fill="#e8943a" />
      <rect x="16"   y="5.5"  width="2.5" height="1"   rx="0.5" fill="#c47020" />
    </svg>
  )
}
const SORT_OPTIONS = [
  { key: 'score',     label: '🏆 Score'     },
  { key: 'secondary', label: '💰 Secondary' },
  { key: 'msrp',      label: 'MSRP'         },
  { key: 'name',      label: 'Name'          },
]

function scoreColor(score) {
  if (score >= 85) return '#4ade80'
  if (score >= 75) return '#e8943a'
  return '#9a7c55'
}

function fmt$(n) {
  if (!n) return '—'
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ── Unicorn auction helpers ───────────────────────────────────────────────────

function normalizeName(s) {
  return s.toLowerCase()
    .replace(/['''‘’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findUnicornMatches(bottleName, deals) {
  if (!bottleName || !deals?.length) return []
  const norm  = normalizeName(bottleName)
  const words = norm.split(' ').filter(w => w.length > 3)
  if (!words.length) return []
  return deals.filter(d => {
    const hay  = normalizeName(d.bottle_name)
    const hits = words.filter(w => hay.includes(w)).length
    // first significant word (brand) must match + at least 1 more when 3+ words
    if (!hay.includes(words[0])) return false
    if (words.length === 1) return true
    if (words.length === 2) return hits >= 1
    return hits >= 2
  })
}

function timeLeft(isoStr) {
  if (!isoStr) return null
  const ms = new Date(isoStr).getTime() - Date.now()
  if (ms < 0) return 'ended'
  const h = Math.floor(ms / 3600000)
  if (h < 24) return `${h}h left`
  return `${Math.floor(h / 24)}d left`
}

// ── Bottle Card ───────────────────────────────────────────────────────────────

function BottleCard({ bottle, onRemove, onEdit, unicornMatches }) {
  const score = bottle.blindScore

  // Best unicorn lot — highest current bid
  const bestMatch = unicornMatches?.length
    ? unicornMatches.reduce((a, b) => ((b.current_bid || 0) > (a.current_bid || 0) ? b : a))
    : null
  const auctionBid  = bestMatch ? (bestMatch.current_bid || 0) : 0
  const msrpPremium = bottle.msrp > 0 && auctionBid > 0
    ? Math.round((auctionBid - bottle.msrp) / bottle.msrp * 100)
    : null
  const tl = bestMatch ? timeLeft(bestMatch.end_datetime) : null

  return (
    <div
      className="card"
      onClick={() => onEdit(bottle)}
      style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden', cursor: 'pointer' }}
    >
      {/* ── Main row ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex' }}>

        {/* Score Column */}
        <div style={{
          width:          64,
          flexShrink:     0,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '12px 0',
          background:     '#1f1308',
          borderRight:    '1px solid #2a1c08',
          gap:            2,
        }}>
          <div style={{ fontSize: 10, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</div>
          <div style={{ fontWeight: 800, fontSize: score != null ? 24 : 18, color: score != null ? scoreColor(score) : '#3d2b10', lineHeight: 1 }}>
            {score != null ? score.toFixed(0) : '—'}
          </div>
          <div style={{ fontSize: 9, color: '#6b5030' }}>{bottle.tastings ?? 0} tastings</div>
        </div>

        {/* Middle: info */}
        <div style={{ flex: 1, padding: '12px 12px', minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#f5e6cc', lineHeight: 1.3, marginBottom: 3 }}>
            {bottle.name}
          </div>
          <div style={{ fontSize: 11, color: '#9a7c55', marginBottom: 6 }}>
            {[bottle.distillery, bottle.proof ? `${bottle.proof}°` : null, bottle.qty > 1 ? `×${bottle.qty}` : null].filter(Boolean).join(' · ')}
          </div>
          {bottle.flavors?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {bottle.flavors.map(f => (
                <span key={f} style={{
                  fontSize:     10,
                  color:        '#9a7c55',
                  background:   '#1f1308',
                  border:       '1px solid #2a1c08',
                  borderRadius: 999,
                  padding:      '2px 7px',
                }}>{f}</span>
              ))}
            </div>
          )}
        </div>

        {/* Right: prices + remove */}
        <div style={{
          flexShrink:     0,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'flex-end',
          justifyContent: 'space-between',
          padding:        '10px 12px',
          gap:            4,
        }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#6b5030', textTransform: 'uppercase' }}>MSRP</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#c9a87a' }}>{fmt$(bottle.msrp)}</div>
          </div>
          {bottle.secondary > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: '#6b5030', textTransform: 'uppercase' }}>2ndary</div>
              <div style={{
                fontWeight: 700,
                fontSize:   14,
                color:      bottle.secondary > (bottle.msrp ?? 0) * 1.4 ? '#4ade80' : '#9a7c55',
              }}>{fmt$(bottle.secondary)}</div>
            </div>
          )}
          <button
            onClick={e => { e.stopPropagation(); onRemove(bottle.id) }}
            style={{
              background: 'none',
              border:     'none',
              color:      '#6b5030',
              cursor:     'pointer',
              fontSize:   16,
              padding:    0,
              lineHeight: 1,
            }}
          >✕</button>
        </div>
      </div>

      {/* ── Unicorn Auction Footer ─────────────────────────────────── */}
      {bestMatch && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            borderTop:      '1px solid #2a1c08',
            padding:        '6px 12px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            background:     '#0c0804',
            gap:            8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', minWidth: 0 }}>
            <span style={{ fontSize: 11, color: '#9a7c55' }}>🔨</span>
            {auctionBid > 0 ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f5e6cc' }}>
                ${auctionBid.toLocaleString()} bid
              </span>
            ) : (
              <span style={{ fontSize: 12, color: '#6b5030' }}>No bids yet</span>
            )}
            {msrpPremium !== null && msrpPremium > 0 && (
              <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>
                +{msrpPremium}% vs MSRP
              </span>
            )}
            {unicornMatches.length > 1 && (
              <span style={{ fontSize: 11, color: '#6b5030' }}>
                ({unicornMatches.length} lots)
              </span>
            )}
            {tl && (
              <span style={{ fontSize: 10, color: '#6b5030' }}>{tl}</span>
            )}
          </div>
          <a
            href={bestMatch.lot_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: '#e8943a', textDecoration: 'none', fontWeight: 700, flexShrink: 0 }}
          >
            view →
          </a>
        </div>
      )}
    </div>
  )
}

// ── Sample Card ───────────────────────────────────────────────────────────────

function SampleCard({ sample, onRemove }) {
  const TYPE_ICON  = { Mule: '🫏', Handshake: '🤝', Other: '🥃' }
  const TYPE_COLOR = { Mule: '#e8943a', Handshake: '#4ade80', Other: '#9a7c55' }
  const icon  = TYPE_ICON[sample.type]  ?? '🥃'
  const color = TYPE_COLOR[sample.type] ?? '#9a7c55'

  return (
    <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px' }}>
      <div style={{
        width: 40, height: 40, borderRadius: 8,
        background: '#1f1308', border: '1px solid #3d2b10',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#f5e6cc', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sample.name}</div>
        <div style={{ fontSize: 11 }}>
          <span style={{ color: '#9a7c55' }}>from </span>
          <span style={{ color }}>{sample.from}</span>
          <span style={{ color: '#3d2b10', margin: '0 5px' }}>·</span>
          <span style={{ color, fontWeight: 600 }}>{sample.type}</span>
        </div>
        {sample.notes && <div style={{ fontSize: 11, color: '#6b5030', marginTop: 2, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sample.notes}</div>}
      </div>
      <button onClick={() => onRemove(sample.id)} style={{ background: 'none', border: 'none', color: '#6b5030', cursor: 'pointer', fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>
    </div>
  )
}

// ── Add Sample Sheet ──────────────────────────────────────────────────────────

function AddSampleSheet({ onClose, onAdd }) {
  const [name,       setName]       = useState('')
  const [fromText,   setFromText]   = useState('')
  const [fromEmail,  setFromEmail]  = useState(null)
  const [type,       setType]       = useState('Mule')
  const [notes,      setNotes]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState(null)
  const [friends,    setFriends]    = useState([])
  const [showFriends,setShowFriends]= useState(false)

  useEffect(() => {
    fetch('/api/friends')
      .then(r => r.json())
      .then(d => setFriends(d.friends ?? []))
      .catch(() => {})
  }, [])

  const labelStyle = { display: 'block', fontSize: 10, fontWeight: 700, color: '#9a7c55', marginBottom: 4, marginTop: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }
  const inputStyle = { width: '100%', padding: '9px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim())    return setError('Bottle name is required')
    if (!fromText.trim()) return setError('From is required')
    setSubmitting(true)
    setError(null)
    try {
      const res  = await fetch('/api/samples', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, from: fromText, fromEmail, type, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add sample')
      onAdd(data.sample)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 99 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: '#1a1008', borderRadius: '16px 16px 0 0',
        borderTop: '1px solid #3d2b10',
        maxHeight: '90vh', overflowY: 'auto',
        padding: '20px 16px calc(20px + env(safe-area-inset-bottom))',
        animation: 'slideUp 0.2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#f5e6cc' }}>🥃 Add a Sample</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9a7c55', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Bottle Name *</label>
          <input style={inputStyle} placeholder="e.g. Blanton's Single Barrel" value={name} onChange={e => setName(e.target.value)} required />

          <label style={labelStyle}>From (who gave it) *</label>
          <div style={{ position: 'relative' }}>
            <input
              style={inputStyle}
              placeholder="Name or select a friend"
              value={fromText}
              onChange={e => { setFromText(e.target.value); setFromEmail(null); setShowFriends(false) }}
              onFocus={() => setShowFriends(friends.length > 0)}
            />
            {showFriends && friends.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: '#1f1308', border: '1px solid #3d2b10', borderRadius: '0 0 8px 8px',
                maxHeight: 160, overflowY: 'auto',
              }}>
                {friends.map(f => (
                  <button
                    key={f.email}
                    type="button"
                    onClick={() => { setFromText(f.name ?? f.email); setFromEmail(f.email); setShowFriends(false) }}
                    style={{ width: '100%', padding: '9px 12px', background: 'none', border: 'none', borderTop: '1px solid #2a1c08', color: '#f5e6cc', fontSize: 13, textAlign: 'left', cursor: 'pointer' }}
                  >
                    {f.name ?? f.email}
                    <span style={{ color: '#6b5030', fontSize: 11, marginLeft: 6 }}>{f.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <label style={labelStyle}>Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Mule', 'Handshake', 'Other'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  background: type === t ? '#e8943a' : '#1f1308',
                  color:      type === t ? '#fff'     : '#6b5030',
                }}
              >
                {t === 'Mule' ? '🫏 Mule' : t === 'Handshake' ? '🤝 Handshake' : '🥃 Other'}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#6b5030', marginTop: 6, lineHeight: 1.5 }}>
            {type === 'Mule' ? 'Someone physically transported this sample for you.' : type === 'Handshake' ? 'Traded or received at a meet-up.' : 'Other way you got it.'}
          </div>

          <label style={labelStyle}>Notes (optional)</label>
          <textarea style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} placeholder="What did you think? Anything to remember?" value={notes} onChange={e => setNotes(e.target.value)} />

          {error && <p style={{ color: '#f87171', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            style={{ marginTop: 16, width: '100%', padding: '12px', background: '#e8943a', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 800, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? '⏳ Saving…' : '+ Add Sample'}
          </button>
        </form>
      </div>
    </>
  )
}

// ── Edit Bottle Sheet ─────────────────────────────────────────────────────────

function EditBottleSheet({ bottle, onClose, onSave }) {
  const [name,       setName]       = useState(bottle.name       ?? '')
  const [distillery, setDistillery] = useState(bottle.distillery ?? '')
  const [category,   setCategory]   = useState(bottle.category   ?? 'Bourbon')
  const [proof,      setProof]      = useState(bottle.proof > 0  ? String(bottle.proof) : '')
  const [msrp,       setMsrp]       = useState(bottle.msrp > 0   ? String(bottle.msrp)  : '')
  const [secondary,  setSecondary]  = useState(bottle.secondary > 0 ? String(bottle.secondary) : '')
  const [qty,        setQty]        = useState(String(bottle.qty ?? 1))
  const [flavors,    setFlavors]    = useState((bottle.flavors ?? []).join(', '))
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState(null)

  const inputStyle = {
    width: '100%', padding: '9px 12px',
    background: '#0f0a05', border: '1px solid #3d2b10', borderRadius: 8,
    color: '#f5e6cc', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = {
    display: 'block', fontSize: 10, fontWeight: 700, color: '#9a7c55',
    marginBottom: 4, marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.06em',
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Bottle name is required')
    setSubmitting(true)
    setError(null)
    try {
      const flavorArr = flavors.split(',').map(s => s.trim()).filter(Boolean)
      const res  = await fetch('/api/collection', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: bottle.id, name, distillery, category, proof, msrp, secondary, qty, flavors: flavorArr }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      onSave(data.bottles)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 149 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 150,
        background: '#1a1008', borderRadius: '16px 16px 0 0',
        border: '1px solid #3d2b10', borderBottom: 'none',
        maxHeight: '90vh', overflowY: 'auto',
        animation: 'fadeUp 0.25s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#3d2b10' }} />
        </div>
        <div style={{ padding: '0 16px 32px' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#f5e6cc', marginBottom: 16 }}>
            ✏️ Edit Bottle
          </div>
          <form onSubmit={handleSubmit}>
            <label style={labelStyle}>Bottle Name *</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} required />

            <label style={labelStyle}>Distillery</label>
            <input style={inputStyle} value={distillery} onChange={e => setDistillery(e.target.value)} />

            <label style={labelStyle}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Proof</label>
                <input style={inputStyle} type="number" min="0" step="0.1" value={proof} onChange={e => setProof(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>MSRP $</label>
                <input style={inputStyle} type="number" min="0" value={msrp} onChange={e => setMsrp(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Qty</label>
                <input style={inputStyle} type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} />
              </div>
            </div>

            <label style={labelStyle}>Secondary Market $</label>
            <input style={inputStyle} type="number" min="0" value={secondary} onChange={e => setSecondary(e.target.value)} />

            <label style={labelStyle}>Flavor Notes (comma separated)</label>
            <input style={inputStyle} value={flavors} onChange={e => setFlavors(e.target.value)} />

            {error && <p style={{ color: '#f87171', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 16, width: '100%', padding: '12px',
                background: '#e8943a', border: 'none', borderRadius: 8,
                color: '#fff', fontWeight: 800, fontSize: 15,
                cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? '⏳ Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

// ── Add Bottle Sheet ──────────────────────────────────────────────────────────

function AddBottleSheet({ onClose, onAdd }) {
  const [name,        setName]        = useState('')
  const [distillery,  setDistillery]  = useState('')
  const [category,    setCategory]    = useState('Bourbon')
  const [proof,       setProof]       = useState('')
  const [msrp,        setMsrp]        = useState('')
  const [secondary,   setSecondary]   = useState('')
  const [qty,         setQty]         = useState('1')
  const [flavors,     setFlavors]     = useState('')
  const [upc,         setUpc]         = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [lookingUp,   setLookingUp]   = useState(false) // UPC or photo in progress
  const [lookupMsg,   setLookupMsg]   = useState(null)  // success/info message
  const [suggestions, setSuggestions] = useState([])
  const [error,       setError]       = useState(null)
  const photoInputRef = useRef(null)
  const nameDebounce  = useRef(null)

  // ── Auto-fill helper ────────────────────────────────────────────────────────
  function applyBottle(b, msg) {
    if (b.name)       setName(b.name)
    if (b.distillery) setDistillery(b.distillery)
    if (b.category)   setCategory(b.category)
    if (b.proof)      setProof(String(b.proof))
    if (b.msrp)       setMsrp(String(b.msrp))
    if (msg)          setLookupMsg(msg)
    setSuggestions([])
  }

  // ── Barcode scan ────────────────────────────────────────────────────────────
  async function handleBarcode(code) {
    setUpc(code)
    setShowScanner(false)
    setLookingUp(true)
    setLookupMsg(null)
    try {
      const r = await fetch(`/api/lookup?upc=${encodeURIComponent(code)}`)
      const d = await r.json()
      if (d.found) {
        applyBottle(d.bottle, `✓ Found via barcode (${d.bottle.source})`)
      } else {
        setLookupMsg('Barcode not in database — fill in manually')
      }
    } catch {
      setLookupMsg('Lookup failed — fill in manually')
    } finally {
      setLookingUp(false)
    }
  }

  // ── Photo label scan ────────────────────────────────────────────────────────
  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLookingUp(true)
    setLookupMsg('Reading label…')
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const mediaType = file.type || 'image/jpeg'
      const r = await fetch('/api/lookup/photo', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: base64, mediaType }),
      })
      const d = await r.json()
      if (d.found) {
        applyBottle(d.bottle, '✓ Label read by AI — verify details below')
      } else {
        setLookupMsg(d.error ?? 'Could not read label — fill in manually')
      }
    } catch {
      setLookupMsg('Photo lookup failed — fill in manually')
    } finally {
      setLookingUp(false)
      e.target.value = ''
    }
  }

  // ── Name autocomplete ───────────────────────────────────────────────────────
  function handleNameChange(val) {
    setName(val)
    clearTimeout(nameDebounce.current)
    if (val.trim().length < 2) { setSuggestions([]); return }
    nameDebounce.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/lookup?search=${encodeURIComponent(val)}`)
        const d = await r.json()
        setSuggestions(d.results ?? [])
      } catch {}
    }, 280)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Bottle name is required')
    setSubmitting(true)
    setError(null)
    try {
      const flavorArr = flavors.split(',').map(s => s.trim()).filter(Boolean)
      const res  = await fetch('/api/collection', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, distillery, category, proof, msrp, secondary, qty, flavors: flavorArr, upc }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add bottle')
      onAdd(data.bottles)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    width:        '100%',
    padding:      '9px 12px',
    background:   '#0f0a05',
    border:       '1px solid #3d2b10',
    borderRadius: 8,
    color:        '#f5e6cc',
    fontSize:     13,
    fontFamily:   'inherit',
    outline:      'none',
    boxSizing:    'border-box',
  }
  const labelStyle = {
    display:       'block',
    fontSize:      10,
    fontWeight:    700,
    color:         '#9a7c55',
    marginBottom:  4,
    marginTop:     12,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 149 }} />

      {/* Sheet */}
      <div style={{
        position:     'fixed',
        bottom:       0,
        left:         0,
        right:        0,
        zIndex:       150,
        background:   '#1a1008',
        borderRadius: '16px 16px 0 0',
        border:       '1px solid #3d2b10',
        borderBottom: 'none',
        maxHeight:    '90vh',
        overflowY:    'auto',
        animation:    'fadeUp 0.25s ease',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#3d2b10' }} />
        </div>

        <div style={{ padding: '0 16px 32px' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#f5e6cc', marginBottom: 4 }}>
            + Add to Collection
          </div>

          {/* Quick-scan buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => { setShowScanner(s => !s); setLookupMsg(null) }}
              disabled={lookingUp}
              style={{
                flex:         1,
                padding:      '9px 0',
                background:   showScanner ? '#e8943a' : '#1f1308',
                border:       '1px solid #3d2b10',
                borderRadius: 8,
                color:        showScanner ? '#fff' : '#e8943a',
                cursor:       'pointer',
                fontSize:     13,
                fontWeight:   700,
              }}
            >
              {showScanner ? '✕ Close Scanner' : '📷 Scan Barcode'}
            </button>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={lookingUp}
              style={{
                flex:         1,
                padding:      '9px 0',
                background:   '#1f1308',
                border:       '1px solid #3d2b10',
                borderRadius: 8,
                color:        '#c084fc',
                cursor:       lookingUp ? 'not-allowed' : 'pointer',
                fontSize:     13,
                fontWeight:   700,
                opacity:      lookingUp ? 0.5 : 1,
              }}
            >
              {lookingUp ? '⏳ Reading…' : '🏷️ Scan Label'}
            </button>
          </div>

          {/* Hidden photo input */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            style={{ display: 'none' }}
          />

          {/* Lookup status message */}
          {lookupMsg && (
            <div style={{
              fontSize:     12,
              color:        lookupMsg.startsWith('✓') ? '#4ade80' : '#e8943a',
              marginBottom: 10,
              padding:      '7px 10px',
              background:   '#0f0a05',
              borderRadius: 6,
              border:       '1px solid #2a1c08',
            }}>
              {lookupMsg}
            </div>
          )}

          {showScanner && (
            <div style={{ marginBottom: 12 }}>
              <BarcodeScanner onResult={handleBarcode} onClose={() => setShowScanner(false)} autoCamera />
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Name with autocomplete */}
            <label style={labelStyle}>Bottle Name *</label>
            <div style={{ position: 'relative' }}>
              <input
                style={inputStyle}
                placeholder="e.g. Blanton's Original Single Barrel"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                onBlur={() => setTimeout(() => setSuggestions([]), 200)}
                required
              />
              {suggestions.length > 0 && (
                <div style={{
                  position:   'absolute',
                  top:        '100%',
                  left:       0,
                  right:      0,
                  background: '#1a1008',
                  border:     '1px solid #3d2b10',
                  borderTop:  'none',
                  borderRadius: '0 0 8px 8px',
                  zIndex:     200,
                  overflow:   'hidden',
                }}>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={() => applyBottle(s, `✓ Matched "${s.name}" from database`)}
                      style={{
                        display:    'block',
                        width:      '100%',
                        padding:    '9px 12px',
                        background: 'none',
                        border:     'none',
                        borderTop:  i > 0 ? '1px solid #2a1c08' : 'none',
                        color:      '#f5e6cc',
                        fontSize:   13,
                        textAlign:  'left',
                        cursor:     'pointer',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      <span style={{ color: '#6b5030', fontSize: 11, marginLeft: 8 }}>
                        {s.proof ? `${s.proof}°` : ''} {s.msrp ? `· $${s.msrp}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label style={labelStyle}>Distillery</label>
            <input style={inputStyle} placeholder="e.g. Buffalo Trace" value={distillery} onChange={e => setDistillery(e.target.value)} />

            <label style={labelStyle}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* 3-col grid: Proof / MSRP / Qty */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Proof</label>
                <input style={inputStyle} type="number" min="0" step="0.1" placeholder="93" value={proof} onChange={e => setProof(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>MSRP $</label>
                <input style={inputStyle} type="number" min="0" placeholder="60" value={msrp} onChange={e => setMsrp(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Qty</label>
                <input style={inputStyle} type="number" min="1" placeholder="1" value={qty} onChange={e => setQty(e.target.value)} />
              </div>
            </div>

            <label style={labelStyle}>Secondary Market $</label>
            <input style={inputStyle} type="number" min="0" placeholder="e.g. 120" value={secondary} onChange={e => setSecondary(e.target.value)} />

            <label style={labelStyle}>Flavor Notes (comma separated)</label>
            <input style={inputStyle} placeholder="e.g. Caramel, Vanilla, Oak" value={flavors} onChange={e => setFlavors(e.target.value)} />

            {error && <p style={{ color: '#f87171', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop:    16,
                width:        '100%',
                padding:      '12px',
                background:   '#e8943a',
                border:       'none',
                borderRadius: 8,
                color:        '#fff',
                fontWeight:   800,
                fontSize:     15,
                cursor:       submitting ? 'not-allowed' : 'pointer',
                opacity:      submitting ? 0.6 : 1,
              }}
            >
              {submitting ? '⏳ Adding…' : '+ Add to Collection'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CollectionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [bottles,       setBottles]       = useState([])
  const [loaded,        setLoaded]        = useState(false)
  const [sort,          setSort]          = useState('score')
  const [showAdd,       setShowAdd]       = useState(false)
  const [removing,      setRemoving]      = useState(null)
  const [editingBottle, setEditingBottle] = useState(null) // bottle being edited
  const [unicornDeals,  setUnicornDeals]  = useState([])

  // Samples tab
  const [tab,           setTab]           = useState('bottles')
  const [samples,       setSamples]       = useState([])
  const [samplesLoaded, setSamplesLoaded] = useState(false)
  const [showAddSample, setShowAddSample] = useState(false)
  const [removingSample,setRemovingSample]= useState(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status])

  useEffect(() => {
    fetch('/api/collection')
      .then(r => r.json())
      .then(d => setBottles(d.bottles ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true))

    fetch('/api/samples')
      .then(r => r.json())
      .then(d => setSamples(d.samples ?? []))
      .catch(() => {})
      .finally(() => setSamplesLoaded(true))

    fetch('/api/unicorn-deals')
      .then(r => r.json())
      .then(d => setUnicornDeals(d.deals ?? []))
      .catch(() => {})
  }, [])

  async function handleRemove(id) {
    setRemoving(id)
    try {
      const res  = await fetch(`/api/collection?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.bottles) setBottles(data.bottles)
    } catch {}
    setRemoving(null)
  }

  async function handleRemoveSample(id) {
    setRemovingSample(id)
    try {
      const res  = await fetch(`/api/samples?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.samples) setSamples(data.samples)
    } catch {}
    setRemovingSample(null)
  }

  // Sort
  const sorted = [...bottles].sort((a, b) => {
    if (sort === 'score')     return (b.blindScore ?? -1) - (a.blindScore ?? -1)
    if (sort === 'secondary') return (b.secondary ?? 0) - (a.secondary ?? 0)
    if (sort === 'msrp')      return (b.msrp ?? 0) - (a.msrp ?? 0)
    if (sort === 'name')      return a.name.localeCompare(b.name)
    return 0
  })

  // Stats
  const totalBottles = bottles.reduce((s, b) => s + (b.qty ?? 1), 0)
  // Est. value: use secondary market price when available, fall back to MSRP
  const estValue = bottles.reduce((s, b) => {
    const val = b.secondary > 0 ? b.secondary : (b.msrp > 0 ? b.msrp : 0)
    return s + val * (b.qty ?? 1)
  }, 0)
  const scoredBottles = bottles.filter(b => b.blindScore != null)
  const avgScore      = scoredBottles.length
    ? (scoredBottles.reduce((s, b) => s + b.blindScore, 0) / scoredBottles.length).toFixed(1)
    : '—'

  if (status === 'loading') return null

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div style={{
        position:             'sticky',
        top:                  0,
        zIndex:               50,
        background:           'rgba(15,10,5,0.95)',
        borderBottom:         '1px solid #3d2b10',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding:              '11px 16px',
        display:              'flex',
        alignItems:           'center',
        justifyContent:       'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/profile" style={{ color: '#9a7c55', textDecoration: 'none', fontSize: 20, lineHeight: 1 }}>←</Link>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#f5e6cc', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShelfIcon size={18} /> My Collection
          </div>
            <div style={{ fontSize: 11, color: '#9a7c55' }}>Personal bottle inventory</div>
          </div>
        </div>
        <button
          onClick={() => tab === 'bottles' ? setShowAdd(true) : setShowAddSample(true)}
          style={{
            padding:      '7px 14px',
            background:   '#e8943a',
            border:       'none',
            borderRadius: 8,
            color:        '#fff',
            fontWeight:   700,
            fontSize:     13,
            cursor:       'pointer',
          }}
        >
          {tab === 'bottles' ? '+ Bottle' : '+ Sample'}
        </button>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 12px' }}>

        {/* Summary Strip */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Bottles', value: totalBottles },
            { label: 'Est. Value', value: estValue > 0 ? `$${Math.round(estValue).toLocaleString()}` : '—' },
            { label: 'Avg Score', value: avgScore },
          ].map(({ label, value }) => (
            <div key={label} style={{
              flex:         1,
              textAlign:    'center',
              padding:      '10px 6px',
              background:   '#1f1308',
              borderRadius: 8,
              border:       '1px solid #2a1c08',
            }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#f5e6cc', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: '#9a7c55', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[
            { key: 'bottles', icon: <ShelfIcon size={14} />, text: `Bottles (${bottles.length})` },
            { key: 'samples', icon: '🥃',                   text: `Samples (${samples.length})`  },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex:         1,
                padding:      '8px 0',
                borderRadius: 8,
                border:       'none',
                cursor:       'pointer',
                background:   tab === t.key ? '#e8943a' : '#1f1308',
                color:        tab === t.key ? '#fff' : '#6b5030',
                fontWeight:   700,
                fontSize:     13,
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                gap:          5,
              }}
            >{t.icon} {t.text}</button>
          ))}
        </div>

        {/* Sort bar — only shown on bottles tab */}
        {tab === 'samples' && (
          <div>
            {/* Samples list */}
            {!samplesLoaded ? (
              <p style={{ color: '#9a7c55', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>Loading…</p>
            ) : samples.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🥃</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#f5e6cc', marginBottom: 8 }}>No samples yet</div>
                <div style={{ fontSize: 14, color: '#9a7c55', marginBottom: 20 }}>Track bottles you received via mule or handshake</div>
                <button
                  onClick={() => setShowAddSample(true)}
                  style={{ padding: '10px 24px', background: '#e8943a', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                >
                  + Add your first sample
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {samples.map(sample => (
                  <SampleCard
                    key={sample.id}
                    sample={sample}
                    onRemove={handleRemoveSample}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'bottles' && <>
          {/* Sort bar */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 2 }}>
            {SORT_OPTIONS.map(o => (
              <button
                key={o.key}
                onClick={() => setSort(o.key)}
                style={{
                  flexShrink:   0,
                  padding:      '6px 13px',
                  borderRadius: 999,
                  border:       'none',
                  cursor:       'pointer',
                  background:   sort === o.key ? '#e8943a' : '#1f1308',
                  color:        sort === o.key ? '#fff' : '#9a7c55',
                  fontSize:     12,
                  fontWeight:   600,
                  whiteSpace:   'nowrap',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Bottle list */}
          {!loaded ? (
            <p style={{ color: '#9a7c55', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>Loading…</p>
          ) : sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px' }}>
              <div style={{ marginBottom: 12 }}><ShelfIcon size={48} /></div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#f5e6cc', marginBottom: 8 }}>Your collection is empty</div>
              <div style={{ fontSize: 14, color: '#9a7c55', marginBottom: 20 }}>Add your first bottle to get started</div>
              <button
                onClick={() => setShowAdd(true)}
                style={{ padding: '10px 24px', background: '#e8943a', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                + Add your first bottle
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sorted.map(bottle => (
                <BottleCard
                  key={bottle.id}
                  bottle={bottle}
                  onRemove={handleRemove}
                  onEdit={setEditingBottle}
                  unicornMatches={findUnicornMatches(bottle.name, unicornDeals)}
                />
              ))}
            </div>
          )}
        </>}

      </div>

      {editingBottle && (
        <EditBottleSheet
          bottle={editingBottle}
          onClose={() => setEditingBottle(null)}
          onSave={(bottles) => { setBottles(bottles); setEditingBottle(null) }}
        />
      )}

      {showAdd && (
        <AddBottleSheet
          onClose={() => setShowAdd(false)}
          onAdd={(bottles) => { setBottles(bottles); setShowAdd(false) }}
        />
      )}

      {showAddSample && (
        <AddSampleSheet
          onClose={() => setShowAddSample(false)}
          onAdd={(sample) => { setSamples(prev => [sample, ...prev]); setShowAddSample(false) }}
        />
      )}
    </div>
  )
}
