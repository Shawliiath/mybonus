import { useState, useEffect } from 'react'
import { X, Calendar, TrendingUp, ArrowDownCircle, ArrowUpCircle, FileText, Clock, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'

const DEFAULT_FORM = { weekStart: format(new Date(), 'yyyy-MM-dd'), deposit: '', withdrawal: '', note: '', status: 'pending' }

export default function EntryModal({ open, onClose, onSubmit, initial = null }) {
  const [form, setForm]       = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (open) {
      if (initial) {
        const status = initial.status || 'completed'
        setForm({
          weekStart: initial.weekStart?.slice(0, 10) ?? format(new Date(), 'yyyy-MM-dd'),
          deposit: initial.deposit ?? '',
          withdrawal: initial.withdrawal ?? (initial.profit !== undefined && initial.deposit !== undefined ? initial.deposit + initial.profit : ''),
          note: initial.note ?? '',
          status
        })
      } else {
        setForm(DEFAULT_FORM)
      }
      setError('')
    }
  }, [open, initial])

  if (!open) return null
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const deposit = parseFloat(form.deposit)
    
    if (!form.weekStart) { setError('Sélectionne une date.'); return }
    if (isNaN(deposit))  { setError('Dépôt invalide.'); return }
    
    const withdrawal = form.withdrawal ? parseFloat(form.withdrawal) : null
    if (withdrawal !== null && isNaN(withdrawal)) { setError('Retrait invalide.'); return }
    
    const profit = withdrawal !== null ? withdrawal - deposit : null
    
    setLoading(true)
    try { 
      await onSubmit({ 
        weekStart: form.weekStart, 
        deposit, 
        withdrawal,
        profit, 
        note: form.note,
        status: form.status
      })
      onClose() 
    }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const calculatedProfit = (() => {
    const d = parseFloat(form.deposit), w = parseFloat(form.withdrawal)
    if (!d || isNaN(w)) return null
    return w - d
  })()

  const roi = (() => {
    if (calculatedProfit === null || !parseFloat(form.deposit)) return null
    return ((calculatedProfit / parseFloat(form.deposit)) * 100).toFixed(2)
  })()

  const inputClass = "w-full bg-surface-muted border border-surface-border rounded-xl py-2.5 px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30 transition-all"

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card border-t sm:border border-surface-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl animate-slide-up max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-surface-border sticky top-0 bg-surface-card z-10">
          <h2 className="font-semibold text-base sm:text-lg text-zinc-900 dark:text-white">{initial ? "Modifier l'entrée" : 'Nouvelle entrée'}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-2 -mr-2 rounded-lg hover:bg-surface-muted">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-1.5">Weekend du</label>
            <div className="relative">
              <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="date" value={form.weekStart} onChange={e => set('weekStart', e.target.value)}
                className={clsx(inputClass, 'pl-9 pr-4')} required />
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-2">Statut</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => set('status', 'pending')}
                className={clsx(
                  'flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all',
                  form.status === 'pending'
                    ? 'bg-orange-500/10 border-orange-500/40 text-orange-600 dark:text-orange-400'
                    : 'bg-surface-muted border-surface-border text-zinc-500 hover:border-orange-500/40'
                )}
              >
                <Clock size={16} />
                En attente
              </button>
              <button
                type="button"
                onClick={() => set('status', 'completed')}
                className={clsx(
                  'flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all',
                  form.status === 'completed'
                    ? 'bg-brand-500/10 border-brand-500/40 text-brand-600 dark:text-brand-400'
                    : 'bg-surface-muted border-surface-border text-zinc-500 hover:border-brand-500/40'
                )}
              >
                <CheckCircle size={16} />
                Complété
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1.5">Dépôt (€)</label>
              <div className="relative">
                <ArrowDownCircle size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
                <input type="number" step="0.01" placeholder="0.00" value={form.deposit} onChange={e => set('deposit', e.target.value)}
                  className={clsx(inputClass, 'pl-9 pr-3 font-mono')} required />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1.5">Retrait (€)</label>
              <div className="relative">
                <ArrowUpCircle size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500" />
                <input type="number" step="0.01" placeholder="0.00" value={form.withdrawal} onChange={e => set('withdrawal', e.target.value)}
                  className={clsx(inputClass, 'pl-9 pr-3 font-mono')} />
              </div>
            </div>
          </div>

          {calculatedProfit !== null && (
            <div className={clsx('flex items-center justify-between px-4 py-3 rounded-xl border text-sm',
              calculatedProfit >= 0 ? 'bg-brand-500/10 border-brand-500/20' : 'bg-red-500/10 border-red-500/20')}>
              <span className="text-xs text-zinc-500">Profit calculé</span>
              <span className={clsx('font-mono font-semibold', calculatedProfit >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400')}>
                {calculatedProfit >= 0 ? '+' : ''}{calculatedProfit.toFixed(2)} €
              </span>
            </div>
          )}

          {roi !== null && (
            <div className={clsx('flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-mono',
              parseFloat(roi) >= 0 ? 'bg-brand-500/10 border-brand-500/20 text-brand-600 dark:text-brand-400' : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400')}>
              <span className="text-xs text-zinc-500">ROI calculé</span>
              <span className="font-semibold">{parseFloat(roi) >= 0 ? '+' : ''}{roi}%</span>
            </div>
          )}

          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-1.5">Note (optionnel)</label>
            <div className="relative">
              <FileText size={15} className="absolute left-3 top-3 text-zinc-400" />
              <textarea placeholder="Observations, stratégie…" value={form.note} onChange={e => set('note', e.target.value)} rows={2}
                className={clsx(inputClass, 'pl-9 pr-3 resize-none')} />
            </div>
          </div>
          {error && <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1 pb-safe">
            <button type="button" onClick={onClose} className="flex-1 bg-surface-muted hover:opacity-80 border border-surface-border rounded-xl py-3 text-sm font-medium transition-all text-zinc-700 dark:text-zinc-300">
              Annuler
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl py-3 text-sm transition-all shadow-lg shadow-brand-500/25 disabled:opacity-50">
              {loading ? 'Enregistrement…' : initial ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}