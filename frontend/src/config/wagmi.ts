import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'
import { Chain } from 'wagmi/chains'
import { defineChain } from 'viem'

export const holeskyChain = defineChain({
  id: 17000,
  name: 'Holesky',
  nativeCurrency: {
    decimals: 18,
    name: 'Holesky ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['https://ethereum-holesky.publicnode.com'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://holesky.etherscan.io' },
  },
  testnet: true,
})

export const config = getDefaultConfig({
  appName: 'Intent AVS',
  projectId: 'YOUR_WALLET_CONNECT_PROJECT_ID', // Get one from https://cloud.walletconnect.com
  chains: [holeskyChain],
  transports: {
    [holeskyChain.id]: http(),
  },
}) 