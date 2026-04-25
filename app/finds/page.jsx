'use client'
// v4
import dynamic          from 'next/dynamic'
import Link             from 'next/link'
import { useSession }   from 'next-auth/react'
import { useRouter }    from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

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

// ─── Component ───────────────────────────────────────────────────────────────

export default function FindsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Redirect unauthenticated / unapproved users
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated' && session?.user?.approved === false) router.replace('/pending')
  }, [status, session])

  // ── State ──────────────────────────────────────────────────────────────────
  const [finds,        setFinds]        = useState([])
  const [loading,      setLoading]      = useState(true)

  // Form
  const [bottleName,   setBottleName]   = useState('')
  const [upc,          setUpc]          = useState('')
  const [store,        setStore]        = useState(null)       // { name, address, lat, lng, placeId }
  const [storeInput,   setStoreInput]   = useState('')
  const [notes,        setNotes]        = useState('')
  const [photoFile,    setPhotoFile]    = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoError,   setPhotoError]   = useState(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState(null)
  const [submitted,    setSubmitted]    = useState(false)

  // Camera / barcode scanner
  const [showCamera,   setShowCamera]   = useState(false)
  const [cameraError,  setCameraError]  = useState(null)
  const [scanError,    setScanError]    = useState(null)

  // UPC lookup status
  const [upcLooking,   setUpcLooking]   = useState(false)
  const [upcStatus,    setUpcStatus]    = useState(null)   // 'found' | 'not-found' | null

  // UI
  const [view,         setView]         = useState('map')  // 'map' | 'list'
  const [deletingId,   setDeletingId]   = useState(null)

  // Refs
  const storeInputRef   = useRef(null)
  const autocompleteRef = useRef(null)
  const videoRef        = useRef(null)
  const readerRef       = useRef(null)

  // ── Load finds ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/finds')
      .then(r => r.json())
      .then(d => setFinds(d.finds ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // ── Google Places autocomplete ─────────────────────────────────────────────
  useEffect(() => {
    if (!storeInputRef.current) return

    function loadAutocomplete() {
      if (!window.google?.maps?.places) return
      if (autocompleteRef.current) return   // already initialized

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
        if (window.google?.maps?.places) {
          clearInterval(check)
          loadAutocomplete()
        }
      }, 200)
      return () => clearInterval(check)
    }
  }, [storeInputRef.current])

  // ── Live camera scanning ───────────────────────────────────────────────────
  useEffect(() => {
    if (!showCamera) return
    let cancelled = false

    async function startScan() {
      setCameraError(null)
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        readerRef.current = reader

        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        const rearCam = devices.find(d => /back|rear|environment/i.test(d.label)) ?? devices[0]
        if (!rearCam) throw new Error('No camera found on this device')

        let fired = false
        await reader.decodeFromVideoDevice(
          rearCam.deviceId,
          videoRef.current,
          (result) => {
            if (result && !fired && !cancelled) {
              fired = true
              const code = result.getText()
              stopCamera()
              setShowCamera(false)
              setUpc(code)
              setScanError(null)
              lookupUpc(code)
            }
          }
        )
      } catch (err) {
        if (!cancelled) setCameraError(err.message || 'Camera unavailable — use a photo instead')
      }
    }

    startScan()
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [showCamera])

  // ── Camera helpers ─────────────────────────────────────────────────────────
  function stopCamera() {
    try { readerRef.current?.reset(); readerRef.current = null } catch {}
  }

  function closeCamera() {
    stopCamera()
    setShowCamera(false)
    setCameraError(null)
  }

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

  // ── Barcode scan from an image file (fallback) ────────────────────────────
  async function handleScanFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''   // allow re-selecting same file
    if (!file) return
    setScanError(null)
    // Close overlay if open (file-picker triggered from inside overlay)
    if (showCamera) { stopCamera(); setShowCamera(false) }
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      const url    = URL.createObjectURL(file)
      const result = await reader.decodeFromImageUrl(url)
      URL.revokeObjectURL(url)
      const code = result.getText()
      setUpc(code)
      lookupUpc(code)
    } catch {
      setScanError('No barcode found — try a clearer photo or type the name manually.')
    }
  }

  // ── Photo selection ────────────────────────────────────────────────────────
  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  // ── Submit find ────────────────────────────────────────────────────────────
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

      const res = await fetch('/api/finds', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ bottleName, upc: upc || null, store, photoUrl, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submit failed')

      setFinds(prev => [data.find, ...prev])
      // Reset form
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

  // ── Delete find ────────────────────────────────────────────────────────────
  async function handleDelete(id) {
    if (!confirm('Remove this find?')) return
    setDeletingId(id)
    try {
      const res  = await fetch(`/api/finds?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) setFinds(data.finds ?? [])
    } catch {}
    setDeletingId(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (status === 'loading') return null

  const cardStyle = {
    background:   '#1a1a2e',
    border:       '1px solid #4a3728',
    borderRadius: 10,
    padding:      20,
    marginBottom: 20,
  }

  const inputStyle = {
    width:        '100%',
    padding:      '8px 10px',
    background:   '#0d0d1a',
    border:       '1px solid #4a3728',
    borderRadius: 5,
    color:        '#e8d5b7',
    fontSize:     14,
    boxSizing:    'border-box',
  }

  const labelStyle = { display: 'block', color: '#aaa', fontSize: 12, marginBottom: 4, marginTop: 12 }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 12px', fontFamily: 'system-ui, sans-serif', color: '#e8d5b7', background: '#0d0d1a', minHeight: '100vh' }}>

      {/* ── Fullscreen camera overlay ─────────────────────────────────────── */}
      {showCamera && (
        <div style={{
          position: 'fixed', inset: 0,
          background: '#000',
          zIndex: 9999,
          overflow: 'hidden',
        }}>
          {/* Live viewfinder — fills entire screen */}
          <video
            ref={videoRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            playsInline
            muted
          />

          {/* Top bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '14px 16px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            zIndex: 1,
          }}>
            <span style={{ color: '#d4a054', fontWeight: 700, fontSize: 16 }}>📷 Scan Barcode</span>
            <button
              onClick={closeCamera}
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', lineHeight: 1, padding: '4px 8px' }}
            >✕</button>
          </div>

          {/* Targeting frame — amber rectangle in center */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -60%)',
            width: 260, height: 130,
            border: '2.5px solid rgba(212,160,84,0.9)',
            borderRadius: 10,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
            zIndex: 1,
          }} />

          {/* Bottom bar */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '20px 20px 40px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
            textAlign: 'center', zIndex: 1,
          }}>
            {cameraError
              ? <p style={{ color: '#e87', fontSize: 14, margin: '0 0 16px' }}>{cameraError}</p>
              : <p style={{ color: '#ccc', fontSize: 14, margin: '0 0 16px' }}>Hold barcode inside the frame</p>
            }
            {/* Fallback to image file */}
            <label style={{ color: '#d4a054', fontSize: 14, cursor: 'pointer', textDecoration: 'underline' }}>
              Use a saved photo instead
              <input type="file" accept="image/*" onChange={handleScanFile} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: '#d4a054' }}>📍 Whiskey Finds</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>
            Spotted a great bottle? Share it with the club.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/" style={{ color: '#d4a054', textDecoration: 'none', fontSize: 13 }}>🏠 Tracker</Link>
          <Link href="/unicorn" style={{ color: '#d4a054', textDecoration: 'none', fontSize: 13 }}>🦄 Auctions</Link>
        </div>
      </div>

      {/* ── Submit Form ─────────────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 14px', fontSize: 16, color: '#d4a054' }}>Report a Find</h2>

        <form onSubmit={handleSubmit}>

          {/* Bottle name + barcode button */}
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
              onClick={() => { setScanError(null); setShowCamera(true) }}
              title="Scan barcode"
              style={{
                padding:      '8px 12px',
                background:   '#2d2d2d',
                border:       '1px solid #4a3728',
                borderRadius: 5,
                color:        '#d4a054',
                cursor:       'pointer',
                fontSize:     18,
                flexShrink:   0,
              }}
            >📷</button>
          </div>

          {/* UPC & lookup status */}
          {upc && (
            <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#888' }}>UPC: {upc}</span>
              {upcLooking && (
                <span style={{ fontSize: 12, color: '#aaa' }}>🔍 Looking up…</span>
              )}
              {!upcLooking && upcStatus === 'found' && (
                <span style={{ fontSize: 12, color: '#6a9' }}>✓ Name filled from barcode</span>
              )}
              {!upcLooking && upcStatus === 'not-found' && (
                <span style={{ fontSize: 12, color: '#fa8' }}>Not in database — enter name above</span>
              )}
              <button
                type="button"
                onClick={() => { setUpc(''); setUpcStatus(null) }}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 12 }}
              >✕ clear</button>
            </div>
          )}
          {scanError && <p style={{ fontSize: 12, color: '#e87', margin: '4px 0 0' }}>{scanError}</p>}

          {/* Store search */}
          <label style={labelStyle}>Store Location * (search for the store)</label>
          <input
            ref={storeInputRef}
            style={inputStyle}
            placeholder="e.g. Binny's Orland Park…"
            value={storeInput}
            onChange={e => { setStoreInput(e.target.value); if (!e.target.value) setStore(null) }}
            autoComplete="off"
          />
          {store && (
            <p style={{ fontSize: 11, color: '#6a9', margin: '4px 0 0' }}>
              ✓ {store.name} — {store.address}
            </p>
          )}
          {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
            <p style={{ fontSize: 11, color: '#e87', margin: '4px 0 0' }}>
              Google Maps API key not configured — store search unavailable.
            </p>
          )}

          {/* Notes */}
          <label style={labelStyle}>Notes (optional)</label>
          <textarea
            style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
            placeholder="How many bottles? Price? Limit per customer?"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />

          {/* Photo */}
          <label style={labelStyle}>Photo (optional)</label>
          <label style={{
            display:      'block',
            background:   '#0d0d1a',
            border:       '1px dashed #4a3728',
            borderRadius: 5,
            padding:      '10px',
            cursor:       'pointer',
            textAlign:    'center',
            color:        '#888',
            fontSize:     13,
          }}>
            {photoPreview
              ? <img src={photoPreview} alt="preview" style={{ maxHeight: 120, borderRadius: 4, maxWidth: '100%' }} />
              : '📸 Tap to attach a photo'
            }
            <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
          </label>
          {photoFile && (
            <button
              type="button"
              onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12, marginTop: 4 }}
            >✕ Remove photo</button>
          )}

          {photoError  && <p style={{ color: '#fa8', fontSize: 12, margin: '6px 0 0' }}>⚠️ {photoError}</p>}
          {submitError && <p style={{ color: '#e87', fontSize: 13, margin: '10px 0 0' }}>{submitError}</p>}
          {submitted   && <p style={{ color: '#6a9', fontSize: 13, margin: '10px 0 0' }}>✓ Find submitted!</p>}

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop:    16,
              width:        '100%',
              padding:      '10px 0',
              background:   submitting ? '#555' : '#8B4513',
              color:        '#fff',
              border:       'none',
              borderRadius: 6,
              cursor:       submitting ? 'not-allowed' : 'pointer',
              fontSize:     15,
              fontWeight:   600,
            }}
          >
            {submitting ? '⏳ Submitting…' : '📍 Submit Find'}
          </button>
        </form>
      </div>

      {/* ── Finds Display ───────────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, color: '#d4a054' }}>
            Club Finds {finds.length > 0 && <span style={{ fontSize: 13, color: '#aaa' }}>({finds.length})</span>}
          </h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {['map', 'list'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding:    '4px 12px',
                  borderRadius: 4,
                  border:     'none',
                  cursor:     'pointer',
                  background: view === v ? '#8B4513' : '#2d2d2d',
                  color:      view === v ? '#fff' : '#aaa',
                  fontSize:   12,
                }}
              >
                {v === 'map' ? '🗺 Map' : '📋 List'}
              </button>
            ))}
          </div>
        </div>

        {loading && <p style={{ color: '#888', fontSize: 13 }}>Loading finds…</p>}

        {!loading && finds.length === 0 && (
          <p style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>
            No finds yet — be the first to report one!
          </p>
        )}

        {!loading && finds.length > 0 && view === 'map' && <FindsMap finds={finds} />}

        {!loading && finds.length > 0 && view === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {finds.map(find => (
              <div key={find.id} style={{
                background:   '#0d0d1a',
                border:       '1px solid #2d2d2d',
                borderRadius: 8,
                padding:      12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#d4a054', marginBottom: 4 }}>
                      🥃 {find.bottleName}
                    </div>
                    <div style={{ fontSize: 12, color: '#aaa', marginBottom: 2 }}>
                      📍 {find.store?.name ?? '—'}
                      {find.store?.address && <span style={{ color: '#777' }}> · {find.store.address}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#666' }}>
                      {fmtDate(find.timestamp)}
                      {find.timestamp && <span> · {fmtTimeAgo(find.timestamp)}</span>}
                    </div>
                    {find.notes && (
                      <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic', marginTop: 4 }}>
                        "{find.notes}"
                      </div>
                    )}
                    {find.photoUrl && (
                      <img
                        src={find.photoUrl}
                        alt="bottle"
                        style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 6, marginTop: 8, display: 'block' }}
                      />
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(find.id)}
                    disabled={deletingId === find.id}
                    title="Remove find"
                    style={{
                      background: 'none',
                      border:     'none',
                      color:      '#666',
                      cursor:     'pointer',
                      fontSize:   16,
                      padding:    '0 0 0 10px',
                      flexShrink: 0,
                    }}
                  >
                    {deletingId === find.id ? '⏳' : '✕'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ textAlign: 'center', color: '#555', fontSize: 11, marginTop: 16 }}>
        Whiskey Hunting · Chicagoland Bourbon Club
      </p>
    </div>
  )
}
