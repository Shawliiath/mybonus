import { Link } from 'react-router-dom'
import { useWalletContext } from '../../context/WalletContext'
import { Wallet, TrendingUp, TrendingDown, ExternalLink, RefreshCw, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

function fmtEur(v) {
  if (v === null || v === undefined || isNaN(v)) return '—'
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function CryptoSummaryCard() {
  // Lit directement le wallet déjà chargé dans Portfolio — aucun fetch supplémentaire
  const { address, walletData, loading, refresh } = useWalletContext()

  // Pas d'adresse configurée
  if (!address) {
    return (
      <Link to="/portfolio"
        className="bg-surface-card border border-surface-border hover:border-brand-500/30 rounded-2xl p-5 flex items-center gap-4 transition-all group">
        <div className="w-10 h-10 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-center shrink-0">
          <Wallet size={18} className="text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Portfolio Crypto</p>
          <p className="text-xs text-zinc-500 mt-0.5">Connecte ton wallet ETH →</p>
        </div>
        <ChevronRight size={16} className="text-zinc-600 group-hover:text-brand-400 transition-colors" />
      </Link>
    )
  }

  const d    = walletData
  const isUp = (d?.ethPrice?.change24h ?? 0) >= 0

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet size={14} className="text-brand-400" />
          <h3 className="text-sm font-semibold text-zinc-400">Portfolio ETH</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={refresh} disabled={loading}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-surface-muted transition-all">
            <RefreshCw size={13} className={clsx(loading && 'animate-spin')} />
          </button>
          <Link to="/portfolio"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-brand-400 hover:bg-surface-muted transition-all">
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>

      {loading && !d ? (
        <div className="h-12 bg-surface-muted rounded-xl animate-pulse" />
      ) : d ? (
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {fmtEur(d.totalValueEur)}
            </p>
            <p className="text-xs text-zinc-500 mt-1 font-mono">
              {d.ethBalance.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 6 })} ETH
              {d.tokens.length > 0 && ` · ${d.tokens.length} token${d.tokens.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="text-right">
            <span className={clsx(
              'inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-lg',
              isUp ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'
            )}>
              {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {isUp ? '+' : ''}{d.ethPrice.change24h?.toFixed(2)}%
            </span>
            <p className="text-xs text-zinc-600 mt-1">{fmtEur(d.ethPrice.eur)} / ETH</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Chargement…</p>
      )}
    </div>
  )
}
