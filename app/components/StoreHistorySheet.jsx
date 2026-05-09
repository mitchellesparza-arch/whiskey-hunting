'use client'
import { useEffect, useState } from 'react'
import Sheet from './ui/Sheet.jsx'

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
    <Sheet open={true} onClose={onClose} title={`📍 ${store?.name ?? 'Store History'}`}>
      {/* Address subtitle */}
      {store?.address && (
        <div style={{ padding: '0 16px 10px', fontSize: 11, color: 'var(--text-dim)' }}>
          {store.address}
        </div>
      )}

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px', alignItems: 'center' }}>
        {FILTERS.map(f => (
          <button
            key={f.label}
            onClick={() => setFilter(f.days)}
            style={{
              flexShrink:   0,
              padding:      '5px 12px',
              borderRadius: 'var(--r-pill)',
              border:       'none',
              cursor:       'pointer',
              fontSize:     12,
              fontWeight:   600,
              background:   filter === f.days ? 'var(--copper-400)' : 'var(--bg-elev-3)',
              color:        filter === f.days ? 'var(--text-inverse)' : 'var(--text-muted)',
            }}
          >{f.label}</button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 4 }}>
          {visible.length} find{visible.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      <div style={{ padding: '8px 16px 0' }}>
        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '28px 0' }}>Loading…</p>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
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
                  borderBottom: i < visible.length - 1 ? '1px solid var(--bg-elev-3)' : 'none',
                  display:      'flex',
                  justifyContent: 'space-between',
                  alignItems:   'center',
                  gap:          8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: 13, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    🥃 {h.bottleName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                    by {h.submitterName} · {fmtTimeAgo(h.timestamp)}
                  </div>
                </div>
                {h.price != null && (
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--copper-400)', flexShrink: 0 }}>
                    ${Number(h.price).toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  )
}
