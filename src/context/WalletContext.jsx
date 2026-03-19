/**
 * WalletContext — partage l'état du wallet ETH + Solana + Bitcoin
 * Sauvegarde automatiquement un snapshot Firestore pour le partage de stats
 */
import { createContext, useContext, useEffect } from 'react'
import { useWallet } from '../hooks/useWallet'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { useBitcoinWallet } from '../hooks/useBitcoinWallet'
import { useAuth } from './AuthContext'
import { saveCryptoSnapshot } from '../firebase/firestore'

const WalletContext = createContext(null)

export function WalletProvider({ children }) {
  const { user } = useAuth()
  const eth     = useWallet()
  const solana  = useSolanaWallet()
  const bitcoin = useBitcoinWallet()

  // Sauvegarde un snapshot Firestore dès que les données crypto arrivent
  // pour pouvoir les afficher sur la SharedView
  useEffect(() => {
    if (!user?.uid) return
    const { walletData } = eth
    const { solanaData  } = solana
    const { bitcoinData } = bitcoin

    // On ne sauvegarde que si au moins une chain a des données
    if (!walletData && !solanaData && !bitcoinData) return

    const snapshot = {
      totalValueEur: (walletData?.totalValueEur ?? 0) + (solanaData?.totalValueEur ?? 0) + (bitcoinData?.totalValueEur ?? 0),
      assets: [],
    }

    if (walletData) {
      snapshot.assets.push({
        symbol: 'ETH', name: 'Ethereum', chain: 'eth',
        balance: walletData.ethBalance,
        valueEur: walletData.ethValueEur,
        priceEur: walletData.ethPrice?.eur ?? 0,
        change24h: walletData.ethPrice?.change24h ?? 0,
      })
      for (const t of walletData.tokens) {
        snapshot.assets.push({
          symbol: t.symbol, name: t.name, chain: 'eth',
          balance: t.balance, valueEur: t.valueEur ?? 0,
          priceEur: t.valueEur && t.balance ? t.valueEur / t.balance : 0,
          change24h: null,
        })
      }
    }

    if (solanaData) {
      snapshot.assets.push({
        symbol: 'SOL', name: 'Solana', chain: 'sol',
        balance: solanaData.solBalance,
        valueEur: solanaData.solValueEur,
        priceEur: solanaData.solPrice?.eur ?? 0,
        change24h: solanaData.solPrice?.change24h ?? 0,
      })
      for (const t of solanaData.splTokens) {
        snapshot.assets.push({
          symbol: t.symbol, name: t.name, chain: 'sol',
          balance: t.balance, valueEur: t.valueEur ?? 0,
          priceEur: 0, change24h: null,
        })
      }
    }

    if (bitcoinData) {
      snapshot.assets.push({
        symbol: 'BTC', name: 'Bitcoin', chain: 'btc',
        balance: bitcoinData.btcBalance,
        valueEur: bitcoinData.btcValueEur,
        priceEur: bitcoinData.btcPrice?.eur ?? 0,
        change24h: bitcoinData.btcPrice?.change24h ?? 0,
      })
    }

    // Trie par valeur décroissante
    snapshot.assets.sort((a, b) => (b.valueEur ?? 0) - (a.valueEur ?? 0))

    saveCryptoSnapshot(user.uid, snapshot)
  }, [eth.walletData, solana.solanaData, bitcoin.bitcoinData, user?.uid])

  return (
    <WalletContext.Provider value={{ eth, solana, bitcoin }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWalletContext() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWalletContext must be used within WalletProvider')
  return ctx
}
