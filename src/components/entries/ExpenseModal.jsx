import { useState, useEffect } from 'react'
import { X, Calendar, ArrowUpCircle, FileText, Tag } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'

const CATEGORIES = [
  { value: 'fees',       label: 'Frais', emoji: '💸' },
  { value: 'withdrawal', label: 'Retrait', emoji: '🏦' },
  { value: 'taxes',      label: 'Impôts', emoji: '📋' },
  { value: 'other',      label: 'Autre', emoji: '📌' },
]

const DEFAULT_FORM = {
  date:     format(new Date(), 'yyyy-MM-dd'),
  amount:   '',
  category: 'fees',
  note:     '',
}

export default function ExpenseModal({ open, onClose, onSubmit, initial = null, currency = '€' }) {
  const [form, setForm]       = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        date:     initial.date?.slice(0, 10) ?? format(new Date(), 'yyyy-MM-dd'),
        amount:   initial.amount ?? '',
        category: initial.category ?? 'fees',
        note:     initial.note ?? '',
      } : DEFAULT_FORM)
      setError('')
    }
  }, [open, initial])

  if (!open) return null
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.date)      { setError('Sélectionne une date.'); return }
    if (isNaN(amount) || amount <= 0) { setError('Montant invalide.'); return }
    setLoading(true)
    try {
      await onSubmit({ date: form.date, amount, category: form.category, note: form.note })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full bg-surface-muted border border-surface-border rounded-xl py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card border border-surface-border rounded-2xl w-full max-w-md shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-red-500/15 rounded-lg flex items-center justify-center">
              <ArrowUpCircle size={14} className="text-red-400" />
            </div>
            <h2 className="font-semibold text-zinc-900 dark:text-white">
              {initial ? 'Modifier la sortie' : 'Nouvelle sortie'}
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-surface-muted">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Catégorie */}
          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-2">Catégorie</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => set('category', cat.value)}
                  className={clsx(
                    'flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all',
                    form.category === cat.value
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-surface-muted border-surface-border text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  )}
                >
                  <span className="text-base">{cat.emoji}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date + Montant */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1.5">Date</label>
              <div className="relative">
                <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                  className={clsx(inputClass, 'pl-9 pr-3')} required />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1.5">Montant ({currency})</label>
              <div className="relative">
                <ArrowUpCircle size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400" />
                <input type="number" step="0.01" min="0" placeholder="0.00" value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  className={clsx(inputClass, 'pl-9 pr-3 font-mono')} required />
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-1.5">Note (optionnel)</label>
            <div className="relative">
              <FileText size={15} className="absolute left-3 top-3 text-zinc-400" />
              <textarea placeholder="Description, référence…" value={form.note} onChange={e => set('note', e.target.value)}
                rows={2} className={clsx(inputClass, 'pl-9 pr-3 resize-none')} />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 bg-surface-muted hover:opacity-80 border border-surface-border rounded-xl py-2.5 text-sm font-medium transition-all text-zinc-700 dark:text-zinc-300">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-xl py-2.5 text-sm transition-all disabled:opacity-50">
              {loading ? 'Enregistrement…' : initial ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
