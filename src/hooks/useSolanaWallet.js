/**
 * useSolanaWallet
 * Prix via priceCache centralisé — zéro requête CoinGecko dédiée.
 */
import { useState, useCallback, useEffect } from 'react'
import { useAppKitAccount } from '@reown/appkit/react'
import { getSolPrice, getCachedPrices } from '../services/priceCache'

const LS_KEY_SOL = 'mybonus_solana_address'
const HELIUS_KEY = import.meta.env.VITE_HELIUS_API_KEY || '0fa8a59f-b33b-4159-8eef-a1094ced3129'
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
const HELIUS_API = `https://api-mainnet.helius-rpc.com`

export function isValidSolAddress(addr) {
  if (!addr || typeof addr !== 'string') return false
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim())
}

async function solanaRpc(method, params = []) {
  const res = await fetch(HELIUS_RPC, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Helius RPC HTTP ${res.status}`)
  const j = await res.json()
  if (j.error) throw new Error(j.error.message ?? 'RPC error')
  return j.result
}

const KNOWN_SPL = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', decimals: 6, cgId: 'usd-coin' },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', decimals: 6, cgId: 'tether' },
  'So11111111111111111111111111111111111111112':    { symbol: 'wSOL', decimals: 9, cgId: 'solana' },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', decimals: 9, cgId: 'msol' },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', decimals: 5, cgId: 'bonk' },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN':  { symbol: 'JUP',  decimals: 6, cgId: 'jupiter-exchange-solana' },
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': { symbol: 'WIF',  decimals: 6, cgId: 'dogwifcoin' },
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE':  { symbol: 'ORCA', decimals: 6, cgId: 'orca' },
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof':  { symbol: 'RNDR', decimals: 8, cgId: 'render-token' },
  'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux':  { symbol: 'HNT',  decimals: 8, cgId: 'helium' },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { symbol: 'ETH',  decimals: 8, cgId: 'ethereum' },
}

// SPL prices: USDC/USDT depuis le cache CoinGecko principal (prix EUR direct), wSOL idem
async function fetchSplPrices(mints) {
  const prices = {}
  const cached = await getCachedPrices()
  // USDC Solana → prix usd-coin depuis CoinGecko (EUR direct, pas de calcul de taux)
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  if (mints.includes(USDC_MINT) && cached['usd-coin']?.eur > 0) prices[USDC_MINT] = { eur: cached['usd-coin'].eur, usd: 1.0 }
  if (mints.includes(USDT_MINT) && cached['tether']?.eur   > 0) prices[USDT_MINT] = { eur: cached['tether'].eur,   usd: 1.0 }
  // wSOL : réutilise le prix SOL du cache principal
  const solMint = 'So11111111111111111111111111111111111111112'
  if (mints.includes(solMint)) {
    const solPrice = await getSolPrice()
    prices[solMint] = { eur: solPrice.eur, usd: solPrice.usd }
  }
  // Autres tokens connus : une seule requête CoinGecko groupée si besoin
  const needFetch = mints.filter(m => !prices[m] && KNOWN_SPL[m]?.cgId)
  if (needFetch.length > 0) {
    const cgIds = [...new Set(needFetch.map(m => KNOWN_SPL[m]?.cgId).filter(Boolean))]
    try {
      const CG_KEY     = import.meta.env.VITE_COINGECKO_KEY ?? ''
      const CG_HEADERS = CG_KEY ? { 'x-cg-demo-api-key': CG_KEY } : {}
      const r = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds.join(',')}&vs_currencies=eur,usd`,
        { headers: CG_HEADERS, signal: AbortSignal.timeout(6000) }
      )
      if (r.ok) {
        const j = await r.json()
        for (const mint of needFetch) {
          const meta = KNOWN_SPL[mint]
          if (meta?.cgId && j[meta.cgId]?.eur) prices[mint] = { eur: j[meta.cgId].eur, usd: j[meta.cgId].usd ?? 0 }
        }
      }
    } catch { /* silencieux */ }
  }
  return prices
}

async function fetchSolTransactions(addr) {
  try {
    const url = `${HELIUS_API}/v0/addresses/${addr}/transactions/?api-key=${HELIUS_KEY}&limit=50`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const txs = await res.json()
    if (!Array.isArray(txs)) return []
    return txs.map(tx => {
      const ts             = (tx.timestamp ?? 0) * 1000
      const nativeTransfer = (tx.nativeTransfers ?? []).find(t => t.fromUserAccount === addr || t.toUserAccount === addr)
      const tokenTransfer  = (tx.tokenTransfers  ?? []).find(t => t.fromUserAccount === addr || t.toUserAccount === addr)
      let value = 0, symbol = 'SOL', isToken = false, direction = 'out'
      if (tokenTransfer) {
        value     = tokenTransfer.tokenAmount ?? 0
        symbol    = KNOWN_SPL[tokenTransfer.mint]?.symbol ?? tokenTransfer.mint?.slice(0, 5) + '…' ?? '?'
        isToken   = true
        direction = tokenTransfer.toUserAccount === addr ? 'in' : 'out'
      } else if (nativeTransfer) {
        value     = (nativeTransfer.amount ?? 0) / 1e9
        direction = nativeTransfer.toUserAccount === addr ? 'in' : 'out'
      }
      return {
        hash: tx.signature, from: nativeTransfer?.fromUserAccount ?? tx.feePayer ?? '',
        to: nativeTransfer?.toUserAccount ?? '', value, symbol, isToken,
        timestamp: ts > 0 ? ts : Date.now(), direction,
        isError: tx.transactionError != null, gasPrice: (tx.fee ?? 0) / 1e9, chain: 'solana',
      }
    }).filter(tx => tx.hash)
  } catch (e) {
    console.warn('[SOL] fetchTransactions error:', e.message)
    return []
  }
}

async function fetchSolanaPortfolio(addr) {
  // Prix depuis le cache partagé — PAS de requête CoinGecko dédiée
  const solPrice = await getSolPrice()

  let solBalance = 0
  try {
    const res   = await solanaRpc('getBalance', [addr, { commitment: 'confirmed' }])
    const lamps = typeof res === 'number' ? res : (res?.value ?? 0)
    solBalance  = lamps / 1e9
  } catch (e) { console.warn('[SOL] getBalance error:', e.message) }

  const splTokens = []
  try {
    const res = await solanaRpc('getTokenAccountsByOwner', [
      addr,
      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ])
    const accounts = res?.value ?? []
    const mints    = accounts.map(a => a?.account?.data?.parsed?.info?.mint).filter(Boolean)
    const prices   = await fetchSplPrices(mints)
    for (const acct of accounts) {
      const info   = acct?.account?.data?.parsed?.info
      if (!info) continue
      const mint   = info.mint
      const ta     = info.tokenAmount
      const amount = ta?.uiAmount ?? parseFloat(ta?.uiAmountString ?? '0')
      if (!amount || amount < 0.000001) continue
      const meta   = KNOWN_SPL[mint]
      const price  = prices[mint]
      splTokens.push({
        mint, symbol: meta?.symbol ?? mint.slice(0, 5) + '…',
        name: meta?.symbol ?? mint.slice(0, 6),
        decimals: ta?.decimals ?? meta?.decimals ?? 0,
        balance: amount,
        valueEur: price ? amount * price.eur : null,
        valueUsd: price ? amount * price.usd : null,
        known: !!meta,
      })
    }
    splTokens.sort((a, b) => (b.valueEur ?? -1) - (a.valueEur ?? -1))
  } catch (e) { console.warn('[SOL] SPL tokens error:', e.message) }

  const transactions   = await fetchSolTransactions(addr)
  const solValueEur    = solBalance * solPrice.eur
  const tokensValueEur = splTokens.reduce((s, t) => s + (t.valueEur ?? 0), 0)

  return {
    address: addr, chain: 'solana',
    solBalance, solPrice, solValueEur,
    splTokens, tokensValueEur,
    totalValueEur: solValueEur + tokensValueEur,
    transactions, lastUpdated: new Date(),
  }
}

export function useSolanaWallet() {
  let wcSolAddr = ''
  try {
    const { address } = useAppKitAccount({ namespace: 'solana' })
    if (address && isValidSolAddress(address)) wcSolAddr = address
  } catch { }

  const [manualAddress, setManualAddress] = useState(() => localStorage.getItem(LS_KEY_SOL) || '')
  const [disconnected,  setDisconnected]  = useState(false)
  const [solanaData,    setSolanaData]    = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)

  const activeAddress = disconnected ? '' : (wcSolAddr || manualAddress)

  const loadData = useCallback(async (addr) => {
    if (!isValidSolAddress(addr)) { setError('Adresse Solana invalide'); return }
    setLoading(true); setError(null); setSolanaData(null)
    try { setSolanaData(await fetchSolanaPortfolio(addr)) }
    catch (e) { setError(e.message ?? 'Erreur inconnue') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (activeAddress && isValidSolAddress(activeAddress)) loadData(activeAddress)
    else setSolanaData(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAddress])

  useEffect(() => { if (wcSolAddr) setDisconnected(false) }, [wcSolAddr])

  const connectManual = useCallback((addr) => {
    const t = addr.trim()
    if (!isValidSolAddress(t)) { setError('Adresse Solana invalide'); return }
    setError(null); setDisconnected(false); localStorage.setItem(LS_KEY_SOL, t); setManualAddress(t)
  }, [])
  const disconnect = useCallback(() => {
    localStorage.removeItem(LS_KEY_SOL); setManualAddress(''); setDisconnected(true); setSolanaData(null); setError(null)
  }, [])
  const refresh = useCallback(() => { if (activeAddress) loadData(activeAddress) }, [activeAddress, loadData])

  return { address: activeAddress, isWalletConnect: !!wcSolAddr && !disconnected, solanaData, loading, error, connectManual, disconnect, refresh }
}
