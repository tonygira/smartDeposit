'use client'

import * as React from 'react'
import '@rainbow-me/rainbowkit/styles.css'
import {
  getDefaultConfig,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { sepolia, hardhat } from 'wagmi/chains'
import { http } from 'viem'
import {
  QueryClientProvider,
  QueryClient,
} from '@tanstack/react-query'

const config = getDefaultConfig({
  appName: 'Smart Deposit',
  projectId: process.env.NEXT_PUBLIC_RAINBOW_PROJECT_ID || 'PROJECT_ID_NOT_SET',
  chains: [hardhat, sepolia],
  //chains: [sepolia],
  transports: {
    [hardhat.id]: http(),
    //[sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  }
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {mounted ? children : null}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
