import { useState, useEffect } from 'react'
import { X, Calendar, TrendingUp, ArrowDownCircle, FileText, Clock } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'

const DEFAULT_FORM = {
  weekStart: format(new Date(), 'yyyy-MM-dd'),
  deposit:   '',
  profit:    '',
  note:      '',
  status:    'confirmed', // 'confirmed' | 'pending'
}

export default function EntryModal({ open, onClose, onSubmit, initial = null }) {
  const [form,    setForm]    = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        weekStart: initial.weekStart?.slice(0, 10) ?? format(new Date(), 'yyyy-MM-dd'),
        deposit:   initial.deposit ?? '',
        profit:    initial.profit  ?? '',
        note:      initial.note    ?? '',
        status:    initial.status  ?? 'confirmed',
      } : DEFAULT_FORM)
      setError('')
    }
  }, [open, initial])

  if (!open) return null
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const deposit = parseFloat(form.deposit)
    const profit  = parseFloat(form.profit)
    if (!form.weekStart)  { setError('Sélectionne une date.'); return }
    if (isNaN(deposit))   { setError('Dépôt invalide.'); return }
    if (isNaN(profit))    { setError('Profit invalide.'); return }
    setLoading(true)
    try {
      await onSubmit({ weekStart: form.weekStart, deposit, profit, note: form.note, status: form.status })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const roi = (() => {
    const d = parseFloat(form.deposit), p = parseFloat(form.profit)
    if (!d || isNaN(p)) return null
    return ((p / d) * 100).toFixed(2)
  })()

  const inputClass = 'w-full bg-surface-muted border border-surface-border rounded-xl py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30 transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card border border-surface-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl animate-slide-up">

        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-surface-border">
          <h2 className="font-semibold text-zinc-900 dark:text-white">
            {initial ? "Modifier l'entrée" : 'Nouvelle entrée'}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-surface-muted">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">

          {/* Statut pending / confirmé */}
          <div className="flex rounded-xl overflow-hidden border border-surface-border bg-surface-muted">
            <button type="button" onClick={() => set('status', 'confirmed')}
              className={clsx('flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all',
                form.status === 'confirmed'
                  ? 'bg-brand-500/20 text-brand-400'
                  : 'text-zinc-500 hover:text-zinc-300')}>
              <TrendingUp size={14} />Confirmé
            </button>
            <button type="button" onClick={() => set('status', 'pending')}
              className={clsx('flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all',
                form.status === 'pending'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300')}>
              <Clock size={14} />En attente
            </button>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-1.5">Weekend du</label>
            <div className="relative">
              <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="date" value={form.weekStart} onChange={e => set('weekStart', e.target.value)}
                className={clsx(inputClass, 'pl-9 pr-4')} required />
            </div>
          </div>

          {/* Dépôt + Profit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1.5">Dépôt</label>
              <div className="relative">
                <ArrowDownCircle size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
                <input type="number" step="0.01" placeholder="0.00" value={form.deposit}
                  onChange={e => set('deposit', e.target.value)}
                  className={clsx(inputClass, 'pl-9 pr-3 font-mono')} required />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1.5">
                {form.status === 'pending' ? 'Profit estimé' : 'Profit'}
              </label>
              <div className="relative">
                <TrendingUp size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500" />
                <input type="number" step="0.01" placeholder="0.00" value={form.profit}
                  onChange={e => set('profit', e.target.value)}
                  className={clsx(inputClass, 'pl-9 pr-3 font-mono')} required />
              </div>
            </div>
          </div>

          {/* ROI calculé */}
          {roi !== null && (
            <div className={clsx('flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-mono',
              parseFloat(roi) >= 0
                ? 'bg-brand-500/10 border-brand-500/20 text-brand-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400')}>
              <span className="text-xs text-zinc-500">ROI calculé</span>
              <span className="font-semibold">{parseFloat(roi) >= 0 ? '+' : ''}{roi}%</span>
            </div>
          )}

          {/* Pending info */}
          {form.status === 'pending' && (
            <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
              <Clock size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-400/80">
                Cette entrée sera marquée "en attente". Tu pourras la confirmer ou l'annuler depuis l'historique une fois ton retrait reçu.
              </p>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-1.5">Note (optionnel)</label>
            <div className="relative">
              <FileText size={15} className="absolute left-3 top-3 text-zinc-400" />
              <textarea placeholder="Observations, stratégie…" value={form.note}
                onChange={e => set('note', e.target.value)} rows={2}
                className={clsx(inputClass, 'pl-9 pr-3 resize-none')} />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 bg-surface-muted hover:opacity-80 border border-surface-border rounded-xl py-2.5 text-sm font-medium transition-all text-zinc-300">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className={clsx('flex-1 font-semibold rounded-xl py-2.5 text-sm transition-all disabled:opacity-50',
                form.status === 'pending'
                  ? 'bg-amber-500 hover:bg-amber-400 text-black'
                  : 'bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/25')}>
              {loading ? 'Enregistrement…' : initial ? 'Modifier' : form.status === 'pending' ? 'Ajouter (en attente)' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
