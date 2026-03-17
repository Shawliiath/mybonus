import { useState, useMemo, useEffect } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useWalletContext } from '../context/WalletContext'
import { shortAddr, isValidEthAddress } from '../hooks/useWallet'
import {
  Wallet, RefreshCw, Copy, Check, ExternalLink,
  TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle,
  Coins, Clock, AlertCircle, Unplug, Search, Zap
} from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const PIE_COLORS = ['#22c55e','#3b82f6','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316']

function fmtEur(v) {
  if (v === null || v === undefined || isNaN(v)) return '—'
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function fmtCrypto(v, dec = 6) {
  if (!v && v !== 0) return '—'
  if (v < 0.000001) return '< 0.000001'
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: dec })
}

function KpiCard({ label, value, sub, icon: Icon, color = 'green' }) {
  const s = {
    green:  'border-brand-500/20 bg-brand-500/5 text-brand-400',
    blue:   'border-blue-500/20  bg-blue-500/5  text-blue-400',
    amber:  'border-amber-500/20 bg-amber-500/5 text-amber-400',
    red:    'border-red-500/20   bg-red-500/5   text-red-400',
  }[color] || 'border-brand-500/20 bg-brand-500/5 text-brand-400'
  return (
    <div className={clsx('bg-surface-card border rounded-2xl p-4', s)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">{label}</p>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-white/5">
          <Icon size={14} />
        </div>
      </div>
      <p className="text-lg font-bold font-mono">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}

function PortfolioPie({ data }) {
  const [active, setActive] = useState(null)
  if (!data?.length) return null
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
            dataKey="value" paddingAngle={2}
            onMouseEnter={(_, i) => setActive(i)} onMouseLeave={() => setActive(null)}>
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}
                opacity={active === null || active === i ? 1 : 0.3}
                strokeWidth={active === i ? 2 : 0} stroke={active === i ? '#fff' : 'transparent'} />
            ))}
          </Pie>
          <Tooltip content={({ active: a, payload }) => {
            if (!a || !payload?.length) return null
            const d = payload[0].payload
            return (
              <div className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-xs shadow-xl">
                <p className="text-zinc-200 font-semibold">{d.name}</p>
                <p className="font-mono text-zinc-400">{fmtEur(d.value)}</p>
                <p className="font-mono text-zinc-500">{d.pct.toFixed(1)}%</p>
              </div>
            )
          }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-2 flex-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="text-zinc-400 flex-1 truncate">{d.name}</span>
            <span className="font-mono text-zinc-300 shrink-0">{d.pct.toFixed(1)}%</span>
            <span className="font-mono text-zinc-500 shrink-0">{fmtEur(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Écran connexion ──────────────────────────────────────────────────────────
function ConnectScreen({ onConnectWallet, onConnectManual, error }) {
  const [input,    setInput]    = useState('')
  const [inputErr, setInputErr] = useState('')

  const handleManual = (e) => {
    e.preventDefault()
    const addr = input.trim()
    if (!isValidEthAddress(addr)) { setInputErr('Adresse invalide — 42 caractères, commence par 0x'); return }
    setInputErr('')
    onConnectManual(addr)
  }

  return (
    <div className="px-4 sm:px-6 py-10 max-w-md mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-brand-500/15 border border-brand-500/20 rounded-2xl flex items-center justify-center">
          <Wallet size={22} className="text-brand-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Portfolio ETH</h1>
          <p className="text-sm text-zinc-500">Connecte ton wallet pour voir tes actifs</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 flex items-start gap-2 mb-5">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />{error}
        </div>
      )}

      {/* WalletConnect */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={14} className="text-blue-400" />
          <p className="text-sm font-semibold text-zinc-200">Trust Wallet / MetaMask</p>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Scanne le QR code avec Trust Wallet. Connexion sécurisée via WalletConnect.
        </p>
        <button onClick={onConnectWallet}
          className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-xl py-3 text-sm transition-all shadow-lg shadow-blue-500/20">
          <Wallet size={16} />
          Connecter avec WalletConnect
        </button>
      </div>

      {/* Adresse manuelle */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Search size={14} className="text-zinc-400" />
          <p className="text-sm font-semibold text-zinc-200">Adresse publique (lecture seule)</p>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Colle ton adresse ETH pour consulter sans connexion.
        </p>
        <form onSubmit={handleManual} className="space-y-3">
          <div>
            <input type="text" value={input}
              onChange={e => { setInput(e.target.value); setInputErr('') }}
              placeholder="0x742d35Cc6634C0532925a3b8..."
              className="w-full bg-surface-muted border border-surface-border rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-brand-500/60 transition-all" />
            {inputErr && <p className="text-xs text-red-400 mt-1.5">{inputErr}</p>}
          </div>
          <button type="submit"
            className="w-full flex items-center justify-center gap-2 bg-surface-muted hover:bg-zinc-700 border border-surface-border text-zinc-300 font-semibold rounded-xl py-3 text-sm transition-all">
            <Search size={14} />Analyser ce wallet
          </button>
        </form>
        <p className="text-xs text-zinc-600 mt-4">
          💡 Dans Trust Wallet : Ethereum → Recevoir → copie l'adresse
        </p>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function Portfolio() {
  const {
    address, isConnected, walletData, loading, error,
    connectWallet, connectManual, disconnect, refresh
  } = useWalletContext()

  const [copied,    setCopied]    = useState(false)
  const [txFilter,  setTxFilter]  = useState('')
  const [activeTab, setActiveTab] = useState('tokens')

  const pieData = useMemo(() => {
    if (!walletData) return []
    const total = walletData.totalValueEur || 1
    return [
      { name: 'ETH', value: walletData.ethValueEur, pct: (walletData.ethValueEur / total) * 100 },
      ...walletData.tokens
        .filter(t => (t.valueEur ?? 0) > 0.01)
        .map(t => ({ name: t.symbol, value: t.valueEur, pct: (t.valueEur / total) * 100 }))
    ].filter(d => d.value > 0).slice(0, 7)
  }, [walletData])

  const filteredTxs = useMemo(() => {
    if (!walletData?.transactions) return []
    const q = txFilter.toLowerCase()
    if (!q) return walletData.transactions
    return walletData.transactions.filter(tx =>
      tx.hash?.toLowerCase().includes(q) ||
      tx.from?.toLowerCase().includes(q) ||
      tx.to?.toLowerCase().includes(q)
    )
  }, [walletData, txFilter])

  const handleCopy = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Écran de connexion
  if (!address && !loading) {
    return (
      <AppLayout>
        <ConnectScreen
          onConnectWallet={connectWallet}
          onConnectManual={connectManual}
          error={error}
        />
      </AppLayout>
    )
  }

  // Loading
  if (loading) {
    return (
      <AppLayout>
        <div className="px-4 sm:px-6 py-10 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">Chargement du wallet…</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-surface-muted rounded-2xl animate-pulse" style={{ opacity: 1 - i * 0.15 }} />)}
          </div>
          <div className="h-48 bg-surface-muted rounded-2xl animate-pulse mb-4" />
          <div className="h-64 bg-surface-muted rounded-2xl animate-pulse" />
        </div>
      </AppLayout>
    )
  }

  if (!walletData) return null

  const d    = walletData
  const isUp = d.ethPrice.change24h >= 0
  const change24hAbs = d.ethBalance * d.ethPrice.eur * (d.ethPrice.change24h / 100)

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto space-y-5 animate-fade-in">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Portfolio ETH</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {isConnected
                ? <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400"><Zap size={10} />WalletConnect</span>
                : <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700/50 border border-zinc-600 text-zinc-400">Lecture seule</span>
              }
              <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors">
                {copied ? <Check size={11} className="text-brand-400" /> : <Copy size={11} />}
                {shortAddr(d.address)}
              </button>
              <a href={`https://etherscan.io/address/${d.address}`} target="_blank" rel="noreferrer"
                className="text-zinc-600 hover:text-brand-400 transition-colors">
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={refresh}
              className="flex items-center gap-1.5 bg-surface-muted hover:bg-zinc-700 border border-surface-border rounded-xl px-3 py-2 text-xs text-zinc-400 hover:text-white transition-all">
              <RefreshCw size={13} />Actualiser
            </button>
            <button onClick={disconnect}
              className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl px-3 py-2 text-xs text-red-400 transition-all">
              <Unplug size={13} />Déconnecter
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Valeur totale" value={fmtEur(d.totalValueEur)}
            sub={`${fmtCrypto(d.ethBalance, 4)} ETH`} icon={Wallet} color="green" />
          <KpiCard label="Prix ETH" value={fmtEur(d.ethPrice.eur)}
            sub={`${isUp ? '+' : ''}${d.ethPrice.change24h?.toFixed(2)}% 24h`}
            icon={isUp ? TrendingUp : TrendingDown} color={isUp ? 'green' : 'red'} />
          <KpiCard label="Variation 24h" value={`${isUp ? '+' : ''}${fmtEur(change24hAbs)}`}
            sub="sur le solde ETH"
            icon={isUp ? TrendingUp : TrendingDown} color={isUp ? 'green' : 'red'} />
          <KpiCard label="Tokens ERC-20" value={d.tokens.length}
            sub={d.tokens.length > 0 ? fmtEur(d.tokensValueEur) : 'aucun solde'}
            icon={Coins} color="blue" />
        </div>

        {/* Pie chart */}
        {pieData.length > 1 && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-zinc-400 mb-4">Répartition du portfolio</h2>
            <PortfolioPie data={pieData} />
          </div>
        )}

        {/* Onglets */}
        <div>
          <div className="flex rounded-xl bg-surface-muted border border-surface-border overflow-hidden w-fit mb-4">
            <button onClick={() => setActiveTab('tokens')}
              className={clsx('px-4 py-2 text-sm font-medium transition-all flex items-center gap-2',
                activeTab === 'tokens' ? 'bg-brand-500/20 text-brand-400' : 'text-zinc-500 hover:text-zinc-300')}>
              <Coins size={14} />Tokens ({d.tokens.length + 1})
            </button>
            <button onClick={() => setActiveTab('txs')}
              className={clsx('px-4 py-2 text-sm font-medium transition-all flex items-center gap-2',
                activeTab === 'txs' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300')}>
              <Clock size={14} />Transactions ({d.transactions.length})
            </button>
          </div>

          {/* Tokens */}
          {activeTab === 'tokens' && (
            <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="text-base font-bold text-blue-400">Ξ</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Ethereum</p>
                    <p className="text-xs text-zinc-500 font-mono">ETH</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold font-mono text-white">{fmtEur(d.ethValueEur)}</p>
                  <p className="text-xs text-zinc-500 font-mono">{fmtCrypto(d.ethBalance, 6)} ETH</p>
                </div>
              </div>
              {d.tokens.length === 0 ? (
                <div className="text-center py-12 text-zinc-600">
                  <Coins size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucun token ERC-20 détecté</p>
                </div>
              ) : d.tokens.map((t, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-4 border-b border-surface-border last:border-0 hover:bg-surface-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-muted border border-surface-border flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-zinc-400">{t.symbol?.slice(0, 4)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{t.name || t.symbol}</p>
                      <p className="text-xs text-zinc-500 font-mono">{t.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold font-mono text-white">
                      {t.valueEur != null ? fmtEur(t.valueEur) : <span className="text-zinc-600 text-xs">—</span>}
                    </p>
                    <p className="text-xs text-zinc-500 font-mono">{fmtCrypto(t.balance, 4)} {t.symbol}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Transactions */}
          {activeTab === 'txs' && (
            <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
              <div className="relative mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input type="text" value={txFilter} onChange={e => setTxFilter(e.target.value)}
                  placeholder="Filtrer par hash ou adresse…"
                  className="w-full bg-surface-muted border border-surface-border rounded-xl pl-9 pr-4 py-2 text-sm font-mono placeholder:text-zinc-600 text-white focus:outline-none focus:border-brand-500/60 transition-all" />
              </div>
              {filteredTxs.length === 0 ? (
                <div className="text-center py-12 text-zinc-600">
                  <Clock size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucune transaction trouvée</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-border">
                        {['Type','Date','Montant ETH','Avec','Gas',''].map(h => (
                          <th key={h} className="text-left text-xs text-zinc-500 font-medium py-2.5 px-2 first:pl-0 last:pr-0 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {filteredTxs.map((tx, i) => (
                        <tr key={i} className="hover:bg-surface-muted/30 transition-colors group">
                          <td className="py-3.5 px-2 pl-0">
                            <span className={clsx('inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg',
                              tx.isError ? 'bg-red-500/10 text-red-400'
                              : tx.direction === 'in' ? 'bg-brand-500/10 text-brand-400'
                              : 'bg-orange-500/10 text-orange-400')}>
                              {tx.isError ? <><AlertCircle size={10}/>Erreur</>
                               : tx.direction==='in' ? <><ArrowDownCircle size={10}/>Reçu</>
                               : <><ArrowUpCircle size={10}/>Envoyé</>}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 text-xs text-zinc-400 whitespace-nowrap">
                            {format(new Date(tx.timestamp), 'dd MMM yy', { locale: fr })}
                          </td>
                          <td className={clsx('py-3.5 px-2 font-mono font-semibold text-xs whitespace-nowrap',
                            tx.direction==='in' ? 'text-brand-400' : 'text-orange-400')}>
                            {tx.direction==='in' ? '+' : '-'}{fmtCrypto(tx.value, 5)} {tx.symbol ?? 'Ξ'}
                          </td>
                          <td className="py-3.5 px-2 text-xs text-zinc-500 font-mono">
                            {shortAddr(tx.direction==='out' ? tx.to : tx.from)}
                          </td>
                          <td className="py-3.5 px-2 text-xs text-zinc-600 font-mono">
                            {tx.gasPrice?.toFixed(1)} Gw
                          </td>
                          <td className="py-3.5 pr-0 pl-2">
                            <a href={`https://etherscan.io/tx/${tx.hash}`} target="_blank" rel="noreferrer"
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-brand-400">
                              <ExternalLink size={13} />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-zinc-600 mt-4 text-right">
                Mis à jour à {format(d.lastUpdated, 'HH:mm:ss')}
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
