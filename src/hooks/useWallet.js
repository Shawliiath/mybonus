import { useState, useCallback, useEffect } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'

const LS_KEY = 'mybonus_wallet_address'

export function isValidEthAddress(addr) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr?.trim())
}
export function shortAddr(addr) {
  if (!addr) return ''
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

// ─── RPC publics avec fallback ────────────────────────────────────────────────
const PUBLIC_RPCS = [
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
  'https://ethereum.publicnode.com',
]

async function rpcPost(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
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

// ─── balanceOf(address) encodé ────────────────────────────────────────────────
function encodeBalanceOf(addr) {
  return '0x70a08231' + addr.slice(2).toLowerCase().padStart(64, '0')
}

// ─── Tokens connus sur Ethereum mainnet ───────────────────────────────────────
const KNOWN_TOKENS = [
  { contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', name: 'USD Coin',        decimals: 6,  cgId: 'usd-coin' },
  { contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7', symbol: 'USDT', name: 'Tether USD',      decimals: 6,  cgId: 'tether' },
  { contractAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH', name: 'Wrapped Ether',   decimals: 18, cgId: 'weth' },
  { contractAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', symbol: 'WBTC', name: 'Wrapped Bitcoin',  decimals: 8,  cgId: 'wrapped-bitcoin' },
  { contractAddress: '0x6b175474e89094c44da98b954eedeac495271d0f', symbol: 'DAI',  name: 'Dai Stablecoin',  decimals: 18, cgId: 'dai' },
  { contractAddress: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', symbol: 'UNI',  name: 'Uniswap',         decimals: 18, cgId: 'uniswap' },
  { contractAddress: '0x514910771af9ca656af840dff83e8264ecf986ca', symbol: 'LINK', name: 'Chainlink',        decimals: 18, cgId: 'chainlink' },
  { contractAddress: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0', symbol: 'MATIC',name: 'Polygon',          decimals: 18, cgId: 'matic-network' },
  { contractAddress: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', symbol: 'SHIB', name: 'Shiba Inu',         decimals: 18, cgId: 'shiba-inu' },
  { contractAddress: '0x4d224452801aced8b2f0aebe155379bb5d594381', symbol: 'APE',  name: 'ApeCoin',           decimals: 18, cgId: 'apecoin' },
]

// ─── Transactions via eth_getBlockByNumber + filtre adresse ───────────────────
// Plus simple : on utilise les Transfer events ERC20 + txlist via RPC
async function fetchTransactions(addr) {
  const addrLower = addr.toLowerCase()
  const txs = []

  try {
    // Récupère le dernier bloc
    const latestHex = await rpc('eth_blockNumber', [])
    const latest    = parseInt(latestHex, 16)

    // Scan les 500 derniers blocs pour les tx impliquant cette adresse
    // Via eth_getLogs — Transfer events ERC20 (topic[1] ou topic[2] = addr)
    const paddedAddr = '0x' + addrLower.slice(2).padStart(64, '0')
    const fromBlock  = '0x' + Math.max(0, latest - 1000).toString(16)

    // Transfer OUT (from = addr)
    const logsOut = await rpc('eth_getLogs', [{
      fromBlock,
      toBlock: 'latest',
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer(address,address,uint256)
        paddedAddr, // from
        null,
      ],
    }])

    // Transfer IN (to = addr)
    const logsIn = await rpc('eth_getLogs', [{
      fromBlock,
      toBlock: 'latest',
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        null,
        paddedAddr, // to
      ],
    }])

    const allLogs = [...(logsOut || []), ...(logsIn || [])]

    // Déduplique par txHash et récupère les blocs pour les timestamps
    const hashSet  = new Set()
    const blockSet = new Set()
    for (const log of allLogs) {
      if (!hashSet.has(log.transactionHash)) {
        hashSet.add(log.transactionHash)
        blockSet.add(log.blockNumber)
      }
    }

    // Récupère les timestamps des blocs uniques
    const blockTimestamps = {}
    await Promise.allSettled(
      [...blockSet].slice(0, 30).map(async (blockHex) => {
        const block = await rpc('eth_getBlockByNumber', [blockHex, false])
        if (block) blockTimestamps[blockHex] = parseInt(block.timestamp, 16) * 1000
      })
    )

    // Construit les transactions à partir des logs
    for (const log of allLogs) {
      if (txs.some(t => t.hash === log.transactionHash)) continue
      const from      = '0x' + (log.topics[1] ?? '').slice(26)
      const to        = '0x' + (log.topics[2] ?? '').slice(26)
      const rawValue  = log.data && log.data !== '0x' ? BigInt(log.data) : 0n
      // Cherche le token connu
      const token     = KNOWN_TOKENS.find(t => t.contractAddress === log.address?.toLowerCase())
      const decimals  = token?.decimals ?? 18
      const value     = Number(rawValue) / Math.pow(10, decimals)
      const symbol    = token?.symbol ?? '?'
      const direction = from.toLowerCase() === addrLower ? 'out' : 'in'
      txs.push({
        hash:      log.transactionHash,
        from,
        to,
        value,
        symbol,
        isToken:   true,
        timestamp: blockTimestamps[log.blockNumber] ?? 0,
        direction,
        isError:   false,
        gasPrice:  0,
      })
    }

    // Trie par timestamp décroissant
    txs.sort((a, b) => b.timestamp - a.timestamp)
    return txs.slice(0, 25)

  } catch (e) {
    console.warn('fetchTransactions error:', e.message)
    return []
  }
}

// ─── Fetch portfolio complet ──────────────────────────────────────────────────
async function fetchPortfolioData(addr) {
  const addrLower = addr.toLowerCase()

  // 1. Prix ETH + tokens connus
  let ethPrice   = { eur: 0, usd: 0, change24h: 0 }
  let tokenPrices = {}
  try {
    const cgIds = ['ethereum', ...KNOWN_TOKENS.map(t => t.cgId)].join(',')
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds}&vs_currencies=eur,usd&include_24hr_change=true`
    )
    const j = await r.json()
    ethPrice = {
      eur:       j.ethereum?.eur            ?? 0,
      usd:       j.ethereum?.usd            ?? 0,
      change24h: j.ethereum?.eur_24h_change ?? 0,
    }
    for (const t of KNOWN_TOKENS) {
      if (j[t.cgId]) tokenPrices[t.contractAddress] = { eur: j[t.cgId].eur ?? 0, usd: j[t.cgId].usd ?? 0 }
    }
  } catch (e) { console.warn('CoinGecko error:', e.message) }

  // 2. Solde ETH
  let ethBalance = 0
  try {
    const hex  = await rpc('eth_getBalance', [addr, 'latest'])
    ethBalance = parseInt(hex, 16) / 1e18
  } catch (e) { console.warn('ETH balance error:', e.message) }

  // 3. Soldes tokens via balanceOf
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

  // 4. Transactions
  const transactions = await fetchTransactions(addr)

  const ethValueEur    = ethBalance * ethPrice.eur
  const tokensValueEur = tokens.reduce((s, t) => s + (t.valueEur ?? 0), 0)

  return {
    address: addr,
    ethBalance,
    ethPrice,
    ethValueEur,
    tokens,
    tokensValueEur,
    totalValueEur: ethValueEur + tokensValueEur,
    transactions,
    lastUpdated: new Date(),
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useWallet() {
  const { address: wagmiAddress, isConnected } = useAccount()
  const { disconnect: wagmiDisconnect }        = useDisconnect()
  const { open }                               = useAppKit()

  const [manualAddress, setManualAddress] = useState(() => localStorage.getItem(LS_KEY) || '')
  const [walletData,    setWalletData]    = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)

  const activeAddress = isConnected && wagmiAddress ? wagmiAddress : manualAddress

  const loadData = useCallback(async (addr) => {
    if (!isValidEthAddress(addr)) return
    setLoading(true)
    setError(null)
    setWalletData(null)
    try {
      const data = await fetchPortfolioData(addr)
      setWalletData(data)
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

  const connectWallet = useCallback(() => open({ view: 'Connect' }), [open])

  const connectManual = useCallback((addr) => {
    addr = addr.trim()
    localStorage.setItem(LS_KEY, addr)
    setManualAddress(addr)
  }, [])

  const disconnect = useCallback(() => {
    if (isConnected) wagmiDisconnect()
    localStorage.removeItem(LS_KEY)
    setManualAddress('')
    setWalletData(null)
    setError(null)
  }, [isConnected, wagmiDisconnect])

  const refresh = useCallback(() => {
    if (activeAddress) loadData(activeAddress)
  }, [activeAddress, loadData])

  return { address: activeAddress, isConnected, walletData, loading, error, connectWallet, connectManual, disconnect, refresh }
}
