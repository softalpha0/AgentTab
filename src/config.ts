/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 *
 * Arc mainnet details (from https://docs.arc.io/arc/references/connect-to-arc):
 *   Chain ID : 5042
 *   RPC      : https://rpc.mainnet.arc.io
 *   Explorer : https://explorer.arc.io
 *   USDC     : 0x3600000000000000000000000000000000000000
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { defineChain } from 'viem'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

/** Arc mainnet — defined manually because viem/chains ships arcTestnet only. */
export const arc = defineChain({
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
})

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
registerChain(arc.id, arc.rpcUrls.default.http[0])

export const config = createConfig({
  chains: [arcTestnet, arc, mainnet], // mainnet needed for ENS resolution
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(),
    [arc.id]: http(),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})
