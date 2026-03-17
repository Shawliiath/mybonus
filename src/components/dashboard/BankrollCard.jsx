import { useState } from 'react'
import { Wallet, Pencil, Check, X, TrendingUp, TrendingDown } from 'lucide-react'
import clsx from 'clsx'
import { fmtNoSign, fmt } from '../../utils/stats'

export default function BankrollCard({ bankroll, netProfit, currency, onUpdate, loading }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState('')
  const [saving, setSaving]   = useState(false)

  // bankroll.amount = capital de base saisi manuellement
  // bankrollTotal = capital de base + profits nets automatiques
  const baseAmount    = bankroll?.amount ?? 0
  const bankrollTotal = baseAmount + (netProfit || 0)
  const isPositive    = bankrollTotal >= 0

  const handleEdit = () => {
    setValue(baseAmount.toString())
    setEditing(true)
  }

  const handleSave = async () => {
    const parsed = parseFloat(value)
    if (isNaN(parsed) || parsed < 0) return
    setSaving(true)
    try { await onUpdate(parsed) } catch (_) {}
    setSaving(false)
    setEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter')  handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div className={clsx(
      'bg-surface-card rounded-2xl p-5 border col-span-2 lg:col-span-1',
      isPositive ? 'border-brand-500/30' : 'border-red-500/30'
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', isPositive ? 'bg-brand-500/10' : 'bg-red-500/10')}>
            <Wallet size={17} className={isPositive ? 'text-brand-400' : 'text-red-400'} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Bankroll totale</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">Base + profits nets</p>
          </div>
        </div>
        {!editing && (
          <button onClick={handleEdit} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-muted transition-all">
            <Pencil size={13} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-8 w-32 bg-surface-muted rounded-lg animate-pulse" />
      ) : (
        <p className={clsx('text-3xl font-bold font-mono tracking-tight mb-1', isPositive ? 'text-white' : 'text-red-400')}>
          {fmtNoSign(bankrollTotal, currency)}
        </p>
      )}

      {/* Détail */}
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-600">Base:</span>
          <span className="text-xs font-mono text-zinc-400">{fmtNoSign(baseAmount, currency)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {netProfit >= 0 ? <TrendingUp size={10} className="text-brand-400" /> : <TrendingDown size={10} className="text-red-400" />}
          <span className="text-[10px] text-zinc-600">Profits nets:</span>
          <span className={clsx('text-xs font-mono', netProfit >= 0 ? 'text-brand-400' : 'text-red-400')}>
            {fmt(netProfit, currency)}
          </span>
        </div>
      </div>

      {/* Inline edit */}
      {editing && (
        <div className="mt-4 flex items-center gap-2 animate-slide-up">
          <div className="flex-1 relative">
            <Wallet size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder="Montant de base…"
              className="w-full bg-surface-muted border border-brand-500/40 rounded-xl py-2 pl-8 pr-3 text-sm font-mono text-white focus:outline-none focus:border-brand-500 transition-all"
            />
          </div>
          <button onClick={handleSave} disabled={saving}
            className="p-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-white transition-all disabled:opacity-50">
            <Check size={14} />
          </button>
          <button onClick={() => setEditing(false)}
            className="p-2 rounded-xl bg-surface-muted hover:bg-zinc-700 text-zinc-400 transition-all">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
