import { Link } from 'react-router-dom'
import { useWalletContext } from '../../context/WalletContext'
import { Wallet, TrendingUp, TrendingDown, ExternalLink, RefreshCw, ChevronRight, Globe } from 'lucide-react'
import clsx from 'clsx'

function fmtEur(v) {
  if (v === null || v === undefined || isNaN(v)) return '—'
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function CryptoSummaryCard() {
  const { eth, solana, bitcoin } = useWalletContext()
  const { address, walletData, loading, refresh } = eth
  const { address: solAddress, solanaData, loading: solLoading, refresh: solRefresh } = solana
  const { address: btcAddress, bitcoinData, loading: btcLoading, refresh: btcRefresh } = bitcoin

  const hasAny = address || solAddress || btcAddress

  if (!hasAny) {
    return (
      <div className="flex gap-3">
        <Link to="/market"
          className="flex-1 bg-surface-card border border-surface-border hover:border-brand-500/30 rounded-2xl p-4 flex items-center gap-3 transition-all group">
          <div className="w-9 h-9 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Globe size={16} className="text-brand-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Marchés</p>
            <p className="text-xs text-zinc-500 mt-0.5">BTC, ETH, SOL…</p>
          </div>
          <ChevronRight size={14} className="text-zinc-600 group-hover:text-brand-400 transition-colors" />
        </Link>
        <Link to="/portfolio"
          className="flex-1 bg-surface-card border border-surface-border hover:border-brand-500/30 rounded-2xl p-4 flex items-center gap-3 transition-all group">
          <div className="w-9 h-9 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Wallet size={16} className="text-brand-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Portfolio</p>
            <p className="text-xs text-zinc-500 mt-0.5">Connecte ton wallet</p>
          </div>
          <ChevronRight size={14} className="text-zinc-600 group-hover:text-brand-400 transition-colors" />
        </Link>
      </div>
    )
  }

  const ethTotal  = walletData?.totalValueEur  ?? 0
  const solTotal  = solanaData?.totalValueEur  ?? 0
  const btcTotal  = bitcoinData?.totalValueEur ?? 0
  const combined  = ethTotal + solTotal + btcTotal
  const isUp      = (walletData?.ethPrice?.change24h ?? 0) >= 0

  // isLoading : seulement si une chain est active ET en cours de chargement sans data encore
  const isLoading = (address && loading && !walletData)
                 || (solAddress && solLoading && !solanaData)
                 || (btcAddress && btcLoading && !bitcoinData)

  const ethAssets   = walletData  ? walletData.tokens.length + 1    : 0
  const solAssets   = solanaData  ? solanaData.splTokens.length + 1 : 0
  const btcAssets   = bitcoinData ? 1 : 0
  const totalAssets = ethAssets + solAssets + btcAssets

  const handleRefresh = () => {
    if (address)    refresh()
    if (solAddress) solRefresh()
    if (btcAddress) btcRefresh()
  }

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Wallet size={14} className="text-brand-400" />
          <h3 className="text-sm font-semibold text-zinc-400">Portfolio Multi-chain</h3>
          {solAddress && (
            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Globe size={9} />SOL
            </span>
          )}
          {btcAddress && (
            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">
              ₿ BTC
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleRefresh} disabled={loading || solLoading || btcLoading}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-surface-muted transition-all">
            <RefreshCw size={13} className={clsx((loading || solLoading || btcLoading) && 'animate-spin')} />
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
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {fmtEur(combined)}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {walletData && (
                <span className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                  <span className="text-blue-400">Ξ</span>{fmtEur(ethTotal)}
                </span>
              )}
              {walletData && (solanaData || bitcoinData) && <span className="text-zinc-600 text-xs">·</span>}
              {solanaData && (
                <span className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                  <span className="text-purple-400">◎</span>{fmtEur(solTotal)}
                </span>
              )}
              {solanaData && bitcoinData && <span className="text-zinc-600 text-xs">·</span>}
              {bitcoinData && (
                <span className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                  <span className="text-amber-400">₿</span>{fmtEur(btcTotal)}
                </span>
              )}
            </div>
            {totalAssets > 0 && (
              <p className="text-xs text-zinc-600 mt-0.5">
                {totalAssets} actif{totalAssets > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Variations 24h */}
          <div className="text-right shrink-0">
            {walletData && (
              <>
                <span className={clsx(
                  'inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-lg',
                  isUp ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'
                )}>
                  {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {isUp ? '+' : ''}{walletData.ethPrice?.change24h?.toFixed(2)}%
                </span>
                <p className="text-xs text-zinc-600 mt-1">{fmtEur(walletData.ethPrice?.eur)} / ETH</p>
              </>
            )}
            {solanaData && (
              <p className="text-xs text-zinc-600">{fmtEur(solanaData.solPrice?.eur)} / SOL</p>
            )}
            {bitcoinData && (
              <p className="text-xs text-zinc-600">{fmtEur(bitcoinData.btcPrice?.eur)} / BTC</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
