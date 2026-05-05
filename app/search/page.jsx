'use client'
import { useSession }  from 'next-auth/react'
import { useRouter }   from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import BottleDetailSheet from '../components/BottleDetailSheet.jsx'

export default function SearchPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated' && session?.user?.approved === false) router.replace('/pending')
  }, [status, session])

  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState([])
  const [searching,   setSearching]   = useState(false)
  const [activeBottle, setActiveBottle] = useState(null)

  const timerRef  = useRef(null)
  const inputRef  = useRef(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function doSearch(q) {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      // Hit both sources in parallel; merge + dedupe by name (case-insensitive)
      const [algoliaRes, localRes] = await Promise.allSettled([
        fetch(`/api/algolia-search?q=${encodeURIComponent(q)}`).then(r => r.json()),
        fetch(`/api/lookup?search=${encodeURIComponent(q)}`).then(r => r.json()),
      ])

      const algolia = algoliaRes.status === 'fulfilled' ? (algoliaRes.value.results ?? []) : []
      const local   = localRes.status   === 'fulfilled'
        ? (localRes.value.results ?? []).map(r => (typeof r === 'string' ? r : r.name)).filter(Boolean)
        : []

      // Dedupe: prefer Algolia order, then append local results not already present
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

  if (status === 'loading') return null

  return (
    <div style={{
      position:   'fixed',
      inset:      0,
      background: 'var(--bg-base)',
      display:    'flex',
      flexDirection: 'column',
      zIndex:     300,
    }}>

      {/* Header bar */}
      <div style={{
        display:     'flex',
        alignItems:  'center',
        gap:         10,
        padding:     '12px 14px',
        paddingTop:  'calc(12px + env(safe-area-inset-top))',
        background:  '#0f0a05',
        borderBottom: '1px solid #2a1c08',
        flexShrink:  0,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none', color: '#e8943a',
            fontSize: 22, cursor: 'pointer', padding: '0 4px',
            lineHeight: 1, flexShrink: 0,
          }}
          aria-label="Back"
        >‹</button>

        <div style={{ position: 'relative', flex: 1 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            placeholder="Search any bottle…"
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

      {/* Results list — scrolls independently, not blocked by keyboard */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>

        {query.trim().length < 2 && (
          <p style={{ color: '#6b5030', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            Start typing to search bottles…
          </p>
        )}

        {query.trim().length >= 2 && searching && results.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            Searching…
          </p>
        )}

        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <p style={{ color: '#6b5030', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
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

      {/* Bottle detail sheet */}
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
