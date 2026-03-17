import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-zinc-400 mb-2 text-xs">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-zinc-400 capitalize">{p.name} :</span>
          <span className="font-mono font-semibold text-white">{p.value >= 0 ? '+' : ''}{p.value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}</span>
        </div>
      ))}
    </div>
  )
}

export function ProfitAreaChart({ data, currency = '€' }) {
  const formatted = data.map(e => ({ ...e, label: format(parseISO(e.weekStart), 'dd MMM', { locale: fr }) }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#232738" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v >= 0 ? '+' : ''}${v}`} />
        <Tooltip content={<CustomTooltip currency={currency} />} />
        <Area type="monotone" dataKey="profit" name="profit" stroke="#22c55e" strokeWidth={2} fill="url(#profitGrad)" dot={false} activeDot={{ r: 5, fill: '#22c55e', stroke: '#0f1117', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function DepositProfitBarChart({ data, currency = '€' }) {
  const formatted = data.map(e => ({ ...e, label: format(parseISO(e.weekStart), 'dd MMM', { locale: fr }) }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={formatted} margin={{ top: 5, right: 5, left: -10, bottom: 0 }} barCategoryGap="35%">
        <CartesianGrid strokeDasharray="3 3" stroke="#232738" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip currency={currency} />} />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} formatter={(v) => <span style={{ color: '#a1a1aa' }}>{v}</span>} />
        <Bar dataKey="deposit" name="dépôt"  fill="#3b82f6" radius={[4,4,0,0]} maxBarSize={24} />
        <Bar dataKey="profit"  name="profit" fill="#22c55e" radius={[4,4,0,0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ChartCard({ title, children, actions }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  )
}
