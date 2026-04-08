'use client'

type Slice = {
  label: string
  value: number
  color: string
}

function DonutChart({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0)
  if (total === 0) return (
    <div className="flex items-center justify-center w-48 h-48">
      <p className="text-xs text-zinc-400">Geen data</p>
    </div>
  )

  const R = 80
  const r = 50
  const cx = 96
  const cy = 96
  const gap = 0.012 // radians gap between slices

  let cumAngle = -Math.PI / 2 // start at top

  function polarToXY(angle: number, radius: number) {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  }

  function slicePath(startAngle: number, endAngle: number) {
    const s = startAngle + gap / 2
    const e = endAngle   - gap / 2
    const large = (e - s) > Math.PI ? 1 : 0
    const o1 = polarToXY(s, R)
    const o2 = polarToXY(e, R)
    const i1 = polarToXY(e, r)
    const i2 = polarToXY(s, r)
    return [
      `M ${o1.x} ${o1.y}`,
      `A ${R} ${R} 0 ${large} 1 ${o2.x} ${o2.y}`,
      `L ${i1.x} ${i1.y}`,
      `A ${r} ${r} 0 ${large} 0 ${i2.x} ${i2.y}`,
      'Z',
    ].join(' ')
  }

  const paths = slices.map((sl) => {
    const angle = (sl.value / total) * 2 * Math.PI
    const start = cumAngle
    const end   = cumAngle + angle
    cumAngle    = end
    return { ...sl, path: slicePath(start, end), pct: Math.round((sl.value / total) * 100) }
  })

  return (
    <svg viewBox="0 0 192 192" className="w-48 h-48 shrink-0">
      {paths.map((p) => (
        <path key={p.label} d={p.path} fill={p.color} className="transition-opacity hover:opacity-80" />
      ))}
      {/* centre text */}
      <text x={cx} y={cy - 6} textAnchor="middle" className="text-xs fill-zinc-700 font-semibold" fontSize={13}>{total.toLocaleString('nl-NL')}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" className="fill-zinc-400" fontSize={9}>totaal</text>
    </svg>
  )
}

type LogsChartProps = {
  sent:    number
  opened:  number
  failed:  number
  skipped: number
  pending: number
}

const SLICES_CONFIG = [
  { key: 'opened',            label: 'Geopend',                    color: '#3b82f6' }, // blue-500
  { key: 'sent_not_opened',   label: 'Afgeleverd (niet geopend)',  color: '#4ade80' }, // green-400
  { key: 'failed',            label: 'Gebounced / Mislukt',        color: '#ef4444' }, // red-500
  { key: 'skipped',           label: 'Opt-out / Overgeslagen',     color: '#f59e0b' }, // amber-500
  { key: 'pending',           label: 'Gepland',                    color: '#d4d4d8' }, // zinc-300
] as const

export function LogsChart({ sent, opened, failed, skipped, pending }: LogsChartProps) {
  const sentNotOpened = Math.max(0, sent - opened)
  const values: Record<string, number> = { opened, sent_not_opened: sentNotOpened, failed, skipped, pending }

  const slices: Slice[] = SLICES_CONFIG
    .map(({ key, label, color }) => ({ label, value: values[key] ?? 0, color }))
    .filter((sl) => sl.value > 0)

  const total = slices.reduce((s, sl) => s + sl.value, 0)

  return (
    <div className="flex items-center gap-8">
      <DonutChart slices={slices} />

      {/* Legend */}
      <div className="space-y-2.5">
        {SLICES_CONFIG.map(({ key, label, color }) => {
          const value = values[key] ?? 0
          const pct   = total > 0 ? Math.round((value / total) * 100) : 0
          return (
            <div key={key} className="flex items-center gap-2.5">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-sm text-zinc-600">{label}</span>
              <span className="ml-auto pl-4 text-sm font-semibold tabular-nums text-zinc-900">{value.toLocaleString('nl-NL')}</span>
              <span className="w-9 text-right text-xs text-zinc-400 tabular-nums">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
