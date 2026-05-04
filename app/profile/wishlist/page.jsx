'use client'
import { useSession }              from 'next-auth/react'
import { useRouter }               from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import AppHeader                   from '../../components/AppHeader.jsx'
import BarcodeScanner              from '../../finds/BarcodeScanner.jsx'

// ── Constants ──────────────────────────────────────────────────────────────────

const RARITY_META = {
  Common:    { color: '#9a7c55', bg: 'rgba(154,124,85,0.15)',   label: 'Common'    },
  Allocated: { color: '#e8943a', bg: 'rgba(232,148,58,0.15)',   label: 'Allocated' },
  Unicorn:   { color: '#c084fc', bg: 'rgba(192,132,252,0.15)',  label: '🦄 Unicorn' },
}

const STATUS_META = {
  Hunting: { color: '#e8943a', bg: 'rgba(232,148,58,0.12)', label: '🔍 Hunting' },
  Found:   { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', label: '✓ Found'    },
  Paused:  { color: '#6b5030', bg: 'rgba(107,80,48,0.12)',  label: '⏸ Paused'  },
}

const RARITY_OPTIONS   = ['Common', 'Allocated', 'Unicorn']
const STATUS_OPTIONS   = ['Hunting', 'Found', 'Paused']

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt$(n) {
  if (!n && n !== 0) return null
  return `$${Number(n).toLocaleString()}`
}

function RarityBadge({ rarity }) {
  const m = RARITY_META[rarity] ?? RARITY_META.Allocated
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
      color: m.color, background: m.bg, border: `1px solid ${m.color}40`,
      letterSpacing: '0.03em',
    }}>
      {m.label}
    </span>
  )
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.Hunting
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
      color: m.color, background: m.bg, border: `1px solid ${m.color}40`,
    }}>
      {m.label}
    </span>
  )
}

function MarketPriceChip({ price }) {
  if (!price) return null
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
      color: '#60a5fa', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)',
      whiteSpace: 'nowrap',
    }}>
      📊 ${price.low}–${price.high}
    </span>
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
      const r = await fetch(`/api/whiskey-db?upc=${encodeURIComponent(code)}`)
      const d = await r.json()
      if (d.found) {
        setName(d.bottle?.name ?? name)
        setLookupMsg('✓ Barcode matched')
      } else {
        setLookupMsg('Barcode not in database — fill in manually')
      }
    } catch { setLookupMsg('Lookup failed') }
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

  const inputStyle = {
    width: '100%', padding: '9px 12px', background: '#1f1308',
    border: '1px solid #3d2b10', borderRadius: 8, color: '#f5e6cc',
    fontSize: 14, boxSizing: 'border-box',
  }
  const labelStyle = {
    display: 'block', color: '#9a7c55', fontSize: '0.72rem',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#0f0a05', borderRadius: '18px 18px 0 0', border: '1px solid #3d2b10', borderBottom: 'none', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: '24px 20px 40px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#f5e6cc', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Add to Wishlist</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b5030', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Bottle name + barcode */}
          <div>
            <label style={labelStyle}>Bottle Name *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Blanton's Original"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="button" onClick={() => setScanning(true)} style={{
                padding: '9px 14px', background: 'rgba(232,148,58,0.15)',
                border: '1px solid rgba(232,148,58,0.4)', borderRadius: 8,
                color: '#e8943a', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>
                {lookingUp ? '…' : '📷'}
              </button>
            </div>
            {scanning && (
              <div style={{ marginTop: 8 }}>
                <BarcodeScanner onCode={handleBarcode} onClose={() => setScanning(false)} />
              </div>
            )}
            {lookupMsg && (
              <div style={{ marginTop: 6, fontSize: 11, color: lookupMsg.startsWith('✓') ? '#4ade80' : '#9a7c55' }}>
                {lookupMsg}
              </div>
            )}
          </div>

          {/* Rarity tier */}
          <div>
            <label style={labelStyle}>Rarity Tier</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {RARITY_OPTIONS.map(r => {
                const m = RARITY_META[r]
                return (
                  <button key={r} type="button" onClick={() => setRarity(r)} style={{
                    flex: 1, padding: '9px 6px',
                    background: rarity === r ? m.bg : 'transparent',
                    border: `1px solid ${rarity === r ? m.color + '80' : '#3d2b10'}`,
                    borderRadius: 8, color: rarity === r ? m.color : '#6b5030',
                    fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}>
                    {r === 'Unicorn' ? '🦄 ' : ''}{r}
                  </button>
                )
              })}
            </div>
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
            <div style={{ fontSize: 12, color: '#f87171', padding: '8px 12px', background: 'rgba(248,113,113,0.1)', borderRadius: 8, border: '1px solid rgba(248,113,113,0.25)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} style={{
            padding: '12px 0', background: '#e8943a', border: 'none', borderRadius: 10,
            color: '#fff', fontWeight: 800, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.6 : 1, marginTop: 4,
          }}>
            {submitting ? 'Adding…' : 'Add to Wishlist'}
          </button>

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

  const inputStyle = { width: '100%', padding: '9px 12px', background: '#1f1308', border: '1px solid #3d2b10', borderRadius: 8, color: '#f5e6cc', fontSize: 14, boxSizing: 'border-box' }
  const labelStyle = { display: 'block', color: '#9a7c55', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#0f0a05', borderRadius: '18px 18px 0 0', border: '1px solid #3d2b10', borderBottom: 'none', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: '24px 20px 40px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 style={{ color: '#f5e6cc', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>{entry.name}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b5030', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 11, color: '#6b5030', marginBottom: 20 }}>
          Added {new Date(entry.addedAt).toLocaleDateString()}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {STATUS_OPTIONS.map(s => {
                const m = STATUS_META[s]
                return (
                  <button key={s} type="button" onClick={() => setStatus(s)} style={{
                    flex: 1, padding: '9px 6px',
                    background: status === s ? m.bg : 'transparent',
                    border: `1px solid ${status === s ? m.color + '80' : '#3d2b10'}`,
                    borderRadius: 8, color: status === s ? m.color : '#6b5030',
                    fontWeight: 700, fontSize: 11, cursor: 'pointer',
                  }}>
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Rarity */}
          <div>
            <label style={labelStyle}>Rarity Tier</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {RARITY_OPTIONS.map(r => {
                const m = RARITY_META[r]
                return (
                  <button key={r} type="button" onClick={() => setRarity(r)} style={{
                    flex: 1, padding: '9px 6px',
                    background: rarity === r ? m.bg : 'transparent',
                    border: `1px solid ${rarity === r ? m.color + '80' : '#3d2b10'}`,
                    borderRadius: 8, color: rarity === r ? m.color : '#6b5030',
                    fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}>
                    {r === 'Unicorn' ? '🦄 ' : ''}{r}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Target price */}
          <div>
            <label style={labelStyle}>Target Price ($)</label>
            <input type="number" min="0" step="1" value={targetPrice} onChange={e => setTargetPrice(e.target.value)} placeholder="e.g. 65" style={inputStyle} />
          </div>

          {/* Store notes */}
          <div>
            <label style={labelStyle}>Store Notes</label>
            <input value={storeNotes} onChange={e => setStoreNotes(e.target.value)} placeholder="Store tips…" style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={handleSave} disabled={saving} style={{
              flex: 2, padding: '11px 0', background: '#e8943a', border: 'none', borderRadius: 10,
              color: '#fff', fontWeight: 800, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {status !== 'Found' && (
              <button onClick={() => onMoveToCollection(entry)} style={{
                flex: 1, padding: '11px 0', background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', borderRadius: 10,
                color: '#4ade80', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>
                ✓ Found it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Wishlist Card ──────────────────────────────────────────────────────────────

function WishlistCard({ entry, marketPrice, onEdit, onDelete }) {
  const rarityMeta = RARITY_META[entry.rarity] ?? RARITY_META.Allocated
  const statusMeta = STATUS_META[entry.status]  ?? STATUS_META.Hunting

  return (
    <div style={{
      background: '#1a1008', border: `1px solid ${entry.status === 'Found' ? 'rgba(74,222,128,0.25)' : '#3d2b10'}`,
      borderRadius: 12, padding: '14px 16px',
      opacity: entry.status === 'Paused' ? 0.6 : 1,
      transition: 'border-color 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>

        {/* Left: name + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#f5e6cc', marginBottom: 6, lineHeight: 1.3 }}>
            {entry.name}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: entry.storeNotes ? 8 : 0 }}>
            <RarityBadge rarity={entry.rarity} />
            <StatusBadge status={entry.status} />
            {entry.targetPrice != null && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999, color: '#c9a87a', background: 'rgba(201,168,122,0.12)', border: '1px solid rgba(201,168,122,0.25)' }}>
                Target {fmt$(entry.targetPrice)}
              </span>
            )}
            {marketPrice && <MarketPriceChip price={marketPrice} />}
          </div>
          {marketPrice && entry.targetPrice != null && (
            <div style={{ fontSize: 10, color: '#6b5030', marginBottom: 6 }}>
              {entry.targetPrice < marketPrice.low
                ? '⚠ Target below market range'
                : entry.targetPrice <= marketPrice.high
                  ? '✓ Target within market range'
                  : '✓ Target above market low'
              }
            </div>
          )}
          {entry.storeNotes && (
            <div style={{ fontSize: 11, color: '#9a7c55', fontStyle: 'italic', lineHeight: 1.4 }}>
              📍 {entry.storeNotes}
            </div>
          )}
          {marketPrice && (
            <div style={{ fontSize: 10, color: '#4b5563', marginTop: 4 }}>
              Market data: {marketPrice.source} · Updated {marketPrice.lastUpdated}
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onEdit(entry)} style={{
            padding: '6px 12px', background: 'rgba(232,148,58,0.15)',
            border: '1px solid rgba(232,148,58,0.3)', borderRadius: 7,
            color: '#e8943a', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            Edit
          </button>
          <button onClick={() => onDelete(entry.id)} style={{
            padding: '6px 10px', background: 'none',
            border: '1px solid #2a1c08', borderRadius: 7,
            color: '#6b5030', fontSize: 12, cursor: 'pointer',
          }}>
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: 'all',     label: 'All'     },
  { key: 'Hunting', label: '🔍 Hunting' },
  { key: 'Found',   label: '✓ Found'   },
  { key: 'Paused',  label: '⏸ Paused'  },
]

export default function WishlistPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [wishlist,     setWishlist]     = useState([])
  const [loaded,       setLoaded]       = useState(false)
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
      .then(r => r.json())
      .then(d => setWishlist(d.wishlist ?? []))
      .catch(() => {})
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

  const filtered = wishlist.filter(e => filterTab === 'all' || e.status === filterTab)
  const huntingCount = wishlist.filter(e => e.status === 'Hunting').length
  const foundCount   = wishlist.filter(e => e.status === 'Found').length

  if (status === 'loading') return null

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <AppHeader sub="Your Hunt List" />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px 100px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#f5e6cc' }}>Wishlist</div>
            <div style={{ fontSize: 12, color: '#9a7c55', marginTop: 2 }}>
              {huntingCount} hunting · {foundCount} found
            </div>
          </div>
          <button onClick={() => setShowAdd(true)} style={{
            padding: '9px 18px', background: '#e8943a', border: 'none', borderRadius: 10,
            color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
          }}>
            + Add Bottle
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
          {FILTER_TABS.map(t => (
            <button key={t.key} onClick={() => setFilterTab(t.key)} style={{
              padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap', cursor: 'pointer',
              background:   filterTab === t.key ? 'rgba(232,148,58,0.2)' : 'transparent',
              color:        filterTab === t.key ? '#e8943a' : '#9a7c55',
              border:       `1px solid ${filterTab === t.key ? 'rgba(232,148,58,0.5)' : '#3d2b10'}`,
            }}>
              {t.label}
              {t.key !== 'all' && (
                <span style={{ marginLeft: 5, opacity: 0.65, fontSize: 11 }}>
                  {wishlist.filter(e => e.status === t.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {!loaded ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b5030' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#f5e6cc', marginBottom: 6 }}>
              {filterTab === 'all' ? 'Your wishlist is empty' : `No ${filterTab.toLowerCase()} bottles`}
            </div>
            <div style={{ fontSize: 13, color: '#9a7c55', marginBottom: 20 }}>
              {filterTab === 'all' ? 'Add bottles you\'re actively hunting' : 'Switch tabs or add a new bottle'}
            </div>
            {filterTab === 'all' && (
              <button onClick={() => setShowAdd(true)} style={{
                padding: '10px 24px', background: '#e8943a', border: 'none', borderRadius: 10,
                color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
              }}>
                + Add Your First Bottle
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
          <div style={{ marginTop: 20, padding: '10px 14px', background: '#1a1008', border: '1px solid #2a1c08', borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: '#6b5030' }}>
              📊 Market price ranges are secondary market estimates and may not reflect current trading conditions.
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
