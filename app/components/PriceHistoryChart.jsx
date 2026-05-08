'use client'
/**
 * PriceHistoryChart — full-width SVG chart of monthly secondary-market prices.
 *
 * Renders the avg line plus a low/high band for each month.  Months are spaced
 * evenly along the x-axis; y-axis spans min(low) to max(high) with a small
 * top/bottom pad.  X-axis labels show the first month, last month, and every
 * 3rd month in between.
 *
 * Props:
 *   data  [{ date: 'YYYY-MM', avg, low, high }] sorted oldest→newest
 *   color stroke color (default accent orange)
 */
export default function PriceHistoryChart({ data, color = '#e8943a' }) {
  if (!data || data.length < 2) return null

  const W = 320, H = 140, padL = 32, padR = 8, padT = 12, padB = 22
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const lows  = data.map(d => d.low  ?? d.avg)
  const highs = data.map(d => d.high ?? d.avg)
  const yMin  = Math.min(...lows)
  const yMax  = Math.max(...highs)
  const span  = (yMax - yMin) || 1

  const xFor = i => padL + (i / (data.length - 1)) * chartW
  const yFor = v => padT + (1 - (v - yMin) / span) * chartH

  const avgPath  = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(d.avg).toFixed(1)}`).join(' ')
  const bandPath = [
    ...data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(d.high ?? d.avg).toFixed(1)}`),
    ...[...data].reverse().map((d, i) => `L ${xFor(data.length - 1 - i).toFixed(1)} ${yFor(d.low ?? d.avg).toFixed(1)}`),
    'Z',
  ].join(' ')

  // Y-axis: min, mid, max ticks
  const yTicks = [yMin, (yMin + yMax) / 2, yMax]

  // X-axis labels — first, last, and every 3rd in between (or every Nth that fits)
  const xLabelStep = Math.max(1, Math.ceil(data.length / 5))
  const xLabels = data
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i === 0 || i === data.length - 1 || i % xLabelStep === 0)

  function fmtMonth(yyyymm) {
    const [y, m] = yyyymm.split('-')
    if (!y || !m) return yyyymm
    const date = new Date(Number(y), Number(m) - 1, 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxWidth: '100%' }} aria-label="Price history chart">
      {/* Y-axis grid + labels */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line
            x1={padL} y1={yFor(v)} x2={W - padR} y2={yFor(v)}
            stroke="#2a1c08" strokeWidth={0.5} strokeDasharray="2 3"
          />
          <text
            x={padL - 4} y={yFor(v) + 3}
            fill="#6b5030" fontSize="9" textAnchor="end" fontFamily="inherit"
          >
            ${Math.round(v)}
          </text>
        </g>
      ))}

      {/* Low/high band */}
      <path d={bandPath} fill={color} fillOpacity={0.12} />

      {/* Avg line */}
      <path d={avgPath} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Data points */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={xFor(i).toFixed(1)} cy={yFor(d.avg).toFixed(1)}
          r={2.5} fill={color}
        >
          <title>{`${fmtMonth(d.date)} · avg $${d.avg}${d.low != null && d.high != null ? ` (${d.low}–${d.high})` : ''}`}</title>
        </circle>
      ))}

      {/* X-axis month labels */}
      {xLabels.map(({ d, i }) => (
        <text
          key={i}
          x={xFor(i)} y={H - 6}
          fill="#6b5030" fontSize="9" textAnchor="middle" fontFamily="inherit"
        >
          {fmtMonth(d.date)}
        </text>
      ))}
    </svg>
  )
}
