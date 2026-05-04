'use client'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link           from 'next/link'

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function joinedAgo(iso) {
  if (!iso) return 'Member'
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000)
  if (days < 1)  return 'Joined today'
  if (days < 30) return `Joined ${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `Member ${months}mo`
  return `Member ${Math.floor(months / 12)}yr`
}

function scoreColor(s) {
  if (s >= 85) return '#4ade80'
  if (s >= 75) return '#e8943a'
  return '#9a7c55'
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 40 }) {
  return (
    <div style={{
      width:          size,
      height:         size,
      borderRadius:   '50%',
      background:     'linear-gradient(135deg, #e8943a, #b05a10)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontWeight:     800,
      fontSize:       size * 0.35,
      color:          '#fff',
      flexShrink:     0,
      letterSpacing:  '-0.02em',
    }}>
      {initials(name)}
    </div>
  )
}

// ── Friend Profile Panel ──────────────────────────────────────────────────────
// Slide-in from the right, shows a friend's collection + stats

function FriendProfilePanel({ friend, onClose }) {
  const [bottles,   setBottles]   = useState([])
  const [loaded,    setLoaded]    = useState(false)
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    if (!friend) return
    setLoaded(false)
    setForbidden(false)
    fetch(`/api/collection?userId=${encodeURIComponent(friend.email)}`)
      .then(r => {
        if (r.status === 403) { setForbidden(true); return { bottles: [] } }
        return r.json()
      })
      .then(d => setBottles(d.bottles ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [friend?.email])

  if (!friend) return null

  const totalBottles  = bottles.reduce((s, b) => s + Number(b.qty ?? 1), 0)
  const totalTastings = bottles.reduce((s, b) => s + (b.tastings ?? 0), 0)
  const estValue      = bottles.reduce((s, b) => {
    const val = Number(b.secondary) > 0 ? Number(b.secondary) : (Number(b.msrp) > 0 ? Number(b.msrp) : 0)
    return s + val * Number(b.qty ?? 1)
  }, 0)
  const topBottle     = bottles.length
    ? bottles.reduce((best, b) => (b.blindScore ?? 75) > (best?.blindScore ?? 0) ? b : best, null)
    : null

  const sorted = [...bottles].sort((a, b) => (b.blindScore ?? 75) - (a.blindScore ?? 75))

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 149 }} />

      {/* Panel */}
      <div style={{
        position:     'fixed',
        top:          0,
        right:        0,
        bottom:       0,
        width:        'min(420px, 100vw)',
        background:   '#1a1008',
        borderLeft:   '1px solid #3d2b10',
        zIndex:       150,
        display:      'flex',
        flexDirection:'column',
        animation:    'slideLeft 0.25s ease',
        overflowY:    'auto',
      }}>

        {/* Header */}
        <div style={{
          position:   'sticky',
          top:        0,
          zIndex:     1,
          background: '#1a1008',
          borderBottom:'1px solid #3d2b10',
          padding:    '14px 16px',
          display:    'flex',
          alignItems: 'center',
          justifyContent:'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={friend.name} size={44} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#f5e6cc' }}>{friend.name}</div>
              <div style={{ fontSize: 11, color: '#9a7c55', marginTop: 2 }}>{joinedAgo(friend.joinedAt)}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'#9a7c55',fontSize:22,lineHeight:1 }}>✕</button>
        </div>

        <div style={{ padding: '16px' }}>

          {/* Stats row */}
          {loaded && !forbidden && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Bottles',   value: totalBottles },
                { label: 'Tastings',  value: totalTastings },
                { label: 'Est. Value', value: estValue > 0 ? `$${Math.round(estValue).toLocaleString()}` : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  flex:         1,
                  textAlign:    'center',
                  padding:      '10px 4px',
                  background:   '#1f1308',
                  borderRadius: 8,
                  border:       '1px solid #2a1c08',
                }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: '#f5e6cc', lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 9, color: '#9a7c55', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Top bottle */}
          {loaded && topBottle && topBottle.tastings > 0 && (
            <div style={{
              background:   'linear-gradient(135deg, #2a1505 0%, #1a1008 100%)',
              border:       '1px solid #7c3a0a',
              borderRadius: 10,
              padding:      '12px 14px',
              marginBottom: 16,
              display:      'flex',
              alignItems:   'center',
              gap:          12,
            }}>
              <span style={{ fontSize: 22 }}>🏆</span>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#e8943a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Top Bottle</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#f5e6cc' }}>{topBottle.name}</div>
                <div style={{ fontSize: 11, color: '#9a7c55' }}>Score: {(topBottle.blindScore ?? 75).toFixed(1)}</div>
              </div>
            </div>
          )}

          {/* Mule requests — shown immediately, before collection loads */}
          {(friend.muleRequests ?? []).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#9a7c55', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                🫏 Hunting For
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(friend.muleRequests ?? []).map((req, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: '#1f1308', border: '1px solid #2a1c08', borderRadius: 8 }}>
                    <span style={{ fontSize: 14 }}>🥃</span>
                    <span style={{ fontSize: 13, color: '#f5e6cc' }}>{req}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading / empty / forbidden states */}
          {!loaded && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9a7c55', fontSize: 13 }}>Loading…</div>
          )}
          {loaded && forbidden && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
              <div style={{ color: '#9a7c55', fontSize: 13 }}>Collection is private</div>
            </div>
          )}
          {loaded && !forbidden && sorted.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#6b5030', fontSize: 13 }}>
              {friend.name?.split(' ')[0] ?? 'They'} hasn&apos;t added any bottles yet
            </div>
          )}

          {/* Bottle list */}
          {loaded && !forbidden && sorted.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#9a7c55', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                🥃 Collection · {totalBottles} bottle{totalBottles !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sorted.map((bottle, i) => {
                  const score = bottle.blindScore ?? 75
                  return (
                    <div key={bottle.id} style={{
                      display:      'flex',
                      alignItems:   'center',
                      gap:          10,
                      padding:      '10px 12px',
                      background:   '#1f1308',
                      border:       '1px solid #2a1c08',
                      borderRadius: 9,
                    }}>
                      {/* Rank */}
                      <div style={{ fontSize: 13, color: '#6b5030', fontWeight: 700, width: 16, flexShrink: 0, textAlign: 'center' }}>
                        {i + 1}
                      </div>
                      {/* Score */}
                      <div style={{ fontWeight: 800, fontSize: 18, color: scoreColor(score), flexShrink: 0, width: 34, textAlign: 'center' }}>
                        {score.toFixed(0)}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#f5e6cc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {bottle.name}
                        </div>
                        {bottle.distillery && (
                          <div style={{ fontSize: 10, color: '#9a7c55', marginTop: 1 }}>{bottle.distillery}</div>
                        )}
                      </div>
                      {/* MSRP */}
                      {bottle.msrp > 0 && (
                        <div style={{ fontSize: 11, color: '#c9a87a', flexShrink: 0 }}>${bottle.msrp}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom)' }} />
      </div>
    </>
  )
}

// ── User Row ──────────────────────────────────────────────────────────────────

function UserRow({ user, rightSlot }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' }}>
      <Avatar name={user.name} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#f5e6cc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name}
        </div>
        <div style={{ fontSize: 11, color: '#9a7c55', marginTop: 1 }}>{joinedAgo(user.joinedAt)}</div>
      </div>
      {rightSlot}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = ['Friends', 'Requests', 'Discover']

export default function FriendsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [data,        setData]        = useState({ friends: [], requests: [], sent: [], discover: [] })
  const [loaded,      setLoaded]      = useState(false)
  const [tab,         setTab]         = useState(0)   // 0 = Friends, 1 = Requests, 2 = Discover
  const [search,      setSearch]      = useState('')
  const [actionEmail, setActionEmail] = useState(null) // loading state per-email
  const [viewing,     setViewing]     = useState(null) // friend profile panel

  // Mule requests — bottles I'm hunting that friends can help find
  const [myRequests,      setMyRequests]      = useState([])
  const [editRequests,    setEditRequests]    = useState([])
  const [editingMule,     setEditingMule]     = useState(false)
  const [savingMule,      setSavingMule]      = useState(false)
  const [muleError,       setMuleError]       = useState('')
  const [muleSaved,       setMuleSaved]       = useState(false)
  // Friends' structured wishlists (Hunting entries)
  const [friendWishlists, setFriendWishlists] = useState({})

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status])

  const loadData = useCallback(() => {
    fetch('/api/friends')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Load my mule requests on mount
  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => setMyRequests(d.profile?.muleRequests ?? []))
      .catch(() => {})
  }, [])

  // Load friends' wishlist Hunting entries once friends load
  useEffect(() => {
    if (!loaded || !(data.friends ?? []).length) return
    fetch('/api/wishlist?friends=1')
      .then(r => r.json())
      .then(d => setFriendWishlists(d.wishlists ?? {}))
      .catch(() => {})
  }, [loaded, data.friends?.length])

  // ── Mule request handlers ─────────────────────────────────────────────────
  function startEditMule() {
    setEditRequests([...myRequests])
    setEditingMule(true)
  }
  function cancelEditMule() {
    setEditingMule(false)
    setEditRequests([])
  }
  async function saveMuleRequests() {
    setSavingMule(true)
    setMuleError('')
    try {
      const cleaned = editRequests.map(r => r.trim()).filter(Boolean)
      const res  = await fetch('/api/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ muleRequests: cleaned }),
      })
      const data = await res.json()
      if (res.ok) {
        setMyRequests(data.profile?.muleRequests ?? cleaned)
        setEditingMule(false)
        setMuleSaved(true)
        setTimeout(() => setMuleSaved(false), 3000)
      } else {
        setMuleError(data.error ?? `Save failed (${res.status}) — try again`)
      }
    } catch (e) {
      setMuleError('Network error — check connection and try again')
    } finally {
      setSavingMule(false)
    }
  }

  async function sendRequest(email) {
    setActionEmail(email)
    try {
      await fetch('/api/friends', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ targetEmail: email }),
      })
      loadData()
    } finally {
      setActionEmail(null)
    }
  }

  async function respond(email, action) {
    setActionEmail(email)
    try {
      await fetch('/api/friends', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ targetEmail: email, action }),
      })
      loadData()
      if (action === 'accept') setTab(0)
    } finally {
      setActionEmail(null)
    }
  }

  async function removeFriend(email) {
    if (!confirm('Remove this friend?')) return
    setActionEmail(email)
    try {
      await fetch(`/api/friends?email=${encodeURIComponent(email)}`, { method: 'DELETE' })
      loadData()
    } finally {
      setActionEmail(null)
    }
  }

  const sentSet = new Set(data.sent ?? [])

  // Filter by search
  function filterUsers(list) {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
  }

  const filteredFriends  = filterUsers(data.friends  ?? [])
  const filteredRequests = filterUsers(data.requests ?? [])
  const filteredDiscover = filterUsers(data.discover ?? [])

  const requestBadge = (data.requests ?? []).length

  if (status === 'loading') return null

  const accentBtn = (label, onClick, loading) => (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding:      '6px 13px',
        background:   '#e8943a',
        border:       'none',
        borderRadius: 7,
        color:        '#fff',
        fontWeight:   700,
        fontSize:     12,
        cursor:       loading ? 'not-allowed' : 'pointer',
        opacity:      loading ? 0.6 : 1,
        flexShrink:   0,
        whiteSpace:   'nowrap',
      }}
    >
      {loading ? '…' : label}
    </button>
  )

  const ghostBtn = (label, onClick, loading, color = '#9a7c55') => (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding:      '5px 11px',
        background:   'none',
        border:       `1px solid #3d2b10`,
        borderRadius: 7,
        color,
        fontWeight:   600,
        fontSize:     12,
        cursor:       loading ? 'not-allowed' : 'pointer',
        opacity:      loading ? 0.6 : 1,
        flexShrink:   0,
        whiteSpace:   'nowrap',
      }}
    >
      {loading ? '…' : label}
    </button>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div style={{
        position:             'sticky',
        top:                  0,
        zIndex:               50,
        background:           'rgba(15,10,5,0.95)',
        borderBottom:         '1px solid #3d2b10',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/profile" style={{ color: '#9a7c55', textDecoration: 'none', fontSize: 20, lineHeight: 1 }}>←</Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#f5e6cc' }}>👥 Friends</div>
            <div style={{ fontSize: 11, color: '#9a7c55' }}>Jon and the Juice</div>
          </div>
          <button
            onClick={loadData}
            style={{ background: 'none', border: 'none', color: '#9a7c55', cursor: 'pointer', fontSize: 18 }}
          >
            ↺
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderTop: '1px solid #2a1c08' }}>
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              style={{
                flex:           1,
                padding:        '10px 0',
                background:     'none',
                border:         'none',
                borderBottom:   tab === i ? '2px solid #e8943a' : '2px solid transparent',
                color:          tab === i ? '#e8943a' : '#6b5030',
                fontWeight:     tab === i ? 700 : 500,
                fontSize:       13,
                cursor:         'pointer',
                position:       'relative',
              }}
            >
              {t}
              {i === 1 && requestBadge > 0 && (
                <span style={{
                  position:     'absolute',
                  top:          6,
                  right:        '50%',
                  transform:    'translateX(18px)',
                  background:   '#f87171',
                  color:        '#fff',
                  fontSize:     9,
                  fontWeight:   700,
                  borderRadius: 999,
                  padding:      '1px 5px',
                  lineHeight:   1.3,
                }}>
                  {requestBadge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ padding: '8px 16px 10px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name…"
            style={{
              width:        '100%',
              padding:      '8px 12px',
              background:   '#1f1308',
              border:       '1px solid #3d2b10',
              borderRadius: 8,
              color:        '#f5e6cc',
              fontSize:     13,
              fontFamily:   'inherit',
              outline:      'none',
              boxSizing:    'border-box',
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px 32px' }}>

        {!loaded ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9a7c55', fontSize: 13 }}>Loading…</div>
        ) : (

          <>
            {/* ── Tab 0: Friends ── */}
            {tab === 0 && (
              <>
                {/* My Mule Requests card */}
                <div style={{ marginTop: 16, marginBottom: 8, background: '#1a1008', border: '1px solid #3d2b10', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (editingMule || myRequests.length > 0) ? 10 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#f5e6cc' }}>🫏 My Mule Requests</div>
                      {muleSaved && <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>✓ Saved</span>}
                    </div>
                    {!editingMule && (
                      <button
                        onClick={startEditMule}
                        style={{ background: 'none', border: '1px solid #3d2b10', borderRadius: 6, color: '#9a7c55', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '3px 10px' }}
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {editingMule ? (
                    <div>
                      {editRequests.map((req, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          <input
                            value={req}
                            onChange={e => setEditRequests(prev => prev.map((r, j) => j === i ? e.target.value : r))}
                            placeholder="e.g. Blanton's Original"
                            style={{ flex: 1, padding: '7px 10px', background: '#2a1c08', border: '1px solid #3d2b10', borderRadius: 7, color: '#f5e6cc', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                          />
                          <button
                            onClick={() => setEditRequests(prev => prev.filter((_, j) => j !== i))}
                            style={{ background: 'none', border: '1px solid #3d2b10', borderRadius: 7, color: '#f87171', cursor: 'pointer', padding: '0 10px', fontSize: 14 }}
                          >✕</button>
                        </div>
                      ))}
                      {editRequests.length < 5 && (
                        <button
                          onClick={() => setEditRequests(prev => [...prev, ''])}
                          style={{ width: '100%', padding: '7px 0', background: 'none', border: '1px dashed #3d2b10', borderRadius: 7, color: '#9a7c55', fontSize: 12, cursor: 'pointer', marginBottom: 10 }}
                        >+ Add bottle</button>
                      )}
                      {muleError && (
                        <div style={{ fontSize: 11, color: '#f87171', marginBottom: 6, padding: '5px 8px', background: 'rgba(248,113,113,0.1)', borderRadius: 6, border: '1px solid rgba(248,113,113,0.2)' }}>
                          ⚠ {muleError}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: editRequests.length < 5 ? 0 : 10 }}>
                        <button
                          onClick={saveMuleRequests}
                          disabled={savingMule}
                          style={{ flex: 1, padding: '7px 0', background: '#e8943a', border: 'none', borderRadius: 7, color: '#fff', fontWeight: 700, fontSize: 12, cursor: savingMule ? 'not-allowed' : 'pointer', opacity: savingMule ? 0.6 : 1 }}
                        >{savingMule ? 'Saving…' : 'Save'}</button>
                        <button
                          onClick={cancelEditMule}
                          style={{ flex: 1, padding: '7px 0', background: 'none', border: '1px solid #3d2b10', borderRadius: 7, color: '#9a7c55', fontSize: 12, cursor: 'pointer' }}
                        >Cancel</button>
                      </div>
                    </div>
                  ) : myRequests.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#6b5030', fontStyle: 'italic' }}>
                      No bottles on your list yet — tap Edit to add bottles your friends can hunt for you
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {myRequests.map((req, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < myRequests.length - 1 ? '1px solid #2a1c08' : 'none' }}>
                          <span style={{ fontSize: 13 }}>🥃</span>
                          <span style={{ fontSize: 13, color: '#f5e6cc', fontWeight: 500 }}>{req}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Friends Hunting For — mule requests + structured wishlist Hunting entries */}
                {(() => {
                  const nameFor = f => f.name ?? f.email.split('@')[0]
                  // Legacy mule requests
                  const muleRows = (data.friends ?? []).flatMap(f =>
                    (f.muleRequests ?? []).map(req => ({ req, name: nameFor(f), source: 'mule' }))
                  )
                  // Structured wishlist Hunting entries
                  const wishlistRows = (data.friends ?? []).flatMap(f => {
                    const entries = (friendWishlists[f.email] ?? [])
                    return entries.map(e => ({ req: e.name, name: nameFor(f), rarity: e.rarity, source: 'wishlist' }))
                  })
                  // Merge: wishlist entries take priority; de-dupe by (name+req)
                  const seen = new Set()
                  const allRequests = [...wishlistRows, ...muleRows].filter(r => {
                    const k = `${r.name}:${r.req.toLowerCase()}`
                    if (seen.has(k)) return false
                    seen.add(k)
                    return true
                  })
                  if (allRequests.length === 0) return null

                  const rarityColor = { Common: '#9a7c55', Allocated: '#e8943a', Unicorn: '#c084fc' }

                  return (
                    <div style={{ marginBottom: 8, background: '#1a1008', border: '1px solid #3d2b10', borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#f5e6cc', marginBottom: 10 }}>
                        🔍 Friends Hunting For
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {allRequests.map(({ req, name, rarity }, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < allRequests.length - 1 ? '1px solid #1f1308' : 'none' }}>
                            <span style={{ fontSize: 14, flexShrink: 0 }}>🥃</span>
                            <span style={{ fontSize: 13, color: '#f5e6cc', flex: 1 }}>{req}</span>
                            {rarity && rarity !== 'Common' && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999, color: rarityColor[rarity] ?? '#9a7c55', background: `${rarityColor[rarity] ?? '#9a7c55'}18`, border: `1px solid ${rarityColor[rarity] ?? '#9a7c55'}40`, flexShrink: 0 }}>
                                {rarity === 'Unicorn' ? '🦄' : rarity}
                              </span>
                            )}
                            <span style={{ fontSize: 11, color: '#6b5030', flexShrink: 0 }}>{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {filteredFriends.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#f5e6cc', marginBottom: 6 }}>
                      {search ? 'No matches' : 'No friends yet'}
                    </div>
                    <div style={{ fontSize: 13, color: '#9a7c55', marginBottom: 16 }}>
                      {search ? 'Try a different search' : 'Discover members on the Discover tab and send a friend request'}
                    </div>
                    {!search && (
                      <button
                        onClick={() => setTab(2)}
                        style={{ padding: '8px 20px', background: '#e8943a', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                      >
                        Discover Members →
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ paddingTop: 4 }}>
                    <div style={{ fontSize: 11, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '12px 0 4px', fontWeight: 700 }}>
                      {filteredFriends.length} friend{filteredFriends.length !== 1 ? 's' : ''}
                    </div>
                    {filteredFriends.map(friend => (
                      <div key={friend.email} style={{ borderBottom: '1px solid #1f1308' }}>
                        <UserRow
                          user={friend}
                          rightSlot={
                            <div style={{ display: 'flex', gap: 6 }}>
                              {accentBtn('View', () => setViewing(friend), false)}
                              {ghostBtn('Remove', () => removeFriend(friend.email), actionEmail === friend.email, '#f87171')}
                            </div>
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Tab 1: Requests ── */}
            {tab === 1 && (
              <>
                {filteredRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b5030', fontSize: 13 }}>
                    {search ? 'No matches' : 'No pending friend requests'}
                  </div>
                ) : (
                  <div style={{ paddingTop: 4 }}>
                    <div style={{ fontSize: 11, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '12px 0 4px', fontWeight: 700 }}>
                      {filteredRequests.length} pending request{filteredRequests.length !== 1 ? 's' : ''}
                    </div>
                    {filteredRequests.map(user => (
                      <div key={user.email} style={{ borderBottom: '1px solid #1f1308' }}>
                        <UserRow
                          user={user}
                          rightSlot={
                            <div style={{ display: 'flex', gap: 6 }}>
                              {accentBtn('Accept', () => respond(user.email, 'accept'), actionEmail === user.email)}
                              {ghostBtn('Ignore', () => respond(user.email, 'reject'), actionEmail === user.email)}
                            </div>
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Tab 2: Discover ── */}
            {tab === 2 && (
              <>
                {filteredDiscover.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b5030', fontSize: 13 }}>
                    {search ? 'No matches' : "You're connected with everyone in the club 🎉"}
                  </div>
                ) : (
                  <div style={{ paddingTop: 4 }}>
                    <div style={{ fontSize: 11, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '12px 0 4px', fontWeight: 700 }}>
                      {filteredDiscover.length} member{filteredDiscover.length !== 1 ? 's' : ''}
                    </div>
                    {filteredDiscover.map(user => {
                      const alreadySent = sentSet.has(user.email)
                      const loading     = actionEmail === user.email
                      return (
                        <div key={user.email} style={{ borderBottom: '1px solid #1f1308' }}>
                          <UserRow
                            user={user}
                            rightSlot={
                              alreadySent
                                ? <span style={{ fontSize: 11, color: '#6b5030', fontStyle: 'italic', flexShrink: 0 }}>Requested</span>
                                : accentBtn('+ Add', () => sendRequest(user.email), loading)
                            }
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Friend profile panel */}
      <FriendProfilePanel friend={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}
