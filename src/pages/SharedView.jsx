import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getUserByShareToken } from '../firebase/firestore'
import { computeStats, fmt } from '../utils/stats'
import { TrendingUp, TrendingDown, Wallet, ArrowUpCircle, Target, BarChart2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import clsx from 'clsx'

function fmtEur(v) {
  if (v === null || v === undefined || isNaN(v)) return '—'
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

const CAT_LABELS = {
  fees:       { label: 'Frais',   emoji: '💸' },
  withdrawal: { label: 'Retrait', emoji: '🏦' },
  taxes:      { label: 'Impôts',  emoji: '📋' },
  other:      { label: 'Autre',   emoji: '📌' },
}

export default function SharedView() {
  const { token } = useParams()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    getUserByShareToken(token)
      .then(res => { if (!res) setError('Lien invalide ou expiré.'); else setData(res) })
      .catch(() => setError('Impossible de charger les données.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="flex items-center gap-3 text-zinc-400">
        <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        Chargement…
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <p className="text-zinc-400 text-sm">{error}</p>
      </div>
    </div>
  )

  const { user, settings, entries, expenses, cryptoSnapshot } = data
  const currency  = user.preferences?.currency || '€'
  const name      = user.displayName || 'Anonyme'
  const stats     = computeStats(entries, expenses)
  const bankroll  = user.bankroll?.amount ?? 0
  const cryptoTotal = cryptoSnapshot?.totalValueEur ?? 0

  // Bankroll totale = capital de départ + profits nets + crypto
  const totalWealth = bankroll + stats.netProfit + (settings.showCrypto ? cryptoTotal : 0)

  // Objectif du mois
  const monthlyGoal = user.preferences?.monthlyGoal ?? 0
  const now = new Date()
  const currentMonthProfit = entries
    .filter(e => e.status !== 'pending' && e.weekStart)
    .filter(e => {
      const d = new Date(e.weekStart)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, e) => s + (e.profit || 0), 0)
  const goalPct = monthlyGoal > 0 ? Math.min((currentMonthProfit / monthlyGoal) * 100, 100) : 0

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-2xl mx-auto px-5 py-12 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/30">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{name}</h1>
            <p className="text-xs text-zinc-500">Stats MyBonus · lecture seule</p>
          </div>
        </div>

        {/* Bankroll totale — même rendu que la BankrollCard du dashboard */}
        {settings.showBankroll && (
          <div className={clsx(
            'bg-surface-card rounded-2xl p-5 border',
            (bankroll + stats.netProfit) >= 0 ? 'border-brand-500/30' : 'border-red-500/30'
          )}>
            <div className="flex items-center gap-2 mb-4">
              <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', (bankroll + stats.netProfit) >= 0 ? 'bg-brand-500/10' : 'bg-red-500/10')}>
                <Wallet size={17} className={(bankroll + stats.netProfit) >= 0 ? 'text-brand-400' : 'text-red-400'} />
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Bankroll totale</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Base + profits nets</p>
              </div>
            </div>
            <p className={clsx('text-2xl sm:text-3xl font-bold font-mono tracking-tight whitespace-nowrap', (bankroll + stats.netProfit) >= 0 ? 'text-white' : 'text-red-400')}>
              {(bankroll + stats.netProfit) < 0 ? '-' : ''}{Math.abs(bankroll + stats.netProfit).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
            </p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-[10px] text-zinc-600">Base: <span className="text-xs font-mono text-zinc-400">{bankroll.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}</span></span>
              <span className="text-[10px] text-zinc-600">Profits nets: <span className={clsx('text-xs font-mono', stats.netProfit >= 0 ? 'text-brand-400' : 'text-red-400')}>{stats.netProfit >= 0 ? '+' : ''}{stats.netProfit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}</span></span>
            </div>
          </div>
        )}

        {/* KPIs */}
        {settings.showStats && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Profit net',  value: fmt(stats.netProfit, currency),  color: stats.netProfit >= 0 ? 'text-brand-400' : 'text-red-400' },
              { label: 'ROI moyen',   value: `${stats.avgRoi >= 0 ? '+' : ''}${stats.avgRoi.toFixed(2)}%`, color: stats.avgRoi >= 0 ? 'text-brand-400' : 'text-red-400' },
              { label: 'Win rate',    value: `${stats.winRate.toFixed(0)}%`,   color: 'text-amber-400' },
              { label: 'Semaines',    value: stats.weekCount,                  color: 'text-zinc-300' },
            ].map(k => (
              <div key={k.label} className="bg-surface-card border border-surface-border rounded-2xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2">{k.label}</p>
                <p className={clsx('text-2xl font-bold font-mono', k.color)}>{k.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Objectif mensuel */}
        {settings.showGoal && monthlyGoal > 0 && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target size={14} className="text-amber-400" />
                <p className="text-sm font-semibold text-zinc-400">Objectif du mois</p>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-mono">
                <span className={currentMonthProfit >= 0 ? 'text-brand-400' : 'text-red-400'}>
                  {currentMonthProfit >= 0 ? '+' : ''}{fmtEur(currentMonthProfit)}
                </span>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-500">{fmtEur(monthlyGoal)}</span>
              </div>
            </div>
            <div className="w-full h-2 bg-surface-muted rounded-full overflow-hidden">
              <div className={clsx('h-full rounded-full transition-all', goalPct >= 100 ? 'bg-amber-400' : 'bg-brand-500')}
                style={{ width: `${Math.max(goalPct, 0)}%` }} />
            </div>
            <p className="text-xs text-zinc-600 mt-1.5">
              {goalPct >= 100 ? '🎉 Objectif atteint !' : `${goalPct.toFixed(0)}%`}
            </p>
          </div>
        )}

        {/* Portfolio crypto */}
        {settings.showCrypto && cryptoSnapshot && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart2 size={14} className="text-brand-400" />
                <p className="text-sm font-semibold text-zinc-400">Portfolio Crypto</p>
              </div>
              <p className="text-sm font-bold font-mono text-white">{fmtEur(cryptoTotal)}</p>
            </div>
            <div className="divide-y divide-surface-border">
              {(cryptoSnapshot.assets ?? [])
                .filter(a => (a.valueEur ?? 0) > 0.01)
                .map((asset, i) => {
                  const chainLabel = asset.chain === 'sol' ? '◎' : asset.chain === 'btc' ? '₿' : 'Ξ'
                  const chainColor = asset.chain === 'sol' ? 'text-purple-400' : asset.chain === 'btc' ? 'text-amber-400' : 'text-blue-400'
                  const isUp = (asset.change24h ?? 0) >= 0
                  const weight = cryptoTotal > 0 ? (asset.valueEur / cryptoTotal) * 100 : 0
                  return (
                    <div key={i} className="flex items-center gap-3 py-3">
                      <div className="w-9 h-9 rounded-xl bg-surface-muted flex items-center justify-center shrink-0 font-bold text-xs text-zinc-300">
                        {asset.symbol.slice(0, 3)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <p className="text-sm font-semibold text-white truncate">{asset.name}</p>
                          <span className={clsx('text-xs font-bold shrink-0', chainColor)}>{chainLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-zinc-500 font-mono">
                            {asset.balance?.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} {asset.symbol}
                          </p>
                          {weight > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-10 h-1 bg-zinc-700 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-500/60 rounded-full" style={{ width: `${Math.min(weight, 100)}%` }} />
                              </div>
                              <span className="text-xs text-zinc-600">{weight.toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold font-mono text-white">{fmtEur(asset.valueEur)}</p>
                        {asset.change24h != null && (
                          <p className={clsx('text-xs font-mono mt-0.5', isUp ? 'text-emerald-400' : 'text-red-400')}>
                            {isUp ? '▲' : '▼'} {Math.abs(asset.change24h).toFixed(2)}%
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
            {cryptoSnapshot.updatedAt && (
              <p className="text-xs text-zinc-700 mt-3 pt-3 border-t border-surface-border">
                Snapshot du {new Date(cryptoSnapshot.updatedAt).toLocaleDateString('fr-FR')} à {new Date(cryptoSnapshot.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}

        {/* Historique entrées */}
        {settings.showHistory && entries.length > 0 && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-zinc-400 mb-4">
              Historique <span className="text-zinc-600">({entries.length} semaine{entries.length > 1 ? 's' : ''})</span>
            </h2>
            <div className="space-y-0 max-h-96 overflow-y-auto divide-y divide-surface-border">
              {entries.map(e => {
                const pos = (e.profit ?? 0) >= 0
                const roi = e.deposit ? ((e.profit / e.deposit) * 100).toFixed(2) : null
                return (
                  <div key={e.id} className="flex items-center justify-between py-2.5 gap-3">
                    <span className="text-xs text-zinc-500 shrink-0">
                      {e.weekStart ? format(parseISO(e.weekStart), 'dd MMM yyyy', { locale: fr }) : '—'}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {roi && (
                        <span className={clsx('text-xs font-mono px-2 py-0.5 rounded-full', pos ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400')}>
                          {pos ? '+' : ''}{roi}%
                        </span>
                      )}
                      <span className={clsx('text-sm font-mono font-semibold', pos ? 'text-brand-400' : 'text-red-400')}>
                        {pos ? '+' : ''}{e.profit?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Sorties */}
        {settings.showExpenses && expenses.length > 0 && (
          <div className="bg-surface-card border border-red-500/15 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <ArrowUpCircle size={14} className="text-red-400" />
              <h2 className="text-sm font-semibold text-zinc-400">
                Sorties <span className="text-zinc-600">({expenses.length})</span>
              </h2>
            </div>
            <div className="divide-y divide-surface-border">
              {expenses.map(exp => {
                const cat = CAT_LABELS[exp.category] || CAT_LABELS.other
                return (
                  <div key={exp.id} className="flex items-center justify-between py-2.5 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-zinc-500 shrink-0">
                        {exp.date ? new Date(exp.date).toLocaleDateString('fr-FR') : '—'}
                      </span>
                      <span className="text-xs text-zinc-500">{cat.emoji} {cat.label}</span>
                    </div>
                    <span className="text-sm font-mono font-semibold text-red-400 shrink-0">
                      -{exp.amount?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-surface-border flex justify-between">
              <span className="text-xs text-zinc-500">Total sorties</span>
              <span className="text-sm font-mono font-semibold text-red-400">
                -{stats.totalExpenses.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
              </span>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-zinc-700 pt-2">Partagé via MyBonus</p>
      </div>
    </div>
  )
}
