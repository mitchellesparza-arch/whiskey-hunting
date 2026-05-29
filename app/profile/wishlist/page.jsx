'use client'
import { useSession }                   from 'next-auth/react'
import { useRouter }                    from 'next/navigation'
import { useEffect, useState }          from 'react'
import { Camera, X, Check, MapPin, BarChart2, Search, Pause } from 'lucide-react'
import AppHeader                        from '../../components/AppHeader.jsx'
import BarcodeScanner                   from '../../finds/BarcodeScanner.jsx'
import Button                           from '../../components/ui/Button.jsx'
import Card                             from '../../components/ui/Card.jsx'
import Chip                             from '../../components/ui/Chip.jsx'
import EmptyState                       from '../../components/ui/EmptyState.jsx'
import SectionHeader                    from '../../components/ui/SectionHeader.jsx'

// ── Constants ──────────────────────────────────────────────────────────────────

const RARITY_META = {
  Common:    { tone: 'amber',  label: 'Common'     },
  Allocated: { tone: 'copper', label: 'Allocated'  },
  Unicorn:   { tone: 'violet', label: '🦄 Unicorn' },
}

const STATUS_META = {
  Hunting: { tone: 'copper', label: 'Hunting', icon: <Search  size={10} strokeWidth={2} /> },
  Found:   { tone: 'green',  label: 'Found',   icon: <Check   size={10} strokeWidth={2} /> },
  Paused:  { tone: 'neutral',label: 'Paused',  icon: <Pause   size={10} strokeWidth={2} /> },
}

const RARITY_OPTIONS = ['Common', 'Allocated', 'Unicorn']
const STATUS_OPTIONS = ['Hunting', 'Found', 'Paused']

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt$(n) {
  if (!n && n !== 0) return null
  return `$${Number(n).toLocaleString()}`
}

function RarityBadge({ rarity }) {
  const m = RARITY_META[rarity] ?? RARITY_META.Allocated
  return <Chip tone={m.tone} size="sm">{m.label}</Chip>
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.Hunting
  return (
    <Chip tone={m.tone} size="sm" style={{ gap: 4 }}>
      {m.icon}{m.label}
    </Chip>
  )
}

function MarketPriceChip({ price }) {
  if (!price) return null
  return (
    <Chip tone="blue" size="sm">
      <BarChart2 size={10} strokeWidth={2} /> ${price.low}–${price.high}
    </Chip>
  )
}

// ── Shared sub-component styles ────────────────────────────────────────────────

const inputStyle = {
  width: '100%',
  padding: 'var(--sp-2) var(--sp-3)',
  background: 'var(--bg-elev-1)',
  border: '1px solid var(--hairline-2)',
  borderRadius: 'var(--r-md)',
  color: 'var(--text-primary)',
  fontSize: 'var(--fs-body)',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const labelStyle = {
  display: 'block',
  color: 'var(--text-muted)',
  fontSize: 'var(--fs-overline)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 'var(--sp-1)',
  fontWeight: 700,
}

// ── Segmented picker helper ────────────────────────────────────────────────────

function SegmentPicker({ options, value, onChange, meta }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
      {options.map(opt => {
        const m   = meta[opt]
        const sel = value === opt
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
            onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.97)')}
            onTouchEnd={e   => (e.currentTarget.style.transform = 'scale(1)')}
            style={{
              flex: 1,
              padding: 'var(--sp-2) var(--sp-2)',
              background: sel ? 'var(--bg-elev-3)' : 'transparent',
              border: sel ? '1px solid var(--hairline-3)' : '1px solid var(--hairline)',
              borderRadius: 'var(--r-md)',
              color: sel ? 'var(--text-primary)' : 'var(--text-dim)',
              fontWeight: 700,
              fontSize: 'var(--fs-meta)',
              cursor: 'pointer',
              transition: `background var(--t-fast) var(--ease-out), border-color var(--t-fast) var(--ease-out), transform var(--t-fast) var(--ease-out)`,
              fontFamily: 'inherit',
            }}
          >
            {opt === 'Unicorn' ? '🦄 ' : ''}{m?.label ?? opt}
          </button>
        )
      })}
    </div>
  )
}

// ── Add Bottle Modal ───────────────────────────────────────────────────────────

function AddBottleModal({ onClose, onAdded }) {
  const [name,        setName]        = useState('')
  const [rarity,      setRarity]      = useState('Allocated')
  const [targetPrice, setTargetPrice] = useState('')
  const [storeNotes,  setStoreNotes]  = useState('')
  const [scanning,    setScanning]    = useState(false)
  const [lookupMsg,   setLookupMsg]   = useState(null)
  const [lookingUp,   setLookingUp]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState(null)

  async function handleBarcode(code) {
    setLookingUp(true); setLookupMsg(null)
    try {
      const r = await fetch(`/api/lookup?upc=${encodeURIComponent(code)}`)
      const d = await r.json()
      if (d.found) {
        setName(d.bottle?.name ?? name)
        setLookupMsg('matched')
      } else {
        setLookupMsg('miss')
      }
    } catch { setLookupMsg('error') }
    finally { setLookingUp(false); setScanning(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Bottle name is required'); return }
    setSubmitting(true); setError(null)
    try {
      const r = await fetch('/api/wishlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), rarity, targetPrice: targetPrice || null, storeNotes: storeNotes.trim() || null }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Failed')
      onAdded(d.entry)
    } catch (err) { setError(err.message) }
    finally { setSubmitting(false) }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-base)',
        borderRadius: 'var(--r-2xl) var(--r-2xl) 0 0',
        border: '1px solid var(--hairline-2)',
        borderBottom: 'none',
        width: '100%',
        maxWidth: 520,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: 'var(--sp-6) var(--sp-5) var(--sp-10)',
      }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-5)' }}>
          <h2 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 'var(--fs-h2)', margin: 0 }}>Add to Wishlist</h2>
          <button
            onClick={onClose}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
            onMouseUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', lineHeight: 1, padding: 'var(--sp-1)' }}
          >
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

          {/* Bottle name + barcode */}
          <div>
            <label style={labelStyle}>Bottle Name *</label>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Blanton's Original"
                style={{ ...inputStyle, flex: 1 }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setScanning(true)}
                icon={lookingUp ? null : <Camera size={16} strokeWidth={1.75} />}
                style={{ flexShrink: 0, paddingLeft: 'var(--sp-3)', paddingRight: 'var(--sp-3)' }}
              >
                {lookingUp ? '…' : null}
              </Button>
            </div>
            {scanning && (
              <div style={{ marginTop: 'var(--sp-2)' }}>
                <BarcodeScanner onResult={handleBarcode} onClose={() => setScanning(false)} />
              </div>
            )}
            {lookupMsg && (
              <div style={{
                marginTop: 'var(--sp-2)',
                fontSize: 'var(--fs-meta)',
                color: lookupMsg === 'matched' ? 'var(--green)' : 'var(--text-muted)',
              }}>
                {lookupMsg === 'matched'
                  ? '✓ Barcode matched'
                  : lookupMsg === 'miss'
                    ? 'Barcode not in database — fill in manually'
                    : 'Lookup failed'}
              </div>
            )}
          </div>

          {/* Rarity tier */}
          <div>
            <label style={labelStyle}>Rarity Tier</label>
            <SegmentPicker options={RARITY_OPTIONS} value={rarity} onChange={setRarity} meta={RARITY_META} />
          </div>

          {/* Target price */}
          <div>
            <label style={labelStyle}>Target Price ($) — optional</label>
            <input
              type="number" min="0" step="1"
              value={targetPrice} onChange={e => setTargetPrice(e.target.value)}
              placeholder="e.g. 65"
              style={inputStyle}
            />
          </div>

          {/* Store notes */}
          <div>
            <label style={labelStyle}>Store Notes — optional</label>
            <input
              value={storeNotes} onChange={e => setStoreNotes(e.target.value)}
              placeholder="e.g. Binny's Orland Park gets this occasionally"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              fontSize: 'var(--fs-meta)',
              color: 'var(--red)',
              padding: 'var(--sp-2) var(--sp-3)',
              background: 'rgba(248,113,113,0.08)',
              borderRadius: 'var(--r-md)',
              border: '1px solid rgba(248,113,113,0.25)',
            }}>
              {error}
            </div>
          )}

          <Button type="submit" fullWidth disabled={submitting} style={{ marginTop: 'var(--sp-1)' }}>
            {submitting ? 'Adding…' : 'Add to Wishlist'}
          </Button>

        </form>
      </div>
    </div>
  )
}

// ── Edit Entry Modal ───────────────────────────────────────────────────────────

function EditEntryModal({ entry, onClose, onSaved, onMoveToCollection }) {
  const [rarity,      setRarity]      = useState(entry.rarity      ?? 'Allocated')
  const [targetPrice, setTargetPrice] = useState(entry.targetPrice != null ? String(entry.targetPrice) : '')
  const [storeNotes,  setStoreNotes]  = useState(entry.storeNotes  ?? '')
  const [status,      setStatus]      = useState(entry.status      ?? 'Hunting')
  const [saving,      setSaving]      = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const r = await fetch('/api/wishlist', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, rarity, targetPrice: targetPrice || null, storeNotes: storeNotes.trim() || null, status }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Save failed')
      onSaved(d.entry)
    } catch {} finally { setSaving(false) }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-base)',
        borderRadius: 'var(--r-2xl) var(--r-2xl) 0 0',
        border: '1px solid var(--hairline-2)',
        borderBottom: 'none',
        width: '100%',
        maxWidth: 520,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: 'var(--sp-6) var(--sp-5) var(--sp-10)',
      }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-1)' }}>
          <h2 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 'var(--fs-h2)', margin: 0 }}>{entry.name}</h2>
          <button
            onClick={onClose}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
            onMouseUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', lineHeight: 1, padding: 'var(--sp-1)' }}
          >
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>
        <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', marginBottom: 'var(--sp-5)' }}>
          Added {new Date(entry.addedAt).toLocaleDateString()}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <SegmentPicker options={STATUS_OPTIONS} value={status} onChange={setStatus} meta={STATUS_META} />
          </div>

          {/* Rarity */}
          <div>
            <label style={labelStyle}>Rarity Tier</label>
            <SegmentPicker options={RARITY_OPTIONS} value={rarity} onChange={setRarity} meta={RARITY_META} />
          </div>

          {/* Target price */}
          <div>
            <label style={labelStyle}>Target Price ($)</label>
            <input
              type="number" min="0" step="1"
              value={targetPrice} onChange={e => setTargetPrice(e.target.value)}
              placeholder="e.g. 65"
              style={inputStyle}
            />
          </div>

          {/* Store notes */}
          <div>
            <label style={labelStyle}>Store Notes</label>
            <input
              value={storeNotes} onChange={e => setStoreNotes(e.target.value)}
              placeholder="Store tips…"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-1)' }}>
            <Button onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
            {status !== 'Found' && (
              <Button
                variant="secondary"
                onClick={() => onMoveToCollection(entry)}
                icon={<Check size={16} strokeWidth={2} />}
                style={{ flex: 1 }}
              >
                Found it
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Wishlist Card ──────────────────────────────────────────────────────────────

function WishlistCard({ entry, marketPrice, onEdit, onDelete }) {
  return (
    <Card
      hover={false}
      style={{
        background: 'var(--bg-elev-2)',
        border: entry.status === 'Found'
          ? '1px solid rgba(93,211,158,0.25)'
          : '1px solid var(--hairline-2)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--sp-4)',
        opacity: entry.status === 'Paused' ? 0.6 : 1,
        transition: `border-color var(--t-base) var(--ease-out)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>

        {/* Left: name + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', marginBottom: 'var(--sp-2)', lineHeight: 1.3 }}>
            {entry.name}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-1)', marginBottom: entry.storeNotes ? 'var(--sp-2)' : 0 }}>
            <RarityBadge rarity={entry.rarity} />
            <StatusBadge status={entry.status} />
            {entry.targetPrice != null && (
              <Chip tone="amber" size="sm">Target {fmt$(entry.targetPrice)}</Chip>
            )}
            {marketPrice && <MarketPriceChip price={marketPrice} />}
          </div>
          {marketPrice && entry.targetPrice != null && (
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', marginBottom: 'var(--sp-2)' }}>
              {entry.targetPrice < marketPrice.low
                ? '⚠ Target below market range'
                : entry.targetPrice <= marketPrice.high
                  ? '✓ Target within market range'
                  : '✓ Target above market low'
              }
            </div>
          )}
          {entry.storeNotes && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-1)', fontSize: 'var(--fs-meta)', color: 'var(--text-2)', fontStyle: 'italic', lineHeight: 1.4 }}>
              <MapPin size={12} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
              {entry.storeNotes}
            </div>
          )}
          {marketPrice && (
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', marginTop: 'var(--sp-1)' }}>
              Market data: {marketPrice.source} · Updated {marketPrice.lastUpdated}
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexShrink: 0 }}>
          <Button variant="secondary" size="sm" onClick={() => onEdit(entry)}>Edit</Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(entry.id)}
            style={{ padding: 'var(--sp-2)', color: 'var(--text-dim)' }}
          >
            <X size={14} strokeWidth={1.75} />
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ── Filter tab button ──────────────────────────────────────────────────────────

function FilterTab({ label, active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
      onMouseUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
      onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.96)')}
      onTouchEnd={e   => (e.currentTarget.style.transform = 'scale(1)')}
      style={{
        padding: 'var(--sp-1) var(--sp-3)',
        borderRadius: 'var(--r-pill)',
        fontSize: 'var(--fs-meta)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        background:   active ? 'rgba(217,126,44,0.15)' : 'transparent',
        color:        active ? 'var(--copper-400)'     : 'var(--text-muted)',
        border:       active ? '1px solid rgba(217,126,44,0.4)' : '1px solid var(--hairline)',
        transition: `background var(--t-fast) var(--ease-out), border-color var(--t-fast) var(--ease-out), transform var(--t-fast) var(--ease-out)`,
        fontFamily: 'inherit',
      }}
    >
      {label}
      {count !== undefined && (
        <span style={{ marginLeft: 'var(--sp-1)', opacity: 0.65, fontSize: 'var(--fs-meta)' }}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: 'all',     label: 'All'     },
  { key: 'Hunting', label: 'Hunting' },
  { key: 'Found',   label: 'Found'   },
  { key: 'Paused',  label: 'Paused'  },
]

export default function WishlistPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [wishlist,     setWishlist]     = useState([])
  const [loaded,       setLoaded]       = useState(false)
  const [loadError,    setLoadError]    = useState(false)
  const [marketPrices, setMarketPrices] = useState({})
  const [filterTab,    setFilterTab]    = useState('all')
  const [showAdd,      setShowAdd]      = useState(false)
  const [editing,      setEditing]      = useState(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated' && session?.user?.approved === false) router.replace('/pending')
  }, [status, session])

  useEffect(() => {
    fetch('/api/wishlist')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(d => setWishlist(d.wishlist ?? []))
      .catch(() => setLoadError(true))
      .finally(() => setLoaded(true))
  }, [])

  // Fetch market prices for all bottle names in the wishlist
  useEffect(() => {
    if (!wishlist.length) return
    const names = [...new Set(wishlist.map(e => e.name))]
    Promise.all(
      names.map(name =>
        fetch(`/api/market-price?name=${encodeURIComponent(name)}`)
          .then(r => r.json())
          .then(d => [name, d.price])
          .catch(() => [name, null])
      )
    ).then(pairs => setMarketPrices(Object.fromEntries(pairs)))
  }, [wishlist.length])

  function handleAdded(entry) {
    setWishlist(prev => [...prev, entry])
    setShowAdd(false)
  }

  function handleSaved(updated) {
    setWishlist(prev => prev.map(e => e.id === updated.id ? updated : e))
    setEditing(null)
  }

  async function handleDelete(id) {
    setWishlist(prev => prev.filter(e => e.id !== id))
    await fetch(`/api/wishlist?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  async function handleMoveToCollection(entry) {
    // Mark Found on wishlist
    await fetch('/api/wishlist', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entry.id, status: 'Found' }),
    })
    setWishlist(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'Found' } : e))
    setEditing(null)
    // Navigate to Add to Collection
    router.push('/profile/collection')
  }

  const filtered     = wishlist.filter(e => filterTab === 'all' || e.status === filterTab)
  const huntingCount = wishlist.filter(e => e.status === 'Hunting').length
  const foundCount   = wishlist.filter(e => e.status === 'Found').length

  if (status === 'loading') return null

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <AppHeader sub="Your Hunt List" />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: 'var(--sp-5) var(--sp-4) var(--sp-12)' }}>

        {/* Header row */}
        <SectionHeader
          overline={`${huntingCount} hunting · ${foundCount} found`}
          title="Wishlist"
          action={
            <Button onClick={() => setShowAdd(true)} size="sm">
              + Add Bottle
            </Button>
          }
          style={{ marginBottom: 'var(--sp-4)' }}
        />

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)', overflowX: 'auto', paddingBottom: 'var(--sp-1)' }}>
          {FILTER_TABS.map(t => (
            <FilterTab
              key={t.key}
              label={t.label}
              active={filterTab === t.key}
              count={t.key !== 'all' ? wishlist.filter(e => e.status === t.key).length : undefined}
              onClick={() => setFilterTab(t.key)}
            />
          ))}
        </div>

        {/* List */}
        {!loaded ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-12) 0', color: 'var(--text-dim)' }}>Loading…</div>
        ) : loadError ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-12) 0', color: 'var(--red)', fontSize: 'var(--fs-body)' }}>
            Failed to load your wishlist. Please refresh.
          </div>
        ) : filtered.length === 0 ? (
          filterTab === 'all' ? (
            <EmptyState
              icon="Bookmark"
              title="Your wishlist is empty"
              body="Add bottles you're hunting for"
              ctaLabel="+ Add Your First Bottle"
              onCta={() => setShowAdd(true)}
            />
          ) : (
            <EmptyState
              icon="Search"
              title={`No ${filterTab.toLowerCase()} bottles`}
              body="Switch tabs or add a new bottle"
            />
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {filtered.map(entry => (
              <WishlistCard
                key={entry.id}
                entry={entry}
                marketPrice={marketPrices[entry.name] ?? null}
                onEdit={setEditing}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Market price attribution */}
        {loaded && wishlist.length > 0 && Object.values(marketPrices).some(p => p) && (
          <div style={{
            marginTop: 'var(--sp-5)',
            padding: 'var(--sp-3) var(--sp-4)',
            background: 'var(--bg-elev-1)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-md)',
          }}>
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
              <BarChart2 size={12} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
              Market price ranges are secondary market estimates and may not reflect current trading conditions.
              Data is updated periodically.
            </div>
          </div>
        )}

      </div>

      {showAdd && (
        <AddBottleModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />
      )}

      {editing && (
        <EditEntryModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onMoveToCollection={handleMoveToCollection}
        />
      )}
    </div>
  )
}
