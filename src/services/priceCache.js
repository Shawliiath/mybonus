/**
 * priceCache.js
 * Cache centralisé pour tous les prix.
 * USDC/USDT/DAI inclus dans la requête CoinGecko principale — prix EUR direct, zéro calcul de taux.
 * Fallback : Frankfurter pour le taux EUR/USD si CoinGecko fail.
 */

const CG_KEY     = import.meta.env.VITE_COINGECKO_KEY ?? ''
const CG_HEADERS = CG_KEY ? { 'x-cg-demo-api-key': CG_KEY } : {}

// Tous les coins dans une seule requête — crypto + stablecoins
const ALL_IDS = 'bitcoin,ethereum,solana,usd-coin,tether,dai'

const TTL_MS         = 2 * 60 * 1000  // 2 min
const RETRY_AFTER_MS = 60 * 1000      // backoff 60s après 429

const _cache = {
  data:            null,  // { bitcoin: {eur,usd,change24h}, ethereum: {...}, 'usd-coin': {...}, ... }
  ts:              0,
  inflightPromise: null,
  backoffUntil:    0,
}

// ── Fetch depuis CoinGecko (tous les coins d'un coup) ─────────────────────────
async function _fetchFromCoinGecko() {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ALL_IDS}&vs_currencies=eur,usd&include_24hr_change=true`
  const res = await fetch(url, { headers: CG_HEADERS, signal: AbortSignal.timeout(6000) })
  if (res.status === 429) {
    _cache.backoffUntil = Date.now() + RETRY_AFTER_MS
    throw new Error('rate-limit')
  }
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
  const j      = await res.json()
  const result = {}
  for (const id of ALL_IDS.split(',')) {
    if (j[id]) {
      result[id] = {
        eur:       j[id].eur            ?? 0,
        usd:       j[id].usd            ?? 0,
        change24h: j[id].eur_24h_change ?? 0,
      }
    }
  }
  return result
}

// ── Fallback CoinCap + Frankfurter (si CoinGecko indisponible) ─────────────────
async function _fetchFromFallback() {
  // Taux EUR/USD depuis Frankfurter
  let eurRate = 0.87 // dernière valeur connue approchée — jamais 0.93 hardcodé
  try {
    const fxRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR', { signal: AbortSignal.timeout(5000) })
    if (fxRes.ok) {
      const fx = await fxRes.json()
      if (fx.rates?.EUR) eurRate = fx.rates.EUR
    }
  } catch { }

  // Crypto via CoinCap
  const capRes = await fetch(
    'https://api.coincap.io/v2/assets?ids=bitcoin,ethereum,solana&limit=3',
    { signal: AbortSignal.timeout(6000) }
  )
  if (!capRes.ok) throw new Error('CoinCap fail')
  const capJson = await capRes.json()
  const result  = {}
  for (const asset of capJson.data ?? []) {
    const usd = parseFloat(asset.priceUsd ?? 0)
    result[asset.id] = {
      eur:       usd * eurRate,
      usd,
      change24h: parseFloat(asset.changePercent24Hr ?? 0),
    }
  }
  // Stablecoins : 1 USD × taux réel Frankfurter (pas de valeur hardcodée)
  result['usd-coin'] = { eur: eurRate, usd: 1.0, change24h: 0 }
  result['tether']   = { eur: eurRate, usd: 1.0, change24h: 0 }
  result['dai']      = { eur: eurRate, usd: 1.0, change24h: 0 }
  return result
}

// ── getCachedPrices — point d'entrée unique ────────────────────────────────────
export async function getCachedPrices() {
  if (_cache.data && Date.now() - _cache.ts < TTL_MS) return _cache.data
  if (Date.now() < _cache.backoffUntil) return _cache.data ?? {}
  if (_cache.inflightPromise) return _cache.inflightPromise

  _cache.inflightPromise = (async () => {
    try {
      const data     = await _fetchFromCoinGecko()
      _cache.data    = data
      _cache.ts      = Date.now()
      return data
    } catch (e) {
      console.warn('[priceCache] CoinGecko fail, fallback:', e.message)
      try {
        const data     = await _fetchFromFallback()
        _cache.data    = data
        _cache.ts      = Date.now()
        return data
      } catch (e2) {
        console.warn('[priceCache] Fallback fail:', e2.message)
        return _cache.data ?? {}
      }
    } finally {
      _cache.inflightPromise = null
    }
  })()

  return _cache.inflightPromise
}

// ── Helpers ────────────────────────────────────────────────────────────────────
export async function getBtcPrice()    { const p = await getCachedPrices(); return p.bitcoin    ?? { eur: 0, usd: 0, change24h: 0 } }
export async function getEthPrice()    { const p = await getCachedPrices(); return p.ethereum   ?? { eur: 0, usd: 0, change24h: 0 } }
export async function getSolPrice()    { const p = await getCachedPrices(); return p.solana     ?? { eur: 0, usd: 0, change24h: 0 } }
export async function getUsdcPrice()   { const p = await getCachedPrices(); return p['usd-coin'] ?? { eur: 0, usd: 1, change24h: 0 } }
export async function getUsdtPrice()   { const p = await getCachedPrices(); return p.tether     ?? { eur: 0, usd: 1, change24h: 0 } }

/** Prix EUR d'un stablecoin USD — utilise le prix CoinGecko direct, zéro calcul de taux */
export async function getStableEurPrice() {
  const p = await getCachedPrices()
  // On prend usd-coin comme référence (le plus liquide, CG le price bien)
  const usdc = p['usd-coin']
  if (usdc?.eur > 0) return { eur: usdc.eur, usd: 1.0, change24h: 0 }
  // Fallback : tether
  const usdt = p.tether
  if (usdt?.eur > 0) return { eur: usdt.eur, usd: 1.0, change24h: 0 }
  // Dernier recours Frankfurter direct
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR', { signal: AbortSignal.timeout(5000) })
    if (res.ok) { const j = await res.json(); if (j.rates?.EUR) return { eur: j.rates.EUR, usd: 1.0, change24h: 0 } }
  } catch { }
  return { eur: 0.87, usd: 1.0, change24h: 0 }
}
