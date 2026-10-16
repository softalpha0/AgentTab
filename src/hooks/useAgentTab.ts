/**
 * Shared read hooks for AgentTabV2 contract state.
 */
import { useReadContract, useReadContracts } from 'wagmi'
import { AGENT_TAB_ADDRESS, AGENT_TAB_ABI } from '../contract'
import { ARC_MAINNET_ID } from '../utils'

const contractBase = {
  address: AGENT_TAB_ADDRESS,
  abi: AGENT_TAB_ABI,
  chainId: ARC_MAINNET_ID,
} as const

export type ServiceData = {
  id: number
  provider: string
  name: string
  pricePerCall: bigint
}

export type TabData = {
  id: number
  client: string
  serviceId: number
  balance: bigint
  callsClaimed: bigint
  closed: boolean
  closeRequestedAt: bigint
  refundRecipient: string
}

export function useServiceCount() {
  return useReadContract({ ...contractBase, functionName: 'serviceCount' })
}

export function useTabCount() {
  return useReadContract({ ...contractBase, functionName: 'tabCount' })
}

export function useCloseDelay() {
  return useReadContract({ ...contractBase, functionName: 'CLOSE_DELAY' })
}

export function useService(serviceId: number) {
  return useReadContract({
    ...contractBase,
    functionName: 'services',
    args: [BigInt(serviceId)],
    query: { enabled: serviceId >= 0 },
  })
}

export function useTab(tabId: number) {
  return useReadContract({
    ...contractBase,
    functionName: 'tabs',
    args: [BigInt(tabId)],
    query: { enabled: tabId >= 0 },
  })
}

export function useAllServices(count: number) {
  const contracts = Array.from({ length: count }, (_, i) => ({
    ...contractBase,
    functionName: 'services' as const,
    args: [BigInt(i)] as const,
  }))
  return useReadContracts({ contracts, query: { enabled: count > 0 } })
}

export function useAllTabs(count: number) {
  const contracts = Array.from({ length: count }, (_, i) => ({
    ...contractBase,
    functionName: 'tabs' as const,
    args: [BigInt(i)] as const,
  }))
  return useReadContracts({ contracts, query: { enabled: count > 0 } })
}
