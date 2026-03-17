import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getUserByShareToken } from '../firebase/firestore'
import { computeStats, fmt, fmtNoSign } from '../utils/stats'
import { TrendingUp, TrendingDown, Percent, Trophy, Wallet } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

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

  const { user, entries, expenses } = data
  const currency = user.preferences?.currency || '€'
  const name     = user.displayName || 'Anonyme'
  const stats    = computeStats(entries, expenses)

  const kpis = [
    { label: 'Profit net',  value: fmt(stats.netProfit,     currency), color: stats.netProfit >= 0 ? 'text-brand-400' : 'text-red-400' },
    { label: 'ROI moyen',   value: `${stats.avgRoi >= 0 ? '+' : ''}${stats.avgRoi.toFixed(2)}%`, color: stats.avgRoi >= 0 ? 'text-brand-400' : 'text-red-400' },
    { label: 'Win rate',    value: `${stats.winRate.toFixed(0)}%`, color: 'text-amber-400' },
    { label: 'Semaines',    value: stats.weekCount, color: 'text-zinc-300' },
  ]

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-2xl mx-auto px-5 py-12 space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/30">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{name}</h1>
            <p className="text-xs text-zinc-500">Stats MyBonus · lecture seule</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          {kpis.map(k => (
            <div key={k.label} className="bg-surface-card border border-surface-border rounded-2xl p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2">{k.label}</p>
              <p className={`text-2xl font-bold font-mono ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Entrées */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-zinc-400 mb-4">Historique ({entries.length} semaines)</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {entries.map(e => {
              const pos = e.profit >= 0
              const roi = e.deposit ? ((e.profit / e.deposit) * 100).toFixed(2) : null
              return (
                <div key={e.id} className="flex items-center justify-between py-2.5 border-b border-surface-border last:border-0">
                  <span className="text-xs text-zinc-500">
                    {e.weekStart ? format(parseISO(e.weekStart), 'dd MMM yyyy', { locale: fr }) : '—'}
                  </span>
                  <div className="flex items-center gap-3">
                    {roi && (
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${pos ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'}`}>
                        {pos ? '+' : ''}{roi}%
                      </span>
                    )}
                    <span className={`text-sm font-mono font-semibold ${pos ? 'text-brand-400' : 'text-red-400'}`}>
                      {pos ? '+' : ''}{e.profit?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-center text-xs text-zinc-700">Partagé via MyBonus</p>
      </div>
    </div>
  )
}
