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

  // AI fallback (Claude — fires only when local results are empty)
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiLoading,     setAiLoading]     = useState(false)
  const [aiQuery,       setAiQuery]       = useState(null)   // query AI was last asked about

  // Scan state
  const [showScanner,  setShowScanner]  = useState(false)
  const [scanning,     setScanning]     = useState(false)
  const [scanMsg,      setScanMsg]      = useState(null)

  const photoInputRef = useRef(null)
  const timerRef      = useRef(null)
  const aiTimerRef    = useRef(null)
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

      // Fire the AI fallback when local sources don't satisfy the query — either
      // zero results, OR the query contains a distinctive term (a number, year,
      // or 4+ char word) that no local result actually mentions.  The latter
      // catches "Eagle Rare 12 Year" matching against "Eagle Rare 10 Year" —
      // local has hits, but the user's "12" is missing, so they want more.
      if (q.trim().length >= 4 && (merged.length === 0 || hasUnmatchedTerms(q, merged))) {
        scheduleAiFallback(q)
      } else {
        clearTimeout(aiTimerRef.current)
        setAiSuggestions([])
        setAiQuery(null)
      }
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  // Strong signal that local results miss the user's intent: the query has a
  // term — a number, a year, or a 4+ char word — that doesn't appear in any
  // result name.  Common short tokens like "the", "and", "year" are skipped.
  function hasUnmatchedTerms(q, results) {
    const stopwords = new Set(['year', 'years', 'bourbon', 'whiskey', 'whisky', 'rye', 'single', 'barrel', 'small', 'batch'])
    const allText   = results.join(' ').toLowerCase()
    const terms     = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    const distinct  = terms.filter(t => /\d/.test(t) || (t.length >= 4 && !stopwords.has(t)))
    return distinct.some(t => !allText.includes(t))
  }

  function scheduleAiFallback(q) {
    clearTimeout(aiTimerRef.current)
    aiTimerRef.current = setTimeout(() => fetchAiSuggestions(q), 600)
  }

  async function fetchAiSuggestions(q) {
    if (q !== query) return   // user kept typing — bail
    setAiLoading(true)
    setAiQuery(q)
    try {
      const r = await fetch(`/api/search-fallback?q=${encodeURIComponent(q)}`)
      const d = await r.json()
      // Only commit if the query is still what the user wants
      if (q === query) {
        setAiSuggestions(Array.isArray(d.suggestions) ? d.suggestions : [])
      }
    } catch {
      if (q === query) setAiSuggestions([])
    } finally {
      setAiLoading(false)
    }
  }

  async function handlePickAi(suggestion) {
    // Save first so future searches by anyone surface this bottle without an
    // AI call.  Open the detail sheet whether or not save succeeded — UX
    // shouldn't block on the persistence call.
    fetch('/api/bottles/save', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(suggestion),
    }).catch(() => {})
    setActiveBottle(suggestion.name)
  }

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(timerRef.current)
    clearTimeout(aiTimerRef.current)
    if (val.trim().length < 2) { setResults([]); setAiSuggestions([]); setAiQuery(null); return }
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
              onClick={() => { setQuery(''); setResults([]); setAiSuggestions([]); setAiQuery(null); inputRef.current?.focus() }}
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

        {!searching && query.trim().length >= 2 && results.length === 0 && !aiLoading && aiSuggestions.length === 0 && aiQuery !== query && (
          <p style={{ color: '#6b5030', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
            No local results for &ldquo;{query}&rdquo;
          </p>
        )}

        {/* AI fallback — fires on zero local results.  Suggestions are tagged
            so members understand they were sourced from Claude rather than
            the curated local database. */}
        {(aiLoading || aiSuggestions.length > 0) && (
          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              fontSize:     10,
              fontWeight:   700,
              color:        '#fbbf24',
              textTransform:'uppercase',
              letterSpacing:'0.06em',
              marginBottom: 6,
            }}>
              <span>✨ AI-Identified</span>
              <span style={{ color: '#3d2b10', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                — verify before saving
              </span>
            </div>
            {aiLoading && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 16 }}>
                Searching beyond the local database…
              </p>
            )}
            {!aiLoading && aiSuggestions.length === 0 && aiQuery === query && (
              <p style={{ color: '#6b5030', fontSize: 13, textAlign: 'center', marginTop: 16 }}>
                No matches found anywhere for &ldquo;{query}&rdquo;.
              </p>
            )}
            {aiSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handlePickAi(s)}
                style={{
                  display:      'block',
                  width:        '100%',
                  padding:      '10px 12px',
                  marginTop:    i === 0 ? 0 : 6,
                  background:   'rgba(251,191,36,0.06)',
                  border:       '1px solid rgba(251,191,36,0.25)',
                  borderRadius: 8,
                  textAlign:    'left',
                  cursor:       'pointer',
                  fontFamily:   'inherit',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f5e6cc', marginBottom: 2 }}>
                  🥃 {s.name}
                </div>
                <div style={{ fontSize: 11, color: '#9a7c55' }}>
                  {[s.distillery, s.category, s.proof ? `${s.proof}°` : null, s.age ? `${s.age}yr` : null]
                    .filter(Boolean).join(' · ')}
                  {s.msrp ? ` · $${s.msrp} MSRP` : ''}
                </div>
                {s.note && (
                  <div style={{ fontSize: 11, color: '#6b5030', marginTop: 4, fontStyle: 'italic' }}>
                    {s.note}
                  </div>
                )}
              </button>
            ))}
          </div>
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
