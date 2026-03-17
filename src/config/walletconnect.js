import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet } from '@reown/appkit/networks'
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient()

const projectId = '38a4c1b38d060c67c73675cfe76d213e'

const metadata = {
  name: 'MyBonus',
  description: 'Suivi de performance & portfolio crypto',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
  icons: ['https://avatars.githubusercontent.com/u/37784886'],
}

export const networks = [mainnet]

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
})

createAppKit({
  adapters:  [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: false,
    email:     false,
    socials:   false,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent':               '#22c55e',
    '--w3m-border-radius-master': '8px',
  },
})

export const wagmiConfig = wagmiAdapter.wagmiConfig
