'use client'
import { useSession }  from 'next-auth/react'
import { useRouter }   from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import BarcodeScanner    from '../finds/BarcodeScanner.jsx'
import { sameBottleLine } from '../../lib/bottle-match.js'
import AppHeader from '../components/AppHeader.jsx'
import Button from '../components/ui/Button.jsx'
import { Camera, Search, X, Tag, Loader } from 'lucide-react'

function bottleHref(name) {
  return `/bottle/${encodeURIComponent(name)}`
}

export default function SearchPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated' && session?.user?.approved === false) router.replace('/pending')
  }, [status, session])

  const [query,          setQuery]          = useState('')
  const [results,        setResults]        = useState([])
  const [catalogResults, setCatalogResults] = useState([])
  const [searching,      setSearching]      = useState(false)
  const [submitted,      setSubmitted]      = useState(false)  // true after Enter/Search button

  // AI fallback (Claude — fires only when local results are empty)
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiLoading,     setAiLoading]     = useState(false)
  const [aiQuery,       setAiQuery]       = useState(null)   // query AI was last asked about

  // Scan state
  const [showScanner,  setShowScanner]  = useState(false)
  const [scanning,     setScanning]     = useState(false)
  const [scanMsg,      setScanMsg]      = useState(null)
  const [upcMiss,      setUpcMiss]      = useState(false)  // true when barcode not in DB
  const [lastUpc,      setLastUpc]      = useState(null)   // UPC code from last barcode scan

  const photoInputRef = useRef(null)
  const timerRef      = useRef(null)
  const inputRef      = useRef(null)
  const searchSeq     = useRef(0)   // monotonic id so stale searches can't overwrite fresh results

  // Unified relevance scoring used to merge Algolia + local-lookup hits.  Same
  // logic regardless of source so a saved AI-confirmed bottle that exactly
  // matches the query (score 100) outranks a fuzzy Algolia hit on a different
  // brand that happened to share a token.
  function scoreResult(query, name) {
    const norm = s => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const q = norm(query)
    const n = norm(name)
    if (!q || !n) return 0
    if (n === q)                            return 100
    if (n.startsWith(q) || q.startsWith(n)) return 80
    if (n.includes(q) || q.includes(n))     return 60
    // Brand + numeric gate: don't award a token-overlap score to a different
    // brand/age that merely shares a generic token ("10", "year", "barrel").
    if (!sameBottleLine(query, name)) return 0
    const qWords = new Set(q.split(' ').filter(w => w.length >= 2))
    const nWords = n.split(' ').filter(w => w.length >= 2)
    const hits   = nWords.filter(w => qWords.has(w)).length
    if (hits === 0) return 0
    // Penalize when the candidate has many extra non-matching tokens —
    // "Pappy Van Winkle 15" shouldn't outrank "Jack Daniels 10" on a
    // "Jack Daniels 10 Year" query just because both share length.
    return Math.round(20 + 10 * hits - Math.max(0, nWords.length - hits) * 2)
  }

  async function doSearch(q, explicit = false) {
    if (q.trim().length < 2) { setResults([]); setCatalogResults([]); return }
    const seq = ++searchSeq.current
    setSearching(true)
    const limit = explicit ? 50 : 20
    try {
      const [algoliaRes, localRes, catalogRes] = await Promise.allSettled([
        fetch(`/api/algolia-search?q=${encodeURIComponent(q)}`).then(r => r.json()),
        fetch(`/api/lookup?search=${encodeURIComponent(q)}`).then(r => r.json()),
        fetch(`/api/catalog/search?q=${encodeURIComponent(q)}&limit=${limit}`).then(r => r.json()),
      ])

      // A newer search was kicked off while these were in flight — discard so a
      // slow early keystroke ("we") can't overwrite a later one ("weller").
      if (seq !== searchSeq.current) return

      const algolia  = algoliaRes.status  === 'fulfilled' ? (algoliaRes.value.results ?? []) : []
      const local    = localRes.status    === 'fulfilled'
        ? (localRes.value.results ?? []).map(r => (typeof r === 'string' ? r : r.name)).filter(Boolean)
        : []
      const catalog  = catalogRes.status  === 'fulfilled' ? (catalogRes.value.results ?? []) : []

      const normKey = s => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()

      // Seed the unified pool with Algolia + local results (plain strings → objects)
      const pool = new Map()
      for (const name of [...algolia, ...local]) {
        const k = normKey(name)
        if (!pool.has(k)) pool.set(k, { name, score: scoreResult(q, name), source: null })
      }

      // Score catalog/UA entries with the same function and merge into the pool.
      // This lets a UA entry that closely matches the query rank above a weakly
      // matching Algolia hit instead of always being pushed to the secondary section.
      const catalogScored = catalog.map(entry => ({
        ...entry,
        score: scoreResult(q, entry.name ?? ''),
      }))
      for (const entry of catalogScored) {
        const k = normKey(entry.name ?? '')
        if (!pool.has(k) && entry.score > 0) pool.set(k, entry)
      }

      // Sort the unified pool and split: top hits go to results, rest to catalog section
      const sorted = [...pool.values()]
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      setResults(sorted)

      // Catalog section: entries that didn't make the top list (still useful context)
      const topNorms = new Set(sorted.map(r => normKey(r.name ?? '')))
      const filteredCatalog = catalogScored.filter(e => !topNorms.has(normKey(e.name ?? '')))
      setCatalogResults(filteredCatalog)
    } catch (err) {
      if (seq !== searchSeq.current) return
      console.error('[search] doSearch failed:', err)
      setResults([])
      setCatalogResults([])
    } finally {
      // Only the latest search owns the spinner — a stale one finishing late
      // must not clear it while a newer search is still running.
      if (seq === searchSeq.current) setSearching(false)
    }
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
    } catch (err) {
      console.error('[search] AI fallback failed:', err)
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
    }).catch(err => console.error('[search] AI-pick save failed:', err))
    router.push(bottleHref(suggestion.name))
  }

  function handleSubmit() {
    if (query.trim().length < 2) return
    clearTimeout(timerRef.current)
    setSubmitted(true)
    doSearch(query, true)
  }

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    setSubmitted(false)
    clearTimeout(timerRef.current)
    setAiSuggestions([])
    setAiQuery(null)
    if (val.trim().length < 2) { setResults([]); setCatalogResults([]); return }
    timerRef.current = setTimeout(() => doSearch(val), 280)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit()
  }

  // ── Barcode scan ───────────────────────────────────────────────────────────
  async function handleBarcode(code) {
    setShowScanner(false)
    setScanning(true)
    setUpcMiss(false)
    setScanMsg('Looking up…')
    setLastUpc(code)
    try {
      const r = await fetch(`/api/lookup?upc=${encodeURIComponent(code)}`)
      const d = await r.json()
      if (d.found && d.bottle?.name) {
        setScanMsg(null)
        router.push(bottleHref(d.bottle.name))
      } else {
        setScanMsg(null)
        setUpcMiss(true)
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
        setUpcMiss(false)
        // Cache UPC→name so future scans resolve instantly
        if (lastUpc) {
          fetch('/api/upc', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ code: lastUpc, name: d.bottle.name }),
          }).catch(err => console.error('[search] UPC cache write failed:', err))
        }
        router.push(bottleHref(d.bottle.name))
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
      <AppHeader sub="Search bottles" />

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Dual scan buttons — same pattern as Add to Collection / Report a Find */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="secondary"
            size="md"
            icon={<Camera size={16} strokeWidth={1.75} />}
            onClick={() => { setShowScanner(s => !s); setScanMsg(null) }}
            disabled={scanning}
            fullWidth
          >
            {showScanner ? 'Close Scanner' : 'Scan Barcode'}
          </Button>
          <Button
            variant="ghost"
            size="md"
            icon={<Camera size={16} strokeWidth={1.75} />}
            onClick={() => photoInputRef.current?.click()}
            disabled={scanning}
            fullWidth
            style={{ color: 'var(--violet)' }}
          >
            {scanning ? 'Reading…' : 'Scan Label'}
          </Button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            style={{ display: 'none' }}
          />
        </div>

        {/* UPC miss — prompt label scan */}
        {upcMiss && (
          <div style={{
            padding:      '10px 12px',
            background:   'rgba(139,92,246,0.08)',
            borderRadius: 8,
            border:       '1px solid rgba(139,92,246,0.25)',
            display:      'flex',
            alignItems:   'center',
            gap:          10,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--violet)', marginBottom: 2 }}>
                Barcode not found in database
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Scan the label so we can identify this bottle.
              </div>
            </div>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={scanning}
              style={{
                background:   'var(--violet)',
                color:        '#fff',
                border:       'none',
                borderRadius: 7,
                padding:      '7px 12px',
                fontSize:     12,
                fontWeight:   700,
                cursor:       scanning ? 'not-allowed' : 'pointer',
                fontFamily:   'inherit',
                flexShrink:   0,
                display:      'flex',
                alignItems:   'center',
                gap:          5,
                opacity:      scanning ? 0.6 : 1,
              }}
            >
              {scanning
                ? <><Loader size={12} strokeWidth={1.75} /> Reading…</>
                : <><Tag    size={12} strokeWidth={1.75} /> Scan Label</>
              }
            </button>
          </div>
        )}

        {/* Scan status */}
        {scanMsg && (
          <div style={{
            fontSize:     12,
            color:        scanMsg.includes('failed') || scanMsg.includes('Could not')
                            ? 'var(--amber)'
                            : 'var(--text-muted)',
            padding:      '8px 10px',
            background:   'var(--bg-base)',
            borderRadius: 6,
            border:       '1px solid var(--hairline)',
          }}>
            {scanMsg}
          </div>
        )}

        {/* Text search input + Search button */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              ref={inputRef}
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Search any bottle by name…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{
                width:        '100%',
                padding:      '10px 36px 10px 12px',
                background:   'var(--bg-elev-2)',
                border:       '1px solid var(--hairline-2)',
                borderRadius: 10,
                color:        'var(--text-primary)',
                fontSize:     16,
                fontFamily:   'inherit',
                outline:      'none',
                boxSizing:    'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--copper-500)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--hairline-2)' }}
            />
            {query.length > 0 && (
              <button
                onClick={() => { setQuery(''); setResults([]); setCatalogResults([]); setSubmitted(false); setAiSuggestions([]); setAiQuery(null); inputRef.current?.focus() }}
                style={{
                  position:   'absolute',
                  right:      8,
                  top:        '50%',
                  transform:  'translateY(-50%)',
                  background: 'none',
                  border:     'none',
                  color:      'var(--text-dim)',
                  fontSize:   16,
                  cursor:     'pointer',
                  padding:    0,
                  lineHeight: 1,
                }}
              ><X size={14} /></button>
            )}
          </div>
          <Button
            variant="primary"
            size="md"
            icon={<Search size={15} strokeWidth={2} />}
            onClick={handleSubmit}
            disabled={query.trim().length < 2 || searching}
          >
            Search
          </Button>
        </div>
      </div>

      {/* Results list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>

        {query.trim().length < 2 && results.length === 0 && !scanMsg && (
          <p style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
            Start typing, scan a barcode, or photograph a label.
          </p>
        )}

        {query.trim().length >= 2 && searching && results.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
            Searching…
          </p>
        )}

        {!searching && query.trim().length >= 2 && results.length === 0 && !aiLoading && aiSuggestions.length === 0 && aiQuery !== query && (
          <p style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
            No local results for &ldquo;{query}&rdquo;
          </p>
        )}

        {/* Manual AI trigger — always available when there's a usable query.
            Belt-and-suspenders backup for the auto-fire heuristic, and the
            obvious entry point when local results exist but don't quite match
            (e.g. searching "Eagle Rare 12 Year" against a DB that only has 10). */}
        {query.trim().length >= 4 && !aiLoading && aiQuery !== query && (
          <button
            onClick={() => fetchAiSuggestions(query)}
            style={{
              display:      'block',
              width:        '100%',
              marginTop:    12,
              padding:      '10px 0',
              background:   'rgba(245,184,58,0.08)',
              border:       '1px dashed rgba(245,184,58,0.4)',
              borderRadius: 8,
              color:        'var(--amber)',
              fontSize:     13,
              fontWeight:   700,
              cursor:       'pointer',
              fontFamily:   'inherit',
            }}
          >
            ✨ {results.length > 0 ? "Don't see it? Search with AI" : 'Search with AI'}
          </button>
        )}

        {/* AI fallback — fires automatically (in parallel with local search)
            on any 4+ char query.  Section stays visible whenever AI was queried
            for the current query so the "no matches" feedback shows on empty
            responses; without the aiQuery condition the wrapper would hide
            silently the moment loading flipped to false with no results. */}
        {(aiLoading || aiSuggestions.length > 0 || aiQuery === query) && (
          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              fontSize:     10,
              fontWeight:   700,
              color:        'var(--amber)',
              textTransform:'uppercase',
              letterSpacing:'0.06em',
              marginBottom: 6,
            }}>
              <span>✨ AI-Identified</span>
              <span style={{ color: 'var(--text-dim)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                — verify before saving
              </span>
            </div>
            {aiLoading && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 16 }}>
                Searching beyond the local database…
              </p>
            )}
            {!aiLoading && aiSuggestions.length === 0 && aiQuery === query && (
              <p style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', marginTop: 16 }}>
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
                  background:   'rgba(245,184,58,0.06)',
                  border:       '1px solid rgba(245,184,58,0.25)',
                  borderRadius: 8,
                  textAlign:    'left',
                  cursor:       'pointer',
                  fontFamily:   'inherit',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                  🥃 {s.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {[s.distillery, s.category, s.proof ? `${s.proof}°` : null, s.age ? `${s.age}yr` : null]
                    .filter(Boolean).join(' · ')}
                  {s.msrp ? ` · $${s.msrp} MSRP` : ''}
                </div>
                {s.note && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, fontStyle: 'italic' }}>
                    {s.note}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {results.map((item, i) => {
            const name  = item.name ?? item
            const isUA  = item.source === 'unicorn_auctions'
            const isCat = item.source && item.source !== 'unicorn_auctions'
            const meta  = isUA || isCat ? [
              item.distillery ?? item.category,
              item.proof  ? `${item.proof}°`  : null,
              item.age    ? `${item.age}yr`   : null,
            ].filter(Boolean).join(' · ') : null
            const priceLabel = item.msrp
              ? `$${item.msrp} MSRP`
              : item.secondary?.avg
                ? `~$${item.secondary.avg} secondary`
                : null
            const hasMeta = meta || priceLabel
            return (
              <button
                key={i}
                onClick={() => router.push(bottleHref(name))}
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          10,
                  width:        '100%',
                  padding:      hasMeta ? '10px 12px' : '12px 10px',
                  background:   hasMeta ? 'var(--bg-elev-1)' : 'none',
                  border:       hasMeta ? '1px solid var(--hairline)' : 'none',
                  borderBottom: !hasMeta && i < results.length - 1 ? '1px solid var(--hairline)' : undefined,
                  borderRadius: hasMeta ? 8 : 0,
                  color:        'var(--text-primary)',
                  fontSize:     14,
                  fontWeight:   600,
                  textAlign:    'left',
                  cursor:       'pointer',
                  fontFamily:   'inherit',
                  marginBottom: hasMeta ? 4 : 0,
                }}
              >
                <span style={{ fontSize: hasMeta ? 16 : 18, flexShrink: 0 }}>
                  {isUA ? '🦄' : '🥃'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {name}
                  </div>
                  {hasMeta && (
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginTop: 1 }}>
                      {[meta, priceLabel].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                {isUA && (
                  <span style={{
                    fontSize:      9,
                    fontWeight:    700,
                    color:         'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    flexShrink:    0,
                  }}>UA</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Catalog results — static catalog + UA bottles not in Algolia/local */}
        {catalogResults.length > 0 && (
          <div style={{ marginTop: results.length > 0 ? 20 : 0 }}>
            {results.length > 0 && (
              <div style={{
                fontSize:      10,
                fontWeight:    700,
                color:         'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom:  8,
              }}>
                Also in catalog
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {catalogResults.map((entry, i) => {
                const isUA    = entry.source === 'unicorn_auctions'
                const meta    = [
                  entry.distillery ?? entry.category,
                  entry.proof  ? `${entry.proof}°`  : null,
                  entry.age    ? `${entry.age}yr`   : null,
                ].filter(Boolean).join(' · ')
                const priceLabel = entry.msrp
                  ? `$${entry.msrp} MSRP`
                  : entry.secondary?.avg
                    ? `~$${entry.secondary.avg} secondary`
                    : null
                return (
                  <button
                    key={i}
                    onClick={() => router.push(bottleHref(entry.name))}
                    style={{
                      display:      'flex',
                      alignItems:   'center',
                      gap:          10,
                      width:        '100%',
                      padding:      '10px 12px',
                      background:   'var(--bg-elev-1)',
                      border:       '1px solid var(--hairline)',
                      borderRadius: 8,
                      textAlign:    'left',
                      cursor:       'pointer',
                      fontFamily:   'inherit',
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{isUA ? '🦄' : '🥃'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.name}
                      </div>
                      {(meta || priceLabel) && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          {[meta, priceLabel].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                    {isUA && (
                      <span style={{
                        fontSize:     9,
                        fontWeight:   700,
                        color:        'var(--text-dim)',
                        textTransform:'uppercase',
                        letterSpacing:'0.05em',
                        flexShrink:   0,
                      }}>UA</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Live barcode scanner overlay */}
      {showScanner && (
        <BarcodeScanner
          onResult={handleBarcode}
          onClose={() => setShowScanner(false)}
        />
      )}

    </div>
  )
}
