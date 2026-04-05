import { formatNumber } from '@/utils/format'

type StatCardProps = {
  label:    string
  value:    number | string
  sub?:     string
  trend?:   'up' | 'down' | 'neutral'
  icon?:    React.ReactNode
}

export function StatCard({ label, value, sub, trend, icon }: StatCardProps) {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-zinc-400'

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</span>
        {icon && <span className="text-zinc-400">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-zinc-900">
        {typeof value === 'number' ? formatNumber(value) : value}
      </div>
      {sub && (
        <p className={`text-xs ${trendColor}`}>{sub}</p>
      )}
    </div>
  )
}
