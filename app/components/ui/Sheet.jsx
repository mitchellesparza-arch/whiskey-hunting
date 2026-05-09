'use client'
import { useEffect } from 'react'

/**
 * Sheet — bottom sheet (mobile) or side drawer (≥ 600px).
 * Supports both modes via the `side` prop.
 *
 * Props:
 *   open      bool
 *   onClose   fn
 *   side      bool   — if true, slides from the right edge (drawer). default: false (bottom sheet)
 *   title     string
 *   children
 */
export default function Sheet({ open, onClose, side = false, title, children }) {
  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const panelStyle = side ? {
    position:    'fixed',
    top:         0,
    right:       0,
    bottom:      0,
    width:       'min(360px, 100vw)',
    background:  'var(--bg-elev-4)',
    borderLeft:  '1px solid var(--hairline-2)',
    boxShadow:   'var(--shadow-3)',
    display:     'flex',
    flexDirection: 'column',
    zIndex:      150,
    animation:   'slideLeft var(--t-slow) var(--ease-spring)',
    overflowY:   'auto',
  } : {
    position:    'fixed',
    left:        0,
    right:       0,
    bottom:      0,
    maxHeight:   '90dvh',
    background:  'var(--bg-elev-4)',
    borderTop:   '1px solid var(--hairline-2)',
    borderRadius:'var(--r-2xl) var(--r-2xl) 0 0',
    boxShadow:   'var(--shadow-3)',
    display:     'flex',
    flexDirection: 'column',
    zIndex:      150,
    animation:   'springIn var(--t-slow) var(--ease-spring)',
    overflowY:   'auto',
    paddingBottom: 'env(safe-area-inset-bottom)',
  }

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
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div style={panelStyle}>
        {/* Drag handle (bottom sheet only) */}
        {!side && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-3) 0 0' }}>
            <div style={{
              width:        40,
              height:       4,
              borderRadius: 'var(--r-pill)',
              background:   'var(--hairline-3)',
            }} />
          </div>
        )}

        {/* Header */}
        {title && (
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        'var(--sp-4) var(--sp-5)',
            borderBottom:   '1px solid var(--hairline)',
            flexShrink:     0,
          }}>
            <h2 style={{
              margin:        0,
              fontSize:      'var(--fs-h3)',
              fontWeight:    700,
              color:         'var(--text-primary)',
              letterSpacing: 'var(--tracking-head)',
            }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                background:   'none',
                border:       'none',
                cursor:       'pointer',
                color:        'var(--text-muted)',
                fontSize:     20,
                lineHeight:   1,
                padding:      'var(--sp-1)',
                borderRadius: 'var(--r-sm)',
                transition:   'color var(--t-fast) var(--ease-out)',
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: title ? 'var(--sp-5)' : 0 }}>
          {children}
        </div>
      </div>
    </>
  )
}
