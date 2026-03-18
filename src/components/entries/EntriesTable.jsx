import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Pencil, Trash2, TrendingUp, TrendingDown, Check, X, Clock } from 'lucide-react'
import clsx from 'clsx'

export default function EntriesTable({ entries, onEdit, onDelete, onConfirm, onCancel, currency = '€', loading }) {
  if (loading) return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-14 bg-surface-muted rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  )

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
              <th key={h}
                className={clsx(
                  'text-left text-xs text-zinc-500 font-medium py-3 px-2 sm:px-3 first:pl-0 last:pr-0 last:text-right',
                  h === 'Note' && 'hidden sm:table-cell'
                )}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {entries.map(entry => {
            const isPending = entry.status === 'pending'
            const roi       = entry.deposit ? (entry.profit / entry.deposit) * 100 : null
            const positive  = entry.profit >= 0

            return (
              <tr key={entry.id} className={clsx(
                'transition-colors group',
                isPending ? 'hover:bg-amber-500/5' : 'hover:bg-surface-muted/40'
              )}>

                {/* Date + badge pending inline */}
                <td className="py-3.5 px-2 sm:px-3 pl-0 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-300 text-xs sm:text-sm">
                      {entry.weekStart ? format(parseISO(entry.weekStart), 'dd MMM yyyy', { locale: fr }) : '—'}
                    </span>
                    {isPending && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 shrink-0">
                        <Clock size={9} />En attente
                      </span>
                    )}
                  </div>
                </td>

                {/* Dépôt */}
                <td className={clsx('py-3.5 px-2 sm:px-3 font-mono text-xs sm:text-sm whitespace-nowrap',
                  isPending ? 'text-zinc-600' : 'text-blue-400')}>
                  {entry.deposit?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
                </td>

                {/* Profit */}
                <td className="py-3.5 px-2 sm:px-3 font-mono whitespace-nowrap">
                  <span className={clsx('flex items-center gap-1 text-xs sm:text-sm',
                    isPending ? 'text-amber-400/60' : positive ? 'text-brand-400' : 'text-red-400')}>
                    {isPending ? <Clock size={12} /> : positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {positive ? '+' : ''}{entry.profit?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
                  </span>
                </td>

                {/* ROI */}
                <td className="py-3.5 px-2 sm:px-3">
                  {roi !== null ? (
                    <span className={clsx('text-xs font-mono font-semibold px-2 py-0.5 rounded-full',
                      isPending
                        ? 'bg-amber-500/10 text-amber-400/60'
                        : roi >= 0 ? 'bg-brand-500/15 text-brand-400' : 'bg-red-500/15 text-red-400')}>
                      {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                    </span>
                  ) : '—'}
                </td>

                {/* Note */}
                <td className="py-3.5 px-2 sm:px-3 text-zinc-500 max-w-[160px] truncate text-xs hidden sm:table-cell">
                  {entry.note || <span className="italic text-zinc-600">—</span>}
                </td>

                {/* Actions */}
                <td className="py-3.5 pr-0 pl-2 sm:pl-3 text-right">
                  {isPending ? (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onConfirm?.(entry)} title="Confirmer"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-brand-400 hover:bg-brand-500/10 transition-all">
                        <Check size={14} />
                      </button>
                      <button onClick={() => onCancel?.(entry)} title="Annuler"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEdit(entry)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-surface-muted transition-all">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => onDelete(entry)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
