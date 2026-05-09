/**
 * Card — base surface for content.
 *
 * Props:
 *   variant  'padded' | 'flush'  (default: 'padded')
 *   hover    bool                (default: true) — adds lift on hover
 *   onClick  fn                  — makes card interactive (adds cursor + press)
 *   style    object
 *   children
 */
export default function Card({ variant = 'padded', hover = true, onClick, style, children, className, ...rest }) {
  const isInteractive = !!onClick

  return (
    <div
      onClick={onClick}
      style={{
        background:    'var(--bg-elev-2)',
        border:        '1px solid var(--hairline-2)',
        borderRadius:  'var(--r-lg)',
        padding:       variant === 'padded' ? 'var(--sp-4)' : 0,
        overflow:      'hidden',
        transition:    `background var(--t-base) var(--ease-out), border-color var(--t-base) var(--ease-out), transform var(--t-fast) var(--ease-out), box-shadow var(--t-base) var(--ease-out)`,
        cursor:        isInteractive ? 'pointer' : undefined,
        ...style,
      }}
      onMouseEnter={e => {
        if (!hover) return
        e.currentTarget.style.background    = 'var(--bg-elev-3)'
        e.currentTarget.style.borderColor   = 'var(--hairline-3)'
        if (isInteractive) e.currentTarget.style.boxShadow = 'var(--shadow-2)'
      }}
      onMouseLeave={e => {
        if (!hover) return
        e.currentTarget.style.background    = 'var(--bg-elev-2)'
        e.currentTarget.style.borderColor   = 'var(--hairline-2)'
        e.currentTarget.style.boxShadow     = ''
      }}
      onMouseDown={e => { if (isInteractive) e.currentTarget.style.transform = 'scale(0.99)' }}
      onMouseUp={e   => { if (isInteractive) e.currentTarget.style.transform = 'scale(1)' }}
      className={className}
      {...rest}
    >
      {children}
    </div>
  )
}
