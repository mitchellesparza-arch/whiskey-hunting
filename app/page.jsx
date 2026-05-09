'use client'
// Finds — home tab (moved from /finds)
import dynamic        from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ThumbsUp, ThumbsDown, ChevronDown, ChevronUp } from 'lucide-react'
import BarcodeScanner    from './finds/BarcodeScanner.jsx'
import AppHeader         from './components/AppHeader.jsx'
import BottleDetailSheet from './components/BottleDetailSheet.jsx'
import StoreHistorySheet from './components/StoreHistorySheet.jsx'
import Chip              from './components/ui/Chip.jsx'
import Button            from './components/ui/Button.jsx'
import Card              from './components/ui/Card.jsx'
import EmptyState        from './components/ui/EmptyState.jsx'

// Leaflet map — SSR disabled (window is required)
const FindsMap = dynamic(() => import('./finds/FindsMap.jsx'), { ssr: false, loading: () => (
  <div style={{ height: 380, background: 'var(--bg-elev-2)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
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
  if (hoursOld < 6)  return <Chip tone="green" size="sm">🔥 Fresh</Chip>
  if (hoursOld > 20) return <Chip tone="neutral" size="sm">⏰ Aging</Chip>
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
  const [price,        setPrice]        = useState('')
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

  // Bottle name autocomplete
  const [suggestions,     setSuggestions]     = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestTimer = useRef(null)
  const bottleInputRef = useRef(null)

  // Label scan fallback (when UPC not in DB)
  const [labelScanning,  setLabelScanning]  = useState(false)
  const labelScanRef = useRef(null)

  // UI
  const [showScanner,    setShowScanner]    = useState(false)
  const [view,           setView]           = useState('map')
  const [deletingId,     setDeletingId]     = useState(null)

  // Bottle detail + store history sheets (Sprint 1 & 3)
  const [activeBottle,   setActiveBottle]   = useState(null)  // string | null
  const [activeStore,    setActiveStore]    = useState(null)  // store object | null

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

  // ── Bottle name autocomplete ───────────────────────────────────────────────
  function handleBottleNameChange(e) {
    const val = e.target.value
    setBottleName(val)
    clearTimeout(suggestTimer.current)
    if (val.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    suggestTimer.current = setTimeout(async () => {
      try {
        const [algoliaRes, localRes] = await Promise.allSettled([
          fetch(`/api/algolia-search?q=${encodeURIComponent(val.trim())}`).then(r => r.json()),
          fetch(`/api/lookup?search=${encodeURIComponent(val.trim())}`).then(r => r.json()),
        ])
        const algolia = algoliaRes.status === 'fulfilled' ? (algoliaRes.value.results ?? []) : []
        const local   = localRes.status   === 'fulfilled'
          ? (localRes.value.results ?? []).map(r => (typeof r === 'string' ? r : r.name)).filter(Boolean)
          : []
        const seen = new Set()
        const merged = []
        for (const name of [...algolia, ...local]) {
          const key = name.toLowerCase()
          if (!seen.has(key)) { seen.add(key); merged.push(name) }
        }
        const list = merged.slice(0, 8)
        setSuggestions(list)
        setShowSuggestions(list.length > 0)
      } catch { setSuggestions([]); setShowSuggestions(false) }
    }, 280)
  }

  function selectSuggestion(name) {
    setBottleName(name)
    setSuggestions([])
    setShowSuggestions(false)
  }

  // ── Label scan fallback (UPC not found) ────────────────────────────────────
  async function handleLabelScan(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLabelScanning(true)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const r = await fetch('/api/lookup/photo', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: base64, mediaType: file.type || 'image/jpeg' }),
      })
      const d = await r.json()
      if (d.found && d.bottle?.name) {
        setBottleName(d.bottle.name)
        setUpcStatus('found')
        // Cache UPC→name so future scans of this barcode resolve instantly
        if (upc) {
          fetch('/api/upc', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ code: upc, name: d.bottle.name }),
          }).catch(() => {})
        }
      }
    } catch {}
    setLabelScanning(false)
    e.target.value = ''
  }

  // ── Photo ──────────────────────────────────────────────────────────────────
  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  // Compress to JPEG ≤ 3 MB so we stay under Vercel's 4.5 MB payload cap.
  // iPhone HEIC/HEIF files are typically 10-15 MB — this brings them safely in range.
  async function compressPhoto(file) {
    return new Promise(resolve => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const MAX = 3 * 1024 * 1024  // 3 MB target
        if (file.size <= MAX) { resolve(file); return }
        // Scale down proportionally until the canvas output fits
        const canvas = document.createElement('canvas')
        const scale  = Math.sqrt(MAX / file.size)
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(blob => resolve(blob ?? file), 'image/jpeg', 0.85)
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
      img.src = url
    })
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
        try {
          const compressed = await compressPhoto(photoFile)
          const fd = new FormData()
          fd.append('file', compressed, 'photo.jpg')
          const upRes = await fetch('/api/finds/upload', { method: 'POST', body: fd })
          if (upRes.ok) {
            const upData = await upRes.json()
            photoUrl = upData.url ?? null
          } else {
            const msg = upRes.status === 413
              ? 'Photo still too large after compression — find saved without photo.'
              : `Photo upload failed (${upRes.status}) — find saved without photo.`
            setPhotoError(msg)
          }
        } catch {
          setPhotoError('Photo upload failed — find saved without photo.')
        }
      }

      const res  = await fetch('/api/finds', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ bottleName, upc: upc || null, store, photoUrl, notes, price: price || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submit failed')

      setFinds(prev => [data.find, ...prev])
      setBottleName('')
      setUpc('')
      setUpcStatus(null)
      setStore(null)
      setStoreInput('')
      setPrice('')
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

  // ── Vote ───────────────────────────────────────────────────────────────────
  async function handleVote(id, type) {
    try {
      const res  = await fetch('/api/finds', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, type }),
      })
      const data = await res.json()
      if (!res.ok) return
      // Optimistically update vote counts in both lists
      const patch = prev => prev.map(f => f.id === id ? { ...f, votes: data.find.votes } : f)
      setFinds(patch)
      setArchived(patch)
    } catch {}
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
    padding:      'var(--sp-2) var(--sp-3)',
    background:   'var(--bg-base)',
    border:       '1px solid var(--hairline-2)',
    borderRadius: 'var(--r-md)',
    color:        'var(--text-primary)',
    fontSize:     'var(--fs-body)',
    boxSizing:    'border-box',
    fontFamily:   'inherit',
    outline:      'none',
  }

  const labelStyle = {
    display:       'block',
    fontSize:      'var(--fs-overline)',
    fontWeight:    700,
    color:         'var(--text-muted)',
    marginBottom:  'var(--sp-1)',
    marginTop:     'var(--sp-4)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  }

  const MEDAL_COLOR = ['var(--amber)', 'var(--text-muted)', 'var(--copper-600)']

  function FindCard({ find, isArchived = false, onBottleClick, onStoreClick }) {
    const userEmail = session?.user?.email ?? ''
    const votes     = find.votes ?? { up: [], down: [] }
    const upCount   = votes.up.length
    const downCount = votes.down.length
    const myVote    = votes.up.includes(userEmail) ? 'up'
                    : votes.down.includes(userEmail) ? 'down'
                    : null

    return (
      <div className="card" style={{ padding: 0, opacity: isArchived ? 0.6 : 1 }}>
        <div style={{ padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--hairline)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <button
              onClick={() => onBottleClick?.(find.bottleName)}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                textAlign: 'left', fontFamily: 'inherit',
                fontWeight: 700, fontSize: 'var(--fs-h3)', color: 'var(--text-primary)',
                lineHeight: 1.3, fontStyle: isArchived ? 'italic' : 'normal',
              }}
            >
              🥃 {find.bottleName}
            </button>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
              {!isArchived && <FreshnessBadge timestamp={find.timestamp} />}
              <button
                onClick={() => handleDelete(find.id)}
                disabled={deletingId === find.id}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16, padding: 0 }}
              >
                {deletingId === find.id ? '⏳' : '✕'}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginBottom: 2 }}>
            <button
              onClick={() => find.store?.placeId && onStoreClick?.(find.store)}
              style={{
                background: 'none', border: 'none', padding: 0, fontFamily: 'inherit',
                fontSize: 'var(--fs-meta)', cursor: find.store?.placeId ? 'pointer' : 'default',
                color: find.store?.placeId ? 'var(--text-2)' : 'var(--text-muted)',
              }}
            >📍 {find.store?.name ?? '—'}</button>
            {find.store?.address && <span style={{ color: 'var(--text-dim)' }}> · {find.store.address}</span>}
          </div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>{fmtDate(find.timestamp)}{find.timestamp && ` · ${fmtTimeAgo(find.timestamp)}`}</span>
            {find.price && <span style={{ color: 'var(--copper-400)', fontWeight: 700 }}>${Number(find.price).toFixed(2)}</span>}
            <span style={{ color: 'var(--text-dim)' }}>by {find.submitterName}</span>
            {isArchived && <span style={{ fontStyle: 'italic', color: 'var(--text-dim)' }}>— archived after 24h</span>}
          </div>
        </div>

        {find.photoUrl && (
          <img
            src={find.photoUrl}
            alt="bottle"
            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block', borderBottom: '1px solid var(--hairline)' }}
          />
        )}

        {find.notes && (
          <div style={{ padding: 'var(--sp-3) var(--sp-4)', fontSize: 'var(--fs-meta)', color: 'var(--text-2)', fontStyle: 'italic', borderBottom: '1px solid var(--hairline)' }}>
            &ldquo;{find.notes}&rdquo;
          </div>
        )}

        {/* Vote buttons — not shown on archived finds */}
        {!isArchived && (
          <div style={{ padding: 'var(--sp-2) var(--sp-4)', display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleVote(find.id, 'up')}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
              onMouseUp={e => { e.currentTarget.style.transform = '' }}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          4,
                padding:      'var(--sp-1) var(--sp-3)',
                borderRadius: 'var(--r-sm)',
                border:       myVote === 'up' ? '1px solid rgba(93,211,158,0.4)' : '1px solid var(--hairline)',
                cursor:       'pointer',
                background:   myVote === 'up' ? 'var(--green-bg)' : 'var(--bg-elev-3)',
                color:        myVote === 'up' ? 'var(--green)' : 'var(--text-dim)',
                fontSize:     'var(--fs-meta)',
                fontWeight:   700,
                transition:   'var(--t-fast)',
              }}
            >
              <ThumbsUp size={13} /> Still There{upCount > 0 ? ` (${upCount})` : ''}
            </button>
            <button
              onClick={() => handleVote(find.id, 'down')}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
              onMouseUp={e => { e.currentTarget.style.transform = '' }}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          4,
                padding:      'var(--sp-1) var(--sp-3)',
                borderRadius: 'var(--r-sm)',
                border:       myVote === 'down' ? '1px solid rgba(248,113,113,0.4)' : '1px solid var(--hairline)',
                cursor:       'pointer',
                background:   myVote === 'down' ? 'var(--red-bg)' : 'var(--bg-elev-3)',
                color:        myVote === 'down' ? 'var(--red)' : 'var(--text-dim)',
                fontSize:     'var(--fs-meta)',
                fontWeight:   700,
                transition:   'var(--t-fast)',
              }}
            >
              <ThumbsDown size={13} /> Gone{downCount > 0 ? ` (${downCount})` : ''}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>

      <AppHeader sub="Community Finds · Chicagoland" />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: 'var(--sp-4) var(--sp-3)' }}>

        {/* Submit Form */}
        <Card style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-5)' }}>
          <div style={{ fontWeight: 800, fontSize: 'var(--fs-h3)', color: 'var(--text-primary)', marginBottom: 14 }}>
            📍 Report a Find
          </div>

          <form onSubmit={handleSubmit}>

            {/* Quick-scan buttons — mirror the dual barcode/label flow used in
                the Add to Collection sheet so members can fill the form by
                scanning either the UPC or the bottle's label. */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <button
                type="button"
                onClick={() => { setShowScanner(s => !s); setUpcStatus(null) }}
                disabled={labelScanning}
                style={{
                  flex:         1,
                  padding:      'var(--sp-2) 0',
                  background:   showScanner ? 'var(--copper-500)' : 'var(--bg-elev-3)',
                  border:       '1px solid var(--hairline-2)',
                  borderRadius: 'var(--r-md)',
                  color:        showScanner ? 'var(--text-inverse)' : 'var(--copper-400)',
                  cursor:       labelScanning ? 'not-allowed' : 'pointer',
                  fontSize:     'var(--fs-body)',
                  fontWeight:   700,
                  opacity:      labelScanning ? 0.5 : 1,
                }}
              >
                {showScanner ? '✕ Close Scanner' : '📷 Scan Barcode'}
              </button>
              <button
                type="button"
                onClick={() => labelScanRef.current?.click()}
                disabled={labelScanning}
                style={{
                  flex:         1,
                  padding:      'var(--sp-2) 0',
                  background:   'var(--bg-elev-3)',
                  border:       '1px solid var(--hairline-2)',
                  borderRadius: 'var(--r-md)',
                  color:        'var(--violet)',
                  cursor:       labelScanning ? 'not-allowed' : 'pointer',
                  fontSize:     'var(--fs-body)',
                  fontWeight:   700,
                  opacity:      labelScanning ? 0.5 : 1,
                }}
              >
                {labelScanning ? '⏳ Reading…' : '🏷️ Scan Label'}
              </button>
            </div>

            {/* Hidden file input — triggered by Scan Label button.  Promoted
                to top-level so it works as a primary action, not just a
                post-barcode-miss fallback. */}
            <input
              ref={labelScanRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleLabelScan}
              disabled={labelScanning}
            />

            <label style={labelStyle}>Bottle Name *</label>
            <div style={{ position: 'relative' }}>
              <input
                ref={bottleInputRef}
                style={inputStyle}
                placeholder="e.g. Blanton's Original"
                value={bottleName}
                onChange={handleBottleNameChange}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                required
              />

              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position:     'absolute',
                  top:          '100%',
                  left:         0,
                  right:        0,
                  zIndex:       50,
                  background:   'var(--bg-elev-2)',
                  border:       '1px solid var(--hairline-2)',
                  borderRadius: 'var(--r-md)',
                  marginTop:    4,
                  overflow:     'hidden',
                  boxShadow:    'var(--shadow-2)',
                }}>
                  {suggestions.map((name, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={() => selectSuggestion(name)}
                      style={{
                        display:      'block',
                        width:        '100%',
                        padding:      'var(--sp-2) var(--sp-3)',
                        background:   'none',
                        border:       'none',
                        borderBottom: i < suggestions.length - 1 ? '1px solid var(--hairline)' : 'none',
                        color:        'var(--text-primary)',
                        fontSize:     'var(--fs-body)',
                        textAlign:    'left',
                        cursor:       'pointer',
                        fontFamily:   'inherit',
                      }}
                    >
                      🥃 {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {upc && (
              <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace" }}>UPC: {upc}</span>
                {upcLooking && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>🔍 Looking up…</span>}
                {!upcLooking && upcStatus === 'found'     && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--green)' }}>✓ Name filled from barcode</span>}
                {!upcLooking && upcStatus === 'not-found' && (
                  <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--amber)' }}>
                    Not in database — try Scan Label above
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => { setUpc(''); setUpcStatus(null) }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 'var(--fs-meta)' }}
                >✕ clear</button>
              </div>
            )}

            {showScanner && (
              <BarcodeScanner
                onResult={handleBarcodeResult}
                onClose={() => setShowScanner(false)}
              />
            )}

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
              <p style={{ fontSize: 'var(--fs-meta)', color: 'var(--green)', margin: 'var(--sp-1) 0 0' }}>
                ✓ {store.name} — {store.address}
              </p>
            )}

            <label style={labelStyle}>Price (optional)</label>
            <input
              style={inputStyle}
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 65"
              value={price}
              onChange={e => setPrice(e.target.value)}
            />

            <label style={labelStyle}>Notes (optional)</label>
            <textarea
              style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
              placeholder="How many bottles? Where in the store? Purchase limit?"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />

            <label style={labelStyle}>Photo (optional)</label>
            <label style={{
              display:      'block',
              background:   'var(--bg-base)',
              border:       '1px dashed var(--hairline-2)',
              borderRadius: 'var(--r-md)',
              padding:      'var(--sp-3)',
              cursor:       'pointer',
              textAlign:    'center',
              color:        'var(--text-dim)',
              fontSize:     'var(--fs-body)',
            }}>
              {photoPreview
                ? <img src={photoPreview} alt="preview" style={{ maxHeight: 120, borderRadius: 'var(--r-sm)', maxWidth: '100%' }} />
                : '📸 Tap to attach a photo'
              }
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </label>
            {photoFile && (
              <button
                type="button"
                onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 'var(--fs-meta)', marginTop: 'var(--sp-1)' }}
              >✕ Remove photo</button>
            )}

            {photoError  && <p style={{ color: 'var(--amber)', fontSize: 'var(--fs-meta)', margin: 'var(--sp-2) 0 0' }}>⚠️ {photoError}</p>}
            {submitError && <p style={{ color: 'var(--red)', fontSize: 'var(--fs-body)', margin: 'var(--sp-3) 0 0' }}>{submitError}</p>}
            {submitted   && <p style={{ color: 'var(--green)', fontSize: 'var(--fs-body)', margin: 'var(--sp-3) 0 0' }}>✓ Find submitted! Thanks for looking out for the club.</p>}

            <Button type="submit" disabled={submitting} variant="primary" fullWidth style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--fs-h3)' }}>
              📍 {submitting ? 'Submitting…' : 'Submit Find'}
            </Button>
          </form>
        </Card>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <Card style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <div style={{ fontWeight: 800, fontSize: 'var(--fs-h3)', color: 'var(--text-primary)', marginBottom: 12 }}>
              🏆 This Month
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {leaderboard.map(([name, count], i) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{['🥇','🥈','🥉'][i] ?? '🎯'}</span>
                    <span style={{
                      fontSize:   'var(--fs-body)',
                      fontWeight: 600,
                      color:      [MEDAL_COLOR[0], MEDAL_COLOR[1], MEDAL_COLOR[2]][i] ?? 'var(--text-muted)',
                    }}>
                      {name}
                    </span>
                  </div>
                  <span className={i === 0 ? 'badge-in-stock' : ''} style={i !== 0 ? { fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' } : {}}>
                    {count} find{count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Finds Display */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 'var(--fs-h2)', color: 'var(--text-primary)' }}>
              Club Finds{' '}
              <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-dim)', fontWeight: 400 }}>
                ({finds.length} active{archived.length > 0 ? ` · ${archived.length} archived` : ''})
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['map', 'list'].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding:      'var(--sp-1) var(--sp-3)',
                    borderRadius: 'var(--r-sm)',
                    border:       'none',
                    cursor:       'pointer',
                    background:   view === v ? 'var(--copper-500)' : 'var(--bg-elev-3)',
                    color:        view === v ? 'var(--text-inverse)' : 'var(--text-muted)',
                    fontSize:     'var(--fs-meta)',
                    fontWeight:   600,
                  }}
                >
                  {v === 'map' ? '🗺 Map' : '📋 List'}
                </button>
              ))}
            </div>
          </div>

          {loading && <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-body)' }}>Loading finds…</p>}

          {!loading && finds.length === 0 && archived.length === 0 && (
            <EmptyState icon="MapPin" title="No finds yet" body="Be the first to report one!" />
          )}

          {!loading && finds.length > 0 && view === 'map' && <FindsMap finds={finds} />}

          {!loading && view === 'list' && (
            <>
              {finds.length === 0 && (
                <EmptyState icon="MapPin" title="No active finds" body="Check archived below or be the first to report!" />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {finds.map(find => (
                  <FindCard key={find.id} find={find} onBottleClick={setActiveBottle} onStoreClick={setActiveStore} />
                ))}
              </div>

              {archived.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <button
                    onClick={() => setShowArchived(s => !s)}
                    style={{
                      display:    'flex', alignItems: 'center', gap: 8,
                      background: 'none', border: 'none', color: 'var(--text-dim)',
                      cursor:     'pointer', fontSize: 'var(--fs-body)', fontWeight: 600,
                      padding:    'var(--sp-2) 0', width: '100%', textAlign: 'left',
                    }}
                  >
                    {showArchived ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    Archived ({archived.length}) — older than 24h
                  </button>
                  {showArchived && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                      {archived.map(find => (
                        <FindCard key={find.id} find={find} isArchived onBottleClick={setActiveBottle} onStoreClick={setActiveStore} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* ── Bottle Detail sheet (Sprint 1) ────────────────────────────────────── */}
      {activeBottle && (
        <BottleDetailSheet
          bottleName={activeBottle}
          finds={finds}
          archived={archived}
          onClose={() => setActiveBottle(null)}
        />
      )}

      {/* ── Store History sheet (Sprint 3) ────────────────────────────────────── */}
      {activeStore && (
        <StoreHistorySheet
          store={activeStore}
          onClose={() => setActiveStore(null)}
        />
      )}

    </div>
  )
}
