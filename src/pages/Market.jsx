import { useState, useEffect, useCallback, useRef, memo } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { Search, RefreshCw, BarChart3 } from 'lucide-react'
import clsx from 'clsx'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

// ── Constants ────────────────────────────────────────────────────────────────

const TIME_FILTERS = [
  { id: '1h',  label: '1H',  days: 1,  minutesBack: 60  },
  { id: '24h', label: '24H', days: 1,  minutesBack: null },
  { id: '7d',  label: '7J',  days: 7,  minutesBack: null },
  { id: '1m',  label: '1M',  days: 30, minutesBack: null },
]

const COINS_LIST = [
  // Top market cap
  'bitcoin','ethereum','binancecoin','ripple','solana',
  'cardano','dogecoin','tron','avalanche-2','shiba-inu',
  // DeFi & infra
  'chainlink','polkadot','uniswap','polygon','near',
  'litecoin','the-open-network','internet-computer','aptos','arbitrum',
  // Tendance / hype
  'pepe','bonk','dogwifcoin','floki','brett-based',
  'sui','sei-network','injective-protocol','celestia','render-token',
  // Ecosystèmes
  'cosmos','algorand','vechain','filecoin','hedera-hashgraph',
  'optimism','base','mantle','stacks','immutable-x',
  'hyperliquid',
]

// Intervalles larges — fluide sans spam
const LIVE_INTERVAL   = 90_000       // prix live toutes les 90s
const MARKET_INTERVAL = 5 * 60_000   // marché toutes les 5 min
const CHART_TTL       = 10 * 60_000  // cache graphique 10 min
const PULL_THRESHOLD  = 70

// ── API — état global pour éviter les requêtes concurrentes ──────────────────

let _backoffUntil   = 0
let _inflightMarket = null

const CG_KEY     = import.meta.env.VITE_COINGECKO_KEY ?? ''
const CG_HEADERS = CG_KEY ? { 'x-cg-demo-api-key': CG_KEY } : {}

// Compteur de "Load failed" consécutifs pour détecter le rate-limit déguisé en CORS error
let _loadFailCount = 0
let _loadFailTs    = 0

async function cgFetch(url) {
  if (Date.now() < _backoffUntil) throw new Error('backoff')
  let res
  try {
    res = await fetch(url, { headers: CG_HEADERS, signal: AbortSignal.timeout(8000) })
  } catch (e) {
    const msg = (e?.message ?? '').toLowerCase()
    // Sur Safari/iOS, un 429 génère un CORS error "Load failed" avant qu'on lise le status
    if (msg === 'load failed' || msg.includes('load failed')) {
      const now = Date.now()
      if (now - _loadFailTs > 30_000) _loadFailCount = 0
      _loadFailCount++
      _loadFailTs = now
      if (_loadFailCount >= 2) {
        // Plusieurs "Load failed" consécutifs = très probablement du rate-limit
        _backoffUntil = Date.now() + 60_000
        _loadFailCount = 0
        throw new Error('rate-limit')
      }
    }
    if (e.name === 'TimeoutError' || e.name === 'AbortError') throw new Error('timeout')
    throw new Error('network')
  }
  if (res.status === 429) {
    _backoffUntil = Date.now() + 60_000
    _loadFailCount = 0
    throw new Error('rate-limit')
  }
  if (!res.ok) throw new Error(`api-error ${res.status}`)
  _loadFailCount = 0  // reset si succès
  return res.json()
}

async function fetchMarkets() {
  if (_inflightMarket) return _inflightMarket
  const ids = COINS_LIST.join(',')
  _inflightMarket = cgFetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&ids=${ids}&order=market_cap_desc&per_page=41&page=1&sparkline=true&price_change_percentage=1h,24h,7d,30d`
  ).finally(() => { _inflightMarket = null })
  return _inflightMarket
}

async function fetchLivePrice(coinId) {
  const data = await cgFetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=eur`)
  return data[coinId]?.eur ?? null
}

// ── Cache graphique global — clé par (coinId + filterId) ─────────────────────
// Séparé du state React pour ne PAS déclencher de re-render sur les CoinRow
const _chartCache = {}

async function fetchChart(coinId, days, minutesBack = null) {
  const key   = `${coinId}-${days}-${minutesBack}`
  const entry = _chartCache[key]
  if (entry && Date.now() - entry.ts < CHART_TTL) return entry.data
  if (Date.now() < _backoffUntil) return entry?.data ?? []

  const data = await cgFetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=eur&days=${days}`
  )
  let pts = data.prices.map(([ts, price]) => ({ ts, price }))
  if (minutesBack != null) {
    const cutoff = Date.now() - minutesBack * 60 * 1000
    pts = pts.filter(p => p.ts >= cutoff)
  }
  const step   = Math.max(1, Math.floor(pts.length / 120))
  const result = pts.filter((_, i) => i % step === 0)
  _chartCache[key] = { data: result, ts: Date.now() }
  return result
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(v) {
  if (v == null || isNaN(v)) return '—'
  if (v >= 1000) return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
  if (v >= 1)    return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 6 }) + ' €'
}
function fmtPct(v) {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}
function fmtMcap(v) {
  if (!v) return '—'
  if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T €'
  if (v >= 1e9)  return (v / 1e9).toFixed(2)  + 'B €'
  if (v >= 1e6)  return (v / 1e6).toFixed(1)  + 'M €'
  return v.toLocaleString('fr-FR') + ' €'
}
function fmtChartDate(ts, filter) {
  const d = new Date(ts)
  if (filter === '1h' || filter === '24h')
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// ── Pull-to-refresh ───────────────────────────────────────────────────────────

function usePullToRefresh(onRefresh) {
  const [pullY,      setPullY]      = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY  = useRef(null)
  const pulling = useRef(false)

  useEffect(() => {
    const onTouchStart = (e) => {
      if (window.scrollY > 0) return
      startY.current  = e.touches[0].clientY
      pulling.current = true
    }
    const onTouchMove = (e) => {
      if (!pulling.current || startY.current == null) return
      const delta = e.touches[0].clientY - startY.current
      if (delta > 0) { e.preventDefault(); setPullY(Math.min(delta * 0.5, PULL_THRESHOLD + 20)) }
    }
    const onTouchEnd = async () => {
      if (!pulling.current) return
      pulling.current = false
      setPullY(py => {
        if (py >= PULL_THRESHOLD && !refreshing) {
          setRefreshing(true)
          onRefresh().finally(() => { setRefreshing(false); setPullY(0) })
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

// ── LiveDot ───────────────────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  )
}

// ── Sparkline — memo pour éviter les re-renders inutiles ──────────────────────

const Sparkline = memo(function Sparkline({ data, isUp }) {
  if (!data || data.length < 2) return <div className="w-20 h-8" />
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const W = 80, H = 32
  const pts = data.map((p, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((p - min) / range) * H
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline points={pts} fill="none"
        stroke={isUp ? '#22c55e' : '#ef4444'} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
})

// ── CoinRow — memo + listFilter SÉPARÉ du chartFilter ────────────────────────
// listFilter : contrôle la variation % affichée dans la liste (ne touche PAS au graphique)

const CoinRow = memo(function CoinRow({ coin, listFilter, livePrice, onClick, isSelected }) {
  const pctKey = listFilter === '1h'  ? 'price_change_percentage_1h_in_currency'
               : listFilter === '24h' ? 'price_change_percentage_24h_in_currency'
               : listFilter === '7d'  ? 'price_change_percentage_7d_in_currency'
               : 'price_change_percentage_30d_in_currency'
  const pct        = coin[pctKey]
  const isUp       = (pct ?? 0) >= 0
  const price      = isSelected && livePrice != null ? livePrice : coin.current_price
  const sparkData  = coin.sparkline_in_7d?.price ?? []

  return (
    <button onClick={() => onClick(coin)}
      className={clsx(
        'w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/30 transition-colors text-left border-b border-surface-border last:border-0',
        isSelected && 'bg-brand-500/5 border-l-2 border-l-brand-500'
      )}>
      <div className="w-6 text-center shrink-0">
        <span className="text-xs text-zinc-600 font-mono">{coin.market_cap_rank}</span>
      </div>
      <img src={coin.image} alt={coin.name} className="w-9 h-9 rounded-full shrink-0" loading="lazy" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{coin.name}</p>
        <p className="text-xs text-zinc-500 font-mono uppercase">{coin.symbol}</p>
      </div>
      <div className="hidden sm:block shrink-0">
        <Sparkline data={sparkData.slice(-48)} isUp={isUp} />
      </div>
      <div className="hidden sm:flex text-right shrink-0 w-20 justify-end">
        <p className={clsx('text-xs font-mono font-semibold', isUp ? 'text-emerald-400' : 'text-red-400')}>
          {isUp ? '▲' : '▼'} {Math.abs(pct ?? 0).toFixed(2)}%
        </p>
      </div>
      <div className="text-right shrink-0 w-28">
        <p className={clsx('text-sm font-semibold font-mono transition-colors duration-300',
          isSelected ? 'text-brand-400' : 'text-zinc-900 dark:text-white')}>
          {fmtEur(price)}
        </p>
        <p className="text-xs text-zinc-600 font-mono">{fmtMcap(coin.market_cap)}</p>
      </div>
    </button>
  )
})

// ── ChartTooltip ──────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, filter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1">{fmtChartDate(label, filter)}</p>
      <p className="text-zinc-900 dark:text-white font-semibold font-mono">{fmtEur(payload[0].value)}</p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Market() {
  const [coins,        setCoins]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [errorType,    setErrorType]    = useState(null) // 'rate-limit' | 'network' | 'generic'
  const [search,       setSearch]       = useState('')

  // ── DEUX filtres INDÉPENDANTS ─────────────────────────────────────────────
  // listFilter  : variation % dans la liste des coins (ne déclenche PAS de fetch graphique)
  // chartFilter : période du graphique détail (ne re-render PAS la liste)
  const [listFilter,   setListFilter]   = useState('24h')
  const [chartFilter,  setChartFilter]  = useState('24h')

  const [selectedCoin, setSelectedCoin] = useState(null)
  const [chartData,    setChartData]    = useState([])
  const [chartLoading, setChartLoading] = useState(false)
  const [livePrice,    setLivePrice]    = useState(null)
  const [liveFlash,    setLiveFlash]    = useState(null)
  const [lastUpdated,  setLastUpdated]  = useState(null)
  const [mktRefreshing, setMktRefreshing] = useState(false)

  const liveTimerRef = useRef(null)
  const mktTimerRef  = useRef(null)

  // ── Load market list ────────────────────────────────────────────────────────
  const loadMarkets = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null); setErrorType(null) }
    else setMktRefreshing(true)
    try {
      const data = await fetchMarkets()
      setCoins(data)
      setSelectedCoin(prev => {
        if (!prev) return data[0] ?? null
        return data.find(c => c.id === prev.id) ?? prev
      })
      setLastUpdated(new Date())
    } catch (e) {
      if (!silent) {
        if (e.message === 'rate-limit' || e.message === 'backoff') {
          setError('Trop de requêtes — patiente quelques secondes puis réessaie.')
          setErrorType('rate-limit')
        } else if (e.message === 'network' || e.message === 'timeout') {
          setError('Pas de connexion réseau. Vérifie ta connexion internet.')
          setErrorType('network')
        } else if ((e.message ?? '').toLowerCase().includes('load failed')) {
          // "Load failed" sur Safari = CORS block, probablement du rate-limit
          setError('Trop de requêtes — patiente quelques secondes puis réessaie.')
          setErrorType('rate-limit')
        } else {
          setError('Impossible de charger les données. Réessaie dans un moment.')
          setErrorType('generic')
        }
      }
    } finally {
      if (!silent) setLoading(false)
      else setMktRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadMarkets()
    mktTimerRef.current = setInterval(() => loadMarkets(true), MARKET_INTERVAL)
    return () => clearInterval(mktTimerRef.current)
  }, [loadMarkets])

  // ── Live price — seulement pour le coin sélectionné, 90s ─────────────────
  useEffect(() => {
    if (!selectedCoin) return
    setLivePrice(selectedCoin.current_price)

    const poll = async () => {
      if (Date.now() < _backoffUntil) return
      try {
        const newPrice = await fetchLivePrice(selectedCoin.id)
        if (newPrice == null) return
        setLivePrice(prev => {
          if (newPrice !== prev && prev != null) {
            const dir = newPrice > prev ? 'up' : 'down'
            setLiveFlash(dir)
            setTimeout(() => setLiveFlash(null), 600)
            // Ajoute le point au graphique sans refetch
            setChartData(pts => {
              if (!pts.length) return pts
              const next = [...pts, { ts: Date.now(), price: newPrice }]
              return next.length > 150 ? next.slice(-150) : next
            })
          }
          return newPrice
        })
      } catch { }
    }

    const t0 = setTimeout(poll, 15_000)
    liveTimerRef.current = setInterval(poll, LIVE_INTERVAL)
    return () => { clearTimeout(t0); clearInterval(liveTimerRef.current) }
  }, [selectedCoin?.id])

  // ── Fetch chart — UNIQUEMENT sur changement de coin OU chartFilter ────────
  // N'est PAS déclenché par listFilter — les deux sont totalement indépendants
  useEffect(() => {
    if (!selectedCoin) return
    const tf  = TIME_FILTERS.find(t => t.id === chartFilter)
    const key = `${selectedCoin.id}-${tf.days}-${tf.minutesBack}`

    const cached = _chartCache[key]
    if (cached && Date.now() - cached.ts < CHART_TTL) {
      setChartData(cached.data)
      return
    }
    if (Date.now() < _backoffUntil) {
      if (cached) setChartData(cached.data)
      return
    }

    setChartLoading(true)
    fetchChart(selectedCoin.id, tf.days, tf.minutesBack)
      .then(data => setChartData(data))
      .catch(() => setChartData(_chartCache[key]?.data ?? []))
      .finally(() => setChartLoading(false))
  }, [selectedCoin?.id, chartFilter])   // ← chartFilter seulement, pas listFilter

  const handleSelectCoin = useCallback((coin) => {
    setSelectedCoin(coin)
    setLivePrice(coin.current_price)
    setLiveFlash(null)
    // Sur mobile, scroll vers le panel détail qui s'affiche en haut
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        document.getElementById('coin-detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    }
  }, [])

  // ── Pull-to-refresh — vide uniquement le cache du coin sélectionné ────────
  const handlePull = useCallback(async () => {
    if (selectedCoin) {
      Object.keys(_chartCache).forEach(k => { if (k.startsWith(selectedCoin.id + '-')) delete _chartCache[k] })
    }
    await loadMarkets(true)
  }, [loadMarkets, selectedCoin])

  const { pullY, refreshing: pullRefreshing } = usePullToRefresh(handlePull)

  // ── Computed ──────────────────────────────────────────────────────────────
  const filteredCoins = coins.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.symbol.toLowerCase().includes(search.toLowerCase())
  )

  const displayPrice = livePrice ?? selectedCoin?.current_price
  const chartMin  = chartData.length ? Math.min(...chartData.map(d => d.price)) * 0.998 : 0
  const chartMax  = chartData.length ? Math.max(...chartData.map(d => d.price)) * 1.002 : 0
  const chartIsUp = chartData.length >= 2
    ? chartData[chartData.length - 1].price >= chartData[0].price : true

  const pctKey   = chartFilter === '1h'  ? 'price_change_percentage_1h_in_currency'
                 : chartFilter === '24h' ? 'price_change_percentage_24h_in_currency'
                 : chartFilter === '7d'  ? 'price_change_percentage_7d_in_currency'
                 : 'price_change_percentage_30d_in_currency'
  const coinPct  = selectedCoin ? (selectedCoin[pctKey] ?? 0) : 0
  const coinIsUp = coinPct >= 0

  return (
    <AppLayout>
      {/* Pull indicator */}
      <div className="flex items-center justify-center overflow-hidden transition-all duration-200 ease-out"
        style={{ height: pullY > 0 ? pullY : 0 }}>
        <div className={clsx('flex items-center gap-2 text-xs transition-colors',
          pullY >= PULL_THRESHOLD ? 'text-brand-400' : 'text-zinc-500')}>
          <RefreshCw size={14} className={clsx(pullRefreshing && 'animate-spin')}
            style={{ transform: !pullRefreshing ? `rotate(${Math.min(pullY / PULL_THRESHOLD, 1) * 180}deg)` : undefined }} />
          {pullRefreshing ? 'Actualisation…' : pullY >= PULL_THRESHOLD ? 'Relâcher pour actualiser' : 'Tirer pour actualiser'}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <BarChart3 size={22} className="text-brand-400" />
              Crypto
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <LiveDot />
              <p className="text-xs text-zinc-500">
                Live · {lastUpdated
                  ? lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '—'}
              </p>
            </div>
          </div>
          <button onClick={() => loadMarkets(true)} disabled={loading || mktRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-surface-card border border-surface-border rounded-xl text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all">
            <RefreshCw size={12} className={clsx((loading || mktRefreshing) && 'animate-spin')} />
            {mktRefreshing ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4 text-sm text-red-400 flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">
              
            </span>
            <div>
              <p className="font-semibold">{error}</p>
              {errorType === 'rate-limit' && (
                <p className="text-xs text-red-400/70 mt-1">Les données précédentes sont affichées si disponibles.</p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4" id="market-layout">

          {/* Liste — contrôlée par listFilter uniquement */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {/* listFilter — ne touche PAS au graphique */}
              <div className="flex bg-surface-card border border-surface-border rounded-xl p-1 gap-1">
                {TIME_FILTERS.map(tf => (
                  <button key={tf.id} onClick={() => setListFilter(tf.id)}
                    className={clsx('px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                      listFilter === tf.id
                        ? 'bg-surface-muted text-zinc-900 dark:text-white'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300')}>
                    {tf.label}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-[160px]">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-full bg-surface-card border border-surface-border rounded-xl pl-8 pr-3 py-2 text-xs placeholder:text-zinc-500 text-zinc-900 dark:text-white focus:outline-none focus:border-brand-500/40 transition-all" />
              </div>
            </div>

            <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              <div className="w-6 text-center">#</div>
              <div className="w-9" />
              <div className="flex-1">Actif</div>
              <div className="hidden sm:block w-20 text-right">7J</div>
              <div className="hidden sm:block w-20 text-right">Var.</div>
              <div className="w-28 text-right">Prix / Mcap</div>
            </div>

            <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
              {loading ? [...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-surface-border last:border-0">
                  <div className="w-6 h-3 bg-surface-muted rounded animate-pulse" />
                  <div className="w-9 h-9 bg-surface-muted rounded-full animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 bg-surface-muted rounded animate-pulse" />
                    <div className="h-2.5 w-12 bg-surface-muted rounded animate-pulse" />
                  </div>
                  <div className="w-16 h-3 bg-surface-muted rounded animate-pulse" />
                  <div className="w-24 h-3 bg-surface-muted rounded animate-pulse" />
                </div>
              )) : filteredCoins.length === 0 ? (
                <div className="text-center py-16 text-zinc-600">
                  <p className="text-sm">Aucun résultat</p>
                </div>
              ) : filteredCoins.map(coin => (
                <CoinRow
                  key={coin.id}
                  coin={coin}
                  listFilter={listFilter}
                  livePrice={selectedCoin?.id === coin.id ? livePrice : null}
                  onClick={handleSelectCoin}
                  isSelected={selectedCoin?.id === coin.id}
                />
              ))}
            </div>
          </div>

          {/* Détail — contrôlé par chartFilter uniquement */}
          {selectedCoin && (
            <div id="coin-detail-panel" className="lg:w-80 xl:w-96 shrink-0 space-y-4 order-first lg:order-last">
              {/* Header mobile — visible uniquement sur petits écrans */}
              <div className="flex items-center justify-between lg:hidden mb-1">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Détail</p>
                <button
                  onClick={() => setSelectedCoin(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white px-2 py-1 rounded-lg bg-surface-muted transition-colors">
                  Fermer
                </button>
              </div>

              {/* Header coin */}
              <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <img src={selectedCoin.image} alt={selectedCoin.name} className="w-12 h-12 rounded-full" />
                  <div>
                    <p className="text-base font-bold text-zinc-900 dark:text-white">{selectedCoin.name}</p>
                    <p className="text-xs text-zinc-500 font-mono uppercase flex items-center gap-1.5">
                      {selectedCoin.symbol} <LiveDot /> <span className="text-zinc-600">live</span>
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className={clsx('text-xl font-bold font-mono transition-colors duration-300',
                      liveFlash === 'up'   ? 'text-emerald-400' :
                      liveFlash === 'down' ? 'text-red-400'     : 'text-zinc-900 dark:text-white')}>
                      {fmtEur(displayPrice)}
                    </p>
                    <span className={clsx('text-xs font-semibold font-mono px-2 py-0.5 rounded-lg',
                      coinIsUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                      {coinIsUp ? '▲' : '▼'} {Math.abs(coinPct).toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Cap. Marché', value: fmtMcap(selectedCoin.market_cap) },
                    { label: 'Vol. 24h',    value: fmtMcap(selectedCoin.total_volume) },
                    { label: 'ATH',         value: fmtEur(selectedCoin.ath) },
                    { label: 'Rang',        value: `#${selectedCoin.market_cap_rank}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-surface-muted rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">{label}</p>
                      <p className="text-sm font-semibold font-mono text-zinc-900 dark:text-white">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Variations dans le panel détail — ces boutons changent chartFilter */}
                <div className="mt-3 pt-3 border-t border-surface-border">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Variations</p>
                  <div className="flex gap-2">
                    {TIME_FILTERS.map(tf => {
                      const k = tf.id === '1h'  ? 'price_change_percentage_1h_in_currency'
                              : tf.id === '24h' ? 'price_change_percentage_24h_in_currency'
                              : tf.id === '7d'  ? 'price_change_percentage_7d_in_currency'
                              : 'price_change_percentage_30d_in_currency'
                      const v  = selectedCoin[k]
                      const up = (v ?? 0) >= 0
                      return (
                        <button key={tf.id} onClick={() => setChartFilter(tf.id)}
                          className={clsx('flex flex-col items-center px-2 py-1.5 rounded-lg flex-1 transition-all',
                            chartFilter === tf.id
                              ? 'bg-brand-500/10 border border-brand-500/20'
                              : 'bg-surface-muted hover:bg-surface-border')}>
                          <span className="text-[10px] text-zinc-500 mb-0.5">{tf.label}</span>
                          <span className={clsx('text-xs font-mono font-semibold', up ? 'text-emerald-400' : 'text-red-400')}>
                            {fmtPct(v)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Graphique — chartFilter uniquement */}
              <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Évolution du prix</p>
                    <LiveDot />
                  </div>
                  <div className="flex bg-surface-muted rounded-lg p-0.5 gap-0.5">
                    {TIME_FILTERS.map(tf => (
                      <button key={tf.id} onClick={() => setChartFilter(tf.id)}
                        className={clsx('px-2 py-1 text-[10px] font-semibold rounded-md transition-all',
                          chartFilter === tf.id
                            ? 'bg-surface-card text-zinc-900 dark:text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300')}>
                        {tf.label}
                      </button>
                    ))}
                  </div>
                </div>

                {chartLoading ? (
                  <div className="h-48 bg-surface-muted rounded-xl animate-pulse" />
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={190}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={chartIsUp ? '#22c55e' : '#ef4444'} stopOpacity={0.18} />
                          <stop offset="95%" stopColor={chartIsUp ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="ts" tickFormatter={ts => fmtChartDate(ts, chartFilter)}
                        tick={{ fontSize: 9, fill: '#71717a' }} axisLine={false} tickLine={false}
                        interval="preserveStartEnd" />
                      <YAxis domain={[chartMin, chartMax]}
                        tickFormatter={v => fmtEur(v).replace(' €', '')}
                        tick={{ fontSize: 9, fill: '#71717a' }} axisLine={false} tickLine={false} width={60} />
                      <Tooltip content={<ChartTooltip filter={chartFilter} />} />
                      <Area type="monotone" dataKey="price" isAnimationActive={false}
                        stroke={chartIsUp ? '#22c55e' : '#ef4444'} strokeWidth={1.5}
                        fill="url(#chartGrad)" dot={false}
                        activeDot={{ r: 3, strokeWidth: 0, fill: chartIsUp ? '#22c55e' : '#ef4444' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-zinc-600 text-sm">
                    Données indisponibles
                  </div>
                )}

                {displayPrice && (
                  <div className="mt-3 pt-3 border-t border-surface-border flex items-center justify-between">
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Prix actuel</span>
                    <span className={clsx('text-sm font-bold font-mono transition-colors duration-300',
                      liveFlash === 'up'   ? 'text-emerald-400' :
                      liveFlash === 'down' ? 'text-red-400'     : 'text-zinc-900 dark:text-white')}>
                      {fmtEur(displayPrice)}
                    </span>
                  </div>
                )}
              </div>

              {/* Fourchette 24h */}
              <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-3">Fourchette 24h</p>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-red-400">{fmtEur(selectedCoin.low_24h)}</span>
                  <div className="flex-1 h-1.5 bg-surface-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-500 to-emerald-500 rounded-full"
                      style={{
                        width: selectedCoin.high_24h && selectedCoin.low_24h
                          ? `${Math.max(0, Math.min(100, ((selectedCoin.current_price - selectedCoin.low_24h) / (selectedCoin.high_24h - selectedCoin.low_24h)) * 100))}%`
                          : '50%'
                      }} />
                  </div>
                  <span className="text-xs font-mono text-emerald-400">{fmtEur(selectedCoin.high_24h)}</span>
                </div>
                <p className="text-[10px] text-zinc-600 text-center">Position du prix dans la plage</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
