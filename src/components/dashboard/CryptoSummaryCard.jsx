import { Link } from 'react-router-dom'
import { useWalletContext } from '../../context/WalletContext'
import { Wallet, TrendingUp, TrendingDown, ExternalLink, RefreshCw, ChevronRight, Globe } from 'lucide-react'
import clsx from 'clsx'

function fmtEur(v) {
  if (v === null || v === undefined || isNaN(v)) return '—'
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function CryptoSummaryCard() {
  const { eth, solana } = useWalletContext()
  const { address, walletData, loading, refresh } = eth
  const { address: solAddress, solanaData, loading: solLoading, refresh: solRefresh } = solana

  const hasAny = address || solAddress

  // Aucun wallet connecté
  if (!hasAny) {
    return (
      <Link to="/portfolio"
        className="bg-surface-card border border-surface-border hover:border-brand-500/30 rounded-2xl p-5 flex items-center gap-4 transition-all group">
        <div className="w-10 h-10 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-center shrink-0">
          <Wallet size={18} className="text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Portfolio Crypto</p>
          <p className="text-xs text-zinc-500 mt-0.5">Connecte ton wallet →</p>
        </div>
        <ChevronRight size={16} className="text-zinc-600 group-hover:text-brand-400 transition-colors" />
      </Link>
    )
  }

  const ethTotal  = walletData?.totalValueEur ?? 0
  const solTotal  = solanaData?.totalValueEur ?? 0
  const combined  = ethTotal + solTotal
  const isUp      = (walletData?.ethPrice?.change24h ?? 0) >= 0
  const isLoading = (loading && !walletData) || (solLoading && !solanaData)

  // Compte les actifs
  const ethAssets = walletData ? walletData.tokens.length + 1 : 0
  const solAssets = solanaData ? solanaData.splTokens.length + 1 : 0
  const totalAssets = ethAssets + solAssets

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet size={14} className="text-brand-400" />
          <h3 className="text-sm font-semibold text-zinc-400">Portfolio Multi-chain</h3>
          {solAddress && (
            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Globe size={9} />SOL
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => { refresh(); if (solAddress) solRefresh() }} disabled={loading || solLoading}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-surface-muted transition-all">
            <RefreshCw size={13} className={clsx((loading || solLoading) && 'animate-spin')} />
          </button>
          <Link to="/portfolio"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-brand-400 hover:bg-surface-muted transition-all">
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="h-12 bg-surface-muted rounded-xl animate-pulse" />
      ) : (
        <div className="flex items-end justify-between">
          <div>
            {/* Valeur totale combinée */}
            <p className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {fmtEur(combined)}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* ETH */}
              {walletData && (
                <span className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                  <span className="text-blue-400">Ξ</span>
                  {fmtEur(ethTotal)}
                </span>
              )}
              {walletData && solanaData && (
                <span className="text-zinc-700 text-xs">·</span>
              )}
              {/* SOL */}
              {solanaData && (
                <span className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                  <span className="text-purple-400">◎</span>
                  {fmtEur(solTotal)}
                </span>
              )}
            </div>
            {totalAssets > 0 && (
              <p className="text-xs text-zinc-600 mt-0.5">
                {totalAssets} actif{totalAssets > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Variation ETH 24h */}
          {walletData && (
            <div className="text-right">
              <span className={clsx(
                'inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-lg',
                isUp ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'
              )}>
                {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {isUp ? '+' : ''}{walletData.ethPrice.change24h?.toFixed(2)}%
              </span>
              <p className="text-xs text-zinc-600 mt-1">{fmtEur(walletData.ethPrice.eur)} / ETH</p>
              {solanaData && (
                <p className="text-xs text-zinc-600">{fmtEur(solanaData.solPrice.eur)} / SOL</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
