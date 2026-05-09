/**
 * StatTile — a label + big number + optional delta tile.
 * Uses Fraunces for the number for editorial weight.
 *
 * Props:
 *   label    string
 *   value    string | number
 *   delta    string  — e.g. "+3.8" or "-1.2"
 *   deltaPositive bool  — true = green, false = red
 *   prefix   string  — e.g. "$"
 *   suffix   string  — e.g. "%"
 *   style    object
 */
export default function StatTile({ label, value, delta, deltaPositive, prefix, suffix, style }) {
  return (
    <div style={{
      flex:          1,
      display:       'flex',
      flexDirection: 'column',
      gap:           'var(--sp-1)',
      padding:       'var(--sp-4)',
      background:    'var(--bg-elev-2)',
      border:        '1px solid var(--hairline-2)',
      borderRadius:  'var(--r-lg)',
      minWidth:      0,
      ...style,
    }}>
      <span style={{
        fontSize:      'var(--fs-overline)',
        fontWeight:    700,
        letterSpacing: 'var(--tracking-overline)',
        textTransform: 'uppercase',
        color:         'var(--text-muted)',
      }}>
        {label}
      </span>

      <span style={{
        fontFamily:    "'Fraunces', Georgia, serif",
        fontWeight:    600,
        fontSize:      28,
        color:         'var(--text-primary)',
        lineHeight:    1,
        letterSpacing: '-0.02em',
      }}>
        {prefix}{value}{suffix}
      </span>

      {delta !== undefined && (
        <span style={{
          fontSize:   'var(--fs-overline)',
          fontWeight: 600,
          color:      deltaPositive ? 'var(--green)' : 'var(--red)',
        }}>
          {delta}
        </span>
      )}
    </div>
  )
}
