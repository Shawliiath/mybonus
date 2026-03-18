import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { mainnet, solana } from '@reown/appkit/networks'
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient()

const projectId = '38a4c1b38d060c67c73675cfe76d213e'

const metadata = {
  name: 'MyBonus',
  description: 'Suivi de performance & portfolio crypto',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
  icons: ['https://avatars.githubusercontent.com/u/37784886'],
}

// ─── EVM (Ethereum) ───────────────────────────────────────────────────────────
export const wagmiAdapter = new WagmiAdapter({
  networks: [mainnet],
  projectId,
})

// ─── Solana ───────────────────────────────────────────────────────────────────
const solanaAdapter = new SolanaAdapter({
  wallets: [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ],
})

// ─── AppKit multi-chain ───────────────────────────────────────────────────────
export const networks = [mainnet, solana]

createAppKit({
  adapters:  [wagmiAdapter, solanaAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: false,
    email:     false,
    socials:   false,
    onramp:    false,
    swaps:     false,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent':               '#22c55e',
    '--w3m-border-radius-master': '8px',
  },
})

export const wagmiConfig = wagmiAdapter.wagmiConfig

