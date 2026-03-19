import { classifyWalletError } from '../utils/walletError'
/**
 * useWallet (ETH)
 * Prix via priceCache centralisé — zéro requête CoinGecko dédiée.
 */
import { useState, useCallback, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useAppKit, useDisconnect } from '@reown/appkit/react'
import { getCachedPrices } from '../services/priceCache'

const LS_KEY = 'mybonus_wallet_address'

export function isValidEthAddress(addr) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr?.trim())
}
export function shortAddr(addr) {
  if (!addr) return ''
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

const PUBLIC_RPCS = [
  'https://eth.drpc.org',               // CORS ok, pas de restriction localhost
  'https://ethereum.publicnode.com',    // CORS ok
  'https://rpc.ankr.com/eth',           // Ankr — public, CORS ok
  'https://cloudflare-eth.com',         // Cloudflare — CORS ok
]

async function rpcPost(url, method, params) {
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  if (j.error) throw new Error(j.error.message || 'RPC error')
  return j.result
}

async function rpc(method, params) {
  for (const url of PUBLIC_RPCS) {
    try { return await rpcPost(url, method, params) }
    catch (e) { console.warn(`RPC ${url} failed:`, e.message) }
  }
  throw new Error('Tous les RPC ont échoué')
}

function encodeBalanceOf(addr) {
  return '0x70a08231' + addr.slice(2).toLowerCase().padStart(64, '0')
}

const KNOWN_TOKENS = [
  { contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', decimals: 6,  cgId: 'usd-coin' },
  { contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7', symbol: 'USDT', decimals: 6,  cgId: 'tether' },
  { contractAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH', decimals: 18, cgId: 'weth' },
  { contractAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', symbol: 'WBTC', decimals: 8,  cgId: 'wrapped-bitcoin' },
  { contractAddress: '0x6b175474e89094c44da98b954eedeac495271d0f', symbol: 'DAI',  decimals: 18, cgId: 'dai' },
  { contractAddress: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', symbol: 'UNI',  decimals: 18, cgId: 'uniswap' },
  { contractAddress: '0x514910771af9ca656af840dff83e8264ecf986ca', symbol: 'LINK', decimals: 18, cgId: 'chainlink' },
]

// Stablecoins : prix fixe, pas de requête
// getCachedPrices inclut déjà BTC/ETH/SOL/USDC/USDT/DAI — prix EUR direct depuis CoinGecko
async function fetchTokenPrices() {
  const cached = await getCachedPrices()
  const result = { ...cached }
  if (result.ethereum) result['weth'] = result.ethereum // WETH ≈ ETH
  // Tokens moins courants (UNI, LINK, WBTC) absents du cache principal
  const CG_KEY     = import.meta.env.VITE_COINGECKO_KEY ?? ''
  const CG_HEADERS = CG_KEY ? { 'x-cg-demo-api-key': CG_KEY } : {}
  const extraIds   = KNOWN_TOKENS.map(t => t.cgId).filter(id => !result[id])
  if (extraIds.length > 0) {
    try {
      const r = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${extraIds.join(',')}&vs_currencies=eur,usd`,
        { signal: AbortSignal.timeout(6000), headers: CG_HEADERS }
      )
      if (r.ok) {
        const j = await r.json()
        for (const id of extraIds) {
          if (j[id]) result[id] = { eur: j[id].eur ?? 0, usd: j[id].usd ?? 0, change24h: 0 }
        }
      }
    } catch (e) { console.warn('[ETH] extra token prices fail:', e.message) }
  }
  return result
}

// ─── Transactions via Blockscout ──────────────────────────────────────────────
async function fetchTransactions(addr) {
  try {
    const addrLower = addr.toLowerCase()
    const [txRes, tokenRes] = await Promise.allSettled([
      fetch(`https://eth.blockscout.com/api/v2/addresses/${addr}/transactions`, { signal: AbortSignal.timeout(10000) }),
      fetch(`https://eth.blockscout.com/api/v2/addresses/${addr}/token-transfers`, { signal: AbortSignal.timeout(10000) }),
    ])
    const txMap = new Map()
    if (txRes.status === 'fulfilled' && txRes.value.ok) {
      const data = await txRes.value.json()
      for (const tx of (data.items ?? []).slice(0, 50)) {
        const ts        = tx.timestamp ? new Date(tx.timestamp).getTime() : 0
        const rawVal    = tx.value ? BigInt(tx.value) : 0n
        const direction = tx.from?.hash?.toLowerCase() === addrLower ? 'out' : 'in'
        txMap.set(tx.hash, { hash: tx.hash, from: tx.from?.hash ?? '', to: tx.to?.hash ?? '', value: Number(rawVal) / 1e18, symbol: 'ETH', timestamp: ts, direction, isError: tx.status === 'error', gasPrice: tx.gas_price ? Number(BigInt(tx.gas_price)) / 1e9 : 0 })
      }
    }
    if (tokenRes.status === 'fulfilled' && tokenRes.value.ok) {
      const data = await tokenRes.value.json()
      for (const t of (data.items ?? []).slice(0, 50)) {
        const hash     = t.tx_hash ?? t.transaction_hash
        if (!hash) continue
        const decimals = parseInt(t.total?.decimals ?? t.token?.decimals ?? '18', 10)
        let value = 0
        try {
          const rawStr = (t.total?.value ?? t.value ?? '0').toString()
          const digits = rawStr.replace(/\D/g, '')
          if (digits) value = Number(BigInt(digits)) / Math.pow(10, decimals)
        } catch { value = 0 }
        const ts        = t.timestamp ? new Date(t.timestamp).getTime() : 0
        const fromHash  = t.from?.hash ?? t.from_address_hash ?? ''
        const toHash    = t.to?.hash   ?? t.to_address_hash   ?? ''
        const direction = fromHash.toLowerCase() === addrLower ? 'out' : 'in'
        txMap.set(hash, { hash, from: fromHash, to: toHash, value, symbol: t.token?.symbol ?? '?', timestamp: ts, direction, isError: false, gasPrice: 0 })
      }
    }
    const result = [...txMap.values()].filter(tx => tx.hash).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 30)
    if (result.length > 0) return result
    throw new Error('Blockscout: vide')
  } catch (e) {
    console.warn('[ETH] Blockscout error:', e.message)
    return fetchTransactionsFallback(addr)
  }
}

async function fetchTransactionsFallback(addr) {
  try {
    const addrLower = addr.toLowerCase()
    const [ethData, tokenData] = await Promise.allSettled([
      fetch(`https://api.ethplorer.io/getAddressTransactions/${addr}?limit=25&showZeroValues=1&apiKey=freekey`, { signal: AbortSignal.timeout(8000) }).then(r => r.json()),
      fetch(`https://api.ethplorer.io/getAddressHistory/${addr}?limit=25&type=transfer&apiKey=freekey`, { signal: AbortSignal.timeout(8000) }).then(r => r.json()),
    ])
    const txMap   = new Map()
    const ethList = ethData.status === 'fulfilled' && Array.isArray(ethData.value) ? ethData.value : []
    for (const tx of ethList) {
      txMap.set(tx.hash, { hash: tx.hash, from: tx.from || '', to: tx.to || '', value: tx.value ?? 0, symbol: 'ETH', timestamp: (tx.timestamp ?? 0) * 1000, direction: tx.from?.toLowerCase() === addrLower ? 'out' : 'in', isError: tx.success === false, gasPrice: tx.gasPrice ? tx.gasPrice / 1e9 : 0 })
    }
    const ops = tokenData.status === 'fulfilled' && Array.isArray(tokenData.value?.operations) ? tokenData.value.operations : []
    for (const op of ops) {
      const hash = op.transactionHash
      if (!hash || txMap.has(hash)) continue
      const dec   = parseInt(op.tokenInfo?.decimals ?? '18', 10)
      const value = Number(op.value || 0) / Math.pow(10, dec)
      txMap.set(hash, { hash, from: op.from || '', to: op.to || '', value, symbol: op.tokenInfo?.symbol || '?', timestamp: (op.timestamp ?? 0) * 1000, direction: op.from?.toLowerCase() === addrLower ? 'out' : 'in', isError: false, gasPrice: 0 })
    }
    return [...txMap.values()].filter(tx => tx.hash).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 30)
  } catch { return [] }
}

async function fetchPortfolioData(addr) {
  const addrLower = addr.toLowerCase()
  const prices    = await fetchTokenPrices()
  const ethPrice  = prices['ethereum'] ?? { eur: 0, usd: 0, change24h: 0 }

  const tokenPrices = {}
  for (const t of KNOWN_TOKENS) {
    if (prices[t.cgId]) tokenPrices[t.contractAddress] = { eur: prices[t.cgId].eur, usd: prices[t.cgId].usd }
  }

  let ethBalance = 0
  try {
    const hex  = await rpc('eth_getBalance', [addr, 'latest'])
    ethBalance = parseInt(hex, 16) / 1e18
  } catch (e) { console.warn('ETH balance error:', e.message) }

  const tokens = []
  await Promise.allSettled(KNOWN_TOKENS.map(async (t) => {
    try {
      const hex = await rpc('eth_call', [{ to: t.contractAddress, data: encodeBalanceOf(addrLower) }, 'latest'])
      if (!hex || hex === '0x' || /^0x0+$/.test(hex)) return
      const balance = parseInt(hex, 16) / Math.pow(10, t.decimals)
      if (balance < 0.001) return
      const p = tokenPrices[t.contractAddress]
      tokens.push({ ...t, balance, valueEur: p ? balance * p.eur : null, valueUsd: p ? balance * p.usd : null })
    } catch { }
  }))
  tokens.sort((a, b) => (b.valueEur ?? 0) - (a.valueEur ?? 0))

  const transactions   = await fetchTransactions(addr)
  const ethValueEur    = ethBalance * ethPrice.eur
  const tokensValueEur = tokens.reduce((s, t) => s + (t.valueEur ?? 0), 0)

  return {
    address: addr, ethBalance, ethPrice, ethValueEur,
    tokens, tokensValueEur,
    totalValueEur: ethValueEur + tokensValueEur,
    transactions, lastUpdated: new Date(),
  }
}

export function useWallet() {
  const { address: wagmiAddress, isConnected } = useAccount()
  const { disconnect: appkitDisconnect }       = useDisconnect()
  const { open }                               = useAppKit()

  const [manualAddress, setManualAddress] = useState(() => localStorage.getItem(LS_KEY) || '')
  const [walletData,    setWalletData]    = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)

  const activeAddress = isConnected && wagmiAddress ? wagmiAddress : manualAddress

  const loadData = useCallback(async (addr) => {
    if (!isValidEthAddress(addr)) return
    setLoading(true); setError(null); setWalletData(null)
    try { setWalletData(await fetchPortfolioData(addr)) }
    catch (e) { setError(classifyWalletError(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (activeAddress && isValidEthAddress(activeAddress)) loadData(activeAddress)
    // eslint-disable-next-line
  }, [activeAddress])

  const connectWallet = useCallback(() => open({ view: 'Connect' }), [open])
  const connectManual = useCallback((addr) => {
    addr = addr.trim(); localStorage.setItem(LS_KEY, addr); setManualAddress(addr)
  }, [])
  const disconnect = useCallback(async () => {
    await appkitDisconnect()
    localStorage.removeItem(LS_KEY)
    localStorage.removeItem('mybonus_solana_address')
    setManualAddress(''); setWalletData(null); setError(null)
  }, [appkitDisconnect])
  const refresh = useCallback(() => { if (activeAddress) loadData(activeAddress) }, [activeAddress, loadData])

  return { address: activeAddress, isConnected, walletData, loading, error, connectWallet, connectManual, disconnect, refresh }
}
