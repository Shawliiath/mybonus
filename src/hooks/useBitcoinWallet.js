/**
 * useBitcoinWallet
 * Prix via priceCache centralisé — zéro requête CoinGecko dédiée.
 */
import { useState, useCallback, useEffect } from 'react'
import { useAppKitAccount, useAppKitEvents } from '@reown/appkit/react'
import { useAppKit } from '@reown/appkit/react'
import { getBtcPrice } from '../services/priceCache'

const LS_KEY_BTC  = 'mybonus_bitcoin_address'
const BLOCKSTREAM = 'https://blockstream.info/api'

export function isValidBtcAddress(addr) {
  if (!addr || typeof addr !== 'string') return false
  const t = addr.trim()
  if (/^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(t)) return true
  if (/^3[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(t)) return true
  if (/^bc1[ac-hj-np-z02-9]{6,87}$/i.test(t))   return true
  return false
}

async function fetchBtcAddress(addr) {
  const r = await fetch(`${BLOCKSTREAM}/address/${addr}`, { signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error(`Blockstream HTTP ${r.status}`)
  return r.json()
}

async function fetchBtcTransactions(addr) {
  try {
    const r = await fetch(`${BLOCKSTREAM}/address/${addr}/txs`, { signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const txs = await r.json()
    if (!Array.isArray(txs)) return []
    return txs.slice(0, 50).map(tx => {
      const inputValue  = (tx.vin  ?? []).reduce((s, inp) => s + (inp.prevout?.scriptpubkey_address === addr ? (inp.prevout?.value ?? 0) : 0), 0)
      const outputValue = (tx.vout ?? []).reduce((s, out) => s + (out.scriptpubkey_address === addr ? (out.value ?? 0) : 0), 0)
      const net   = outputValue - inputValue
      const isIn  = net >= 0
      return {
        hash:      tx.txid,
        from:      isIn ? (tx.vin?.[0]?.prevout?.scriptpubkey_address ?? '') : addr,
        to:        isIn ? addr : (tx.vout?.find(o => o.scriptpubkey_address !== addr)?.scriptpubkey_address ?? ''),
        value:     Math.abs(net) / 1e8,
        symbol:    'BTC',
        timestamp: tx.status?.block_time ? tx.status.block_time * 1000 : 0,
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

async function fetchBitcoinPortfolio(addr) {
  const [addrInfo, btcPrice] = await Promise.all([fetchBtcAddress(addr), getBtcPrice()])
  const cs = addrInfo.chain_stats   ?? {}
  const ms = addrInfo.mempool_stats ?? {}
  const confirmedSat   = (cs.funded_txo_sum ?? 0) - (cs.spent_txo_sum ?? 0)
  const unconfirmedSat = (ms.funded_txo_sum ?? 0) - (ms.spent_txo_sum ?? 0)
  const btcBalance     = confirmedSat / 1e8
  const transactions   = await fetchBtcTransactions(addr)
  return {
    address: addr, chain: 'btc',
    btcBalance, btcBalanceTotal: (confirmedSat + unconfirmedSat) / 1e8,
    btcPrice, btcValueEur: btcBalance * btcPrice.eur,
    totalValueEur: btcBalance * btcPrice.eur,
    txCount: (cs.tx_count ?? 0) + (ms.tx_count ?? 0),
    transactions, lastUpdated: new Date(),
  }
}

export function useBitcoinWallet() {
  const { address: appkitBtcAddress, isConnected: btcConnected } = useAppKitAccount({ namespace: 'bip122' })
  const [manualAddress, setManualAddress] = useState(() => localStorage.getItem(LS_KEY_BTC) || '')
  const [bitcoinData,   setBitcoinData]   = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)
  const activeAddress = appkitBtcAddress || manualAddress

  useAppKitEvents((event) => {
    if (event.data?.namespace === 'bip122' && event.data?.address) console.log('[BTC] Event address:', event.data.address)
  })

  const loadData = useCallback(async (addr) => {
    if (!isValidBtcAddress(addr)) { setError('Adresse Bitcoin invalide'); return }
    setLoading(true); setError(null); setBitcoinData(null)
    try { setBitcoinData(await fetchBitcoinPortfolio(addr)) }
    catch (e) { setError(e.message ?? 'Erreur inconnue') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (activeAddress && isValidBtcAddress(activeAddress)) loadData(activeAddress)
    else setBitcoinData(null)
  }, [activeAddress, loadData])

  const { open } = useAppKit()
  const connectManual = useCallback((addr) => {
    const t = addr.trim()
    if (!isValidBtcAddress(t)) { setError('Adresse Bitcoin invalide'); return }
    setError(null); localStorage.setItem(LS_KEY_BTC, t); setManualAddress(t)
  }, [])
  const connectWallet = useCallback(() => open({ view: 'Connect', namespace: 'bip122' }), [open])
  const disconnect    = useCallback(() => { localStorage.removeItem(LS_KEY_BTC); setManualAddress(''); setBitcoinData(null); setError(null) }, [])
  const refresh       = useCallback(() => { if (activeAddress) loadData(activeAddress) }, [activeAddress, loadData])

  return { address: activeAddress, isConnected: btcConnected || !!manualAddress, bitcoinData, loading, error, connectWallet, connectManual, disconnect, refresh }
}
