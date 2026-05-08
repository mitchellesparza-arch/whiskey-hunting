'use client'
import { useSession }  from 'next-auth/react'
import { useRouter }   from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import BottleDetailSheet from '../components/BottleDetailSheet.jsx'
import BarcodeScanner    from '../finds/BarcodeScanner.jsx'

export default function SearchPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated' && session?.user?.approved === false) router.replace('/pending')
  }, [status, session])

  const [query,        setQuery]        = useState('')
  const [results,      setResults]      = useState([])
  const [searching,    setSearching]    = useState(false)
  const [activeBottle, setActiveBottle] = useState(null)

  // Scan state
  const [showScanner,  setShowScanner]  = useState(false)
  const [scanning,     setScanning]     = useState(false)
  const [scanMsg,      setScanMsg]      = useState(null)

  const photoInputRef = useRef(null)
  const timerRef      = useRef(null)
  const inputRef      = useRef(null)

  async function doSearch(q) {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const [algoliaRes, localRes] = await Promise.allSettled([
        fetch(`/api/algolia-search?q=${encodeURIComponent(q)}`).then(r => r.json()),
        fetch(`/api/lookup?search=${encodeURIComponent(q)}`).then(r => r.json()),
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

      setResults(merged.slice(0, 20))
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(timerRef.current)
    if (val.trim().length < 2) { setResults([]); return }
    timerRef.current = setTimeout(() => doSearch(val), 280)
  }

  // ── Barcode scan ───────────────────────────────────────────────────────────
  async function handleBarcode(code) {
    setShowScanner(false)
    setScanning(true)
    setScanMsg('Looking up…')
    try {
      const r = await fetch(`/api/lookup?upc=${encodeURIComponent(code)}`)
      const d = await r.json()
      if (d.found && d.bottle?.name) {
        setScanMsg(null)
        setActiveBottle(d.bottle.name)
      } else {
        setScanMsg('Barcode not in database — try Scan Label instead')
      }
    } catch {
      setScanMsg('Lookup failed — try again')
    } finally {
      setScanning(false)
    }
  }

  // ── Label scan ─────────────────────────────────────────────────────────────
  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setScanning(true)
    setScanMsg('Reading label…')
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
        setScanMsg(null)
        setActiveBottle(d.bottle.name)
      } else {
        setScanMsg(d.error ?? 'Could not read label — try a clearer photo')
      }
    } catch {
      setScanMsg('Label lookup failed — try again')
    } finally {
      setScanning(false)
    }
  }

  if (status === 'loading') return null

  return (
    <div style={{
      minHeight:      '100vh',
      background:     'var(--bg-base)',
      display:        'flex',
      flexDirection:  'column',
      paddingBottom:  'calc(72px + env(safe-area-inset-bottom))',
    }}>

      {/* Header */}
      <div style={{
        padding:      '14px 16px 10px',
        paddingTop:   'calc(14px + env(safe-area-inset-top))',
        background:   '#0f0a05',
        borderBottom: '1px solid #2a1c08',
      }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#f5e6cc' }}>Search</div>
        <div style={{ fontSize: 12, color: '#6b5030', marginTop: 2 }}>
          Look up pricing and community sightings — type, scan, or photograph the label.
        </div>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Dual scan buttons — same pattern as Add to Collection / Report a Find */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => { setShowScanner(s => !s); setScanMsg(null) }}
            disabled={scanning}
            style={{
              flex:         1,
              padding:      '10px 0',
              background:   showScanner ? 'var(--accent)' : 'var(--bg-card)',
              border:       '1px solid var(--border)',
              borderRadius: 8,
              color:        showScanner ? '#fff' : 'var(--accent)',
              cursor:       scanning ? 'not-allowed' : 'pointer',
              fontSize:     13,
              fontWeight:   700,
              opacity:      scanning ? 0.6 : 1,
              fontFamily:   'inherit',
            }}
          >
            {showScanner ? '✕ Close Scanner' : '📷 Scan Barcode'}
          </button>
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={scanning}
            style={{
              flex:         1,
              padding:      '10px 0',
              background:   'var(--bg-card)',
              border:       '1px solid var(--border)',
              borderRadius: 8,
              color:        '#c084fc',
              cursor:       scanning ? 'not-allowed' : 'pointer',
              fontSize:     13,
              fontWeight:   700,
              opacity:      scanning ? 0.6 : 1,
              fontFamily:   'inherit',
            }}
          >
            {scanning ? '⏳ Reading…' : '🏷️ Scan Label'}
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            style={{ display: 'none' }}
          />
        </div>

        {/* Scan status */}
        {scanMsg && (
          <div style={{
            fontSize:     12,
            color:        scanMsg.includes('failed') || scanMsg.includes('not in') || scanMsg.includes('Could not')
                            ? '#fb923c'
                            : 'var(--text-muted)',
            padding:      '8px 10px',
            background:   '#0f0a05',
            borderRadius: 6,
            border:       '1px solid #2a1c08',
          }}>
            {scanMsg}
          </div>
        )}

        {/* Text search input */}
        <div style={{ position: 'relative', marginTop: 4 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            placeholder="Search any bottle by name…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            style={{
              width:        '100%',
              padding:      '10px 36px 10px 12px',
              background:   '#1a1008',
              border:       '1px solid #3d2b10',
              borderRadius: 10,
              color:        'var(--text-primary)',
              fontSize:     16,
              fontFamily:   'inherit',
              outline:      'none',
              boxSizing:    'border-box',
            }}
          />
          {query.length > 0 && (
            <button
              onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus() }}
              style={{
                position:   'absolute',
                right:      8,
                top:        '50%',
                transform:  'translateY(-50%)',
                background: 'none',
                border:     'none',
                color:      '#6b5030',
                fontSize:   16,
                cursor:     'pointer',
                padding:    0,
                lineHeight: 1,
              }}
            >✕</button>
          )}
        </div>
      </div>

      {/* Results list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>

        {query.trim().length < 2 && results.length === 0 && !scanMsg && (
          <p style={{ color: '#6b5030', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
            Start typing, scan a barcode, or photograph a label.
          </p>
        )}

        {query.trim().length >= 2 && searching && results.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
            Searching…
          </p>
        )}

        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <p style={{ color: '#6b5030', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
            No results for &ldquo;{query}&rdquo;
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {results.map((name, i) => (
            <button
              key={i}
              onClick={() => setActiveBottle(name)}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          10,
                width:        '100%',
                padding:      '12px 10px',
                background:   'none',
                border:       'none',
                borderBottom: i < results.length - 1 ? '1px solid #1f1308' : 'none',
                color:        'var(--text-primary)',
                fontSize:     14,
                fontWeight:   600,
                textAlign:    'left',
                cursor:       'pointer',
                fontFamily:   'inherit',
              }}
            >
              <span style={{ fontSize: 18 }}>🥃</span>
              <span>{name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Live barcode scanner overlay */}
      {showScanner && (
        <BarcodeScanner
          onResult={handleBarcode}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Bottle detail sheet — opened by name click, barcode hit, or label hit */}
      {activeBottle && (
        <BottleDetailSheet
          bottleName={activeBottle}
          finds={[]}
          archived={[]}
          onClose={() => setActiveBottle(null)}
        />
      )}
    </div>
  )
}
