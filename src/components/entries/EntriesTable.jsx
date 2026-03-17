import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Pencil, Trash2, TrendingUp, TrendingDown, Clock, CheckCircle } from 'lucide-react'
import clsx from 'clsx'

export default function EntriesTable({ entries, onEdit, onDelete, onValidate, currency = '€', loading }) {
  if (loading) return <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-surface-muted rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.15 }} />)}</div>
  if (!entries.length) return (
    <div className="text-center py-16 text-zinc-400">
      <TrendingUp size={32} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">Aucune entrée pour cette période</p>
    </div>
  )

  const isPending = (entry) => entry.status === 'pending'
  const roi = (entry) => !isPending(entry) && entry.deposit ? ((entry.profit / entry.deposit) * 100) : null
  const positive = (entry) => entry.profit >= 0

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              {['Weekend', 'Statut', 'Dépôt', 'Retrait', 'Profit', 'ROI', 'Note', ''].map(h => (
                <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 first:pl-0 last:pr-0 last:text-right">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {entries.map(entry => (
              <tr key={entry.id} className="hover:bg-surface-muted/40 transition-colors group">
                <td className="py-3.5 px-3 pl-0 font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                  {entry.weekStart ? format(parseISO(entry.weekStart), 'dd MMM yyyy', { locale: fr }) : '—'}
                </td>
                <td className="py-3.5 px-3">
                  {isPending(entry) ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                      <Clock size={12} />
                      En attente
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                      Complété
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-3 font-mono text-blue-500 dark:text-blue-400">
                  {entry.deposit?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
                </td>
                <td className="py-3.5 px-3 font-mono">
                  {entry.withdrawal != null ? (
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {entry.withdrawal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
                    </span>
                  ) : (
                    <span className="text-zinc-400 italic text-xs">—</span>
                  )}
                </td>
                <td className="py-3.5 px-3 font-mono whitespace-nowrap">
                  {entry.profit != null ? (
                    <span className={clsx('flex items-center gap-1', positive(entry) ? 'text-brand-500 dark:text-brand-400' : 'text-red-500 dark:text-red-400')}>
                      {positive(entry) ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {positive(entry) ? '+' : ''}{entry.profit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
                    </span>
                  ) : (
                    <span className="text-zinc-400 italic text-xs">—</span>
                  )}
                </td>
                <td className="py-3.5 px-3">
                  {roi(entry) !== null ? (
                    <span className={clsx('text-xs font-mono font-semibold px-2 py-0.5 rounded-full', roi(entry) >= 0 ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400' : 'bg-red-500/15 text-red-600 dark:text-red-400')}>
                      {roi(entry) >= 0 ? '+' : ''}{roi(entry).toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-zinc-400 italic text-xs">—</span>
                  )}
                </td>
                <td className="py-3.5 px-3 text-zinc-500 max-w-[160px] truncate text-xs">{entry.note || <span className="italic">—</span>}</td>
                <td className="py-3.5 pr-0 pl-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {isPending(entry) && entry.withdrawal != null && (
                      <button 
                        onClick={() => onValidate(entry)} 
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-brand-500 hover:bg-brand-500/10 transition-all"
                        title="Valider cette entrée"
                      >
                        <CheckCircle size={14} />
                      </button>
                    )}
                    <button onClick={() => onEdit(entry)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-surface-muted transition-all"><Pencil size={14} /></button>
                    <button onClick={() => onDelete(entry)} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {entries.map(entry => (
          <div key={entry.id} className="bg-surface-muted/50 border border-surface-border rounded-xl p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {entry.weekStart ? format(parseISO(entry.weekStart), 'dd MMM yyyy', { locale: fr }) : '—'}
                </p>
                {isPending(entry) ? (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                    <Clock size={10} />
                    En attente
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                    Complété
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isPending(entry) && entry.withdrawal != null && (
                  <button 
                    onClick={() => onValidate(entry)} 
                    className="p-2 rounded-lg text-zinc-400 hover:text-brand-500 hover:bg-brand-500/10 transition-all"
                  >
                    <CheckCircle size={16} />
                  </button>
                )}
                <button onClick={() => onEdit(entry)} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-surface-muted transition-all">
                  <Pencil size={16} />
                </button>
                <button onClick={() => onDelete(entry)} className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Dépôt</p>
                <p className="text-sm font-mono font-semibold text-blue-500 dark:text-blue-400">
                  {entry.deposit?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Retrait</p>
                <p className="text-sm font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                  {entry.withdrawal != null ? `${entry.withdrawal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currency}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Profit</p>
                {entry.profit != null ? (
                  <p className={clsx('text-sm font-mono font-semibold flex items-center gap-1', positive(entry) ? 'text-brand-500 dark:text-brand-400' : 'text-red-500 dark:text-red-400')}>
                    {positive(entry) ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {positive(entry) ? '+' : ''}{entry.profit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-400">—</p>
                )}
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">ROI</p>
                {roi(entry) !== null ? (
                  <span className={clsx('inline-block text-xs font-mono font-semibold px-2 py-1 rounded-lg', roi(entry) >= 0 ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400' : 'bg-red-500/15 text-red-600 dark:text-red-400')}>
                    {roi(entry) >= 0 ? '+' : ''}{roi(entry).toFixed(2)}%
                  </span>
                ) : (
                  <p className="text-sm text-zinc-400">—</p>
                )}
              </div>
            </div>

            {/* Note */}
            {entry.note && (
              <div className="pt-2 border-t border-surface-border">
                <p className="text-xs text-zinc-500">Note : <span className="text-zinc-600 dark:text-zinc-400">{entry.note}</span></p>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}