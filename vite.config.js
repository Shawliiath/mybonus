import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Polyfills nécessaires pour WalletConnect
      'process': 'process/browser',
    },
  },
})
