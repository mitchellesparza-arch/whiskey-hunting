'use client'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link           from 'next/link'
import { X, Plus, UserPlus, Users, RefreshCw, ChevronLeft, Search } from 'lucide-react'

import Button        from '../../components/ui/Button'
import Card          from '../../components/ui/Card'
import EmptyState    from '../../components/ui/EmptyState'
import SectionHeader from '../../components/ui/SectionHeader'
import Icon          from '../../components/ui/Icon'

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
  if (s >= 85) return 'var(--green)'
  if (s >= 75) return 'var(--copper-500)'
  return 'var(--text-muted)'
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 40 }) {
  return (
    <div style={{
      width:          size,
      height:         size,
      borderRadius:   '50%',
      background:     'var(--grad-copper)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontWeight:     800,
      fontSize:       size * 0.35,
      color:          'var(--text-inverse)',
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
      <div
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          background: 'rgba(0,0,0,0.55)',
          zIndex:     149,
        }}
      />

      {/* Panel */}
      <div style={{
        position:      'fixed',
        top:           0,
        right:         0,
        bottom:        0,
        width:         'min(420px, 100vw)',
        background:    'var(--bg-base)',
        borderLeft:    '1px solid var(--hairline-2)',
        zIndex:        150,
        display:       'flex',
        flexDirection: 'column',
        animation:     'slideLeft 0.25s ease',
        overflowY:     'auto',
      }}>

        {/* Header */}
        <div style={{
          position:       'sticky',
          top:            0,
          zIndex:         1,
          background:     'var(--bg-base)',
          borderBottom:   '1px solid var(--hairline-2)',
          padding:        'var(--sp-3) var(--sp-4)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <Avatar name={friend.name} size={44} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>{friend.name}</div>
              <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>{joinedAgo(friend.joinedAt)}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
            style={{
              background:    'none',
              border:        'none',
              cursor:        'pointer',
              color:         'var(--text-muted)',
              padding:       'var(--sp-2)',
              display:       'flex',
              alignItems:    'center',
              borderRadius:  'var(--r-sm)',
            }}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div style={{ padding: 'var(--sp-4)' }}>

          {/* Stats row */}
          {loaded && !forbidden && (
            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
              {[
                { label: 'Bottles',    value: totalBottles },
                { label: 'Tastings',   value: totalTastings },
                { label: 'Est. Value', value: estValue > 0 ? `$${Math.round(estValue).toLocaleString()}` : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  flex:         1,
                  textAlign:    'center',
                  padding:      'var(--sp-3) var(--sp-1)',
                  background:   'var(--bg-elev-2)',
                  borderRadius: 'var(--r-md)',
                  border:       '1px solid var(--hairline)',
                }}>
                  <div style={{ fontWeight: 800, fontSize: 'var(--fs-h3)', color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)', marginTop: 'var(--sp-1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Top bottle */}
          {loaded && topBottle && topBottle.tastings > 0 && (
            <div style={{
              background:    'var(--bg-elev-2)',
              border:        '1px solid var(--copper-600)',
              borderRadius:  'var(--r-md)',
              padding:       'var(--sp-3) var(--sp-4)',
              marginBottom:  'var(--sp-4)',
              display:       'flex',
              alignItems:    'center',
              gap:           'var(--sp-3)',
            }}>
              <span style={{ fontSize: 22 }}>🏆</span>
              <div>
                <div style={{ fontSize: 'var(--fs-overline)', fontWeight: 700, color: 'var(--copper-500)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 'var(--sp-1)' }}>Top Bottle</div>
                <div style={{ fontWeight: 700, fontSize: 'var(--fs-meta)', color: 'var(--text-primary)' }}>{topBottle.name}</div>
                <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)' }}>Score: {(topBottle.blindScore ?? 75).toFixed(1)}</div>
              </div>
            </div>
          )}

          {/* Mule requests — shown immediately, before collection loads */}
          {(friend.muleRequests ?? []).length > 0 && (
            <div style={{ marginBottom: 'var(--sp-4)' }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--fs-overline)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--sp-2)' }}>
                🫏 Hunting For
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                {(friend.muleRequests ?? []).map((req, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-3)', background: 'var(--bg-elev-2)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)' }}>
                    <span style={{ fontSize: 14 }}>🥃</span>
                    <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-primary)' }}>{req}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading / empty / forbidden states */}
          {!loaded && (
            <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0', color: 'var(--text-muted)', fontSize: 'var(--fs-meta)' }}>Loading…</div>
          )}
          {loaded && forbidden && (
            <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0' }}>
              <div style={{ fontSize: 32, marginBottom: 'var(--sp-2)' }}>🔒</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-meta)' }}>Collection is private</div>
            </div>
          )}
          {loaded && !forbidden && sorted.length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0', color: 'var(--text-dim)', fontSize: 'var(--fs-meta)' }}>
              {friend.name?.split(' ')[0] ?? 'They'} hasn&apos;t added any bottles yet
            </div>
          )}

          {/* Bottle list */}
          {loaded && !forbidden && sorted.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 'var(--fs-overline)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--sp-3)' }}>
                🥃 Collection · {totalBottles} bottle{totalBottles !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                {sorted.map((bottle, i) => {
                  const score = bottle.blindScore ?? 75
                  return (
                    <div key={bottle.id} style={{
                      display:      'flex',
                      alignItems:   'center',
                      gap:          'var(--sp-3)',
                      padding:      'var(--sp-3)',
                      background:   'var(--bg-elev-2)',
                      border:       '1px solid var(--hairline)',
                      borderRadius: 'var(--r-md)',
                    }}>
                      {/* Rank */}
                      <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', fontWeight: 700, width: 16, flexShrink: 0, textAlign: 'center' }}>
                        {i + 1}
                      </div>
                      {/* Score */}
                      <div style={{ fontWeight: 800, fontSize: 'var(--fs-h3)', color: scoreColor(score), flexShrink: 0, width: 34, textAlign: 'center' }}>
                        {score.toFixed(0)}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 'var(--fs-meta)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {bottle.name}
                        </div>
                        {bottle.distillery && (
                          <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>{bottle.distillery}</div>
                        )}
                      </div>
                      {/* MSRP */}
                      {bottle.msrp > 0 && (
                        <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-2)', flexShrink: 0 }}>${bottle.msrp}</div>
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
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          'var(--sp-3)',
      padding:      'var(--sp-3) var(--sp-3)',
      background:   'var(--bg-elev-2)',
      border:       '1px solid var(--hairline)',
      borderRadius: 'var(--r-md)',
    }}>
      <Avatar name={user.name} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name}
        </div>
        <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>{joinedAgo(user.joinedAt)}</div>
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

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div style={{
        position:             'sticky',
        top:                  0,
        zIndex:               50,
        background:           'rgba(15,10,5,0.95)',
        borderBottom:         '1px solid var(--hairline-2)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ padding: 'var(--sp-3) var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <Link
            href="/profile"
            style={{
              color:          'var(--text-muted)',
              textDecoration: 'none',
              display:        'flex',
              alignItems:     'center',
            }}
          >
            <ChevronLeft size={20} strokeWidth={1.75} />
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <Users size={18} strokeWidth={1.75} color="var(--copper-500)" />
              Friends
            </div>
            <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)' }}>Jon and the Juice</div>
          </div>
          <button
            onClick={loadData}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 'var(--sp-2)', borderRadius: 'var(--r-sm)' }}
          >
            <RefreshCw size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderTop: '1px solid var(--hairline)' }}>
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              style={{
                flex:         1,
                padding:      'var(--sp-3) 0',
                background:   'none',
                border:       'none',
                borderBottom: tab === i ? '2px solid var(--copper-500)' : '2px solid transparent',
                color:        tab === i ? 'var(--copper-500)' : 'var(--text-dim)',
                fontWeight:   tab === i ? 700 : 500,
                fontSize:     'var(--fs-meta)',
                cursor:       'pointer',
                position:     'relative',
                transition:   'color var(--t-base) var(--ease-out)',
              }}
            >
              {t}
              {i === 1 && requestBadge > 0 && (
                <span style={{
                  position:     'absolute',
                  top:          'var(--sp-2)',
                  right:        '50%',
                  transform:    'translateX(18px)',
                  background:   'var(--red)',
                  color:        'var(--text-inverse)',
                  fontSize:     'var(--fs-overline)',
                  fontWeight:   700,
                  borderRadius: 'var(--r-pill)',
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
        <div style={{ padding: 'var(--sp-2) var(--sp-4) var(--sp-3)' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 'var(--sp-3)', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
              <Search size={14} strokeWidth={1.75} />
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name…"
              style={{
                width:        '100%',
                padding:      'var(--sp-2) var(--sp-3) var(--sp-2) var(--sp-8)',
                background:   'var(--bg-elev-2)',
                border:       '1px solid var(--hairline-2)',
                borderRadius: 'var(--r-md)',
                color:        'var(--text-primary)',
                fontSize:     'var(--fs-meta)',
                fontFamily:   'inherit',
                outline:      'none',
                boxSizing:    'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 var(--sp-4) var(--sp-8)' }}>

        {!loaded ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-12) 0', color: 'var(--text-muted)', fontSize: 'var(--fs-meta)' }}>Loading…</div>
        ) : (

          <>
            {/* ── Tab 0: Friends ── */}
            {tab === 0 && (
              <>
                {/* My Mule Requests card */}
                <Card hover={false} style={{ marginTop: 'var(--sp-4)', marginBottom: 'var(--sp-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (editingMule || myRequests.length > 0) ? 'var(--sp-3)' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--fs-meta)', color: 'var(--text-primary)' }}>🫏 My Mule Requests</div>
                      {muleSaved && <span style={{ fontSize: 'var(--fs-overline)', color: 'var(--green)', fontWeight: 600 }}>✓ Saved</span>}
                    </div>
                    {!editingMule && (
                      <Button variant="secondary" size="sm" onClick={startEditMule}>Edit</Button>
                    )}
                  </div>

                  {editingMule ? (
                    <div>
                      {editRequests.map((req, i) => (
                        <div key={i} style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
                          <input
                            value={req}
                            onChange={e => setEditRequests(prev => prev.map((r, j) => j === i ? e.target.value : r))}
                            placeholder="e.g. Blanton's Original"
                            style={{ flex: 1, padding: 'var(--sp-2) var(--sp-3)', background: 'var(--bg-elev-3)', border: '1px solid var(--hairline-2)', borderRadius: 'var(--r-sm)', color: 'var(--text-primary)', fontSize: 'var(--fs-meta)', fontFamily: 'inherit', outline: 'none' }}
                          />
                          <button
                            onClick={() => setEditRequests(prev => prev.filter((_, j) => j !== i))}
                            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
                            onMouseUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
                            style={{ background: 'none', border: '1px solid var(--hairline-2)', borderRadius: 'var(--r-sm)', color: 'var(--red)', cursor: 'pointer', padding: '0 var(--sp-3)', display: 'flex', alignItems: 'center' }}
                          >
                            <X size={14} strokeWidth={1.75} />
                          </button>
                        </div>
                      ))}
                      {editRequests.length < 5 && (
                        <button
                          onClick={() => setEditRequests(prev => [...prev, ''])}
                          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
                          onMouseUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
                          style={{ width: '100%', padding: 'var(--sp-2) 0', background: 'none', border: '1px dashed var(--hairline-2)', borderRadius: 'var(--r-sm)', color: 'var(--text-muted)', fontSize: 'var(--fs-meta)', cursor: 'pointer', marginBottom: 'var(--sp-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)' }}
                        >
                          <Plus size={14} strokeWidth={1.75} />
                          Add bottle
                        </button>
                      )}
                      {muleError && (
                        <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--red)', marginBottom: 'var(--sp-2)', padding: 'var(--sp-1) var(--sp-2)', background: 'rgba(248,113,113,0.1)', borderRadius: 'var(--r-sm)', border: '1px solid rgba(248,113,113,0.2)' }}>
                          ⚠ {muleError}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: editRequests.length < 5 ? 0 : 'var(--sp-3)' }}>
                        <Button variant="primary" size="sm" fullWidth onClick={saveMuleRequests} disabled={savingMule}>
                          {savingMule ? 'Saving…' : 'Save'}
                        </Button>
                        <Button variant="secondary" size="sm" fullWidth onClick={cancelEditMule}>Cancel</Button>
                      </div>
                    </div>
                  ) : myRequests.length === 0 ? (
                    <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      No bottles on your list yet — tap Edit to add bottles your friends can hunt for you
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                      {myRequests.map((req, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-1) 0', borderBottom: i < myRequests.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                          <span style={{ fontSize: 13 }}>🥃</span>
                          <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-primary)', fontWeight: 500 }}>{req}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

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

                  const rarityColor = {
                    Common:    'var(--text-muted)',
                    Allocated: 'var(--copper-500)',
                    Unicorn:   'var(--violet)',
                  }

                  return (
                    <Card hover={false} style={{ marginBottom: 'var(--sp-2)' }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--fs-meta)', color: 'var(--text-primary)', marginBottom: 'var(--sp-3)' }}>
                        🔍 Friends Hunting For
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                        {allRequests.map(({ req, name, rarity }, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-1) 0', borderBottom: i < allRequests.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                            <span style={{ fontSize: 14, flexShrink: 0 }}>🥃</span>
                            <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-primary)', flex: 1 }}>{req}</span>
                            {rarity && rarity !== 'Common' && (
                              <span style={{ fontSize: 'var(--fs-overline)', fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--r-pill)', color: rarityColor[rarity] ?? 'var(--text-muted)', background: `color-mix(in srgb, ${rarityColor[rarity] ?? 'var(--text-muted)'} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${rarityColor[rarity] ?? 'var(--text-muted)'} 30%, transparent)`, flexShrink: 0 }}>
                                {rarity === 'Unicorn' ? '🦄' : rarity}
                              </span>
                            )}
                            <span style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', flexShrink: 0 }}>{name}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )
                })()}

                {filteredFriends.length === 0 ? (
                  <EmptyState
                    icon="Users"
                    title={search ? 'No matches' : 'No friends yet'}
                    body={search ? 'Try a different search' : 'Invite bourbon hunters you know'}
                    ctaLabel={!search ? 'Discover Members' : undefined}
                    onCta={!search ? () => setTab(2) : undefined}
                  />
                ) : (
                  <div style={{ paddingTop: 'var(--sp-1)' }}>
                    <SectionHeader
                      overline={`${filteredFriends.length} friend${filteredFriends.length !== 1 ? 's' : ''}`}
                      style={{ marginTop: 'var(--sp-3)' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                      {filteredFriends.map(friend => (
                        <UserRow
                          key={friend.email}
                          user={friend}
                          rightSlot={
                            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                              <Button size="sm" variant="primary" onClick={() => setViewing(friend)}>View</Button>
                              <Button size="sm" variant="danger" onClick={() => removeFriend(friend.email)} disabled={actionEmail === friend.email}>Remove</Button>
                            </div>
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Tab 1: Requests ── */}
            {tab === 1 && (
              <>
                {filteredRequests.length === 0 ? (
                  <EmptyState
                    icon="UserPlus"
                    title={search ? 'No matches' : 'No pending requests'}
                    body={search ? 'Try a different search' : 'When someone sends you a friend request it will appear here'}
                  />
                ) : (
                  <div style={{ paddingTop: 'var(--sp-1)' }}>
                    <SectionHeader
                      overline={`${filteredRequests.length} pending request${filteredRequests.length !== 1 ? 's' : ''}`}
                      style={{ marginTop: 'var(--sp-3)' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                      {filteredRequests.map(user => (
                        <UserRow
                          key={user.email}
                          user={user}
                          rightSlot={
                            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                              <Button size="sm" variant="primary" onClick={() => respond(user.email, 'accept')} disabled={actionEmail === user.email}>Accept</Button>
                              <Button size="sm" variant="secondary" onClick={() => respond(user.email, 'reject')} disabled={actionEmail === user.email}>Ignore</Button>
                            </div>
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Tab 2: Discover ── */}
            {tab === 2 && (
              <>
                {filteredDiscover.length === 0 ? (
                  <EmptyState
                    icon="Users"
                    title={search ? 'No matches' : 'All connected!'}
                    body={search ? 'Try a different search' : "You're connected with everyone in the club 🎉"}
                  />
                ) : (
                  <div style={{ paddingTop: 'var(--sp-1)' }}>
                    <SectionHeader
                      overline={`${filteredDiscover.length} member${filteredDiscover.length !== 1 ? 's' : ''}`}
                      style={{ marginTop: 'var(--sp-3)' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                      {filteredDiscover.map(user => {
                        const alreadySent = sentSet.has(user.email)
                        const loading     = actionEmail === user.email
                        return (
                          <UserRow
                            key={user.email}
                            user={user}
                            rightSlot={
                              alreadySent
                                ? <span style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', fontStyle: 'italic', flexShrink: 0 }}>Requested</span>
                                : (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    icon={<UserPlus size={14} strokeWidth={1.75} />}
                                    onClick={() => sendRequest(user.email)}
                                    disabled={loading}
                                  >
                                    Add
                                  </Button>
                                )
                            }
                          />
                        )
                      })}
                    </div>
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
