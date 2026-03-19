import { classifyWalletError } from '../utils/walletError'
import SendModal from '../components/wallet/SendModal'
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import { useWalletContext } from '../context/WalletContext'
import { shortAddr, isValidEthAddress } from '../hooks/useWallet'
import { isValidSolAddress } from '../hooks/useSolanaWallet'
import { isValidBtcAddress } from '../hooks/useBitcoinWallet'
import { useCurrencyRates } from '../hooks/useCurrency'
import {
  Wallet, RefreshCw, Copy, Check, ExternalLink,
  TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle,
  AlertCircle, Search, Zap, Unplug, ChevronRight, BarChart3, X, Plus, Globe, ArrowLeft, Send
} from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'


// ─── CoinGecko helpers ───────────────────────────────────────────────────────
const _CG_KEY_PTF = import.meta.env.VITE_COINGECKO_KEY ?? ''
const _CG_HDRS    = _CG_KEY_PTF ? { 'x-cg-demo-api-key': _CG_KEY_PTF } : {}

// Map symbol → CoinGecko ID pour les principaux tokens
const SYMBOL_TO_CG = {
  ETH: 'ethereum', BTC: 'bitcoin', SOL: 'solana', BNB: 'binancecoin',
  USDC: 'usd-coin', USDT: 'tether', MATIC: 'polygon', AVAX: 'avalanche-2',
  LINK: 'chainlink', UNI: 'uniswap', AAVE: 'aave', WBTC: 'wrapped-bitcoin',
  BONK: 'bonk', JUP: 'jupiter-exchange-solana', DOGE: 'dogecoin', LTC: 'litecoin',
}

function symbolToCgId(symbol) {
  return SYMBOL_TO_CG[symbol?.toUpperCase()] ?? symbol?.toLowerCase()
}

let _ptfBackoff = 0
async function cgFetchPtf(url) {
  if (Date.now() < _ptfBackoff) throw new Error('backoff')
  const res = await fetch(url, { headers: _CG_HDRS, signal: AbortSignal.timeout(8000) })
  if (res.status === 429) { _ptfBackoff = Date.now() + 15000; throw new Error('rate-limit') }
  if (!res.ok) throw new Error('api-error')
  return res.json()
}

async function fetchTokenChart(cgId, days, minutesBack = null) {
  const data = await cgFetchPtf(
    `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=eur&days=${days}`
  )
  let pts = data.prices.map(([ts, price]) => ({ ts, price }))
  if (minutesBack != null) {
    const cutoff = Date.now() - minutesBack * 60 * 1000
    pts = pts.filter(p => p.ts >= cutoff)
  }
  const step = Math.max(1, Math.floor(pts.length / 100))
  return pts.filter((_, i) => i % step === 0)
}

async function fetchTokenLive(cgId) {
  const data = await cgFetchPtf(
    `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=eur&include_24hr_change=true&include_market_cap=true`
  )
  return data[cgId] ?? null
}

const PIE_COLORS = ['#22c55e','#3b82f6','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#10b981','#ef4444']

function fmtEur(v, currency = '€', rate = 1) {
  if (v === null || v === undefined || isNaN(v)) return '—'
  const converted = v * rate
  const sym = currency === '$' ? '$' : currency === '£' ? '£' : currency === 'CHF' ? 'CHF ' : currency === 'CAD' ? 'CAD ' : currency === '₿' ? '₿' : ''
  const suffix = ['€', '$', '£', 'CHF', 'CAD', '₿'].includes(currency) ? '' : ` ${currency}`
  const prefix = ['$', '£', '₿'].includes(currency) ? sym : ''
  const postfix = ['€'].includes(currency) ? ' €' : ['CHF', 'CAD'].includes(currency) ? ` ${currency}` : ''
  return prefix + converted.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + postfix
}
function fmtCrypto(v, dec = 4) {
  if (!v && v !== 0) return '—'
  if (v < 0.0001) return '< 0.0001'
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: dec })
}
function pct(v, total) { return total ? (v / total) * 100 : 0 }

const TOKEN_COLORS = {
  ETH:  { bg: 'bg-blue-500/15',    text: 'text-blue-300',    border: 'border-blue-500/20' },
  SOL:  { bg: 'bg-purple-500/15',  text: 'text-purple-300',  border: 'border-purple-500/20' },
  BTC:  { bg: 'bg-amber-500/15',   text: 'text-amber-300',   border: 'border-amber-500/20' },
  USDC: { bg: 'bg-sky-500/15',     text: 'text-sky-300',     border: 'border-sky-500/20' },
  USDT: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/20' },
  WBTC: { bg: 'bg-amber-500/15',   text: 'text-amber-300',   border: 'border-amber-500/20' },
  BONK: { bg: 'bg-orange-500/15',  text: 'text-orange-300',  border: 'border-orange-500/20' },
  JUP:  { bg: 'bg-green-500/15',   text: 'text-green-300',   border: 'border-green-500/20' },
}
function tokenStyle(sym) {
  return TOKEN_COLORS[sym] ?? { bg: 'bg-zinc-500/15', text: 'text-zinc-300', border: 'border-zinc-500/20' }
}


// ─── Token logo URLs ──────────────────────────────────────────────────────────
const TOKEN_LOGOS = {
  ETH:  'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  BTC:  'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  SOL:  'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/tether.png',
  DAI:  'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  WETH: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  BONK: 'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg',
  JUP:  'https://assets.coingecko.com/coins/images/34188/small/jup.png',
  WIF:  'https://assets.coingecko.com/coins/images/33566/small/wif.png',
  ORCA: 'https://assets.coingecko.com/coins/images/17547/small/Orca_Logo.png',
  LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  UNI:  'https://assets.coingecko.com/coins/images/12504/small/uni.jpg',
  RNDR: 'https://assets.coingecko.com/coins/images/11636/small/rndr.png',
  HNT:  'https://assets.coingecko.com/coins/images/4284/small/Helium_HNT.png',
}

const CHAIN_LOGOS = {
  eth: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  sol: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  btc: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
}

const CHAIN_LABELS = {
  eth: 'Ethereum',
  sol: 'Solana',
  btc: 'Bitcoin',
}

const CHAIN_BADGE_BG = {
  eth: '#ffffff',
  sol: '#000000',
  btc: '#f7931a',
}

function TokenLogo({ symbol, chain, size = 44 }) {
  const [imgError, setImgError] = React.useState(false)
  const url = TOKEN_LOGOS[symbol.toUpperCase()]
  const style = tokenStyle(symbol)
  const chainIcon = chain === 'sol' ? '◎' : chain === 'btc' ? '₿' : 'Ξ'
  const chainColor = chain === 'sol' ? '#a855f7' : chain === 'btc' ? '#f59e0b' : '#3b82f6'

  if (url && !imgError) {
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <img
          src={url}
          alt={symbol}
          onError={() => setImgError(true)}
          className="w-full h-full rounded-2xl object-cover"
          loading="lazy"
        />
        {/* Chain badge — vrai logo réseau */}
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-surface-card flex items-center justify-center overflow-hidden"
          style={{ background: CHAIN_BADGE_BG[chain] ?? '#1a1f2e' }}>
          <img src={CHAIN_LOGOS[chain]} alt={chain} className="w-3.5 h-3.5 object-contain" />
        </div>
      </div>
    )
  }

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className={clsx('w-full h-full rounded-2xl flex items-center justify-center font-bold text-sm border', style.bg, style.text, style.border)}>
        {symbol.slice(0, 3)}
      </div>
      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-surface-card flex items-center justify-center overflow-hidden"
        style={{ background: CHAIN_BADGE_BG[chain] ?? '#1a1f2e' }}>
        <img src={CHAIN_LOGOS[chain]} alt={chain} className="w-3.5 h-3.5 object-contain" />
      </div>
    </div>
  )
}

// ─── Token Row ────────────────────────────────────────────────────────────────
function TokenRow({ symbol, name, balance, valueEur, chain, change24h, allTotal, onClick, currency = '€', rate = 1 }) {
  const isUp   = (change24h ?? 0) >= 0

  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/30 transition-colors text-left">
      <TokenLogo symbol={symbol} chain={chain} size={44} />
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{name}</p>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 shrink-0">
            {CHAIN_LABELS[chain] ?? chain}
          </span>
        </div>
        <p className="text-xs text-zinc-500 font-mono truncate">
          {valueEur != null && balance > 0 ? fmtEur(valueEur / balance, currency, rate) + ' · ' : ''}{fmtCrypto(balance)} {symbol}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white font-mono">
          {valueEur != null ? fmtEur(valueEur, currency, rate) : <span className="text-zinc-400 text-xs">Prix indispo</span>}
        </p>
        {change24h != null ? (
          <p className={clsx('text-xs font-mono mt-0.5 font-medium', isUp ? 'text-emerald-400' : 'text-red-400')}>
            {isUp ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
          </p>
        ) : (
          <p className="text-xs text-zinc-600 mt-0.5 font-mono">{fmtCrypto(balance, 4)} {symbol}</p>
        )}
      </div>
    </button>
  )
}


// ─── Token Detail Modal ───────────────────────────────────────────────────────
const TOKEN_MODAL_FILTERS = [
  { id: '1h',  label: '1H',  days: 1,  minutesBack: 60   },
  { id: '24h', label: '24H', days: 1,  minutesBack: null },
  { id: '7d',  label: '7J',  days: 7,  minutesBack: null },
  { id: '1m',  label: '1M',  days: 30, minutesBack: null },
]

function fmtChartDatePtf(ts, filter) {
  const d = new Date(ts)
  if (filter === '1h' || filter === '24h')
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function TokenModal({ asset, onClose, onSend }) {
  const cgId = symbolToCgId(asset.symbol)
  const [timeFilter,   setTimeFilter]   = useState('24h')
  const [chartData,    setChartData]    = useState([])
  const [chartLoading, setChartLoading] = useState(true)
  const [liveData,     setLiveData]     = useState(null)
  const [livePrice,    setLivePrice]    = useState(asset.valueEur && asset.balance ? asset.valueEur / asset.balance : null)
  const [liveFlash,    setLiveFlash]    = useState(null)
  const chartCache = useRef({})
  const liveTimer  = useRef(null)

  // Fetch chart
  useEffect(() => {
    const key = `${cgId}-${timeFilter}`
    if (chartCache.current[key]) { setChartData(chartCache.current[key]); return }
    setChartLoading(true)
    const tf = TOKEN_MODAL_FILTERS.find(f => f.id === timeFilter)
    fetchTokenChart(cgId, tf?.days ?? 1, tf?.minutesBack ?? null)
      .then(d => { chartCache.current[key] = d; setChartData(d) })
      .catch(() => setChartData([]))
      .finally(() => setChartLoading(false))
  }, [cgId, timeFilter])

  // Fetch live info once
  useEffect(() => {
    fetchTokenLive(cgId).then(d => {
      if (d) { setLiveData(d); setLivePrice(d.eur) }
    }).catch(() => {})
  }, [cgId])

  // Live price poll 5s
  useEffect(() => {
    liveTimer.current = setInterval(async () => {
      try {
        const d = await fetchTokenLive(cgId)
        if (!d) return
        setLivePrice(prev => {
          if (prev != null && d.eur !== prev) {
            setLiveFlash(d.eur > prev ? 'up' : 'down')
            setTimeout(() => setLiveFlash(null), 600)
            setChartData(pts => {
              if (!pts.length) return pts
              const next = [...pts, { ts: Date.now(), price: d.eur }]
              return next.length > 120 ? next.slice(-120) : next
            })
          }
          return d.eur
        })
        setLiveData(d)
      } catch {}
    }, 5000)
    return () => clearInterval(liveTimer.current)
  }, [cgId])

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const chartMin  = chartData.length ? Math.min(...chartData.map(d => d.price)) * 0.998 : 0
  const chartMax  = chartData.length ? Math.max(...chartData.map(d => d.price)) * 1.002 : 0
  const chartIsUp = chartData.length >= 2 ? chartData[chartData.length - 1].price >= chartData[0].price : true
  const change24h = liveData?.eur_24h_change ?? asset.change24h ?? null
  const isUp      = (change24h ?? 0) >= 0
  const style     = tokenStyle(asset.symbol)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-md bg-surface-card border border-surface-border rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-surface-card border-b border-surface-border px-5 pt-5 pb-4 z-10">
          <div className="flex items-center gap-3">
            <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-bold text-base border', style.bg, style.text, style.border)}>
              {asset.symbol.slice(0, 3)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-zinc-900 dark:text-white">{asset.name}</p>
              <p className="text-xs text-zinc-500 font-mono uppercase flex items-center gap-1.5">
                {asset.symbol}
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <span className="text-zinc-600">live</span>
              </p>
            </div>
            <div className="text-right">
              <p className={clsx('text-xl font-bold font-mono transition-colors duration-300',
                liveFlash === 'up' ? 'text-emerald-400' : liveFlash === 'down' ? 'text-red-400' : 'text-zinc-900 dark:text-white')}>
                {livePrice != null ? fmtEur(livePrice) : fmtEur(asset.valueEur && asset.balance ? asset.valueEur / asset.balance : null)}
              </p>
              {change24h != null && (
                <span className={clsx('text-xs font-semibold font-mono px-2 py-0.5 rounded-lg',
                  isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                  {isUp ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
                </span>
              )}
            </div>
            <button onClick={onClose} className="ml-1 p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-surface-muted transition-all shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Ma position */}
          <div className="bg-surface-muted rounded-2xl p-4">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-3">Ma position</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Quantité',   value: `${fmtCrypto(asset.balance, 6)} ${asset.symbol}` },
                { label: 'Valeur EUR', value: asset.valueEur != null ? fmtEur(asset.valueEur) : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-zinc-600 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold font-mono text-zinc-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Stats marché */}
          {liveData && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Cap. marché', value: liveData.eur_market_cap ? (liveData.eur_market_cap >= 1e9 ? (liveData.eur_market_cap / 1e9).toFixed(1) + 'B €' : (liveData.eur_market_cap / 1e6).toFixed(0) + 'M €') : '—' },
                { label: 'Prix actuel', value: fmtEur(liveData.eur) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface-muted rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-sm font-semibold font-mono text-zinc-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Graphique */}
          <div className="bg-surface-muted rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Évolution</p>
              <div className="flex bg-surface-card rounded-lg p-0.5 gap-0.5">
                {TOKEN_MODAL_FILTERS.map(tf => (
                  <button key={tf.id} onClick={() => setTimeFilter(tf.id)}
                    className={clsx('px-2 py-1 text-[10px] font-semibold rounded-md transition-all',
                      timeFilter === tf.id
                        ? 'bg-surface-muted text-zinc-900 dark:text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300')}>
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>
            {chartLoading ? (
              <div className="h-40 bg-surface-card rounded-xl animate-pulse" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="modalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={chartIsUp ? '#22c55e' : '#ef4444'} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={chartIsUp ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="ts" tickFormatter={ts => fmtChartDatePtf(ts, timeFilter)}
                    tick={{ fontSize: 8, fill: '#71717a' }} axisLine={false} tickLine={false}
                    interval="preserveStartEnd" />
                  <YAxis domain={[chartMin, chartMax]}
                    tickFormatter={v => {
                      if (v >= 1000) return (v / 1000).toFixed(1) + 'k'
                      if (v >= 1) return v.toFixed(2)
                      return v.toFixed(4)
                    }}
                    tick={{ fontSize: 8, fill: '#71717a' }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-xs shadow-xl">
                        <p className="text-zinc-400 mb-0.5">{fmtChartDatePtf(label, timeFilter)}</p>
                        <p className="font-semibold font-mono text-zinc-900 dark:text-white">{fmtEur(payload[0].value)}</p>
                      </div>
                    )
                  }} />
                  <Area type="monotone" dataKey="price" isAnimationActive={false}
                    stroke={chartIsUp ? '#22c55e' : '#ef4444'} strokeWidth={1.5}
                    fill="url(#modalGrad)" dot={false}
                    activeDot={{ r: 3, strokeWidth: 0, fill: chartIsUp ? '#22c55e' : '#ef4444' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-zinc-600 text-xs">
                Données indisponibles pour {asset.symbol}
              </div>
            )}
          </div>

          {/* Actions : Envoyer + Voir sur les marchés */}
          <div className="flex gap-2">
            {onSend && (
              <button
                onClick={onSend}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-muted hover:bg-surface-border border border-surface-border rounded-2xl text-sm text-zinc-900 dark:text-white font-semibold transition-all">
                <Send size={15} />
                Envoyer
              </button>
            )}
            <Link to="/market" onClick={onClose}
              className={clsx(
                "flex items-center justify-center gap-2 py-3 bg-brand-500/10 hover:bg-brand-500/15 border border-brand-500/20 rounded-2xl text-sm text-brand-400 font-semibold transition-all",
                onSend ? "flex-1" : "w-full"
              )}>
              <Globe size={15} />
              {onSend ? "Marchés" : `Voir ${asset.name} sur les marchés`}
              {!onSend && <ChevronRight size={14} />}
            </Link>
          </div>
        </div>
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
    : chain === 'btc'
      ? `https://blockstream.info/tx/${tx.hash}`
      : `https://etherscan.io/tx/${tx.hash}`

  // Formatage sécurisé du timestamp
  let dateStr = ''
  try {
    if (tx.timestamp && tx.timestamp > 0) {
      dateStr = format(new Date(tx.timestamp), 'dd MMM yyyy', { locale: fr })
    }
  } catch { dateStr = '' }

  // Adresse raccourcie sécurisée
  const fromAddr = tx.from ? shortAddr(tx.from) : '—'
  const toAddr   = tx.to   ? shortAddr(tx.to)   : '—'

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/30 transition-colors group">
      <div className={clsx(
        'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border',
        isError ? 'bg-red-500/10 border-red-500/20'
        : isIn  ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-orange-500/10 border-orange-500/20'
      )}>
        {isError ? <AlertCircle size={16} className="text-red-400" />
          : isIn ? <ArrowDownCircle size={16} className="text-emerald-400" />
                 : <ArrowUpCircle size={16} className="text-orange-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            {isError ? 'Échec' : isIn ? 'Reçu' : 'Envoyé'}
          </p>
          <span className={clsx('text-xs font-bold', chain === 'sol' ? 'text-purple-400' : chain === 'btc' ? 'text-amber-400' : 'text-blue-400')}>
            {chain === 'sol' ? '◎' : chain === 'btc' ? '₿' : 'Ξ'}
          </span>
          <span className="text-xs text-zinc-600 font-mono">{tx.hash?.slice(0, 8)}…</span>
        </div>
        <p className="text-xs text-zinc-500 font-mono">
          {isIn ? '← ' : '→ '}{isIn ? fromAddr : toAddr}
          {dateStr && <> · {dateStr}</>}
          {tx.gasPrice > 0 && <span className="text-zinc-700"> · {tx.gasPrice.toFixed(1)} Gwei</span>}
        </p>
      </div>
      <div className="text-right shrink-0 flex items-center gap-3">
        <p className={clsx('text-sm font-semibold font-mono',
          isError ? 'text-red-400' : isIn ? 'text-emerald-400' : 'text-orange-400')}>
          {isIn ? '+' : '-'}{fmtCrypto(tx.value, 5)} {tx.symbol ?? '?'}
        </p>
        <a href={explorerUrl} target="_blank" rel="noreferrer"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  )
}


// ─── Écran connexion ──────────────────────────────────────────────────────────
/** Affiche une erreur wallet — accepte un objet {icon,text,sub} ou une string brute */
function WalletErrorMsg({ err }) {
  if (!err) return null
  const isObj = err && typeof err === 'object'
  const text  = isObj ? err.text : err
  const sub   = isObj ? err.sub  : null
  return (
    <div className="mt-2 text-xs text-red-400">
      <p>{text}</p>
      {sub && <p className="text-red-400/60 mt-0.5">{sub}</p>}
    </div>
  )
}

function ConnectScreen({ onConnectWallet, onConnectManual, onConnectSolana, onConnectBitcoin, error, solError, btcError }) {
  const [ethInput, setEthInput] = useState('')
  const [solInput, setSolInput] = useState('')
  const [btcInput, setBtcInput] = useState('')
  const [ethErr,   setEthErr]   = useState('')
  const [btcErr,   setBtcErr]   = useState('')

  const handleEth = (e) => {
    e.preventDefault()
    const addr = ethInput.trim()
    if (!isValidEthAddress(addr)) { setEthErr('Adresse invalide — commence par 0x, 42 chars'); return }
    setEthErr(''); onConnectManual(addr)
  }
  const handleSol = (e) => { e.preventDefault(); onConnectSolana(solInput) }
  const handleBtc = (e) => {
    e.preventDefault()
    const addr = btcInput.trim()
    if (!isValidBtcAddress(addr)) { setBtcErr('Adresse Bitcoin invalide'); return }
    setBtcErr(''); onConnectBitcoin(addr)
  }

  return (
    <div className="px-4 sm:px-6 py-10 max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-brand-500/10 border border-brand-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <Wallet size={28} className="text-brand-400" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">Portfolio Crypto</h1>
        <p className="text-sm text-zinc-500">Connecte tes wallets pour voir tous tes actifs</p>
        <Link to="/market"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-surface-card border border-surface-border hover:border-brand-500/30 rounded-xl text-sm text-zinc-400 hover:text-brand-400 transition-all">
          <BarChart3 size={15} />
          Voir les marchés crypto
          <ChevronRight size={13} />
        </Link>
      </div>

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
            <p className="text-xs text-zinc-500 mt-0.5">ETH · SOL · BTC — MetaMask, Phantom, Trust Wallet…</p>
          </div>
          <ChevronRight size={16} className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
        </button>
      </div>

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
          <WalletErrorMsg err={ethErr || error} />
        </div>

        {/* SOL */}
        <div className="px-4 py-4 border-b border-surface-border">
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
          <WalletErrorMsg err={solError} />
        </div>

        {/* BTC */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                <span className="text-xs font-bold text-amber-400">₿</span>
              </div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">Bitcoin</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-500/10 border border-zinc-500/20 text-zinc-500 font-medium">
              lecture seule
            </span>
          </div>

          <p className="text-xs text-zinc-500 mb-3">Entre ton adresse publique pour suivre ton solde.</p>

          <form onSubmit={handleBtc} className="flex gap-2">
            <input type="text" value={btcInput}
              onChange={e => { setBtcInput(e.target.value); setBtcErr('') }}
              placeholder="bc1q... / 1... / 3..."
              className="flex-1 bg-surface-muted border border-surface-border rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-all" />
            <button type="submit" className="px-4 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 rounded-xl text-xs text-amber-400 font-semibold transition-all whitespace-nowrap">
              Suivre
            </button>
          </form>
          <WalletErrorMsg err={btcErr || btcError} />
        </div>
      </div>
    </div>
  )
}


// ─── Pull-to-refresh ──────────────────────────────────────────────────────────
const PULL_THRESHOLD = 70

function usePullToRefresh(onRefresh) {
  const [pullY,      setPullY]      = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY  = useRef(null)
  const pulling = useRef(false)

  useEffect(() => {
    const onTouchStart = (e) => {
      if (window.scrollY > 0) return
      startY.current = e.touches[0].clientY
      pulling.current = true
    }
    const onTouchMove = (e) => {
      if (!pulling.current || startY.current == null) return
      const delta = e.touches[0].clientY - startY.current
      if (delta > 0) {
        e.preventDefault()
        setPullY(Math.min(delta * 0.5, PULL_THRESHOLD + 20))
      }
    }
    const onTouchEnd = async () => {
      if (!pulling.current) return
      pulling.current = false
      setPullY(py => {
        if (py >= PULL_THRESHOLD && !refreshing) {
          setRefreshing(true)
          Promise.resolve(onRefresh()).finally(() => {
            setRefreshing(false)
            setPullY(0)
          })
          return 50
        }
        return 0
      })
      startY.current = null
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove',  onTouchMove,  { passive: false })
    document.addEventListener('touchend',   onTouchEnd)
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove',  onTouchMove)
      document.removeEventListener('touchend',   onTouchEnd)
    }
  }, [refreshing, onRefresh])

  return { pullY, refreshing }
}

// ─── Page principale ──────────────────────────────────────────────────────────

function BtcQuickAdd({ onConnect }) {
  const [open, setOpen] = React.useState(false)
  const [val,  setVal]  = React.useState('')
  const [err,  setErr]  = React.useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const addr = val.trim()
    if (!isValidBtcAddress(addr)) { setErr('Adresse invalide'); return }
    onConnect(addr)
    setOpen(false)
    setVal('')
    setErr('')
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 bg-amber-500/8 hover:bg-amber-500/15 border border-amber-500/20 rounded-full px-3 py-1.5 text-xs text-amber-400 transition-all">
      <span className="font-bold">₿</span>
      Ajouter BTC
    </button>
  )

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
      <input
        autoFocus
        type="text"
        value={val}
        onChange={e => { setVal(e.target.value); setErr('') }}
        placeholder="bc1q... / 1... / 3..."
        className="bg-surface-muted border border-amber-500/30 rounded-full px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60 w-48 transition-all"
      />
      <button type="submit" className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 rounded-full text-xs text-amber-400 font-semibold transition-all">OK</button>
      <button type="button" onClick={() => { setOpen(false); setErr('') }} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"><X size={13} /></button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </form>
  )
}

export default function Portfolio() {
  const [portfolioCurrency, setPortfolioCurrency] = useState(
    () => localStorage.getItem('mybonus_portfolio_currency') || '€'
  )
  const { convert, rates } = useCurrencyRates('€')
  const portfolioRate = portfolioCurrency === '€' ? 1 : (rates?.[
    portfolioCurrency === '$' ? 'USD' : portfolioCurrency === '£' ? 'GBP' : portfolioCurrency === 'CHF' ? 'CHF' : portfolioCurrency === 'CAD' ? 'CAD' : 'USD'
  ] ?? 1)

  const handlePortfolioCurrency = (c) => {
    setPortfolioCurrency(c)
    localStorage.setItem('mybonus_portfolio_currency', c)
  }

  const { eth, solana, bitcoin } = useWalletContext()
  const { address, isConnected, walletData, loading, error, connectWallet, connectManual, disconnect, refresh } = eth
  const { address: solAddress, solanaData, loading: solLoading, error: solError, connectManual: solConnectManual, disconnect: solDisconnect, refresh: solRefresh } = solana
  const { address: btcAddress, bitcoinData, loading: btcLoading, error: btcError, connectWallet: btcConnectWallet, connectManual: btcConnectManual, disconnect: btcDisconnect, refresh: btcRefresh } = bitcoin

  const [activeTab,     setActiveTab]     = useState('assets')
  const [sendTarget,    setSendTarget]    = useState(null) // { chain, symbol, maxAmount }
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [copied,    setCopied]    = useState(false)
  const [txFilter,  setTxFilter]  = useState('')
  const [txPage,    setTxPage]    = useState(1)
  const [hideZero,  setHideZero]  = useState(false)
  const TX_PER_PAGE = 20

  const hasAny = address || solAddress || btcAddress

  // ── Même logique isLoading que la version originale qui marchait, étendue à BTC
  // ETH et SOL bloquent l'affichage tant qu'ils n'ont pas leurs données
  // BTC ne bloque PAS — il s'ajoute progressivement quand il arrive
  const isLoading = (loading && !walletData) || (solLoading && !solanaData)

  const ethTotal = walletData?.totalValueEur  ?? 0
  const solTotal = solanaData?.totalValueEur  ?? 0
  const btcTotal = bitcoinData?.totalValueEur ?? 0
  const combined = ethTotal + solTotal + btcTotal

  // ── Actifs ──────────────────────────────────────────────────────────────────
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
    if (bitcoinData) {
      assets.push({ key: 'btc-native', symbol: 'BTC', name: 'Bitcoin',
        balance: bitcoinData.btcBalance, valueEur: bitcoinData.btcValueEur,
        chain: 'btc', change24h: bitcoinData.btcPrice?.change24h ?? null })
    }
    return assets.sort((a, b) => (b.valueEur ?? -1) - (a.valueEur ?? -1))
  }, [walletData, solanaData, bitcoinData])

  const filteredAssets = useMemo(() =>
    hideZero ? allAssets.filter(a => (a.valueEur ?? 0) > 0.01) : allAssets
  , [allAssets, hideZero])

  // ── Pie ─────────────────────────────────────────────────────────────────────
  const pieData = useMemo(() =>
    allAssets.filter(a => (a.valueEur ?? 0) > 0.01).slice(0, 8)
      .map(a => ({ name: a.symbol, value: a.valueEur, pct: pct(a.valueEur, combined) }))
  , [allAssets, combined])

  // ── Transactions ─────────────────────────────────────────────────────────────
  const allTxs = useMemo(() => [
    ...(walletData?.transactions  ?? []).map(tx => ({ ...tx, chain: 'eth' })),
    ...(solanaData?.transactions  ?? []).map(tx => ({ ...tx, chain: 'sol' })),
    ...(bitcoinData?.transactions ?? []).map(tx => ({ ...tx, chain: 'btc' })),
  ].filter(tx => tx.hash).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)), [walletData, solanaData, bitcoinData])

  const filteredTxs = useMemo(() => {
    const q = txFilter.toLowerCase()
    if (!q) return allTxs
    return allTxs.filter(tx =>
      tx.hash?.toLowerCase().includes(q) || tx.from?.toLowerCase().includes(q) ||
      tx.to?.toLowerCase().includes(q)   || tx.symbol?.toLowerCase().includes(q)
    )
  }, [allTxs, txFilter])

  const totalPages   = Math.max(1, Math.ceil(filteredTxs.length / TX_PER_PAGE))
  const paginatedTxs = filteredTxs.slice((txPage - 1) * TX_PER_PAGE, txPage * TX_PER_PAGE)
  const handleTxFilter = (v) => { setTxFilter(v); setTxPage(1) }

  const handleCopy = () => {
    const addr = address || solAddress || btcAddress
    if (!addr) return
    navigator.clipboard.writeText(addr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const handleDisconnect = async () => {
    btcDisconnect()
    solDisconnect()
    await disconnect()
  }
  const handleRefresh = useCallback(async () => {
    refresh()
    if (solAddress) solRefresh()
    if (btcAddress) btcRefresh()
  }, [refresh, solAddress, solRefresh, btcAddress, btcRefresh])

  const { pullY, refreshing: pullRefreshing } = usePullToRefresh(handleRefresh)

  // ── Écran connexion ──────────────────────────────────────────────────────────
  if (!hasAny && !loading && !solLoading && !btcLoading) {
    return (
      <AppLayout>
        <ConnectScreen
          onConnectWallet={connectWallet}
          onConnectManual={connectManual}
          onConnectSolana={solConnectManual}
          onConnectBitcoin={btcConnectManual}
          error={error} solError={solError} btcError={btcError}
        />
      </AppLayout>
    )
  }

  const ethChange    = walletData?.ethPrice?.change24h ?? 0
  const isEthUp      = ethChange >= 0
  const changeAbsEur = Math.abs((walletData?.ethBalance ?? 0) * (walletData?.ethPrice?.eur ?? 0) * (ethChange / 100))

  return (
    <AppLayout>
      {/* Bannière erreur refresh — visible même si data déjà chargée */}
      {(error || solError || btcError) && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          {error    && <div className="mb-2"><WalletErrorMsg err={error} /></div>}
          {solError && <div className="mb-2"><WalletErrorMsg err={solError} /></div>}
          {btcError && <div className="mb-2"><WalletErrorMsg err={btcError} /></div>}
        </div>
      )}
      {/* Pull-to-refresh indicator mobile */}
      <div className="flex items-center justify-center overflow-hidden transition-all duration-200 ease-out lg:hidden"
        style={{ height: pullY > 0 ? pullY : 0 }}>
        <div className={clsx('flex items-center gap-2 text-xs transition-colors',
          pullY >= PULL_THRESHOLD ? 'text-brand-400' : 'text-zinc-500')}>
          <RefreshCw size={14} className={clsx(pullRefreshing && 'animate-spin')}
            style={{ transform: !pullRefreshing ? `rotate(${Math.min(pullY / PULL_THRESHOLD, 1) * 180}deg)` : undefined }} />
          {pullRefreshing ? 'Actualisation…' : pullY >= PULL_THRESHOLD ? 'Relâcher pour actualiser' : 'Tirer vers le bas pour recharger'}
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-12">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="pt-6 pb-6">

          {/* 1. Sélecteur devise — centré tout en haut */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {['€', '$', '£', 'CHF'].map(c => (
              <button key={c} onClick={() => handlePortfolioCurrency(c)}
                className={clsx('px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all border',
                  portfolioCurrency === c
                    ? 'bg-brand-500/15 border-brand-500/30 text-brand-400'
                    : 'bg-surface-muted border-surface-border text-zinc-500 hover:text-zinc-300'
                )}>{c}</button>
            ))}
          </div>

          {/* 2. Wallets connectés */}
          <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden mb-5">
            <div className="px-4 py-3 flex flex-wrap gap-x-4 gap-y-2 border-b border-surface-border">
              {address && (
                <a href={`https://etherscan.io/address/${address}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors">
                  <span className="text-blue-400">Ξ</span>{shortAddr(address)}<ExternalLink size={9} className="opacity-50" />
                </a>
              )}
              {solAddress && (
                <a href={`https://solscan.io/account/${solAddress}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors">
                  <span className="text-purple-400">◎</span>{solAddress.slice(0,4)}…{solAddress.slice(-4)}<ExternalLink size={9} className="opacity-50" />
                </a>
              )}
              {btcAddress ? (
                <div className="flex items-center gap-1.5">
                  <a href={`https://blockstream.info/address/${btcAddress}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors">
                    <span className="text-amber-400">₿</span>{btcAddress.slice(0,6)}…{btcAddress.slice(-4)}<ExternalLink size={9} className="opacity-50" />
                  </a>
                  <button onClick={btcDisconnect} className="text-zinc-600 hover:text-red-400 transition-colors">
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <BtcQuickAdd onConnect={btcConnectManual} />
              )}
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <button onClick={handleRefresh} disabled={loading || solLoading || btcLoading}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                <RefreshCw size={11} className={clsx((loading || solLoading || btcLoading) && 'animate-spin')} />
                Actualiser
              </button>
              <button onClick={handleDisconnect}
                className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 transition-colors">
                <Unplug size={11} />
                Déconnecter
              </button>
            </div>
          </div>

          {/* 3. Total — centré juste au-dessus de la répartition */}
          <div className="text-center mb-1">
            {isLoading ? (
              <div className="h-10 w-40 bg-surface-muted rounded-2xl animate-pulse mx-auto" />
            ) : (
              <div className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight">
                {fmtEur(combined, portfolioCurrency, portfolioRate)}
              </div>
            )}
            <p className="text-xs text-zinc-500">Valeur totale</p>
          </div>

        </div>

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
                        <p className="text-zinc-400 font-mono">{fmtEur(d.value, portfolioCurrency, portfolioRate)}</p>
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
                    <span className="text-xs text-zinc-900 dark:text-zinc-300 font-mono w-20 text-right">{fmtEur(d.value, portfolioCurrency, portfolioRate)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Onglets ──────────────────────────────────────────────────────── */}
        {hasAny && (
          <div className="flex bg-surface-card border border-surface-border rounded-2xl p-1 mb-4 gap-1">
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

        {/* Toggle masquer soldes nuls */}
        {!isLoading && activeTab === 'assets' && allAssets.length > 0 && (
          <div className="flex justify-end mb-2">
            <button onClick={() => setHideZero(h => !h)}
              className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors">
              <div className={clsx(
                'w-8 h-4 rounded-full transition-all relative',
                hideZero ? 'bg-brand-500' : 'bg-surface-muted border border-surface-border'
              )}>
                <div className={clsx(
                  'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all',
                  hideZero ? 'left-4' : 'left-0.5'
                )} />
              </div>
              Masquer les soldes nuls
            </button>
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
            {filteredAssets.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <Wallet size={32} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">{hideZero ? 'Aucun actif avec solde non nul' : 'Aucun actif détecté'}</p>
              </div>
            ) : filteredAssets.map((asset, i) => {
              const { key, ...assetProps } = asset
              return (
                <div key={key} className={clsx(i > 0 && 'border-t border-surface-border')}>
                  <TokenRow
                    {...assetProps}
                    allTotal={combined}
                    onClick={() => setSelectedAsset(asset)}
                    currency={portfolioCurrency}
                    rate={portfolioRate}
                  />
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
            {(walletData?.lastUpdated || solanaData?.lastUpdated || bitcoinData?.lastUpdated) && (() => {
              try {
                const d = walletData?.lastUpdated ?? solanaData?.lastUpdated ?? bitcoinData?.lastUpdated
                return <p className="text-xs text-zinc-700 text-right mt-2 px-1">Mis à jour à {format(d, 'HH:mm:ss')}</p>
              } catch { return null }
            })()}
          </div>
        )}

      </div>
      {/* Token detail modal */}
      {selectedAsset && (
        <TokenModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onSend={
            (selectedAsset.chain === 'eth' && isConnected) ||
            (selectedAsset.chain === 'sol' && !!solAddress) ||
            (selectedAsset.chain === 'btc' && !!btcAddress)
              ? () => {
                  setSendTarget({ chain: selectedAsset.chain, symbol: selectedAsset.symbol, maxAmount: selectedAsset.balance })
                  setSelectedAsset(null)
                }
              : undefined
          }
        />
      )}
      {sendTarget && (
        <SendModal
          chain={sendTarget.chain}
          symbol={sendTarget.symbol}
          maxAmount={sendTarget.maxAmount}
          onClose={() => setSendTarget(null)}
        />
      )}
    </AppLayout>
  )
}
