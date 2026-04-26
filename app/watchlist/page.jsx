'use client'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect, useState } from 'react'
import AppHeader from '../components/AppHeader.jsx'

export default function WatchlistPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated' && session?.user?.approved === false) router.replace('/pending')
  }, [status, session])

  const [bottles,  setBottles]  = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(true)
  const [adding,   setAdding]   = useState(false)
  const [removing, setRemoving] = useState(null)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(d => setBottles(d.bottles ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!input.trim()) return
    setAdding(true)
    setError(null)
    try {
      const res  = await fetch('/api/watchlist', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ bottle: input.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBottles(data.bottles)
      setInput('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(bottle) {
    setRemoving(bottle)
    try {
      const res  = await fetch(`/api/watchlist?bottle=${encodeURIComponent(bottle)}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) setBottles(data.bottles)
    } catch {}
    setRemoving(null)
  }

  if (status === 'loading') return null

  const inputStyle = {
    flex:         1,
    padding:      '9px 12px',
    background:   'var(--bg-base)',
    border:       '1px solid var(--border)',
    borderRadius: 8,
    color:        'var(--text-primary)',
    fontSize:     14,
    outline:      'none',
    fontFamily:   'inherit',
  }

  const MEDAL = ['🥇', '🥈', '🥉']

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <AppHeader sub="Bottles You're Hunting" />

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>

        {/* Add form */}
        <div className="card p-5 mb-5">
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', marginBottom: 14 }}>
            🎯 My Watchlist
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
            Add bottles you're hunting. We'll flag them in #truck-alerts and #watchlist-hits when they're spotted or a matching truck arrives.
          </p>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8 }}>
            <input
              style={inputStyle}
              placeholder="e.g. Blanton's Original, Eagle Rare…"
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={adding || !input.trim()}
              className="btn-primary"
              style={{ whiteSpace: 'nowrap' }}
            >
              {adding ? '…' : '+ Add'}
            </button>
          </form>
          {error && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{error}</p>}
        </div>

        {/* Watchlist chips */}
        <div className="card p-5">
          {loading && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
              Loading…
            </p>
          )}
          {!loading && bottles.length === 0 && (
            <p style={{ fontSize: 13, color: '#6b5030', textAlign: 'center', padding: '24px 0', lineHeight: 1.6 }}>
              Add a bottle name above to start tracking it.
            </p>
          )}
          {!loading && bottles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bottles.map((b, i) => (
                <div
                  key={b}
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                    padding:        '10px 14px',
                    background:     `rgba(232,148,58,0.07)`,
                    border:         '1px solid rgba(232,148,58,0.2)',
                    borderRadius:   8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{MEDAL[i] ?? '🎯'}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{b}</span>
                  </div>
                  <button
                    onClick={() => handleRemove(b)}
                    disabled={removing === b}
                    style={{
                      background: 'none', border: 'none',
                      color:      '#6b5030', cursor: 'pointer',
                      fontSize:   18, padding: '0 0 0 8px',
                      lineHeight: 1,
                    }}
                  >
                    {removing === b ? '…' : '✕'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
