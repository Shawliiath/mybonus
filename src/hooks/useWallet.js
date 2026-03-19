import { useState, useCallback, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useAppKit, useDisconnect } from '@reown/appkit/react'

const LS_KEY = 'mybonus_wallet_address'

export function isValidEthAddress(addr) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr?.trim())
}
export function shortAddr(addr) {
  if (!addr) return ''
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

// ─── RPC publics Ethereum mainnet ─────────────────────────────────────────────
const PUBLIC_RPCS = [
  'https://1rpc.io/eth',
  'https://rpc.flashbots.net',
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
]

async function rpcPost(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

// ─── Tokens connus ────────────────────────────────────────────────────────────
const KNOWN_TOKENS = [
  { contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', name: 'USD Coin',       decimals: 6,  cgId: 'usd-coin' },
  { contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7', symbol: 'USDT', name: 'Tether USD',     decimals: 6,  cgId: 'tether' },
  { contractAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH', name: 'Wrapped Ether',  decimals: 18, cgId: 'weth' },
  { contractAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8,  cgId: 'wrapped-bitcoin' },
  { contractAddress: '0x6b175474e89094c44da98b954eedeac495271d0f', symbol: 'DAI',  name: 'Dai Stablecoin', decimals: 18, cgId: 'dai' },
  { contractAddress: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', symbol: 'UNI',  name: 'Uniswap',        decimals: 18, cgId: 'uniswap' },
  { contractAddress: '0x514910771af9ca656af840dff83e8264ecf986ca', symbol: 'LINK', name: 'Chainlink',       decimals: 18, cgId: 'chainlink' },
]

// ─── Prix via plusieurs sources en cascade ────────────────────────────────────
const _CG_KEY = import.meta.env.VITE_COINGECKO_KEY ?? ''
const _CG_HEADERS = _CG_KEY ? { 'x-cg-demo-api-key': _CG_KEY } : {}

async function fetchPrices(cgIds) {
  // Fallback immédiat pour les stablecoins si tout fail
  const stables = { 'usd-coin': 0.93, 'tether': 0.93, 'dai': 0.93 }

  // 1. CoinGecko (avec clé API pour éviter les 429)
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds.join(',')}&vs_currencies=eur,usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(6000), headers: _CG_HEADERS }
    )
    if (!r.ok) throw new Error(`CoinGecko ${r.status}`)
    const j = await r.json()
    const result = {}
    for (const id of cgIds) {
      if (j[id]) result[id] = { eur: j[id].eur ?? 0, usd: j[id].usd ?? 0, change24h: j[id].eur_24h_change ?? 0 }
    }
    // Merge stables fallback with CG results
    for (const [id, price] of Object.entries(stables)) {
      if (!result[id]) result[id] = { eur: price, usd: 1.0, change24h: 0 }
    }
    if (Object.keys(result).length > 0) return result
    throw new Error('CoinGecko: vide')
  } catch (e) {
    console.warn('CoinGecko failed:', e.message)
  }

  // 2. CoinCap + Frankfurter (fallback)
  try {
    const capIds = { 'usd-coin': 'usd-coin', 'tether': 'tether', 'weth': 'ethereum',
      'wrapped-bitcoin': 'wrapped-bitcoin', 'dai': 'multi-collateral-dai',
      'uniswap': 'uniswap', 'chainlink': 'chainlink', 'ethereum': 'ethereum' }
    const assets = [...new Set(cgIds.map(id => capIds[id]).filter(Boolean))]
    const [capRes, fxRes] = await Promise.all([
      fetch(`https://api.coincap.io/v2/assets?ids=${assets.join(',')}&limit=20`, { signal: AbortSignal.timeout(6000) }),
      fetch('https://api.frankfurter.app/latest?from=USD&to=EUR', { signal: AbortSignal.timeout(4000) }).catch(() => null),
    ])
    if (!capRes.ok) throw new Error(`CoinCap ${capRes.status}`)
    const capJson = await capRes.json()
    const eurRate = fxRes?.ok ? (await fxRes.json()).rates?.EUR ?? 0.92 : 0.92
    const result = {}
    for (const asset of (capJson.data ?? [])) {
      const usd = parseFloat(asset.priceUsd ?? 0)
      const change = parseFloat(asset.changePercent24Hr ?? 0)
      const cgId = Object.entries(capIds).find(([, v]) => v === asset.id)?.[0]
      if (cgId) result[cgId] = { usd, eur: usd * eurRate, change24h: change }
    }
    if (Object.keys(result).length > 0) return result
  } catch (e) {
    console.warn('CoinCap failed:', e.message)
  }

  return {}
}

// ─── Transactions via Blockscout API v2 (bon format, sans params invalides) ───
// Doc: https://eth.blockscout.com/api-docs
// Le 422 venait de `filter=to%7Cfrom` et `limit=` qui sont des params invalides en v9+
async function fetchTransactions(addr) {
  try {
    const addrLower = addr.toLowerCase()
    // Sans paramètres supplémentaires — Blockscout v9+ les rejette
    const [txRes, tokenRes] = await Promise.allSettled([
      fetch(`https://eth.blockscout.com/api/v2/addresses/${addr}/transactions`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://eth.blockscout.com/api/v2/addresses/${addr}/token-transfers`, {
        signal: AbortSignal.timeout(10000),
      }),
    ])

    const txMap = new Map()

    if (txRes.status === 'fulfilled' && txRes.value.ok) {
      const data = await txRes.value.json()
      for (const tx of (data.items ?? []).slice(0, 50)) {
        const ts        = tx.timestamp ? new Date(tx.timestamp).getTime() : 0
        const rawVal    = tx.value ? BigInt(tx.value) : 0n
        const value     = Number(rawVal) / 1e18
        const direction = tx.from?.hash?.toLowerCase() === addrLower ? 'out' : 'in'
        txMap.set(tx.hash, {
          hash:      tx.hash,
          from:      tx.from?.hash ?? '',
          to:        tx.to?.hash   ?? '',
          value,
          symbol:    'ETH',
          timestamp: ts,
          direction,
          isError:   tx.status === 'error',
          gasPrice:  tx.gas_price ? Number(BigInt(tx.gas_price)) / 1e9 : 0,
        })
      }
    }

    if (tokenRes.status === 'fulfilled' && tokenRes.value.ok) {
      const data = await tokenRes.value.json()
      for (const t of (data.items ?? []).slice(0, 50)) {
        // Blockscout peut retourner tx_hash ou transaction_hash selon la version
        const hash = t.tx_hash ?? t.transaction_hash
        if (!hash) continue

        // decimals : dans t.total.decimals ou t.token.decimals (toujours en string)
        const decimals = parseInt(
          t.total?.decimals ?? t.token?.decimals ?? '18', 10
        )

        // value brute : dans t.total.value ou directement t.value
        let value = 0
        try {
          const rawStr = (t.total?.value ?? t.value ?? '0').toString()
          // Garde uniquement les chiffres (élimine les virgules flottantes parasites)
          const digits = rawStr.replace(/\D/g, '')
          if (digits) value = Number(BigInt(digits)) / Math.pow(10, decimals)
        } catch { value = 0 }

        const ts        = t.timestamp ? new Date(t.timestamp).getTime() : 0
        const fromHash  = t.from?.hash ?? t.from_address_hash ?? ''
        const toHash    = t.to?.hash   ?? t.to_address_hash   ?? ''
        const direction = fromHash.toLowerCase() === addrLower ? 'out' : 'in'

        // On garde même les tx déjà dans txMap (token transfer > tx ETH pour le symbol)
        txMap.set(hash, {
          hash,
          from:      fromHash,
          to:        toHash,
          value,
          symbol:    t.token?.symbol ?? '?',
          timestamp: ts,
          direction,
          isError:   false,
          gasPrice:  0,
        })
      }
    }

    const result = [...txMap.values()]
      .filter(tx => tx.hash)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 30)

    if (result.length > 0) return result
    throw new Error('Blockscout: vide')

  } catch (e) {
    console.warn('[ETH] Blockscout error:', e.message)
    // Fallback Ethplorer (marchait bien en prod)
    return fetchTransactionsEthplorer(addr)
  }
}

// ─── Fallback Ethplorer (prod OK, local parfois CORS) ────────────────────────
async function fetchTransactionsEthplorer(addr) {
  try {
    const addrLower = addr.toLowerCase()
    const [ethData, tokenData] = await Promise.allSettled([
      fetch(`https://api.ethplorer.io/getAddressTransactions/${addr}?limit=25&showZeroValues=1&apiKey=freekey`, { signal: AbortSignal.timeout(8000) }).then(r => r.json()),
      fetch(`https://api.ethplorer.io/getAddressHistory/${addr}?limit=25&type=transfer&apiKey=freekey`, { signal: AbortSignal.timeout(8000) }).then(r => r.json()),
    ])
    const txMap = new Map()

    const ethList = ethData.status === 'fulfilled' && Array.isArray(ethData.value) ? ethData.value : []
    for (const tx of ethList) {
      const ts = (tx.timestamp ?? 0) * 1000
      txMap.set(tx.hash, {
        hash: tx.hash, from: tx.from || '', to: tx.to || '',
        value: tx.value ?? 0, symbol: 'ETH',
        timestamp: ts, direction: tx.from?.toLowerCase() === addrLower ? 'out' : 'in',
        isError: tx.success === false, gasPrice: tx.gasPrice ? tx.gasPrice / 1e9 : 0,
      })
    }

    const tokenOps = tokenData.status === 'fulfilled' && Array.isArray(tokenData.value?.operations) ? tokenData.value.operations : []
    for (const op of tokenOps) {
      const hash = op.transactionHash
      if (!hash || txMap.has(hash)) continue
      const decimals = parseInt(op.tokenInfo?.decimals ?? '18', 10)
      const value    = Number(op.value || 0) / Math.pow(10, decimals)
      const ts       = (op.timestamp ?? 0) * 1000
      txMap.set(hash, {
        hash, from: op.from || '', to: op.to || '', value,
        symbol: op.tokenInfo?.symbol || '?',
        timestamp: ts, direction: op.from?.toLowerCase() === addrLower ? 'out' : 'in',
        isError: false, gasPrice: 0,
      })
    }

    const result = [...txMap.values()].filter(tx => tx.hash).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 30)
    if (result.length > 0) return result
    throw new Error('Ethplorer vide')
  } catch (e) {
    console.warn('[ETH] Ethplorer error:', e.message)
    return fetchTransactionsFallbackRPC(addr)
  }
}

// ─── Fallback final : logs ERC-20 via RPC ────────────────────────────────────
async function fetchTransactionsFallbackRPC(addr) {
  try {
    const addrLower  = addr.toLowerCase()
    const paddedAddr = '0x' + addrLower.slice(2).padStart(64, '0')
    const latestHex  = await rpc('eth_blockNumber', [])
    const latest     = parseInt(latestHex, 16)
    const fromBlock  = '0x' + Math.max(0, latest - 2000).toString(16)
    const TRANSFER   = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

    const [logsOut, logsIn] = await Promise.all([
      rpc('eth_getLogs', [{ fromBlock, toBlock: 'latest', topics: [TRANSFER, paddedAddr, null] }]).catch(() => []),
      rpc('eth_getLogs', [{ fromBlock, toBlock: 'latest', topics: [TRANSFER, null, paddedAddr] }]).catch(() => []),
    ])

    const allLogs   = [...(logsOut || []), ...(logsIn || [])]
    const blockNums = [...new Set(allLogs.map(l => l.blockNumber))].slice(0, 20)
    const blockTs   = {}
    await Promise.allSettled(blockNums.map(async bHex => {
      const block = await rpc('eth_getBlockByNumber', [bHex, false])
      if (block?.timestamp) blockTs[bHex] = parseInt(block.timestamp, 16) * 1000
    }))

    const seen = new Set()
    const txs  = []
    for (const log of allLogs) {
      if (seen.has(log.transactionHash)) continue
      seen.add(log.transactionHash)
      const from     = '0x' + (log.topics[1] ?? '').slice(26)
      const to       = '0x' + (log.topics[2] ?? '').slice(26)
      const rawValue = log.data && log.data !== '0x' ? BigInt(log.data) : 0n
      const token    = KNOWN_TOKENS.find(t => t.contractAddress === log.address?.toLowerCase())
      const decimals = token?.decimals ?? 18
      txs.push({
        hash: log.transactionHash, from, to,
        value: Number(rawValue) / Math.pow(10, decimals),
        symbol: token?.symbol ?? '?',
        timestamp: blockTs[log.blockNumber] ?? 0,
        direction: from.toLowerCase() === addrLower ? 'out' : 'in',
        isError: false, gasPrice: 0,
      })
    }
    return txs.filter(tx => tx.hash).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 25)
  } catch (e) {
    console.warn('[ETH] RPC fallback error:', e.message)
    return []
  }
}

// ─── Portfolio complet ────────────────────────────────────────────────────────
async function fetchPortfolioData(addr) {
  const addrLower = addr.toLowerCase()
  const allCgIds  = ['ethereum', ...KNOWN_TOKENS.map(t => t.cgId)]

  let ethPrice    = { eur: 0, usd: 0, change24h: 0 }
  let tokenPrices = {}
  try {
    const prices = await fetchPrices(allCgIds)
    if (prices['ethereum']) ethPrice = prices['ethereum']
    for (const t of KNOWN_TOKENS) {
      if (prices[t.cgId]) tokenPrices[t.contractAddress] = { eur: prices[t.cgId].eur, usd: prices[t.cgId].usd }
    }
  } catch (e) { console.warn('Prix error:', e.message) }

  let ethBalance = 0
  try {
    const hex  = await rpc('eth_getBalance', [addr, 'latest'])
    ethBalance = parseInt(hex, 16) / 1e18
  } catch (e) { console.warn('ETH balance error:', e.message) }

  const tokens = []
  await Promise.allSettled(
    KNOWN_TOKENS.map(async (t) => {
      try {
        const hex = await rpc('eth_call', [{ to: t.contractAddress, data: encodeBalanceOf(addrLower) }, 'latest'])
        if (!hex || hex === '0x' || /^0x0+$/.test(hex)) return
        const balance = parseInt(hex, 16) / Math.pow(10, t.decimals)
        if (balance < 0.001) return
        const p = tokenPrices[t.contractAddress]
        tokens.push({ ...t, balance, valueEur: p ? balance * p.eur : null, valueUsd: p ? balance * p.usd : null })
      } catch { /* non détenu */ }
    })
  )
  tokens.sort((a, b) => (b.valueEur ?? 0) - (a.valueEur ?? 0))

  const transactions = await fetchTransactions(addr)

  const ethValueEur    = ethBalance * ethPrice.eur
  const tokensValueEur = tokens.reduce((s, t) => s + (t.valueEur ?? 0), 0)

  return {
    address: addr, ethBalance, ethPrice, ethValueEur,
    tokens, tokensValueEur,
    totalValueEur: ethValueEur + tokensValueEur,
    transactions, lastUpdated: new Date(),
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
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
    try {
      setWalletData(await fetchPortfolioData(addr))
    } catch (e) {
      setError(e.message || 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeAddress && isValidEthAddress(activeAddress)) loadData(activeAddress)
    // eslint-disable-next-line
  }, [activeAddress])

  const connectWallet  = useCallback(() => open({ view: 'Connect' }), [open])
  const connectManual  = useCallback((addr) => {
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
