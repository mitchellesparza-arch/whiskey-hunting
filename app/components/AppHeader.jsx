'use client'
/**
 * AppHeader — shared sticky header used by all pages.
 *
 * Props:
 *   sub     string   — contextual subtitle (e.g. "Community Finds · Chicagoland")
 *   action  ReactNode — right-side content (refresh button, etc.)
 */
export default function AppHeader({ sub, action }) {
  return (
    <header style={{
      position:        'sticky',
      top:             0,
      zIndex:          50,
      background:      'rgba(15,10,5,0.92)',
      borderBottom:    '1px solid #3d2b10',
      backdropFilter:  'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      <div style={{
        maxWidth:       960,
        margin:         '0 auto',
        padding:        '12px 16px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
      }}>
        {/* Left: logo + title + subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>🥃</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#f5e6cc', lineHeight: 1.1 }}>
              Whiskey Hunter
            </div>
            {sub && (
              <div style={{ fontSize: 11, color: '#9a7c55', marginTop: 1 }}>{sub}</div>
            )}
          </div>
        </div>

        {/* Right: per-page action */}
        {action && <div>{action}</div>}
      </div>
    </header>
  )
}
