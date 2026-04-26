'use client'
// v6
import dynamic        from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import BarcodeScanner from './BarcodeScanner.jsx'
import AppHeader      from '../components/AppHeader.jsx'

// Leaflet map — SSR disabled (window is required)
const FindsMap = dynamic(() => import('./FindsMap.jsx'), { ssr: false, loading: () => (
  <div style={{ height: 380, background: '#111', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
    Loading map…
  </div>
) })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(ts) {
  if (!ts) return '—'
  const d    = new Date(ts)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date} at ${time}`
}

function fmtTimeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const m    = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function FreshnessBadge({ timestamp }) {
  if (!timestamp) return null
  const hoursOld = (Date.now() - timestamp) / 3600000
  if (hoursOld < 6) return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 700,
      padding: '2px 8px', borderRadius: 999,
      color: '#4ade80', background: 'rgba(74,222,128,0.1)',
      border: '1px solid rgba(74,222,128,0.3)',
    }}>🔥 Fresh</span>
  )
  if (hoursOld > 20) return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 700,
      padding: '2px 8px', borderRadius: 999,
      color: '#6b5030', background: 'transparent',
      border: '1px solid #3d2b10',
    }}>⏰ Aging</span>
  )
  return null
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FindsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated' && session?.user?.approved === false) router.replace('/pending')
  }, [status, session])

  // ── State ──────────────────────────────────────────────────────────────────
  const [finds,        setFinds]        = useState([])
  const [archived,     setArchived]     = useState([])
  const [leaderboard,  setLeaderboard]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  // Form
  const [bottleName,   setBottleName]   = useState('')
  const [upc,          setUpc]          = useState('')
  const [store,        setStore]        = useState(null)
  const [storeInput,   setStoreInput]   = useState('')
  const [notes,        setNotes]        = useState('')
  const [photoFile,    setPhotoFile]    = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoError,   setPhotoError]   = useState(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState(null)
  const [submitted,    setSubmitted]    = useState(false)

  // UPC lookup status
  const [upcLooking,   setUpcLooking]   = useState(false)
  const [upcStatus,    setUpcStatus]    = useState(null)   // 'found' | 'not-found' | null

  // UI
  const [showScanner,  setShowScanner]  = useState(false)
  const [view,         setView]         = useState('map')
  const [deletingId,   setDeletingId]   = useState(null)

  const storeInputRef   = useRef(null)
  const autocompleteRef = useRef(null)

  // ── Load finds ─────────────────────────────────────────────────────────────
  function loadFinds() {
    fetch('/api/finds')
      .then(r => r.json())
      .then(d => {
        setFinds(d.finds ?? [])
        setArchived(d.archived ?? [])
        setLeaderboard(d.leaderboard ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadFinds() }, [])

  // ── Google Places autocomplete ─────────────────────────────────────────────
  useEffect(() => {
    if (!storeInputRef.current) return

    function loadAutocomplete() {
      if (!window.google?.maps?.places) return
      if (autocompleteRef.current) return

      const ac = new window.google.maps.places.Autocomplete(storeInputRef.current, {
        componentRestrictions: { country: 'us' },
        fields: ['name', 'formatted_address', 'geometry', 'place_id'],
      })
      autocompleteRef.current = ac

      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (!place.geometry) return
        setStore({
          name:    place.name ?? '',
          address: place.formatted_address ?? '',
          lat:     place.geometry.location.lat(),
          lng:     place.geometry.location.lng(),
          placeId: place.place_id ?? '',
        })
        setStoreInput(place.name ?? '')
      })
    }

    const scriptId = 'gm-places-script'
    if (!document.getElementById(scriptId) && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      const script = document.createElement('script')
      script.id    = scriptId
      script.src   = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`
      script.async = true
      script.onload = loadAutocomplete
      document.head.appendChild(script)
    } else {
      const check = setInterval(() => {
        if (window.google?.maps?.places) { clearInterval(check); loadAutocomplete() }
      }, 200)
      return () => clearInterval(check)
    }
  }, [storeInputRef.current])

  // ── UPC lookup via server-side proxy ───────────────────────────────────────
  async function lookupUpc(code) {
    if (!code) return
    setUpcLooking(true)
    setUpcStatus(null)
    try {
      const r = await fetch(`/api/upc?code=${encodeURIComponent(code)}`)
      const d = await r.json()
      if (d.name) {
        setBottleName(prev => prev.trim() ? prev : d.name)
        setUpcStatus('found')
      } else {
        setUpcStatus('not-found')
      }
    } catch {
      setUpcStatus('not-found')
    } finally {
      setUpcLooking(false)
    }
  }

  function handleBarcodeResult(code) {
    setUpc(code)
    setShowScanner(false)
    lookupUpc(code)
  }

  // ── Photo ──────────────────────────────────────────────────────────────────
  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    if (!bottleName.trim()) return setSubmitError('Bottle name is required')
    if (!store)             return setSubmitError('Please select a store from the dropdown')

    setSubmitting(true)
    setSubmitError(null)

    try {
      let photoUrl = null
      setPhotoError(null)
      if (photoFile) {
        const fd = new FormData()
        fd.append('file', photoFile)
        const upRes  = await fetch('/api/finds/upload', { method: 'POST', body: fd })
        const upData = await upRes.json()
        if (upRes.ok) {
          photoUrl = upData.url ?? null
        } else {
          setPhotoError(`Photo upload failed: ${upData.error ?? upRes.status}. Find will be saved without photo.`)
        }
      }

      const res  = await fetch('/api/finds', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ bottleName, upc: upc || null, store, photoUrl, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submit failed')

      setFinds(prev => [data.find, ...prev])
      setBottleName('')
      setUpc('')
      setUpcStatus(null)
      setStore(null)
      setStoreInput('')
      setNotes('')
      setPhotoFile(null)
      setPhotoPreview(null)
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 3000)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(id) {
    if (!confirm('Remove this find?')) return
    setDeletingId(id)
    try {
      const res  = await fetch(`/api/finds?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        setFinds(data.finds ?? [])
        setArchived(data.archived ?? [])
      }
    } catch {}
    setDeletingId(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (status === 'loading') return null

  const inputStyle = {
    width:        '100%',
    padding:      '9px 12px',
    background:   'var(--bg-base)',
    border:       '1px solid var(--border)',
    borderRadius: 8,
    color:        'var(--text-primary)',
    fontSize:     14,
    boxSizing:    'border-box',
    fontFamily:   'inherit',
    outline:      'none',
  }

  const labelStyle = {
    display:       'block',
    fontSize:      11,
    fontWeight:    700,
    color:         'var(--text-muted)',
    marginBottom:  5,
    marginTop:     14,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  }

  const MEDAL_COLOR = ['#fbbf24', '#94a3b8', '#b45309']

  // ── Find card (shared for active + archived) ────────────────────────────────
  function FindCard({ find, isArchived = false }) {
    return (
      <div
        className="card"
        style={{ padding: 0, opacity: isArchived ? 0.6 : 1 }}
      >
        {/* Header */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #2a1c08' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <div style={{
              fontWeight:   700,
              fontSize:     15,
              color:        'var(--text-primary)',
              lineHeight:   1.3,
              fontStyle:    isArchived ? 'italic' : 'normal',
            }}>
              🥃 {find.bottleName}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
              {!isArchived && <FreshnessBadge timestamp={find.timestamp} />}
              <button
                onClick={() => handleDelete(find.id)}
                disabled={deletingId === find.id}
                style={{ background: 'none', border: 'none', color: '#6b5030', cursor: 'pointer', fontSize: 16, padding: 0 }}
              >
                {deletingId === find.id ? '⏳' : '✕'}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
            📍 {find.store?.name ?? '—'}
            {find.store?.address && <span style={{ color: '#6b5030' }}> · {find.store.address}</span>}
          </div>
          <div style={{ fontSize: 11, color: '#6b5030' }}>
            {fmtDate(find.timestamp)}
            {find.timestamp && <span> · {fmtTimeAgo(find.timestamp)}</span>}
            {isArchived && <span style={{ marginLeft: 6, color: '#6b5030', fontStyle: 'italic' }}>— archived after 24h</span>}
          </div>
        </div>

        {/* Photo */}
        {find.photoUrl && (
          <img
            src={find.photoUrl}
            alt="bottle"
            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block', borderBottom: '1px solid #2a1c08' }}
          />
        )}

        {/* Notes */}
        {find.notes && (
          <div style={{ padding: '10px 14px', fontSize: 12, color: '#c9a87a', fontStyle: 'italic', borderBottom: '1px solid #2a1c08' }}>
            "{find.notes}"
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>

      <AppHeader
        sub="Community Finds · Chicagoland"
        action={
          <button
            onClick={loadFinds}
            className="btn-primary"
            style={{ fontSize: 13 }}
          >
            ↺ Refresh
          </button>
        }
      />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 12px' }}>

        {/* ── Submit Form ──────────────────────────────────────────────────── */}
        <div className="card p-5 mb-5">
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', marginBottom: 14 }}>
            📍 Report a Find
          </div>

          <form onSubmit={handleSubmit}>

            {/* Bottle name + scanner toggle */}
            <label style={labelStyle}>Bottle Name *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="e.g. Blanton's Original"
                value={bottleName}
                onChange={e => setBottleName(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowScanner(s => !s)}
                title="Scan barcode"
                style={{
                  padding:      '8px 13px',
                  background:   showScanner ? 'var(--accent)' : 'var(--bg-card)',
                  border:       '1px solid var(--border)',
                  borderRadius: 8,
                  color:        showScanner ? '#fff' : 'var(--accent)',
                  cursor:       'pointer',
                  fontSize:     18,
                  flexShrink:   0,
                }}
              >
                {showScanner ? '✕' : '📷'}
              </button>
            </div>

            {/* UPC + lookup status */}
            {upc && (
              <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#6b5030', fontFamily: "'DM Mono', monospace" }}>UPC: {upc}</span>
                {upcLooking && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🔍 Looking up…</span>}
                {!upcLooking && upcStatus === 'found'     && <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ Name filled from barcode</span>}
                {!upcLooking && upcStatus === 'not-found' && <span style={{ fontSize: 12, color: '#fb923c' }}>Not in database — enter name above</span>}
                <button
                  type="button"
                  onClick={() => { setUpc(''); setUpcStatus(null) }}
                  style={{ background: 'none', border: 'none', color: '#6b5030', cursor: 'pointer', fontSize: 12 }}
                >✕ clear</button>
              </div>
            )}

            {/* Scanner panel */}
            {showScanner && (
              <div style={{ marginTop: 10 }}>
                <BarcodeScanner
                  onResult={handleBarcodeResult}
                  onClose={() => setShowScanner(false)}
                  autoCamera
                />
              </div>
            )}

            {/* Store */}
            <label style={labelStyle}>Store Location *</label>
            <input
              ref={storeInputRef}
              style={inputStyle}
              placeholder="Search for a store (e.g. Binny's Wilmette…)"
              value={storeInput}
              onChange={e => { setStoreInput(e.target.value); if (!e.target.value) setStore(null) }}
              autoComplete="off"
            />
            {store && (
              <p style={{ fontSize: 11, color: 'var(--green)', margin: '4px 0 0' }}>
                ✓ {store.name} — {store.address}
              </p>
            )}
            {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
              <p style={{ fontSize: 11, color: 'var(--red)', margin: '4px 0 0' }}>
                Google Maps API key not configured — store search unavailable.
              </p>
            )}

            {/* Notes */}
            <label style={labelStyle}>Notes (optional)</label>
            <textarea
              style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
              placeholder="How many bottles? Price? Purchase limit?"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />

            {/* Photo */}
            <label style={labelStyle}>Photo (optional)</label>
            <label style={{
              display:      'block',
              background:   'var(--bg-base)',
              border:       '1px dashed var(--border)',
              borderRadius: 8,
              padding:      12,
              cursor:       'pointer',
              textAlign:    'center',
              color:        '#6b5030',
              fontSize:     13,
            }}>
              {photoPreview
                ? <img src={photoPreview} alt="preview" style={{ maxHeight: 120, borderRadius: 6, maxWidth: '100%' }} />
                : '📸 Tap to attach a photo'
              }
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </label>
            {photoFile && (
              <button
                type="button"
                onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                style={{ background: 'none', border: 'none', color: '#6b5030', cursor: 'pointer', fontSize: 12, marginTop: 4 }}
              >✕ Remove photo</button>
            )}

            {photoError  && <p style={{ color: '#fb923c', fontSize: 12, margin: '6px 0 0' }}>⚠️ {photoError}</p>}
            {submitError && <p style={{ color: 'var(--red)', fontSize: 13, margin: '10px 0 0' }}>{submitError}</p>}
            {submitted   && <p style={{ color: 'var(--green)', fontSize: 13, margin: '10px 0 0' }}>✓ Find submitted! Thanks for looking out for the club.</p>}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ marginTop: 16, width: '100%', padding: '11px', fontSize: 15, opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? '⏳ Submitting…' : '📍 Submit Find'}
            </button>
          </form>
        </div>

        {/* ── Leaderboard ──────────────────────────────────────────────────── */}
        {leaderboard.length > 0 && (
          <div className="card p-4 mb-5">
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', marginBottom: 12 }}>
              🏆 This Month
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {leaderboard.map(([name, count], i) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{['🥇','🥈','🥉'][i] ?? '🎯'}</span>
                    <span style={{
                      fontSize:   13,
                      fontWeight: 600,
                      color:      [MEDAL_COLOR[0], MEDAL_COLOR[1], MEDAL_COLOR[2]][i] ?? 'var(--text-muted)',
                    }}>
                      {name}
                    </span>
                  </div>
                  <span className={i === 0 ? 'badge-in-stock' : ''} style={i !== 0 ? { fontSize: 12, color: 'var(--text-muted)' } : {}}>
                    {count} find{count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Finds Display ────────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
              Club Finds{' '}
              <span style={{ fontSize: 13, color: '#6b5030', fontWeight: 400 }}>
                ({finds.length} active{archived.length > 0 ? ` · ${archived.length} archived` : ''})
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['map', 'list'].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding:      '5px 13px',
                    borderRadius: 6,
                    border:       'none',
                    cursor:       'pointer',
                    background:   view === v ? 'var(--accent)' : 'var(--bg-card)',
                    color:        view === v ? '#fff' : 'var(--text-muted)',
                    fontSize:     12,
                    fontWeight:   600,
                  }}
                >
                  {v === 'map' ? '🗺 Map' : '📋 List'}
                </button>
              ))}
            </div>
          </div>

          {loading && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading finds…</p>}

          {!loading && finds.length === 0 && archived.length === 0 && (
            <p style={{ color: '#6b5030', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>
              No finds yet — be the first to report one!
            </p>
          )}

          {!loading && finds.length > 0 && view === 'map' && <FindsMap finds={finds} />}

          {!loading && view === 'list' && (
            <>
              {/* Active finds */}
              {finds.length === 0 && (
                <p style={{ color: '#6b5030', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  No active finds — check archived below or be the first to report!
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {finds.map(find => <FindCard key={find.id} find={find} />)}
              </div>

              {/* Archived section */}
              {archived.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <button
                    onClick={() => setShowArchived(s => !s)}
                    style={{
                      display:        'flex',
                      alignItems:     'center',
                      gap:            8,
                      background:     'none',
                      border:         'none',
                      color:          '#6b5030',
                      cursor:         'pointer',
                      fontSize:       13,
                      fontWeight:     600,
                      padding:        '8px 0',
                      width:          '100%',
                      textAlign:      'left',
                    }}
                  >
                    <span>{showArchived ? '▾' : '▸'}</span>
                    Archived ({archived.length}) — older than 24h
                  </button>
                  {showArchived && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                      {archived.map(find => <FindCard key={find.id} find={find} isArchived />)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  )
}
