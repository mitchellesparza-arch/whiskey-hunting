/**
 * Button — design-system button with press state.
 *
 * Props:
 *   variant  'primary' | 'secondary' | 'ghost' | 'danger'  (default: 'primary')
 *   size     'sm' | 'md' | 'lg'                             (default: 'md')
 *   icon     ReactNode  — icon rendered left of label
 *   iconRight ReactNode — icon rendered right of label
 *   fullWidth bool
 *   disabled  bool
 *   onClick   fn
 *   type      string
 *   children
 */

const VARIANTS = {
  primary: {
    background:   'var(--copper-500)',
    color:        'var(--text-inverse)',
    border:       '1px solid transparent',
    '--hover-bg': 'var(--copper-400)',
  },
  secondary: {
    background:   'var(--bg-elev-3)',
    color:        'var(--text-primary)',
    border:       '1px solid var(--hairline-2)',
    '--hover-bg': 'var(--bg-elev-4)',
  },
  ghost: {
    background:   'transparent',
    color:        'var(--text-2)',
    border:       '1px solid transparent',
    '--hover-bg': 'var(--bg-elev-3)',
  },
  danger: {
    background:   'transparent',
    color:        'var(--red)',
    border:       '1px solid rgba(248, 113, 113, 0.30)',
    '--hover-bg': 'var(--red-bg)',
  },
}

const SIZES = {
  sm: { padding: '7px 13px', fontSize: 'var(--fs-meta)',    borderRadius: 'var(--r-sm)', gap: '6px' },
  md: { padding: '11px 18px', fontSize: 'var(--fs-body)',   borderRadius: 'var(--r-md)', gap: '8px' },
  lg: { padding: '14px 22px', fontSize: 'var(--fs-h3)',     borderRadius: 'var(--r-md)', gap: '10px' },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth = false,
  disabled = false,
  onClick,
  type = 'button',
  children,
  style,
  ...rest
}) {
  const v = VARIANTS[variant] ?? VARIANTS.primary
  const s = SIZES[size] ?? SIZES.md

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            s.gap,
        width:          fullWidth ? '100%' : undefined,
        padding:        s.padding,
        fontSize:       s.fontSize,
        fontFamily:     'inherit',
        fontWeight:     700,
        borderRadius:   s.borderRadius,
        border:         v.border,
        background:     v.background,
        color:          v.color,
        cursor:         disabled ? 'not-allowed' : 'pointer',
        opacity:        disabled ? 0.45 : 1,
        transition:     `background var(--t-base) var(--ease-out), border-color var(--t-base) var(--ease-out), transform var(--t-fast) var(--ease-out)`,
        lineHeight:     1,
        ...style,
      }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.background = v['--hover-bg'])}
      onMouseLeave={e => !disabled && (e.currentTarget.style.background = v.background)}
      onMouseDown={e  => !disabled && (e.currentTarget.style.transform = 'scale(0.97)')}
      onMouseUp={e    => !disabled && (e.currentTarget.style.transform = 'scale(1)')}
      {...rest}
    >
      {icon && icon}
      {children}
      {iconRight && iconRight}
    </button>
  )
}
