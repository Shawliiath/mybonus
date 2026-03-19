const _CG_KEY = import.meta.env.VITE_COINGECKO_KEY ?? ''
const _CG_HEADERS = _CG_KEY ? { 'x-cg-demo-api-key': _CG_KEY } : {}

/**
 * useBitcoinWallet
 * Récupère le solde BTC + transactions via Blockstream.info (API publique, sans clé, CORS ok).
 * Prix via CoinGecko.
 * Supporte toutes les adresses : Legacy (1...), P2SH (3...), Bech32 (bc1q...), Taproot (bc1p...)
 */
import { useState, useCallback, useEffect } from 'react'
import { useAppKitAccount, useAppKitEvents } from '@reown/appkit/react'
import { useAppKit } from '@reown/appkit/react'

const LS_KEY_BTC = 'mybonus_bitcoin_address'

const BLOCKSTREAM = 'https://blockstream.info/api'

// ─── Validation adresse Bitcoin ───────────────────────────────────────────────
export function isValidBtcAddress(addr) {
  if (!addr || typeof addr !== 'string') return false
  const trimmed = addr.trim()
  // Legacy (P2PKH)
  if (/^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(trimmed)) return true
  // P2SH
  if (/^3[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(trimmed)) return true
  // Bech32 SegWit (bc1q...) et Taproot (bc1p...)
  if (/^bc1[ac-hj-np-z02-9]{6,87}$/i.test(trimmed)) return true
  return false
}

// ─── Prix BTC — CoinGecko d'abord, CoinCap en fallback ───────────────────────
async function fetchBtcPrice() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur,usd&include_24hr_change=true', { headers: _CG_HEADERS, signal: AbortSignal.timeout(5000) }
    )
    if (!r.ok) throw new Error(`CoinGecko ${r.status}`)
    const j = await r.json()
    if (j.bitcoin?.eur) return { eur: j.bitcoin.eur, usd: j.bitcoin.usd ?? 0, change24h: j.bitcoin.eur_24h_change ?? 0 }
    throw new Error('CoinGecko: vide')
  } catch {
    try {
      const [capRes, fxRes] = await Promise.all([
        fetch('https://api.coincap.io/v2/assets/bitcoin', { signal: AbortSignal.timeout(5000) }),
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

// ─── Info adresse (balance) via Blockstream ───────────────────────────────────
async function fetchBtcAddress(addr) {
  const r = await fetch(`${BLOCKSTREAM}/address/${addr}`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!r.ok) throw new Error(`Blockstream HTTP ${r.status}`)
  return r.json()
  // Retourne: { address, chain_stats: { funded_txo_sum, spent_txo_sum, tx_count }, mempool_stats }
}

// ─── Transactions via Blockstream ────────────────────────────────────────────
async function fetchBtcTransactions(addr, btcPrice) {
  try {
    const r = await fetch(`${BLOCKSTREAM}/address/${addr}/txs`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const txs = await r.json()
    if (!Array.isArray(txs)) return []

    return txs.slice(0, 50).map(tx => {
      // Calcule la valeur nette pour notre adresse
      // Inputs depuis notre adresse (ce qu'on dépense)
      const inputValue = (tx.vin ?? []).reduce((sum, inp) => {
        const addrs = inp.prevout?.scriptpubkey_address
        return sum + (addrs === addr ? (inp.prevout?.value ?? 0) : 0)
      }, 0)

      // Outputs vers notre adresse (ce qu'on reçoit)
      const outputValue = (tx.vout ?? []).reduce((sum, out) => {
        return sum + (out.scriptpubkey_address === addr ? (out.value ?? 0) : 0)
      }, 0)

      const netSatoshis = outputValue - inputValue
      const isIn = netSatoshis >= 0
      const valueBtc = Math.abs(netSatoshis) / 1e8

      // From/To : cherche l'adresse principale de l'autre côté
      const from = isIn
        ? (tx.vin?.[0]?.prevout?.scriptpubkey_address ?? '')
        : addr
      const to = isIn
        ? addr
        : (tx.vout?.find(o => o.scriptpubkey_address !== addr)?.scriptpubkey_address ?? '')

      const timestamp = tx.status?.block_time
        ? tx.status.block_time * 1000
        : 0  // non confirmé → timestamp 0, sera affiché sans date

      return {
        hash:      tx.txid,
        from,
        to,
        value:     valueBtc,
        symbol:    'BTC',
        timestamp,
        direction: isIn ? 'in' : 'out',
        isError:   false,
        fee:       (tx.fee ?? 0) / 1e8,
        confirmed: tx.status?.confirmed ?? false,
        chain:     'btc',
      }
    }).filter(tx => tx.value > 0)

  } catch (e) {
    console.warn('[BTC] fetchTransactions error:', e.message)
    return []
  }
}

// ─── Portfolio BTC complet ────────────────────────────────────────────────────
async function fetchBitcoinPortfolio(addr) {
  const [addrInfo, btcPrice] = await Promise.all([
    fetchBtcAddress(addr),
    fetchBtcPrice(),
  ])

  const chainStats   = addrInfo.chain_stats ?? {}
  const mempoolStats = addrInfo.mempool_stats ?? {}

  // Balance confirmée (satoshis → BTC)
  const confirmedSat   = (chainStats.funded_txo_sum ?? 0) - (chainStats.spent_txo_sum ?? 0)
  // Balance non confirmée (mempool)
  const unconfirmedSat = (mempoolStats.funded_txo_sum ?? 0) - (mempoolStats.spent_txo_sum ?? 0)

  const btcBalance         = confirmedSat / 1e8
  const btcBalanceTotal    = (confirmedSat + unconfirmedSat) / 1e8
  const btcValueEur        = btcBalance * btcPrice.eur
  const txCount            = (chainStats.tx_count ?? 0) + (mempoolStats.tx_count ?? 0)

  const transactions = await fetchBtcTransactions(addr, btcPrice)

  return {
    address:       addr,
    chain:         'btc',
    btcBalance,
    btcBalanceTotal,
    btcPrice,
    btcValueEur,
    totalValueEur: btcValueEur,
    txCount,
    transactions,
    lastUpdated:   new Date(),
  }
}

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useBitcoinWallet() {
  const { address: appkitBtcAddress, isConnected: btcConnected } = useAppKitAccount({ namespace: 'bip122' })
  const [manualAddress, setManualAddress] = useState(
    () => localStorage.getItem(LS_KEY_BTC) || ''
  )
  const [bitcoinData, setBitcoinData] = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

  // Priorité : wallet AppKit connecté > adresse manuelle
  const activeAddress = appkitBtcAddress || manualAddress

  // Debug: log what AppKit returns for BTC
  if (appkitBtcAddress) console.log('[BTC] AppKit address:', appkitBtcAddress)

  // Listen to all AppKit events to catch BTC connections
  useAppKitEvents((event) => {
    if (event.data?.namespace === 'bip122' && event.data?.address) {
      console.log('[BTC] Event address:', event.data.address)
    }
  })

  const loadData = useCallback(async (addr) => {
    if (!isValidBtcAddress(addr)) { setError('Adresse Bitcoin invalide'); return }
    setLoading(true)
    setError(null)
    setBitcoinData(null)
    try {
      const data = await fetchBitcoinPortfolio(addr)
      setBitcoinData(data)
    } catch (e) {
      setError(e.message ?? 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeAddress && isValidBtcAddress(activeAddress)) {
      loadData(activeAddress)
    } else {
      setBitcoinData(null)
    }
  }, [activeAddress, loadData])

  const connectManual = useCallback((addr) => {
    const trimmed = addr.trim()
    if (!isValidBtcAddress(trimmed)) { setError('Adresse Bitcoin invalide'); return }
    setError(null)
    localStorage.setItem(LS_KEY_BTC, trimmed)
    setManualAddress(trimmed)
  }, [])

  const { open } = useAppKit()

  const connectWallet = useCallback(() => {
    open({ view: 'Connect', namespace: 'bip122' })
  }, [open])

  const disconnect = useCallback(() => {
    localStorage.removeItem(LS_KEY_BTC)
    setManualAddress('')
    setBitcoinData(null)
    setError(null)
  }, [])



  const refresh = useCallback(() => {
    if (activeAddress) loadData(activeAddress)
  }, [activeAddress, loadData])

  return {
    address:       activeAddress,
    isConnected:   btcConnected || !!manualAddress,
    bitcoinData,
    loading,
    error,
    connectWallet,
    connectManual,
    disconnect,
    refresh,
  }
}
