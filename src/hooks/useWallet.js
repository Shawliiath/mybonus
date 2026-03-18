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

// ─── RPC publics avec CORS OK (sans auth, sans rate-limit agressif) ───────────
const PUBLIC_RPCS = [
  'https://ethereum.publicnode.com',       // CORS OK, stable
  'https://1rpc.io/eth',                   // CORS OK, privacy-focused
  'https://rpc.flashbots.net',             // CORS OK, Flashbots
  'https://eth.drpc.org',                  // CORS OK, dRPC
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

// ─── Transactions via Ethplorer API (freekey publique, CORS OK) ───────────────
// Docs: https://github.com/EverexIO/Ethplorer/wiki/ethplorer-api
const ETHPLORER_API = 'https://api.ethplorer.io'

async function ethplorerGet(path) {
  const url = `${ETHPLORER_API}${path}${path.includes('?') ? '&' : '?'}apiKey=freekey`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Ethplorer HTTP ${res.status}`)
  return res.json()
}

async function fetchTransactions(addr) {
  try {
    // getAddressTransactions : 50 dernières TX ETH + token transfers
    const [ethData, tokenData] = await Promise.allSettled([
      ethplorerGet(`/getAddressTransactions/${addr}?limit=25&showZeroValues=1`),
      ethplorerGet(`/getAddressHistory/${addr}?limit=25&type=transfer`),
    ])

    const addrLower = addr.toLowerCase()
    const txMap     = new Map()

    // ── TX ETH (getAddressTransactions) ─────────────────────────────────────
    // Retourne un array d'objets : { hash, timestamp, from, to, value, success }
    const ethList = ethData.status === 'fulfilled' && Array.isArray(ethData.value)
      ? ethData.value : []

    for (const tx of ethList) {
      const ts        = (tx.timestamp ?? 0) * 1000
      const direction = tx.from?.toLowerCase() === addrLower ? 'out' : 'in'
      txMap.set(tx.hash, {
        hash:      tx.hash,
        from:      tx.from || '',
        to:        tx.to   || '',
        value:     tx.value ?? 0,
        symbol:    'ETH',
        isToken:   false,
        timestamp: ts > 0 ? ts : Date.now(),
        direction,
        isError:   tx.success === false,
        gasPrice:  tx.gasPrice ? tx.gasPrice / 1e9 : 0,
      })
    }

    // ── Token transfers (getAddressHistory) ─────────────────────────────────
    // Retourne { operations: [{transactionHash, timestamp, from, to, value, tokenInfo}] }
    const tokenOps = tokenData.status === 'fulfilled' && Array.isArray(tokenData.value?.operations)
      ? tokenData.value.operations : []

    for (const op of tokenOps) {
      const hash = op.transactionHash
      if (!hash || txMap.has(hash)) continue
      const decimals  = parseInt(op.tokenInfo?.decimals ?? '18', 10)
      const value     = Number(op.value || 0) / Math.pow(10, decimals)
      const ts        = (op.timestamp ?? 0) * 1000
      const direction = op.from?.toLowerCase() === addrLower ? 'out' : 'in'
      txMap.set(hash, {
        hash,
        from:      op.from || '',
        to:        op.to   || '',
        value,
        symbol:    op.tokenInfo?.symbol || '?',
        isToken:   true,
        timestamp: ts > 0 ? ts : Date.now(),
        direction,
        isError:   false,
        gasPrice:  0,
      })
    }

    const result = [...txMap.values()]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 30)

    if (result.length > 0) return result
    throw new Error('Ethplorer: aucune transaction')

  } catch (e) {
    console.warn('fetchTransactions (Ethplorer) error:', e.message)
    return fetchTransactionsFallback(addr)
  }
}

// ─── Fallback RPC si Etherscan indisponible ───────────────────────────────────
async function fetchTransactionsFallback(addr) {
  try {
    const addrLower  = addr.toLowerCase()
    const paddedAddr = '0x' + addrLower.slice(2).padStart(64, '0')
    const latestHex  = await rpc('eth_blockNumber', [])
    const latest     = parseInt(latestHex, 16)
    const fromBlock  = '0x' + Math.max(0, latest - 500).toString(16)
    const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

    const [logsOut, logsIn] = await Promise.all([
      rpc('eth_getLogs', [{ fromBlock, toBlock: 'latest', topics: [TRANSFER_TOPIC, paddedAddr, null] }]).catch(() => []),
      rpc('eth_getLogs', [{ fromBlock, toBlock: 'latest', topics: [TRANSFER_TOPIC, null, paddedAddr] }]).catch(() => []),
    ])

    const allLogs = [...(logsOut || []), ...(logsIn || [])]
    const blockNums = [...new Set(allLogs.map(l => l.blockNumber))].slice(0, 20)
    const blockTs   = {}
    await Promise.allSettled(blockNums.map(async (bHex) => {
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
      const ts       = blockTs[log.blockNumber] ?? Date.now()
      txs.push({
        hash:      log.transactionHash,
        from, to,
        value:     Number(rawValue) / Math.pow(10, decimals),
        symbol:    token?.symbol ?? '?',
        isToken:   true,
        timestamp: ts,
        direction: from.toLowerCase() === addrLower ? 'out' : 'in',
        isError:   false,
        gasPrice:  0,
      })
    }
    return txs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 25)
  } catch (e) {
    console.warn('fetchTransactionsFallback error:', e.message)
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
  const { disconnect: appkitDisconnect }       = useDisconnect()
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

  const disconnect = useCallback(async () => {
    // AppKit useDisconnect déconnecte tous les namespaces (ETH + Solana)
    // C'est l'API correcte selon la doc Reown pour le multi-chain
    await appkitDisconnect()
    localStorage.removeItem(LS_KEY)
    localStorage.removeItem('mybonus_solana_address')
    setManualAddress('')
    setWalletData(null)
    setError(null)
  }, [appkitDisconnect])

  const refresh = useCallback(() => {
    if (activeAddress) loadData(activeAddress)
  }, [activeAddress, loadData])

  return { address: activeAddress, isConnected, walletData, loading, error, connectWallet, connectManual, disconnect, refresh }
}
