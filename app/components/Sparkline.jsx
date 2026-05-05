/**
 * Sparkline — inline SVG price trend chart.
 * Requires at least 2 data points; renders nothing otherwise.
 *
 * Props:
 *   data    [{date, avg, low, high}]  — sorted oldest→newest
 *   width   number                    — SVG width  (default 100)
 *   height  number                    — SVG height (default 36)
 *   color   string                    — stroke color (default #e8943a)
 */
export default function Sparkline({ data, width = 100, height = 36, color = '#e8943a' }) {
  if (!data || data.length < 2) return null

  const avgs = data.map(d => d.avg)
  const min  = Math.min(...avgs)
  const max  = Math.max(...avgs)
  const span = max - min || 1
  const pad  = 4

  const pts = data.map((d, i) => [
    pad + (i / (data.length - 1)) * (width  - pad * 2),
    pad + (1 - (d.avg - min) / span)  * (height - pad * 2),
  ])

  const polyline = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]

  return (
    <svg
      width={width}
      height={height}
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      <circle cx={lx.toFixed(1)} cy={ly.toFixed(1)} r={2.5} fill={color} />
    </svg>
  )
}
