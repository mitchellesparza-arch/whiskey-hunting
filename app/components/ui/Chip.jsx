/**
 * Chip — inline label pill.
 *
 * Props:
 *   tone    'copper' | 'green' | 'red' | 'violet' | 'amber' | 'blue' | 'neutral'  (default: 'neutral')
 *   count   number  — renders a small count badge after the label
 *   size    'sm' | 'md'   (default: 'md')
 *   onClick fn
 *   children
 */

const TONES = {
  copper:  { color: 'var(--copper-400)', bg: 'rgba(217,126,44,0.12)',  border: 'rgba(217,126,44,0.30)'  },
  green:   { color: 'var(--green)',      bg: 'rgba(93,211,158,0.10)',  border: 'rgba(93,211,158,0.30)'  },
  red:     { color: 'var(--red)',        bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.30)' },
  violet:  { color: 'var(--violet)',     bg: 'rgba(185,164,255,0.12)', border: 'rgba(185,164,255,0.30)' },
  amber:   { color: 'var(--amber)',      bg: 'rgba(245,184,58,0.12)',  border: 'rgba(245,184,58,0.30)'  },
  blue:    { color: 'var(--blue)',       bg: 'rgba(143,181,255,0.10)', border: 'rgba(143,181,255,0.30)' },
  neutral: { color: 'var(--text-2)',     bg: 'var(--bg-elev-3)',       border: 'var(--hairline-2)'      },
}

export default function Chip({ tone = 'neutral', count, size = 'md', onClick, children, style }) {
  const t = TONES[tone] ?? TONES.neutral
  const sm = size === 'sm'

  return (
    <span
      onClick={onClick}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           '5px',
        padding:       sm ? '3px 8px' : '5px 10px',
        borderRadius:  'var(--r-pill)',
        fontSize:      sm ? '10px' : 'var(--fs-overline)',
        fontWeight:    600,
        lineHeight:    1,
        color:         t.color,
        background:    t.bg,
        border:        `1px solid ${t.border}`,
        cursor:        onClick ? 'pointer' : undefined,
        whiteSpace:    'nowrap',
        transition:    `opacity var(--t-fast) var(--ease-out)`,
        ...style,
      }}
    >
      {children}
      {count !== undefined && (
        <span style={{
          background:   t.color,
          color:        'var(--bg-base)',
          fontSize:     9,
          fontWeight:   700,
          borderRadius: 'var(--r-pill)',
          padding:      '1px 4px',
          lineHeight:   1.3,
        }}>
          {count}
        </span>
      )}
    </span>
  )
}
