'use client'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Link           from 'next/link'
import {
  ArrowLeft, Plus, X, Camera, Tag, ChevronLeft, ChevronRight, Gavel,
  Star, Wine, FlaskConical, BarChart2, Image as ImageIcon,
  CheckCircle, SkipForward, RefreshCw, Pencil, Loader, EyeOff, Printer,
} from 'lucide-react'
import BarcodeScanner   from '../../finds/BarcodeScanner.jsx'
import Button           from '../../components/ui/Button.jsx'
import Chip             from '../../components/ui/Chip.jsx'
import StatTile         from '../../components/ui/StatTile.jsx'
import EmptyState       from '../../components/ui/EmptyState.jsx'
import SectionHeader    from '../../components/ui/SectionHeader.jsx'
import Sheet            from '../../components/ui/Sheet.jsx'
import LabelMakerSheet  from './LabelMakerSheet.jsx'
import { isPro }        from '../../../lib/tier.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORIES  = ['Bourbon', 'Rye', 'Scotch', 'Japanese', 'American', 'Irish']

// Bar-shelf SVG — replaces the 📦 box emoji throughout this page
function ShelfIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'inline', verticalAlign: 'middle' }}>
      {/* Shelf plank */}
      <rect x="1"    y="17.5" width="22"  height="2.5" rx="1"   fill="var(--copper-600)" />
      {/* Bottle 1 — tall bourbon */}
      <rect x="3"    y="8"    width="3.5" height="9.5" rx="1"   fill="var(--copper-500)" />
      <rect x="4"    y="5.5"  width="1.5" height="2.5" rx="0.5" fill="var(--copper-500)" />
      <rect x="3.5"  y="5.5"  width="2.5" height="1"   rx="0.5" fill="var(--copper-600)" />
      {/* Bottle 2 — medium */}
      <rect x="9"    y="10"   width="3.5" height="7.5" rx="1"   fill="var(--copper-400)" />
      <rect x="10"   y="7.5"  width="1.5" height="2.5" rx="0.5" fill="var(--copper-400)" />
      {/* Bottle 3 — tall */}
      <rect x="15.5" y="8"    width="3.5" height="9.5" rx="1"   fill="var(--copper-500)" />
      <rect x="16.5" y="5.5"  width="1.5" height="2.5" rx="0.5" fill="var(--copper-500)" />
      <rect x="16"   y="5.5"  width="2.5" height="1"   rx="0.5" fill="var(--copper-600)" />
    </svg>
  )
}

const SORT_OPTIONS = [
  { key: 'score',     label: 'Score'     },
  { key: 'secondary', label: 'Secondary' },
  { key: 'msrp',      label: 'MSRP'      },
  { key: 'name',      label: 'Name'       },
]

function scoreColor(score) {
  if (score >= 85) return 'var(--green)'
  if (score >= 75) return 'var(--copper-500)'
  return 'var(--text-muted)'
}

function fmt$(n) {
  if (!n) return '—'
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ── Unicorn auction helpers ───────────────────────────────────────────────────

function normalizeName(s) {
  return s.toLowerCase()
    .replace(/[''''']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findUnicornMatches(bottleName, deals) {
  if (!bottleName || !deals?.length) return []
  const norm  = normalizeName(bottleName)
  const words = norm.split(/\s+/).filter(w => w.length > 3)
  if (!words.length) return []
  return deals.filter(d => {
    const hay  = normalizeName(d.bottle_name ?? d.title ?? '')
    if (!hay.includes(words[0])) return false
    if (words.length === 1) return true
    const hits  = words.filter(w => hay.includes(w)).length
    const ratio = hits / words.length
    if (words.length === 2) return hits === 2
    if (words.length === 3) return hits >= 2
    return ratio >= 0.6
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

// ── Shared form styles (token-based) ─────────────────────────────────────────

const inputStyle = {
  width:        '100%',
  padding:      'var(--sp-2) var(--sp-3)',
  background:   'var(--bg-base)',
  border:       '1px solid var(--hairline-3)',
  borderRadius: 'var(--r-md)',
  color:        'var(--text-primary)',
  fontSize:     'var(--fs-body)',
  fontFamily:   'inherit',
  outline:      'none',
  boxSizing:    'border-box',
}

const labelStyle = {
  display:       'block',
  fontSize:      'var(--fs-overline)',
  fontWeight:    700,
  color:         'var(--text-muted)',
  marginBottom:  'var(--sp-1)',
  marginTop:     'var(--sp-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

// ── Bottle Card ───────────────────────────────────────────────────────────────

function BottleCard({ bottle, onRemove, onEdit, onLabel, unicornMatches, marketPrice }) {
  const score = bottle.blindScore
  const [pressed, setPressed] = useState(false)

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
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        display:    'flex',
        flexDirection: 'column',
        gap:        0,
        padding:    0,
        overflow:   'hidden',
        cursor:     'pointer',
        transform:  pressed ? 'scale(0.97)' : 'scale(1)',
        transition: `transform var(--t-fast) var(--ease-out)`,
      }}
    >
      {/* ── Main row ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex' }}>

        {/* Score / Photo Column */}
        {bottle.photoUrl ? (
          <div style={{
            width:       64,
            height:      80,
            flexShrink:  0,
            position:    'relative',
            background:  'var(--bg-base)',
            borderRight: '1px solid var(--hairline)',
            overflow:    'hidden',
          }}>
            <img
              src={bottle.photoUrl}
              alt={bottle.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => { e.target.style.display = 'none' }}
            />
            {score != null && (
              <div style={{
                position:   'absolute',
                bottom:     'var(--sp-1)',
                left:       0,
                right:      0,
                textAlign:  'center',
                fontSize:   'var(--fs-overline)',
                fontWeight: 800,
                color:      scoreColor(score),
                textShadow: '0 1px 3px rgba(0,0,0,0.9)',
              }}>{score.toFixed(0)}</div>
            )}
          </div>
        ) : (
          <div style={{
            width:          64,
            flexShrink:     0,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        'var(--sp-3) 0',
            background:     'var(--bg-elev-2)',
            borderRight:    '1px solid var(--hairline)',
            gap:            'var(--sp-1)',
          }}>
            <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</div>
            <div style={{ fontWeight: 800, fontSize: score != null ? 'var(--fs-h1)' : 'var(--fs-h2)', color: score != null ? scoreColor(score) : 'var(--text-dim)', lineHeight: 1 }}>
              {score != null ? score.toFixed(0) : '—'}
            </div>
            <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>{bottle.tastings ?? 0} tastings</div>
          </div>
        )}

        {/* Middle: info */}
        <div style={{ flex: 1, padding: 'var(--sp-3)', minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 'var(--sp-1)' }}>
            {bottle.name}
          </div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginBottom: 'var(--sp-2)' }}>
            {[bottle.distillery, bottle.proof ? `${bottle.proof}°` : null, bottle.qty > 1 ? `×${bottle.qty}` : null].filter(Boolean).join(' · ')}
          </div>
          {bottle.flavors?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-1)' }}>
              {bottle.flavors.map(f => (
                <Chip key={f} tone="neutral" size="sm">{f}</Chip>
              ))}
            </div>
          )}
          {(bottle.forSale || bottle.forTrade) && (
            <div style={{ display: 'flex', gap: 'var(--sp-1)', marginTop: 'var(--sp-1)' }}>
              {bottle.forSale  && <Chip tone="green" size="sm">For Sale</Chip>}
              {bottle.forTrade && <Chip tone="blue"  size="sm">For Trade</Chip>}
            </div>
          )}
          {marketPrice && !bottle.secondary && (
            <div style={{ marginTop: 'var(--sp-1)' }}>
              <Chip tone="blue" size="sm">
                <BarChart2 size={10} strokeWidth={1.75} />
                ${marketPrice.low}–${marketPrice.high} secondary
              </Chip>
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
          padding:        'var(--sp-2) var(--sp-3)',
          gap:            'var(--sp-1)',
        }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', textTransform: 'uppercase' }}>MSRP</div>
            <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--copper-400)' }}>{fmt$(bottle.msrp)}</div>
          </div>
          {bottle.secondary > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', textTransform: 'uppercase' }}>2ndary</div>
              <div style={{
                fontWeight: 700,
                fontSize:   'var(--fs-body)',
                color:      bottle.secondary > (bottle.msrp ?? 0) * 1.4 ? 'var(--green)' : 'var(--text-muted)',
              }}>{fmt$(bottle.secondary)}</div>
            </div>
          )}
          <button
            onClick={e => { e.stopPropagation(); onLabel(bottle) }}
            title="Make sample label"
            style={{
              background:   'none',
              border:       'none',
              color:        'var(--copper-400)',
              cursor:       'pointer',
              padding:      'var(--sp-1)',
              lineHeight:   1,
              display:      'flex',
              borderRadius: 'var(--r-sm)',
            }}
          >
            <Printer size={14} strokeWidth={1.75} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onRemove(bottle.id) }}
            style={{
              background:   'none',
              border:       'none',
              color:        'var(--text-dim)',
              cursor:       'pointer',
              padding:      'var(--sp-1)',
              lineHeight:   1,
              display:      'flex',
              borderRadius: 'var(--r-sm)',
            }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* ── Unicorn Auction Footer ─────────────────────────────────── */}
      {bestMatch && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            borderTop:      '1px solid var(--hairline)',
            padding:        'var(--sp-2) var(--sp-3)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            background:     'var(--bg-base)',
            gap:            'var(--sp-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap', minWidth: 0 }}>
            <Gavel size={14} strokeWidth={1.75} color="var(--text-muted)" />
            {auctionBid > 0 ? (
              <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--text-primary)' }}>
                ${auctionBid.toLocaleString()} bid
              </span>
            ) : (
              <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>No bids yet</span>
            )}
            {msrpPremium !== null && msrpPremium > 0 && (
              <span style={{ fontSize: 'var(--fs-overline)', color: 'var(--green)', fontWeight: 600 }}>
                +{msrpPremium}% vs MSRP
              </span>
            )}
            {unicornMatches.length > 1 && (
              <span style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>
                ({unicornMatches.length} lots)
              </span>
            )}
            {tl && (
              <span style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>{tl}</span>
            )}
          </div>
          <a
            href={bestMatch.lot_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 'var(--fs-meta)', color: 'var(--copper-500)', textDecoration: 'none', fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}
          >
            view <ChevronRight size={12} strokeWidth={2} />
          </a>
        </div>
      )}
    </div>
  )
}

// ── Sample Card ───────────────────────────────────────────────────────────────

function SampleCard({ sample, onRemove }) {
  const TYPE_TONE = { Mule: 'copper', Handshake: 'green', Other: 'neutral' }
  const tone      = TYPE_TONE[sample.type] ?? 'neutral'

  return (
    <div className="card" style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', padding: 'var(--sp-3) var(--sp-4)' }}>
      <div style={{
        width:          40,
        height:         40,
        borderRadius:   'var(--r-md)',
        background:     'var(--bg-elev-2)',
        border:         '1px solid var(--hairline-2)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
        fontSize:       'var(--fs-h1)',
      }}>🥃</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', marginBottom: 'var(--sp-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sample.name}</div>
        <div style={{ fontSize: 'var(--fs-meta)', display: 'flex', alignItems: 'center', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)' }}>from </span>
          <Chip tone={tone} size="sm">{sample.from}</Chip>
          <Chip tone={tone} size="sm">{sample.type}</Chip>
        </div>
        {sample.notes && <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', marginTop: 'var(--sp-1)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sample.notes}</div>}
      </div>
      <button
        onClick={() => onRemove(sample.id)}
        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 'var(--sp-1)', display: 'flex', alignItems: 'center', borderRadius: 'var(--r-sm)' }}
      >
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  )
}

// ── Add Sample Sheet ──────────────────────────────────────────────────────────

function AddSampleSheet({ open, onClose, onAdd }) {
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
    <Sheet open={open} onClose={onClose} title="Add a Sample 🥃">
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
              position:     'absolute',
              top:          '100%',
              left:         0,
              right:        0,
              zIndex:       10,
              background:   'var(--bg-elev-3)',
              border:       '1px solid var(--hairline-2)',
              borderRadius: '0 0 var(--r-md) var(--r-md)',
              maxHeight:    160,
              overflowY:    'auto',
            }}>
              {friends.map(f => (
                <button
                  key={f.email}
                  type="button"
                  onClick={() => { setFromText(f.name ?? f.email); setFromEmail(f.email); setShowFriends(false) }}
                  style={{ width: '100%', padding: 'var(--sp-2) var(--sp-3)', background: 'none', border: 'none', borderTop: '1px solid var(--hairline)', color: 'var(--text-primary)', fontSize: 'var(--fs-body)', textAlign: 'left', cursor: 'pointer' }}
                >
                  {f.name ?? f.email}
                  <span style={{ color: 'var(--text-dim)', fontSize: 'var(--fs-meta)', marginLeft: 'var(--sp-2)' }}>{f.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <label style={labelStyle}>Type</label>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          {['Mule', 'Handshake', 'Other'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={e   => e.currentTarget.style.transform = 'scale(1)'}
              style={{
                flex:         1,
                padding:      'var(--sp-2) 0',
                borderRadius: 'var(--r-md)',
                border:       'none',
                cursor:       'pointer',
                fontWeight:   700,
                fontSize:     'var(--fs-body)',
                background:   type === t ? 'var(--copper-500)' : 'var(--bg-elev-2)',
                color:        type === t ? 'var(--text-inverse)' : 'var(--text-dim)',
                transition:   `background var(--t-base) var(--ease-out), transform var(--t-fast) var(--ease-out)`,
              }}
            >
              {t === 'Mule' ? '🫏 Mule' : t === 'Handshake' ? '🤝 Handshake' : '🥃 Other'}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', marginTop: 'var(--sp-2)', lineHeight: 1.5 }}>
          {type === 'Mule' ? 'Someone physically transported this sample for you.' : type === 'Handshake' ? 'Traded or received at a meet-up.' : 'Other way you got it.'}
        </div>

        <label style={labelStyle}>Notes (optional)</label>
        <textarea style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} placeholder="What did you think? Anything to remember?" value={notes} onChange={e => setNotes(e.target.value)} />

        {error && <p style={{ color: 'var(--red)', fontSize: 'var(--fs-meta)', margin: 'var(--sp-2) 0 0' }}>{error}</p>}

        <div style={{ marginTop: 'var(--sp-4)' }}>
          <Button type="submit" variant="primary" fullWidth disabled={submitting}>
            {submitting ? <><Loader size={14} strokeWidth={1.75} /> Saving…</> : <><Plus size={14} strokeWidth={1.75} /> Add Sample</>}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}

// ── Edit Bottle Sheet ─────────────────────────────────────────────────────────

function EditBottleSheet({ bottle, open, onClose, onSave }) {
  const [name,         setName]         = useState(bottle?.name       ?? '')
  const [distillery,   setDistillery]   = useState(bottle?.distillery ?? '')
  const [category,     setCategory]     = useState(bottle?.category   ?? 'Bourbon')
  const [proof,        setProof]        = useState(bottle?.proof > 0  ? String(bottle.proof) : '')
  const [msrp,         setMsrp]         = useState(bottle?.msrp > 0   ? String(bottle.msrp)  : '')
  const [secondary,    setSecondary]    = useState(bottle?.secondary > 0 ? String(bottle.secondary) : '')
  const [qty,          setQty]          = useState(Number(bottle?.qty ?? 1))
  const [flavors,      setFlavors]      = useState((bottle?.flavors ?? []).join(', '))
  const [forSale,      setForSale]      = useState(bottle?.forSale  ?? false)
  const [forTrade,     setForTrade]     = useState(bottle?.forTrade ?? false)
  const [photoUrl,     setPhotoUrl]     = useState(bottle?.photoUrl ?? null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState(null)
  const photoInputRef = useRef(null)

  // Sync state when bottle changes
  useEffect(() => {
    if (!bottle) return
    setName(bottle.name ?? '')
    setDistillery(bottle.distillery ?? '')
    setCategory(bottle.category ?? 'Bourbon')
    setProof(bottle.proof > 0 ? String(bottle.proof) : '')
    setMsrp(bottle.msrp > 0 ? String(bottle.msrp) : '')
    setSecondary(bottle.secondary > 0 ? String(bottle.secondary) : '')
    setQty(Number(bottle.qty ?? 1))
    setFlavors((bottle.flavors ?? []).join(', '))
    setForSale(bottle.forSale ?? false)
    setForTrade(bottle.forTrade ?? false)
    setPhotoUrl(bottle.photoUrl ?? null)
    setError(null)
  }, [bottle?.id])

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res  = await fetch('/api/collection/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setPhotoUrl(data.url)
    } catch (err) {
      setError(`Photo upload failed: ${err.message}`)
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
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
        body:    JSON.stringify({
          id: bottle.id, name, distillery, category,
          proof, msrp, secondary,
          qty:      Number(qty),
          flavors:  flavorArr,
          forSale,
          forTrade,
          photoUrl: photoUrl ?? null,
        }),
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
    <Sheet open={open} onClose={onClose} title="Edit Bottle">
      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Bottle Name *</label>
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} required />

        <label style={labelStyle}>Distillery</label>
        <input style={inputStyle} value={distillery} onChange={e => setDistillery(e.target.value)} />

        <label style={labelStyle}>Category</label>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--sp-2)' }}>
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

        {/* Photo */}
        <label style={labelStyle}>Photo</label>
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} style={{ display: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          {photoUrl ? (
            <>
              <img src={photoUrl} alt="Bottle" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--r-md)', border: '1px solid var(--hairline-2)', flexShrink: 0 }} onError={() => setPhotoUrl(null)} />
              <Button type="button" variant="secondary" size="sm" icon={<Camera size={14} strokeWidth={1.75} />} onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto} style={{ flex: 1 }}>
                {uploadingPhoto ? 'Uploading…' : 'Change Photo'}
              </Button>
              <button
                type="button"
                onClick={() => setPhotoUrl(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 'var(--sp-1)', display: 'flex', borderRadius: 'var(--r-sm)' }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={e   => e.currentTarget.style.transform = 'scale(1)'}
              style={{
                width:        '100%',
                padding:      'var(--sp-2)',
                background:   'var(--bg-base)',
                border:       '1px dashed var(--hairline-3)',
                borderRadius: 'var(--r-md)',
                color:        'var(--text-muted)',
                fontSize:     'var(--fs-body)',
                cursor:       uploadingPhoto ? 'not-allowed' : 'pointer',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                gap:          'var(--sp-2)',
                transition:   `transform var(--t-fast) var(--ease-out)`,
              }}
            >
              <Camera size={16} strokeWidth={1.75} />
              {uploadingPhoto ? 'Uploading…' : 'Add Photo'}
            </button>
          )}
        </div>

        {/* For Sale / For Trade toggles */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
          <label style={{
            flex:       1,
            display:    'flex',
            alignItems: 'center',
            gap:        'var(--sp-2)',
            padding:    'var(--sp-2) var(--sp-3)',
            borderRadius: 'var(--r-md)',
            cursor:     'pointer',
            background: forSale ? 'rgba(93,211,158,0.10)' : 'var(--bg-base)',
            border:     `1px solid ${forSale ? 'rgba(93,211,158,0.30)' : 'var(--hairline-3)'}`,
            transition: `background var(--t-base) var(--ease-out), border-color var(--t-base) var(--ease-out)`,
          }}>
            <input
              type="checkbox"
              checked={forSale}
              onChange={e => setForSale(e.target.checked)}
              style={{ accentColor: 'var(--green)', width: 16, height: 16 }}
            />
            <span style={{ fontSize: 'var(--fs-body)', color: forSale ? 'var(--green)' : 'var(--text-dim)', fontWeight: 600 }}>For Sale</span>
          </label>
          <label style={{
            flex:       1,
            display:    'flex',
            alignItems: 'center',
            gap:        'var(--sp-2)',
            padding:    'var(--sp-2) var(--sp-3)',
            borderRadius: 'var(--r-md)',
            cursor:     'pointer',
            background: forTrade ? 'rgba(143,181,255,0.10)' : 'var(--bg-base)',
            border:     `1px solid ${forTrade ? 'rgba(143,181,255,0.30)' : 'var(--hairline-3)'}`,
            transition: `background var(--t-base) var(--ease-out), border-color var(--t-base) var(--ease-out)`,
          }}>
            <input
              type="checkbox"
              checked={forTrade}
              onChange={e => setForTrade(e.target.checked)}
              style={{ accentColor: 'var(--blue)', width: 16, height: 16 }}
            />
            <span style={{ fontSize: 'var(--fs-body)', color: forTrade ? 'var(--blue)' : 'var(--text-dim)', fontWeight: 600 }}>For Trade</span>
          </label>
        </div>

        {error && <p style={{ color: 'var(--red)', fontSize: 'var(--fs-meta)', margin: 'var(--sp-2) 0 0' }}>{error}</p>}

        <div style={{ marginTop: 'var(--sp-4)' }}>
          <Button type="submit" variant="primary" fullWidth disabled={submitting}>
            {submitting ? <><Loader size={14} strokeWidth={1.75} /> Saving…</> : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}

// ── Add Bottle Sheet ──────────────────────────────────────────────────────────

function AddBottleSheet({ open, onClose, onAdd }) {
  const [name,        setName]        = useState('')
  const [distillery,  setDistillery]  = useState('')
  const [category,    setCategory]    = useState('Bourbon')
  const [proof,       setProof]       = useState('')
  const [msrp,        setMsrp]        = useState('')
  const [secondary,   setSecondary]   = useState('')
  const [qty,         setQty]         = useState('1')
  const [flavors,     setFlavors]     = useState('')
  const [upc,         setUpc]         = useState('')
  const [photoUrl,    setPhotoUrl]    = useState(null)
  const [forSale,     setForSale]     = useState(false)
  const [forTrade,    setForTrade]    = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [lookingUp,   setLookingUp]   = useState(false)
  const [lookupMsg,   setLookupMsg]   = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [error,       setError]       = useState(null)
  const photoInputRef = useRef(null)
  const nameDebounce  = useRef(null)

  function applyBottle(b, msg) {
    if (b.name)       setName(b.name)
    if (b.distillery) setDistillery(b.distillery)
    if (b.category)   setCategory(b.category)
    if (b.imageUrl)   setPhotoUrl(b.imageUrl)
    if (b.proof)      setProof(String(b.proof))
    if (b.msrp)       setMsrp(String(b.msrp))
    if (msg)          setLookupMsg(msg)
    setSuggestions([])
  }

  async function handleBarcode(code) {
    setUpc(code)
    setShowScanner(false)
    setLookingUp(true)
    setLookupMsg(null)
    try {
      const r = await fetch(`/api/lookup?upc=${encodeURIComponent(code)}`)
      const d = await r.json()
      if (d.found) {
        applyBottle(d.bottle, `Found via barcode (${d.bottle.source})`)
      } else {
        setLookupMsg('Barcode not in database — fill in manually')
      }
      if (!d.found || !d.bottle?.imageUrl) {
        fetch(`/api/upc?code=${encodeURIComponent(code)}`)
          .then(r => r.json())
          .then(u => { if (u.imageUrl) setPhotoUrl(u.imageUrl) })
          .catch(() => {})
      }
    } catch {
      setLookupMsg('Lookup failed — fill in manually')
    } finally {
      setLookingUp(false)
    }
  }

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
        applyBottle(d.bottle, 'Label read by AI — verify details below')
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
        body:    JSON.stringify({ name, distillery, category, proof, msrp, secondary, qty, flavors: flavorArr, upc, photoUrl: photoUrl || null, forSale, forTrade }),
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

  const lookupOk = lookupMsg?.startsWith('Found') || lookupMsg?.startsWith('Label read')

  return (
    <Sheet open={open} onClose={onClose} title="Add to Collection">
      {/* Quick-scan buttons */}
      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
        <Button
          type="button"
          variant={showScanner ? 'primary' : 'secondary'}
          size="sm"
          icon={showScanner ? <X size={14} strokeWidth={1.75} /> : <Camera size={14} strokeWidth={1.75} />}
          onClick={() => { setShowScanner(s => !s); setLookupMsg(null) }}
          disabled={lookingUp}
          style={{ flex: 1 }}
        >
          {showScanner ? 'Close Scanner' : 'Scan Barcode'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={lookingUp ? <Loader size={14} strokeWidth={1.75} /> : <Tag size={14} strokeWidth={1.75} />}
          onClick={() => photoInputRef.current?.click()}
          disabled={lookingUp}
          style={{ flex: 1, color: 'var(--violet)' }}
        >
          {lookingUp ? 'Reading…' : 'Scan Label'}
        </Button>
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
          fontSize:     'var(--fs-meta)',
          color:        lookupOk ? 'var(--green)' : 'var(--copper-500)',
          marginBottom: 'var(--sp-2)',
          padding:      'var(--sp-2) var(--sp-3)',
          background:   'var(--bg-base)',
          borderRadius: 'var(--r-sm)',
          border:       '1px solid var(--hairline)',
        }}>
          {lookupOk ? <CheckCircle size={12} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} /> : null}
          {lookupMsg}
        </div>
      )}

      {/* Photo preview from UPC scan */}
      {photoUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
          <img
            src={photoUrl}
            alt="Bottle"
            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--r-md)', border: '1px solid var(--hairline-2)', flexShrink: 0 }}
            onError={() => setPhotoUrl(null)}
          />
          <div style={{ flex: 1, fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>Photo pre-populated from scan</div>
          <button
            type="button"
            onClick={() => setPhotoUrl(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 'var(--sp-1)', display: 'flex', borderRadius: 'var(--r-sm)' }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
      )}

      {showScanner && (
        <div style={{ marginBottom: 'var(--sp-3)' }}>
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
              position:     'absolute',
              top:          '100%',
              left:         0,
              right:        0,
              background:   'var(--bg-elev-3)',
              border:       '1px solid var(--hairline-2)',
              borderTop:    'none',
              borderRadius: '0 0 var(--r-md) var(--r-md)',
              zIndex:       200,
              overflow:     'hidden',
            }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={() => applyBottle(s, `Matched "${s.name}" from database`)}
                  style={{
                    display:    'block',
                    width:      '100%',
                    padding:    'var(--sp-2) var(--sp-3)',
                    background: 'none',
                    border:     'none',
                    borderTop:  i > 0 ? '1px solid var(--hairline)' : 'none',
                    color:      'var(--text-primary)',
                    fontSize:   'var(--fs-body)',
                    textAlign:  'left',
                    cursor:     'pointer',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 'var(--fs-meta)', marginLeft: 'var(--sp-2)' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--sp-2)' }}>
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

        {error && <p style={{ color: 'var(--red)', fontSize: 'var(--fs-meta)', margin: 'var(--sp-2) 0 0' }}>{error}</p>}

        <div style={{ marginTop: 'var(--sp-4)' }}>
          <Button type="submit" variant="primary" fullWidth disabled={submitting}>
            {submitting
              ? <><Loader size={14} strokeWidth={1.75} /> Adding…</>
              : <><Plus size={14} strokeWidth={1.75} /> Add to Collection</>}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}

// ── Fill Photos Sheet ─────────────────────────────────────────────────────────

function FillPhotosSheet({ bottles, onDone }) {
  const [idx,          setIdx]          = useState(0)
  const [saving,       setSaving]       = useState(false)
  const [autoFilling,  setAutoFilling]  = useState(false)
  const [error,        setError]        = useState(null)
  const [algoliaImgs,  setAlgoliaImgs]  = useState({})
  const [candidateIdx, setCandidateIdx] = useState(0)
  const inputRef = useRef(null)

  const bottle = bottles[idx]

  useEffect(() => { setCandidateIdx(0) }, [bottle?.id])

  useEffect(() => {
    if (!bottle) return
    if (algoliaImgs[bottle.id] !== undefined) return
    setAlgoliaImgs(prev => ({ ...prev, [bottle.id]: { imageUrl: null, loading: true } }))
    fetch(`/api/algolia-image?name=${encodeURIComponent(bottle.name)}`)
      .then(r => r.json())
      .then(data => setAlgoliaImgs(prev => ({
        ...prev,
        [bottle.id]: { imageUrl: data.imageUrl ?? null, source: data.source ?? null, loading: false, candidates: data.candidates ?? null },
      })))
      .catch(() => setAlgoliaImgs(prev => ({
        ...prev,
        [bottle.id]: { imageUrl: null, source: null, loading: false, candidates: null },
      })))
  }, [idx, bottle?.id])

  if (!bottle) {
    return (
      <div style={{
        position:       'fixed',
        inset:          0,
        background:     'var(--bg-base)',
        zIndex:         400,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            'var(--sp-4)',
        padding:        'var(--sp-8)',
      }}>
        <div style={{ fontSize: 'var(--fs-display)' }}>🥃</div>
        <div style={{ fontWeight: 800, fontSize: 'var(--fs-h1)', color: 'var(--text-primary)', textAlign: 'center' }}>All done!</div>
        <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)', textAlign: 'center' }}>
          Every bottle in your collection now has a photo.
        </div>
        <Button variant="primary" onClick={onDone}>Back to collection</Button>
      </div>
    )
  }

  async function applyPhotoUrl(photoUrl) {
    setSaving(true)
    setError(null)
    try {
      const res  = await fetch('/api/collection', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: bottle.id, photoUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      onDone(data.bottles, false)
      setIdx(i => i + 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const upRes  = await fetch('/api/collection/upload', { method: 'POST', body: formData })
      const upData = await upRes.json()
      if (!upRes.ok) throw new Error(upData.error || 'Upload failed')
      await applyPhotoUrl(upData.url)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    } finally {
      e.target.value = ''
    }
  }

  async function handleAutoFill() {
    setAutoFilling(true)
    setError(null)
    const remaining = bottles.slice(idx)
    try {
      const results = await Promise.all(
        remaining.map(b =>
          fetch(`/api/algolia-image?name=${encodeURIComponent(b.name)}`)
            .then(r => r.json())
            .then(d => ({ id: b.id, imageUrl: d.imageUrl ?? null }))
            .catch(() => ({ id: b.id, imageUrl: null }))
        )
      )
      const matched = results.filter(r => r.imageUrl)
      if (!matched.length) {
        setError('No catalog images found for remaining bottles.')
        setAutoFilling(false)
        return
      }
      let lastBottles = null
      for (const { id, imageUrl } of matched) {
        const res  = await fetch('/api/collection', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ id, photoUrl: imageUrl }),
        })
        const data = await res.json()
        if (res.ok) lastBottles = data.bottles
      }
      if (lastBottles) onDone(lastBottles, false)
      setIdx(bottles.length)
    } catch (err) {
      setError(err.message)
    } finally {
      setAutoFilling(false)
    }
  }

  function skip() {
    setError(null)
    setIdx(i => i + 1)
  }

  const algoliaImg     = algoliaImgs[bottle.id]
  const catalogUrl     = algoliaImg?.imageUrl ?? null
  const catalogSource  = algoliaImg?.source   ?? null
  const loadingCatalog = algoliaImg?.loading  ?? true
  const candidates     = algoliaImg?.candidates ?? null
  const displayUrl     = candidates?.length > 1 ? (candidates[candidateIdx] ?? catalogUrl) : catalogUrl

  const catalogLabel = catalogSource === 'algolia'
    ? "Found in Binny's catalog"
    : catalogSource === 'ua-catalog' || catalogSource === 'ua-cache'
      ? 'Found in Unicorn Auctions catalog'
      : 'Found in catalog'
  const remaining     = bottles.length - idx

  return (
    <div style={{
      position:      'fixed',
      inset:         0,
      background:    'var(--bg-base)',
      zIndex:        400,
      display:       'flex',
      flexDirection: 'column',
      overflowY:     'auto',
    }}>
      {/* Header */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        'var(--sp-4)',
        paddingTop:     'calc(var(--sp-4) + env(safe-area-inset-top))',
        background:     'var(--bg-elev-1)',
        borderBottom:   '1px solid var(--hairline)',
        flexShrink:     0,
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 'var(--fs-h3)', color: 'var(--text-primary)' }}>Add Missing Photos</div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
            {idx + 1} of {bottles.length} · {remaining} remaining
          </div>
        </div>
        <button
          onClick={onDone}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 'var(--sp-1)', lineHeight: 1, display: 'flex', borderRadius: 'var(--r-sm)' }}
          aria-label="Close"
        >
          <X size={20} strokeWidth={1.75} />
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'var(--bg-elev-2)', flexShrink: 0 }}>
        <div style={{
          height:     '100%',
          background: 'var(--copper-500)',
          transition: `width var(--t-slow) var(--ease-out)`,
          width:      `${(idx / bottles.length) * 100}%`,
        }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 'var(--sp-6) var(--sp-5)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-5)' }}>

        {/* Bottle identity */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 'var(--fs-h1)', color: 'var(--text-primary)', lineHeight: 1.25, marginBottom: 'var(--sp-1)' }}>
            {bottle.name}
          </div>
          {bottle.distillery && (
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>{bottle.distillery}</div>
          )}
          {(bottle.category || bottle.proof) && (
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', marginTop: 'var(--sp-1)' }}>
              {[bottle.category, bottle.proof ? `${bottle.proof}°` : null].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        {/* Catalog image suggestion */}
        {loadingCatalog ? (
          <div style={{
            width:          '100%',
            maxWidth:       300,
            aspectRatio:    '3/4',
            background:     'var(--bg-elev-1)',
            borderRadius:   'var(--r-lg)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            color:          'var(--text-dim)',
            fontSize:       'var(--fs-body)',
            gap:            'var(--sp-2)',
          }}>
            <Loader size={16} strokeWidth={1.75} color="var(--text-dim)" />
            Checking catalog…
          </div>
        ) : catalogUrl ? (
          <div style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)', textAlign: 'center', letterSpacing: 0.3, textTransform: 'uppercase' }}>
              {catalogLabel}{candidates?.length > 1 ? ` · ${candidateIdx + 1} of ${candidates.length}` : ''}
            </div>

            {/* Image with prev/next arrows */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              {candidates?.length > 1 && (
                <button
                  onClick={() => setCandidateIdx(i => Math.max(0, i - 1))}
                  disabled={candidateIdx === 0}
                  style={{
                    flexShrink: 0, background: 'var(--bg-elev-2)', border: '1px solid var(--hairline-2)',
                    borderRadius: 'var(--r-md)', padding: 'var(--sp-2)', cursor: candidateIdx === 0 ? 'default' : 'pointer',
                    opacity: candidateIdx === 0 ? 0.3 : 1, color: 'var(--text-primary)', display: 'flex',
                  }}
                  aria-label="Previous photo"
                >
                  <ChevronLeft size={18} strokeWidth={1.75} />
                </button>
              )}
              <img
                key={displayUrl}
                src={displayUrl}
                alt={bottle.name}
                style={{
                  flex: 1, width: 0, minWidth: 0,
                  aspectRatio: '3/4',
                  objectFit:   'contain',
                  borderRadius: 'var(--r-lg)',
                  background:  'var(--text-inverse)',
                  padding:     'var(--sp-3)',
                  boxSizing:   'border-box',
                }}
              />
              {candidates?.length > 1 && (
                <button
                  onClick={() => setCandidateIdx(i => Math.min(candidates.length - 1, i + 1))}
                  disabled={candidateIdx === candidates.length - 1}
                  style={{
                    flexShrink: 0, background: 'var(--bg-elev-2)', border: '1px solid var(--hairline-2)',
                    borderRadius: 'var(--r-md)', padding: 'var(--sp-2)', cursor: candidateIdx === candidates.length - 1 ? 'default' : 'pointer',
                    opacity: candidateIdx === candidates.length - 1 ? 0.3 : 1, color: 'var(--text-primary)', display: 'flex',
                  }}
                  aria-label="Next photo"
                >
                  <ChevronRight size={18} strokeWidth={1.75} />
                </button>
              )}
            </div>

            <Button
              variant="primary"
              fullWidth
              icon={<CheckCircle size={16} strokeWidth={1.75} />}
              onClick={() => applyPhotoUrl(displayUrl)}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Use this photo'}
            </Button>
            <label style={{
              padding:        'var(--sp-2)',
              background:     'var(--bg-elev-1)',
              border:         '1px solid var(--hairline-2)',
              borderRadius:   'var(--r-md)',
              color:          'var(--text-muted)',
              fontWeight:     600,
              fontSize:       'var(--fs-body)',
              cursor:         saving ? 'default' : 'pointer',
              textAlign:      'center',
              fontFamily:     'inherit',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            'var(--sp-2)',
            }}>
              <Camera size={14} strokeWidth={1.75} />
              Use my own instead
              <input type="file" accept="image/*" capture="environment"
                onChange={handleFile} disabled={saving} style={{ display: 'none' }} />
            </label>
          </div>
        ) : (
          <label style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            width:          '100%',
            maxWidth:       300,
            aspectRatio:    '4/3',
            background:     'var(--bg-elev-1)',
            border:         `2px dashed ${error ? 'var(--red)' : 'var(--hairline-3)'}`,
            borderRadius:   'var(--r-xl)',
            cursor:         saving ? 'default' : 'pointer',
            gap:            'var(--sp-3)',
          }}>
            {saving ? (
              <>
                <Loader size={28} strokeWidth={1.75} color="var(--text-dim)" />
                <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>Uploading…</div>
              </>
            ) : (
              <>
                <Camera size={36} strokeWidth={1.5} color="var(--text-dim)" style={{ opacity: 0.5 }} />
                <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)', fontWeight: 600 }}>Tap to add a photo</div>
                <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>Not found in catalog · Camera or gallery</div>
              </>
            )}
            <input ref={inputRef} type="file" accept="image/*" capture="environment"
              onChange={handleFile} disabled={saving} style={{ display: 'none' }} />
          </label>
        )}

        {error && <p style={{ fontSize: 'var(--fs-meta)', color: 'var(--red)', textAlign: 'center', margin: 0 }}>{error}</p>}

        {/* Skip + auto-fill */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-2)', width: '100%', maxWidth: 300 }}>
          <Button
            variant="secondary"
            fullWidth
            icon={<SkipForward size={14} strokeWidth={1.75} />}
            onClick={skip}
            disabled={saving || autoFilling}
          >
            Skip this bottle
          </Button>
          {remaining > 1 && (
            <button
              onClick={handleAutoFill}
              disabled={saving || autoFilling}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={e   => e.currentTarget.style.transform = 'scale(1)'}
              style={{
                background:  'none',
                border:      'none',
                color:       'var(--text-dim)',
                fontSize:    'var(--fs-meta)',
                cursor:      (saving || autoFilling) ? 'default' : 'pointer',
                fontFamily:  'inherit',
                padding:     'var(--sp-1) 0',
                opacity:     (saving || autoFilling) ? 0.4 : 1,
                display:     'flex',
                alignItems:  'center',
                gap:         'var(--sp-1)',
                transition:  `transform var(--t-fast) var(--ease-out)`,
              }}
            >
              {autoFilling
                ? <><Loader size={12} strokeWidth={1.75} /> Filling from catalog…</>
                : <><RefreshCw size={12} strokeWidth={1.75} /> Auto-fill all {remaining} from Binny's catalog</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CollectionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [bottles,       setBottles]       = useState([])
  const [loaded,        setLoaded]        = useState(false)
  const [loadError,     setLoadError]     = useState(false)
  const [sort,          setSort]          = useState('score')
  const [showAdd,       setShowAdd]       = useState(false)
  const [removing,      setRemoving]      = useState(null)
  const [editingBottle, setEditingBottle] = useState(null)
  const [showFillPhotos, setShowFillPhotos] = useState(false)
  const [unicornDeals,  setUnicornDeals]  = useState([])
  const [marketPrices,  setMarketPrices]  = useState({})

  // Samples tab
  const [tab,           setTab]           = useState('bottles')
  const [samples,       setSamples]       = useState([])
  const [samplesLoaded, setSamplesLoaded] = useState(false)
  const [showAddSample, setShowAddSample] = useState(false)
  const [removingSample,setRemovingSample]= useState(null)
  const [labelBottle,   setLabelBottle]   = useState(null)
  const [showValue,     setShowValue]     = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status])

  useEffect(() => {
    fetch('/api/collection')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(d => {
        const bs = d.bottles ?? []
        setBottles(bs)
        const names = [...new Set(bs.map(b => b.name))]
        Promise.all(
          names.map(name =>
            fetch(`/api/market-price?name=${encodeURIComponent(name)}`)
              .then(r => r.json())
              .then(d => [name, d.price])
              .catch(() => [name, null])
          )
        ).then(pairs => setMarketPrices(Object.fromEntries(pairs)))
      })
      .catch(() => setLoadError(true))
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
      if (res.ok && data.bottles) setBottles(data.bottles)
    } catch {}
    setRemoving(null)
  }

  async function handleRemoveSample(id) {
    setRemovingSample(id)
    try {
      const res  = await fetch(`/api/samples?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.samples) setSamples(data.samples)
    } catch (err) {
      console.warn('[collection] removeSample failed:', err.message)
    } finally {
      setRemovingSample(null)
    }
  }

  function handleLabelBottle(bottle) {
    if (!isPro(session?.user?.tier)) {
      router.push('/upgrade')
      return
    }
    setLabelBottle(bottle)
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
  const totalBottles = bottles.reduce((s, b) => s + Number(b.qty ?? 1), 0)
  const estValue = bottles.reduce((s, b) => {
    const val = Number(b.secondary) > 0 ? Number(b.secondary) : (Number(b.msrp) > 0 ? Number(b.msrp) : 0)
    return s + val * Number(b.qty ?? 1)
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
        background:           'rgba(var(--bg-base-rgb, 15,10,5),0.95)',
        borderBottom:         '1px solid var(--hairline-2)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding:              'var(--sp-3) var(--sp-4)',
        display:              'flex',
        alignItems:           'center',
        justifyContent:       'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <Link
            href="/profile"
            style={{
              color:          'var(--text-muted)',
              textDecoration: 'none',
              lineHeight:     1,
              display:        'flex',
              padding:        'var(--sp-1)',
              borderRadius:   'var(--r-sm)',
            }}
          >
            <ArrowLeft size={20} strokeWidth={1.75} />
          </Link>
          <div>
            <div style={{ fontWeight: 800, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <ShelfIcon size={18} /> My Collection
            </div>
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>Personal bottle inventory</div>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={14} strokeWidth={2} />}
          onClick={() => tab === 'bottles' ? setShowAdd(true) : setShowAddSample(true)}
        >
          {tab === 'bottles' ? 'Bottle' : 'Sample'}
        </Button>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: 'var(--sp-4) var(--sp-3)', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>

        {/* Summary Strip */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
          <StatTile label="Bottles"   value={totalBottles} />
          <button
            onClick={() => setShowValue(v => !v)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)',
              padding: 'var(--sp-4)', background: 'var(--bg-elev-2)',
              border: '1px solid var(--hairline-2)', borderRadius: 'var(--r-lg)',
              minWidth: 0, cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{
              fontSize: 'var(--fs-overline)', fontWeight: 700,
              letterSpacing: 'var(--tracking-overline)', textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}>Est. Value</span>
            {showValue ? (
              <span style={{
                fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600,
                fontSize: 28, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em',
              }}>
                {estValue > 0 ? `$${Math.round(estValue).toLocaleString()}` : '—'}
              </span>
            ) : (
              <EyeOff size={22} strokeWidth={1.5} color="var(--text-dim)" style={{ marginTop: 2 }} />
            )}
          </button>
          <StatTile label="Avg Score" value={avgScore} />
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
          {[
            { key: 'bottles', icon: <ShelfIcon size={14} />, text: `Bottles (${bottles.length})` },
            { key: 'samples', icon: '🥃',                   text: `Samples (${samples.length})`  },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={e   => e.currentTarget.style.transform = 'scale(1)'}
              style={{
                flex:           1,
                padding:        'var(--sp-2) 0',
                borderRadius:   'var(--r-md)',
                border:         'none',
                cursor:         'pointer',
                background:     tab === t.key ? 'var(--copper-500)' : 'var(--bg-elev-2)',
                color:          tab === t.key ? 'var(--text-inverse)' : 'var(--text-dim)',
                fontWeight:     700,
                fontSize:       'var(--fs-body)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            'var(--sp-1)',
                transition:     `background var(--t-base) var(--ease-out), transform var(--t-fast) var(--ease-out)`,
              }}
            >{t.icon} {t.text}</button>
          ))}
        </div>

        {/* ── Samples tab ─────────────────────────────────────────── */}
        {tab === 'samples' && (
          <div>
            {!samplesLoaded ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-body)', textAlign: 'center', padding: 'var(--sp-8) 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)' }}>
                <Loader size={16} strokeWidth={1.75} />Loading…
              </p>
            ) : samples.length === 0 ? (
              <EmptyState
                icon="FlaskConical"
                title="No samples yet"
                body="Track bottles you received via mule or handshake"
                ctaLabel="Add your first sample"
                onCta={() => setShowAddSample(true)}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
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

        {/* ── Bottles tab ─────────────────────────────────────────── */}
        {tab === 'bottles' && <>
          {/* Sort bar */}
          <div style={{ display: 'flex', gap: 'var(--sp-1)', overflowX: 'auto', marginBottom: 'var(--sp-3)', paddingBottom: 'var(--sp-1)' }}>
            {SORT_OPTIONS.map(o => (
              <button
                key={o.key}
                onClick={() => setSort(o.key)}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e   => e.currentTarget.style.transform = 'scale(1)'}
                style={{
                  flexShrink:  0,
                  padding:     'var(--sp-1) var(--sp-3)',
                  borderRadius: 'var(--r-pill)',
                  border:      'none',
                  cursor:      'pointer',
                  background:  sort === o.key ? 'var(--copper-500)' : 'var(--bg-elev-2)',
                  color:       sort === o.key ? 'var(--text-inverse)' : 'var(--text-muted)',
                  fontSize:    'var(--fs-meta)',
                  fontWeight:  600,
                  whiteSpace:  'nowrap',
                  transition:  `background var(--t-base) var(--ease-out), transform var(--t-fast) var(--ease-out)`,
                }}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Missing-photos banner */}
          {loaded && bottles.filter(b => !b.photoUrl).length > 0 && (
            <button
              onClick={() => setShowFillPhotos(true)}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={e   => e.currentTarget.style.transform = 'scale(1)'}
              style={{
                width:        '100%',
                display:      'flex',
                alignItems:   'center',
                gap:          'var(--sp-2)',
                padding:      'var(--sp-2) var(--sp-3)',
                marginBottom: 'var(--sp-3)',
                background:   'var(--bg-elev-1)',
                border:       '1px solid var(--hairline-2)',
                borderRadius: 'var(--r-md)',
                cursor:       'pointer',
                textAlign:    'left',
                fontFamily:   'inherit',
                transition:   `transform var(--t-fast) var(--ease-out)`,
              }}
            >
              <ImageIcon size={18} strokeWidth={1.75} color="var(--copper-500)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {bottles.filter(b => !b.photoUrl).length} bottle{bottles.filter(b => !b.photoUrl).length !== 1 ? 's' : ''} missing photos
                </div>
                <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
                  Tap to add them all in one pass
                </div>
              </div>
              <ChevronRight size={16} strokeWidth={1.75} color="var(--copper-500)" style={{ flexShrink: 0 }} />
            </button>
          )}

          {/* Bottle list */}
          {!loaded ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-body)', textAlign: 'center', padding: 'var(--sp-8) 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)' }}>
              <Loader size={16} strokeWidth={1.75} />Loading…
            </p>
          ) : loadError ? (
            <p style={{ color: 'var(--red)', fontSize: 'var(--fs-body)', textAlign: 'center', padding: 'var(--sp-8) 0' }}>
              Failed to load your collection. Please refresh.
            </p>
          ) : sorted.length === 0 ? (
            <EmptyState
              icon="Wine"
              title="Your collection is empty"
              body="Add your first bottle to get started"
              ctaLabel="Add your first bottle"
              onCta={() => setShowAdd(true)}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {sorted.map(bottle => (
                <BottleCard
                  key={bottle.id}
                  bottle={bottle}
                  onRemove={handleRemove}
                  onEdit={setEditingBottle}
                  onLabel={handleLabelBottle}
                  unicornMatches={findUnicornMatches(bottle.name, unicornDeals)}
                  marketPrice={marketPrices[bottle.name] ?? null}
                />
              ))}
            </div>
          )}
        </>}

      </div>

      {editingBottle && (
        <EditBottleSheet
          bottle={editingBottle}
          open={!!editingBottle}
          onClose={() => setEditingBottle(null)}
          onSave={(bottles) => { setBottles(bottles); setEditingBottle(null) }}
        />
      )}

      {showFillPhotos && (
        <FillPhotosSheet
          bottles={bottles.filter(b => !b.photoUrl)}
          onDone={(updatedBottles, close = true) => {
            if (updatedBottles) setBottles(updatedBottles)
            if (close) setShowFillPhotos(false)
          }}
        />
      )}

      {showAdd && (
        <AddBottleSheet
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onAdd={(bottles) => { setBottles(bottles); setShowAdd(false) }}
        />
      )}

      <AddSampleSheet
        open={showAddSample}
        onClose={() => setShowAddSample(false)}
        onAdd={(sample) => { setSamples(prev => [sample, ...prev]); setShowAddSample(false) }}
      />

      <LabelMakerSheet
        open={!!labelBottle}
        onClose={() => setLabelBottle(null)}
        bottle={labelBottle}
        bottles={bottles}
        session={session}
      />
    </div>
  )
}
