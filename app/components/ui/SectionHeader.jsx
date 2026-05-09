/**
 * SectionHeader — overline label + title + optional action slot.
 *
 * Props:
 *   overline  string  — small all-caps label above the title
 *   title     string
 *   action    ReactNode
 *   style     object
 */
export default function SectionHeader({ overline, title, action, style }) {
  return (
    <div style={{
      display:        'flex',
      alignItems:     'flex-end',
      justifyContent: 'space-between',
      gap:            'var(--sp-3)',
      marginBottom:   'var(--sp-4)',
      ...style,
    }}>
      <div>
        {overline && (
          <p style={{
            margin:        0,
            fontSize:      'var(--fs-overline)',
            fontWeight:    700,
            letterSpacing: 'var(--tracking-overline)',
            textTransform: 'uppercase',
            color:         'var(--text-muted)',
            marginBottom:  'var(--sp-1)',
          }}>
            {overline}
          </p>
        )}
        {title && (
          <h2 style={{
            margin:        0,
            fontSize:      'var(--fs-h2)',
            fontWeight:    700,
            letterSpacing: 'var(--tracking-head)',
            color:         'var(--text-primary)',
            lineHeight:    'var(--lh-tight)',
          }}>
            {title}
          </h2>
        )}
      </div>
      {action && (
        <div style={{ flexShrink: 0 }}>{action}</div>
      )}
    </div>
  )
}
