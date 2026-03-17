import clsx from 'clsx'

export default function KpiCard({ label, value, sub, icon: Icon, trend, color = 'green', loading = false }) {
  const colors = {
    green:  { bg: 'bg-brand-500/10',  border: 'border-brand-500/20',  icon: 'text-brand-500 dark:text-brand-400'  },
    blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: 'text-blue-500 dark:text-blue-400'   },
    amber:  { bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  icon: 'text-amber-500 dark:text-amber-400'  },
    red:    { bg: 'bg-red-500/10',    border: 'border-red-500/20',    icon: 'text-red-500 dark:text-red-400'    },
  }
  const c = colors[color] || colors.green
  return (
    <div className={clsx('bg-surface-card border rounded-2xl p-5 flex flex-col gap-4 card-hover', c.border)}>
      <div className="flex items-start justify-between">
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{label}</p>
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', c.bg)}>
          <Icon size={17} className={c.icon} />
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-7 w-24 bg-surface-muted rounded-lg animate-pulse" />
          <div className="h-4 w-16 bg-surface-muted rounded animate-pulse" />
        </div>
      ) : (
        <div>
          <p className="text-2xl font-bold font-mono tracking-tight text-zinc-900 dark:text-white">{value ?? '—'}</p>
          {(sub || trend !== undefined) && (
            <div className="flex items-center gap-2 mt-1">
              {trend !== undefined && (
                <span className={clsx('text-xs font-medium', trend > 0 ? 'text-brand-500' : trend < 0 ? 'text-red-500' : 'text-zinc-400')}>
                  {trend > 0 ? '▲' : trend < 0 ? '▼' : '●'} {Math.abs(trend).toFixed(1)}%
                </span>
              )}
              {sub && <span className="text-xs text-zinc-400">{sub}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
