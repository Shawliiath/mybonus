import { useState, useMemo } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useWalletContext } from '../context/WalletContext'
import { shortAddr, isValidEthAddress } from '../hooks/useWallet'
import { isValidSolAddress } from '../hooks/useSolanaWallet'
import {
  Wallet, RefreshCw, Copy, Check, ExternalLink,
  TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle,
  AlertCircle, Search, Zap, Unplug, ChevronRight, BarChart3
} from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const PIE_COLORS = ['#22c55e','#3b82f6','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#10b981','#ef4444']

function fmtEur(v) {
  if (v === null || v === undefined || isNaN(v)) return '—'
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function fmtCrypto(v, dec = 4) {
  if (!v && v !== 0) return '—'
  if (v < 0.0001) return '< 0.0001'
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: dec })
}
function pct(v, total) { return total ? (v / total) * 100 : 0 }

// ─── Icône stylisée par token ─────────────────────────────────────────────────
const TOKEN_COLORS = {
  ETH:  { bg: 'bg-blue-500/15',   text: 'text-blue-300',   border: 'border-blue-500/20' },
  SOL:  { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/20' },
  USDC: { bg: 'bg-sky-500/15',    text: 'text-sky-300',    border: 'border-sky-500/20' },
  USDT: { bg: 'bg-emerald-500/15',text: 'text-emerald-300',border: 'border-emerald-500/20' },
  WBTC: { bg: 'bg-amber-500/15',  text: 'text-amber-300',  border: 'border-amber-500/20' },
  BONK: { bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/20' },
  JUP:  { bg: 'bg-green-500/15',  text: 'text-green-300',  border: 'border-green-500/20' },
}
function tokenStyle(sym) {
  return TOKEN_COLORS[sym] ?? { bg: 'bg-zinc-500/15', text: 'text-zinc-300', border: 'border-zinc-500/20' }
}

// ─── Token Row ────────────────────────────────────────────────────────────────
function TokenRow({ symbol, name, balance, valueEur, chain, change24h, allTotal }) {
  const style    = tokenStyle(symbol)
  const isUp     = (change24h ?? 0) >= 0
  const weight   = allTotal > 0 && valueEur ? (valueEur / allTotal) * 100 : 0
  const chainLabel = chain === 'sol' ? '◎' : 'Ξ'
  const chainColor = chain === 'sol' ? 'text-purple-400' : 'text-blue-400'

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/30 transition-colors">
      {/* Icône */}
      <div className={clsx('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-bold text-sm border', style.bg, style.text, style.border)}>
        {symbol.slice(0, 3)}
      </div>

      {/* Nom + réseau + barre de poids */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{name}</p>
          <span className={clsx('text-xs font-bold shrink-0', chainColor)}>{chainLabel}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs text-zinc-500 font-mono truncate">{fmtCrypto(balance)} {symbol}</p>
          {weight > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-12 h-1 bg-surface-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-brand-500/60" style={{ width: `${Math.min(weight, 100)}%` }} />
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-600">{weight.toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Valeur + variation */}
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white font-mono">
          {valueEur != null ? fmtEur(valueEur) : <span className="text-zinc-400 text-xs">Prix indispo</span>}
        </p>
        {change24h != null ? (
          <p className={clsx('text-xs font-mono mt-0.5 font-medium', isUp ? 'text-emerald-400' : 'text-red-400')}>
            {isUp ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
          </p>
        ) : (
          <p className="text-xs text-zinc-600 mt-0.5 font-mono">{fmtCrypto(balance, 4)} {symbol}</p>
        )}
      </div>
    </div>
  )
}

// ─── Tx Row ───────────────────────────────────────────────────────────────────
function TxRow({ tx, chain }) {
  const isIn    = tx.direction === 'in'
  const isError = tx.isError
  const explorerUrl = chain === 'sol'
    ? `https://solscan.io/tx/${tx.hash}`
    : `https://etherscan.io/tx/${tx.hash}`

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/30 transition-colors group">
      <div className={clsx(
        'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border',
        isError ? 'bg-red-500/10 border-red-500/20'
        : isIn   ? 'bg-emerald-500/10 border-emerald-500/20'
                 : 'bg-orange-500/10 border-orange-500/20'
      )}>
        {isError
          ? <AlertCircle size={16} className="text-red-400" />
          : isIn
            ? <ArrowDownCircle size={16} className="text-emerald-400" />
            : <ArrowUpCircle size={16} className="text-orange-400" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            {isError ? 'Échec' : isIn ? 'Reçu' : 'Envoyé'}
          </p>
          <span className={clsx('text-xs font-bold', chain === 'sol' ? 'text-purple-400' : 'text-blue-400')}>
            {chain === 'sol' ? '◎' : 'Ξ'}
          </span>
          <span className="text-xs text-zinc-600 font-mono">
            {tx.hash?.slice(0, 8)}…
          </span>
        </div>
        <p className="text-xs text-zinc-500 font-mono">
          {isIn ? '← ' : '→ '}{shortAddr(isIn ? tx.from : tx.to)}
          {tx.timestamp > 0 && <> · {format(new Date(tx.timestamp), 'dd MMM yyyy', { locale: fr })}</>}
          {tx.gasPrice > 0 && <span className="text-zinc-700"> · {tx.gasPrice.toFixed(1)} Gwei</span>}
        </p>
      </div>

      <div className="text-right shrink-0 flex items-center gap-3">
        <div>
          <p className={clsx('text-sm font-semibold font-mono',
            isError ? 'text-red-400' : isIn ? 'text-emerald-400' : 'text-orange-400'
          )}>
            {isIn ? '+' : '-'}{fmtCrypto(tx.value, 5)} {tx.symbol ?? '?'}
          </p>
        </div>
        <a href={explorerUrl} target="_blank" rel="noreferrer"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  )
}

// ─── Écran connexion ──────────────────────────────────────────────────────────
function ConnectScreen({ onConnectWallet, onConnectManual, onConnectSolana, error, solError }) {
  const [ethInput, setEthInput] = useState('')
  const [solInput, setSolInput] = useState('')
  const [ethErr,   setEthErr]   = useState('')

  const handleEth = (e) => {
    e.preventDefault()
    const addr = ethInput.trim()
    if (!isValidEthAddress(addr)) { setEthErr('Adresse invalide — commence par 0x, 42 chars'); return }
    setEthErr(''); onConnectManual(addr)
  }
  const handleSol = (e) => {
    e.preventDefault()
    onConnectSolana(solInput)
  }

  return (
    <div className="px-4 sm:px-6 py-10 max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-brand-500/10 border border-brand-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <Wallet size={28} className="text-brand-400" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">Portfolio Crypto</h1>
        <p className="text-sm text-zinc-500">Connecte tes wallets pour voir tous tes actifs</p>
      </div>

      {/* Section WalletConnect */}
      <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden mb-4">
        <div className="px-4 py-2.5 border-b border-surface-border">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Connexion directe</p>
        </div>
        <button onClick={onConnectWallet}
          className="w-full flex items-center gap-4 px-4 py-4 hover:bg-surface-muted/40 transition-colors group text-left">
          <div className="w-10 h-10 bg-brand-500/15 border border-brand-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Zap size={18} className="text-brand-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">WalletConnect</p>
            <p className="text-xs text-zinc-500 mt-0.5">MetaMask · Phantom · Trust Wallet · Solflare</p>
          </div>
          <ChevronRight size={16} className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
        </button>
      </div>

      {/* Section adresses publiques */}
      <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-surface-border">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Lecture seule</p>
        </div>

        {/* ETH */}
        <div className="px-4 py-4 border-b border-surface-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-400">Ξ</span>
            </div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Ethereum</p>
          </div>
          <form onSubmit={handleEth} className="flex gap-2">
            <input type="text" value={ethInput}
              onChange={e => { setEthInput(e.target.value); setEthErr('') }}
              placeholder="0x742d35Cc..."
              className="flex-1 bg-surface-muted border border-surface-border rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-brand-500/50 transition-all" />
            <button type="submit" className="px-4 py-2.5 bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/25 rounded-xl text-xs text-brand-400 font-semibold transition-all whitespace-nowrap">
              Analyser
            </button>
          </form>
          {(ethErr || error) && <p className="text-xs text-red-400 mt-2 flex items-center gap-1"><AlertCircle size={11} />{ethErr || error}</p>}
        </div>

        {/* SOL */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
              <span className="text-xs font-bold text-purple-400">◎</span>
            </div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Solana</p>
          </div>
          <form onSubmit={handleSol} className="flex gap-2">
            <input type="text" value={solInput}
              onChange={e => setSolInput(e.target.value)}
              placeholder="5eykt4UsFv8P8N..."
              className="flex-1 bg-surface-muted border border-surface-border rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-all" />
            <button type="submit" className="px-4 py-2.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/25 rounded-xl text-xs text-purple-400 font-semibold transition-all whitespace-nowrap">
              Analyser
            </button>
          </form>
          {solError && <p className="text-xs text-red-400 mt-2 flex items-center gap-1"><AlertCircle size={11} />{solError}</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function Portfolio() {
  const { eth, solana } = useWalletContext()
  const { address, isConnected, walletData, loading, error, connectWallet, connectManual, disconnect, refresh } = eth
  const { address: solAddress, solanaData, loading: solLoading, error: solError, connectManual: solConnectManual, disconnect: solDisconnect, refresh: solRefresh } = solana

  const [activeTab,    setActiveTab]    = useState('assets')
  const [copied,       setCopied]       = useState(false)
  const [txFilter,     setTxFilter]     = useState('')
  const [txPage,       setTxPage]       = useState(1)
  const TX_PER_PAGE = 20

  const hasAny    = address || solAddress
  const isLoading = (loading && !walletData) || (solLoading && !solanaData)
  const ethTotal  = walletData?.totalValueEur ?? 0
  const solTotal  = solanaData?.totalValueEur ?? 0
  const combined  = ethTotal + solTotal

  // ── Actifs unifiés triés par valeur ─────────────────────────────────────────
  const allAssets = useMemo(() => {
    const assets = []
    if (walletData) {
      assets.push({ key: 'eth-native', symbol: 'ETH', name: 'Ethereum',
        balance: walletData.ethBalance, valueEur: walletData.ethValueEur,
        chain: 'eth', change24h: walletData.ethPrice?.change24h ?? null })
      for (const t of walletData.tokens)
        assets.push({ key: `eth-${t.symbol}`, symbol: t.symbol, name: t.name || t.symbol,
          balance: t.balance, valueEur: t.valueEur, chain: 'eth', change24h: null })
    }
    if (solanaData) {
      assets.push({ key: 'sol-native', symbol: 'SOL', name: 'Solana',
        balance: solanaData.solBalance, valueEur: solanaData.solValueEur,
        chain: 'sol', change24h: solanaData.solPrice?.change24h ?? null })
      for (const t of solanaData.splTokens)
        assets.push({ key: `sol-${t.mint}`, symbol: t.symbol, name: t.name,
          balance: t.balance, valueEur: t.valueEur, chain: 'sol', change24h: null })
    }
    return assets.sort((a, b) => (b.valueEur ?? -1) - (a.valueEur ?? -1))
  }, [walletData, solanaData])

  // ── Pie data ─────────────────────────────────────────────────────────────────
  const pieData = useMemo(() =>
    allAssets.filter(a => (a.valueEur ?? 0) > 0.01).slice(0, 8)
      .map(a => ({ name: a.symbol, value: a.valueEur, pct: pct(a.valueEur, combined) }))
  , [allAssets, combined])

  // ── Transactions unifiées ────────────────────────────────────────────────────
  const allTxs = useMemo(() => [
    ...(walletData?.transactions ?? []).map(tx => ({ ...tx, chain: 'eth' })),
    ...(solanaData?.transactions  ?? []).map(tx => ({ ...tx, chain: 'sol' })),
  ].sort((a, b) => b.timestamp - a.timestamp), [walletData, solanaData])

  const filteredTxs  = useMemo(() => {
    const q = txFilter.toLowerCase()
    if (!q) return allTxs
    return allTxs.filter(tx =>
      tx.hash?.toLowerCase().includes(q) || tx.from?.toLowerCase().includes(q) ||
      tx.to?.toLowerCase().includes(q) || tx.symbol?.toLowerCase().includes(q)
    )
  }, [allTxs, txFilter])

  const totalPages   = Math.max(1, Math.ceil(filteredTxs.length / TX_PER_PAGE))
  const paginatedTxs = filteredTxs.slice((txPage - 1) * TX_PER_PAGE, txPage * TX_PER_PAGE)
  const handleTxFilter = (v) => { setTxFilter(v); setTxPage(1) }

  const handleCopy = () => {
    const addr = address || solAddress
    if (!addr) return
    navigator.clipboard.writeText(addr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const handleDisconnect = async () => {
    solDisconnect()      // Reset état local Solana
    await disconnect()   // AppKit déco tous les namespaces ETH + SOL
  }
  const handleRefresh    = () => { refresh(); if (solAddress) solRefresh() }

  // ── Écran connexion ──────────────────────────────────────────────────────────
  if (!hasAny && !loading && !solLoading) {
    return (
      <AppLayout>
        <ConnectScreen
          onConnectWallet={connectWallet}
          onConnectManual={connectManual}
          onConnectSolana={solConnectManual}
          error={error} solError={solError}
        />
      </AppLayout>
    )
  }

  const ethChange    = walletData?.ethPrice?.change24h ?? 0
  const isEthUp      = ethChange >= 0
  const changeAbsEur = Math.abs((walletData?.ethBalance ?? 0) * (walletData?.ethPrice?.eur ?? 0) * (ethChange / 100))

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-12">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="py-8 text-center">
          {isLoading ? (
            <div className="h-12 w-44 bg-surface-muted rounded-2xl animate-pulse mx-auto mb-3" />
          ) : (
            <h1 className="text-5xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">{fmtEur(combined)}</h1>
          )}

          {walletData && !isLoading && (
            <div className="flex items-center justify-center gap-2 mb-5">
              <span className={clsx(
                'inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full',
                isEthUp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
              )}>
                {isEthUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {isEthUp ? '+' : ''}{ethChange.toFixed(2)}% · {isEthUp ? '+' : '-'}{fmtEur(changeAbsEur)}
              </span>
              <span className="text-xs text-zinc-600">24h sur ETH</span>
            </div>
          )}

          {/* Chips wallets + actions */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {address && (
              <div className="flex items-center gap-1.5 bg-surface-card border border-surface-border rounded-full px-3 py-1.5">
                <span className="text-xs text-blue-400 font-bold">Ξ</span>
                <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-mono transition-colors">
                  {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  {shortAddr(address)}
                </button>
                <a href={`https://etherscan.io/address/${address}`} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                  <ExternalLink size={10} />
                </a>
              </div>
            )}
            {solAddress && (
              <div className="flex items-center gap-1.5 bg-surface-card border border-surface-border rounded-full px-3 py-1.5">
                <span className="text-xs text-purple-400 font-bold">◎</span>
                <span className="text-xs text-zinc-500 font-mono">{solAddress.slice(0,4)}…{solAddress.slice(-4)}</span>
                <a href={`https://solscan.io/account/${solAddress}`} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                  <ExternalLink size={10} />
                </a>
              </div>
            )}
            <button onClick={handleRefresh} disabled={loading || solLoading}
              className="flex items-center gap-1.5 bg-surface-card hover:bg-surface-muted border border-surface-border rounded-full px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all">
              <RefreshCw size={11} className={clsx((loading || solLoading) && 'animate-spin')} />
              Actualiser
            </button>
            <button onClick={handleDisconnect}
              className="flex items-center gap-1.5 bg-red-500/8 hover:bg-red-500/15 border border-red-500/20 rounded-full px-3 py-1.5 text-xs text-red-400 transition-all">
              <Unplug size={11} />
              Déconnecter
            </button>
          </div>
        </div>

        {/* ── Stats ETH + SOL côte à côte ──────────────────────────────────── */}
        {!isLoading && (walletData || solanaData) && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {walletData && (
              <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs font-bold text-blue-400">Ξ</span>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Ethereum</p>
                </div>
                <p className="text-lg font-bold font-mono text-zinc-900 dark:text-white">{fmtEur(ethTotal)}</p>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  {fmtCrypto(walletData.ethBalance, 6)} ETH
                  {walletData.tokens.length > 0 && ` · ${walletData.tokens.length} token${walletData.tokens.length > 1 ? 's' : ''}`}
                </p>
                <p className="text-xs text-zinc-600 mt-1">{fmtEur(walletData.ethPrice?.eur)} / ETH</p>
              </div>
            )}
            {solanaData && (
              <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs font-bold text-purple-400">◎</span>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Solana</p>
                </div>
                <p className="text-lg font-bold font-mono text-zinc-900 dark:text-white">{fmtEur(solTotal)}</p>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  {fmtCrypto(solanaData.solBalance, 6)} SOL
                  {solanaData.splTokens.length > 0 && ` · ${solanaData.splTokens.length} token${solanaData.splTokens.length > 1 ? 's' : ''}`}
                </p>
                <p className="text-xs text-zinc-600 mt-1">{fmtEur(solanaData.solPrice?.eur)} / SOL</p>
              </div>
            )}
          </div>
        )}

        {/* ── Pie chart ────────────────────────────────────────────────────── */}
        {!isLoading && pieData.length > 1 && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={14} className="text-zinc-500" />
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Répartition</p>
            </div>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={50}
                    dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-xs shadow-xl">
                        <p className="text-zinc-900 dark:text-white font-semibold">{d.name}</p>
                        <p className="text-zinc-400 font-mono">{fmtEur(d.value)}</p>
                        <p className="text-zinc-500">{d.pct.toFixed(1)}%</p>
                      </div>
                    )
                  }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-zinc-400 flex-1 truncate">{d.name}</span>
                    <span className="text-xs text-zinc-500 font-mono">{d.pct.toFixed(1)}%</span>
                    <span className="text-xs text-zinc-900 dark:text-zinc-300 font-mono w-20 text-right">{fmtEur(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Onglets ──────────────────────────────────────────────────────── */}
        {hasAny && (
          <div className="flex bg-surface-card border border-surface-border rounded-2xl p-1 mb-4">
            {[
              { id: 'assets', label: `Actifs · ${allAssets.length}` },
              { id: 'txs',    label: `Activité · ${allTxs.length}` },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all',
                  activeTab === tab.id
                    ? 'bg-surface-muted text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                )}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────────────── */}
        {isLoading && (
          <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-surface-border last:border-0">
                <div className="w-11 h-11 rounded-2xl bg-surface-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 bg-surface-muted rounded animate-pulse" />
                  <div className="h-2.5 w-20 bg-surface-muted rounded animate-pulse" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-3 w-20 bg-surface-muted rounded animate-pulse ml-auto" />
                  <div className="h-2.5 w-14 bg-surface-muted rounded animate-pulse ml-auto" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Liste des actifs ─────────────────────────────────────────────── */}
        {!isLoading && activeTab === 'assets' && (
          <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
            {allAssets.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <Wallet size={32} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">Aucun actif détecté</p>
              </div>
            ) : allAssets.map((asset, i) => {
                const { key, ...assetProps } = asset
                return (
                  <div key={key} className={clsx(i > 0 && 'border-t border-surface-border')}>
                    <TokenRow {...assetProps} allTotal={combined} />
                  </div>
                )
              })}
          </div>
        )}

        {/* ── Activité ─────────────────────────────────────────────────────── */}
        {!isLoading && activeTab === 'txs' && (
          <div>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="text" value={txFilter} onChange={e => handleTxFilter(e.target.value)}
                placeholder="Hash, adresse, token…"
                className="w-full bg-surface-card border border-surface-border rounded-2xl pl-10 pr-4 py-3 text-sm font-mono placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-white focus:outline-none focus:border-brand-500/40 transition-all" />
            </div>

            <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
              {filteredTxs.length === 0 ? (
                <div className="text-center py-16 text-zinc-600">
                  <p className="text-sm">Aucune transaction</p>
                </div>
              ) : (
                <>
                  {paginatedTxs.map((tx, i) => (
                    <div key={`${tx.chain}-${tx.hash}-${i}`} className={clsx(i > 0 && 'border-t border-surface-border')}>
                      <TxRow tx={tx} chain={tx.chain} />
                    </div>
                  ))}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-surface-border">
                      <button onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={txPage === 1}
                        className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        ← Précédent
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                          <button key={p} onClick={() => setTxPage(p)}
                            className={clsx('w-7 h-7 rounded-lg text-xs font-medium transition-all',
                              p === txPage ? 'bg-surface-muted text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300')}>
                            {p}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setTxPage(p => Math.min(totalPages, p + 1))} disabled={txPage === totalPages}
                        className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        Suivant →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {(walletData?.lastUpdated || solanaData?.lastUpdated) && (
              <p className="text-xs text-zinc-700 text-right mt-2 px-1">
                Mis à jour à {format(walletData?.lastUpdated ?? solanaData?.lastUpdated, 'HH:mm:ss')}
              </p>
            )}
          </div>
        )}

      </div>
    </AppLayout>
  )
}
