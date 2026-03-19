const _CG_KEY = import.meta.env.VITE_COINGECKO_KEY ?? ''
const _CG_HEADERS = _CG_KEY ? { 'x-cg-demo-api-key': _CG_KEY } : {}

/**
 * useSolanaWallet
 * Récupère le solde SOL + tokens SPL + transactions via Helius.
 */
import { useState, useCallback, useEffect } from 'react'
import { useAppKitAccount } from '@reown/appkit/react'

const LS_KEY_SOL = 'mybonus_solana_address'

// ─── Clés Helius hardcodées (free tier) ───────────────────────────────────────
const HELIUS_KEY     = import.meta.env.VITE_HELIUS_API_KEY || '0fa8a59f-b33b-4159-8eef-a1094ced3129'
const HELIUS_RPC     = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
const HELIUS_API     = `https://api-mainnet.helius-rpc.com`

// ─── Validation adresse Solana ────────────────────────────────────────────────
export function isValidSolAddress(addr) {
  if (!addr || typeof addr !== 'string') return false
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim())
}

// ─── RPC JSON-RPC via Helius ──────────────────────────────────────────────────
async function solanaRpc(method, params = []) {
  const res = await fetch(HELIUS_RPC, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal:  AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Helius RPC HTTP ${res.status}`)
  const j = await res.json()
  if (j.error) throw new Error(j.error.message ?? 'RPC error')
  return j.result
}

// ─── Prix SOL — CoinGecko d'abord, CoinCap en fallback ───────────────────────
async function fetchSolPrice() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=eur,usd&include_24hr_change=true', { headers: _CG_HEADERS, signal: AbortSignal.timeout(5000) }
    )
    if (!r.ok) throw new Error(`CoinGecko ${r.status}`)
    const j = await r.json()
    if (j.solana?.eur) return { eur: j.solana.eur, usd: j.solana.usd ?? 0, change24h: j.solana.eur_24h_change ?? 0 }
    throw new Error('CoinGecko: vide')
  } catch {
    try {
      const [capRes, fxRes] = await Promise.all([
        fetch('https://api.coincap.io/v2/assets/solana', { signal: AbortSignal.timeout(5000) }),
        fetch('https://api.frankfurter.app/latest?from=USD&to=EUR', { signal: AbortSignal.timeout(4000) }).catch(() => null),
      ])
      if (!capRes.ok) throw new Error('CoinCap fail')
      const j = await capRes.json()
      const usd     = parseFloat(j.data?.priceUsd ?? 0)
      const change  = parseFloat(j.data?.changePercent24Hr ?? 0)
      const eurRate = fxRes?.ok ? (await fxRes.json()).rates?.EUR ?? 0.92 : 0.92
      return { eur: usd * eurRate, usd, change24h: change }
    } catch { return { eur: 0, usd: 0, change24h: 0 } }
  }
}

// ─── Tokens SPL connus ────────────────────────────────────────────────────────
// stableFallback: prix EUR fixe si CoinGecko fail (stablecoins = ~1 USD = ~0.92 EUR)
const KNOWN_SPL = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin',        decimals: 6, cgId: 'usd-coin',  stableFallback: 0.93 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD',       decimals: 6, cgId: 'tether',    stableFallback: 0.93 },
  'So11111111111111111111111111111111111111112':    { symbol: 'wSOL', name: 'Wrapped SOL',      decimals: 9, cgId: 'solana' },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', name: 'Marinade SOL',     decimals: 9, cgId: 'msol' },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk',             decimals: 5, cgId: 'bonk' },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN':  { symbol: 'JUP',  name: 'Jupiter',          decimals: 6, cgId: 'jupiter-exchange-solana' },
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': { symbol: 'WIF',  name: 'dogwifhat',        decimals: 6, cgId: 'dogwifcoin' },
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE':  { symbol: 'ORCA', name: 'Orca',             decimals: 6, cgId: 'orca' },
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof':  { symbol: 'RNDR', name: 'Render',           decimals: 8, cgId: 'render-token' },
  'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux':  { symbol: 'HNT',  name: 'Helium',           decimals: 8, cgId: 'helium' },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { symbol: 'ETH',  name: 'Ether (Wormhole)', decimals: 8, cgId: 'ethereum' },
}

async function fetchSplPrices(mints) {
  const cgIds = [...new Set(mints.map(m => KNOWN_SPL[m]?.cgId).filter(Boolean))]

  // Fallback immédiat pour les stablecoins connus
  const fallbackPrices = {}
  for (const mint of mints) {
    const meta = KNOWN_SPL[mint]
    if (meta?.stableFallback) {
      fallbackPrices[mint] = { eur: meta.stableFallback, usd: 1.0 }
    }
  }

  if (!cgIds.length) return fallbackPrices

  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds.join(',')}&vs_currencies=eur,usd`,
      { headers: _CG_HEADERS, signal: AbortSignal.timeout(6000) }
    )
    if (!r.ok) return fallbackPrices
    const j = await r.json()
    const prices = { ...fallbackPrices }
    for (const mint of mints) {
      const meta = KNOWN_SPL[mint]
      if (meta?.cgId && j[meta.cgId]?.eur) {
        prices[mint] = { eur: j[meta.cgId].eur, usd: j[meta.cgId].usd ?? 0 }
      }
    }
    return prices
  } catch { return fallbackPrices }
}

// ─── Transactions via Helius Enhanced API ────────────────────────────────────
async function fetchSolTransactions(addr) {
  try {
    const url = `${HELIUS_API}/v0/addresses/${addr}/transactions/?api-key=${HELIUS_KEY}&limit=50`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const txs = await res.json()
    if (!Array.isArray(txs)) return []

    return txs.map(tx => {
      // Helius retourne des tx enrichies avec feePayer, nativeTransfers, tokenTransfers
      const ts = (tx.timestamp ?? 0) * 1000

      // Cherche le transfer principal impliquant notre adresse
      const nativeTransfer = (tx.nativeTransfers ?? []).find(
        t => t.fromUserAccount === addr || t.toUserAccount === addr
      )
      const tokenTransfer = (tx.tokenTransfers ?? []).find(
        t => t.fromUserAccount === addr || t.toUserAccount === addr
      )

      let value    = 0
      let symbol   = 'SOL'
      let isToken  = false
      let direction = 'out'

      if (tokenTransfer) {
        const decimals = tokenTransfer.tokenStandard === 'NonFungible' ? 0 : 6
        value     = (tokenTransfer.tokenAmount ?? 0)
        symbol    = KNOWN_SPL[tokenTransfer.mint]?.symbol ?? tokenTransfer.mint?.slice(0, 5) + '…' ?? '?'
        isToken   = true
        direction = tokenTransfer.toUserAccount === addr ? 'in' : 'out'
      } else if (nativeTransfer) {
        value     = (nativeTransfer.amount ?? 0) / 1e9
        symbol    = 'SOL'
        direction = nativeTransfer.toUserAccount === addr ? 'in' : 'out'
      }

      return {
        hash:      tx.signature,
        from:      nativeTransfer?.fromUserAccount ?? tx.feePayer ?? '',
        to:        nativeTransfer?.toUserAccount   ?? '',
        value,
        symbol,
        isToken,
        timestamp: ts > 0 ? ts : Date.now(),
        direction,
        isError:   tx.transactionError != null,
        gasPrice:  (tx.fee ?? 0) / 1e9,
        chain:     'solana',
      }
    }).filter(tx => tx.hash)

  } catch (e) {
    console.warn('[SOL] fetchTransactions error:', e.message)
    return []
  }
}

// ─── Fetch portfolio Solana complet ──────────────────────────────────────────
async function fetchSolanaPortfolio(addr) {
  const [solPrice] = await Promise.all([fetchSolPrice()])

  // 1. Balance SOL
  let solBalance = 0
  try {
    const res = await solanaRpc('getBalance', [addr, { commitment: 'confirmed' }])
    const lamports = typeof res === 'number' ? res : (res?.value ?? 0)
    solBalance = lamports / 1e9
  } catch (e) {
    console.warn('[SOL] getBalance error:', e.message)
  }

  // 2. Tokens SPL
  const splTokens = []
  try {
    const res = await solanaRpc('getTokenAccountsByOwner', [
      addr,
      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ])
    const accounts = res?.value ?? []
    const mints = accounts.map(a => a?.account?.data?.parsed?.info?.mint).filter(Boolean)
    const prices = await fetchSplPrices(mints)

    for (const acct of accounts) {
      const info   = acct?.account?.data?.parsed?.info
      if (!info) continue
      const mint   = info.mint
      const ta     = info.tokenAmount
      const amount = ta?.uiAmount ?? parseFloat(ta?.uiAmountString ?? '0')
      if (!amount || amount < 0.000001) continue
      const meta = KNOWN_SPL[mint]
      const price = prices[mint]
      splTokens.push({
        mint,
        symbol:   meta?.symbol  ?? mint.slice(0, 5) + '…',
        name:     meta?.name    ?? 'SPL Token',
        decimals: ta?.decimals  ?? meta?.decimals ?? 0,
        balance:  amount,
        valueEur: price ? amount * price.eur : null,
        valueUsd: price ? amount * price.usd : null,
        known:    !!meta,
      })
    }
    splTokens.sort((a, b) => (b.valueEur ?? -1) - (a.valueEur ?? -1))
  } catch (e) {
    console.warn('[SOL] SPL tokens error:', e.message)
  }

  // 3. Transactions
  const transactions = await fetchSolTransactions(addr)

  const solValueEur    = solBalance * solPrice.eur
  const tokensValueEur = splTokens.reduce((s, t) => s + (t.valueEur ?? 0), 0)

  return {
    address:       addr,
    chain:         'solana',
    solBalance,
    solPrice,
    solValueEur,
    splTokens,
    tokensValueEur,
    totalValueEur: solValueEur + tokensValueEur,
    transactions,
    lastUpdated:   new Date(),
  }
}

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useSolanaWallet() {
  let wcSolAddr = ''
  try {
    const { address } = useAppKitAccount({ namespace: 'solana' })
    if (address && isValidSolAddress(address)) wcSolAddr = address
  } catch { /* AppKit sans namespace support */ }

  const [manualAddress,    setManualAddress]    = useState(() => localStorage.getItem(LS_KEY_SOL) || '')
  const [disconnected,     setDisconnected]     = useState(false)
  const [solanaData,       setSolanaData]       = useState(null)
  const [loading,          setLoading]          = useState(false)
  const [error,            setError]            = useState(null)

  // Si l'user a explicitement déco, on ignore wcSolAddr jusqu'au prochain connect
  const activeAddress = disconnected ? '' : (wcSolAddr || manualAddress)

  const loadData = useCallback(async (addr) => {
    if (!isValidSolAddress(addr)) { setError('Adresse Solana invalide'); return }
    setLoading(true)
    setError(null)
    setSolanaData(null)
    try {
      const data = await fetchSolanaPortfolio(addr)
      setSolanaData(data)
    } catch (e) {
      setError(e.message ?? 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeAddress && isValidSolAddress(activeAddress)) {
      loadData(activeAddress)
    } else {
      setSolanaData(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAddress])

  // Quand le wallet WC se reconnecte, on reset le flag disconnected
  useEffect(() => {
    if (wcSolAddr) setDisconnected(false)
  }, [wcSolAddr])

  const connectManual = useCallback((addr) => {
    const trimmed = addr.trim()
    if (!isValidSolAddress(trimmed)) { setError('Adresse Solana invalide'); return }
    setError(null)
    setDisconnected(false)
    localStorage.setItem(LS_KEY_SOL, trimmed)
    setManualAddress(trimmed)
  }, [])

  const disconnect = useCallback(() => {
    localStorage.removeItem(LS_KEY_SOL)
    setManualAddress('')
    setDisconnected(true)
    setSolanaData(null)
    setError(null)
  }, [])

  const refresh = useCallback(() => {
    if (activeAddress) loadData(activeAddress)
  }, [activeAddress, loadData])

  return {
    address:         activeAddress,
    isWalletConnect: !!wcSolAddr && !disconnected,
    solanaData,
    loading,
    error,
    connectManual,
    disconnect,
    refresh,
  }
}
