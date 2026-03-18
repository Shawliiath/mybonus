/**
 * WalletContext — partage l'état du wallet ETH + Solana entre Portfolio et Dashboard
 */
import { createContext, useContext } from 'react'
import { useWallet } from '../hooks/useWallet'
import { useSolanaWallet } from '../hooks/useSolanaWallet'

const WalletContext = createContext(null)

export function WalletProvider({ children }) {
  const eth     = useWallet()
  const solana  = useSolanaWallet()
  return (
    <WalletContext.Provider value={{ eth, solana }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWalletContext() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWalletContext must be used within WalletProvider')
  return ctx
}

