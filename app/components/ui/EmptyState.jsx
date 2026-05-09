import Icon from './Icon.jsx'
import Button from './Button.jsx'

/**
 * EmptyState — hero empty state with icon + title + body + optional CTA.
 *
 * Props:
 *   icon       string  — lucide icon name
 *   title      string
 *   body       string
 *   ctaLabel   string
 *   ctaHref    string
 *   onCta      fn
 *   gradient   bool    — show copper gradient glow behind icon (default: true)
 */
export default function EmptyState({ icon, title, body, ctaLabel, ctaHref, onCta, gradient = true, style }) {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      textAlign:      'center',
      padding:        'var(--sp-12) var(--sp-6)',
      gap:            'var(--sp-4)',
      animation:      'fadeUp 0.3s var(--ease-out)',
      ...style,
    }}>
      {icon && (
        <div style={{
          width:        64,
          height:       64,
          borderRadius: 'var(--r-xl)',
          background:   gradient
            ? 'linear-gradient(160deg, var(--bg-elev-3) 0%, var(--copper-900) 100%)'
            : 'var(--bg-elev-2)',
          border:       '1px solid var(--hairline-2)',
          display:      'grid',
          placeItems:   'center',
          boxShadow:    gradient ? 'var(--shadow-glow)' : 'var(--shadow-1)',
        }}>
          <Icon name={icon} size={28} color="var(--copper-400)" />
        </div>
      )}

      <div style={{ maxWidth: 280 }}>
        <p style={{
          margin:        0,
          fontSize:      'var(--fs-h3)',
          fontWeight:    700,
          color:         'var(--text-primary)',
          letterSpacing: 'var(--tracking-head)',
          lineHeight:    'var(--lh-snug)',
        }}>
          {title}
        </p>
        {body && (
          <p style={{
            margin:     'var(--sp-2) 0 0',
            fontSize:   'var(--fs-meta)',
            color:      'var(--text-muted)',
            lineHeight: 'var(--lh-body)',
          }}>
            {body}
          </p>
        )}
      </div>

      {(ctaLabel && (onCta || ctaHref)) && (
        ctaHref
          ? <a href={ctaHref} style={{ textDecoration: 'none' }}>
              <Button variant="primary">{ctaLabel}</Button>
            </a>
          : <Button variant="primary" onClick={onCta}>{ctaLabel}</Button>
      )}
    </div>
  )
}
