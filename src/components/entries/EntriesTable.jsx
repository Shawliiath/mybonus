import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import clsx from 'clsx'

export default function EntriesTable({ entries, onEdit, onDelete, currency = '€', loading }) {
  if (loading) return <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-surface-muted rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.15 }} />)}</div>
  if (!entries.length) return (
    <div className="text-center py-16 text-zinc-400">
      <TrendingUp size={32} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">Aucune entrée pour cette période</p>
    </div>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border">
            {['Weekend', 'Dépôt', 'Profit', 'ROI', 'Note', ''].map(h => (
              <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 first:pl-0 last:pr-0 last:text-right">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {entries.map(entry => {
            const roi = entry.deposit ? ((entry.profit / entry.deposit) * 100) : null
            const positive = entry.profit >= 0
            return (
              <tr key={entry.id} className="hover:bg-surface-muted/40 transition-colors group">
                <td className="py-3.5 px-3 pl-0 font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                  {entry.weekStart ? format(parseISO(entry.weekStart), 'dd MMM yyyy', { locale: fr }) : '—'}
                </td>
                <td className="py-3.5 px-3 font-mono text-blue-500 dark:text-blue-400">{entry.deposit?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}</td>
                <td className="py-3.5 px-3 font-mono whitespace-nowrap">
                  <span className={clsx('flex items-center gap-1', positive ? 'text-brand-500 dark:text-brand-400' : 'text-red-500 dark:text-red-400')}>
                    {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {positive ? '+' : ''}{entry.profit?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
                  </span>
                </td>
                <td className="py-3.5 px-3">
                  {roi !== null ? (
                    <span className={clsx('text-xs font-mono font-semibold px-2 py-0.5 rounded-full', roi >= 0 ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400' : 'bg-red-500/15 text-red-600 dark:text-red-400')}>
                      {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                    </span>
                  ) : '—'}
                </td>
                <td className="py-3.5 px-3 text-zinc-500 max-w-[160px] truncate text-xs">{entry.note || <span className="italic">—</span>}</td>
                <td className="py-3.5 pr-0 pl-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(entry)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-surface-muted transition-all"><Pencil size={14} /></button>
                    <button onClick={() => onDelete(entry)} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
