'use client'
import { useEffect, useState } from 'react'

function fmtTimeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const m    = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const FILTERS = [
  { label: 'All time', days: null },
  { label: '30 days',  days: 30  },
  { label: '90 days',  days: 90  },
]

/**
 * StoreHistorySheet — bottom sheet showing the permanent find history at a store.
 * Props:
 *   store   { name, address, placeId, lat, lng }
 *   onClose () => void
 */
export default function StoreHistorySheet({ store, onClose }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState(null)

  useEffect(() => {
    if (!store?.placeId) { setLoading(false); return }
    fetch(`/api/store-history?placeId=${encodeURIComponent(store.placeId)}`)
      .then(r => r.json())
      .then(d => setHistory(d.history ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [store?.placeId])

  const cutoff  = filter ? Date.now() - filter * 24 * 60 * 60 * 1000 : null
  const visible = cutoff ? history.filter(h => h.timestamp >= cutoff) : history

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 299 }}
      />
      <div style={{
        position:     'fixed',
        bottom:       0,
        left:         0,
        right:        0,
        zIndex:       300,
        background:   '#1a1008',
        borderRadius: '16px 16px 0 0',
        borderTop:    '1px solid #3d2b10',
        maxHeight:    '80vh',
        overflowY:    'auto',
        paddingBottom:'calc(16px + env(safe-area-inset-bottom))',
        animation:    'fadeUp 0.22s ease',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#3d2b10' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '12px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#f5e6cc' }}>
              📍 {store?.name ?? 'Store History'}
            </div>
            {store?.address && (
              <div style={{ fontSize: 11, color: '#6b5030', marginTop: 2 }}>{store.address}</div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#6b5030', fontSize: 20, cursor: 'pointer', padding: 0, marginTop: 2 }}
          >✕</button>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, padding: '12px 16px 0', alignItems: 'center' }}>
          {FILTERS.map(f => (
            <button
              key={f.label}
              onClick={() => setFilter(f.days)}
              style={{
                flexShrink:   0,
                padding:      '5px 12px',
                borderRadius: 999,
                border:       'none',
                cursor:       'pointer',
                fontSize:     12,
                fontWeight:   600,
                background:   filter === f.days ? '#e8943a' : '#1f1308',
                color:        filter === f.days ? '#fff'     : '#9a7c55',
              }}
            >{f.label}</button>
          ))}
          <span style={{ fontSize: 12, color: '#6b5030', marginLeft: 4 }}>
            {visible.length} find{visible.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* List */}
        <div style={{ padding: '8px 16px 0' }}>
          {loading ? (
            <p style={{ color: '#9a7c55', fontSize: 13, textAlign: 'center', padding: '28px 0' }}>Loading…</p>
          ) : visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
              <div style={{ color: '#6b5030', fontSize: 13 }}>
                {history.length === 0
                  ? 'No finds recorded here yet — be the first!'
                  : 'No finds in this time range'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {visible.map((h, i) => (
                <div
                  key={i}
                  style={{
                    padding:      '10px 0',
                    borderBottom: i < visible.length - 1 ? '1px solid #1f1308' : 'none',
                    display:      'flex',
                    justifyContent: 'space-between',
                    alignItems:   'center',
                    gap:          8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: 13, color: '#f5e6cc',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      🥃 {h.bottleName}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b5030', marginTop: 2 }}>
                      by {h.submitterName} · {fmtTimeAgo(h.timestamp)}
                    </div>
                  </div>
                  {h.price != null && (
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#e8943a', flexShrink: 0 }}>
                      ${Number(h.price).toFixed(2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
