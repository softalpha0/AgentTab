import { formatUnits } from 'viem'
import type { WalletClient } from 'viem'
import { getAgentTabAddress } from './contract'

export const ARC_TESTNET_ID = 5042002
export const ARC_MAINNET_ID = 5042

/** Format a raw USDC bigint (6 decimals) to a display string like "1.50" */
export function formatUsdc(raw: bigint): string {
  return formatUnits(raw, 6)
}

/** Format USDC for display with $ symbol */
export function displayUsdc(raw: bigint): string {
  const n = parseFloat(formatUnits(raw, 6))
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(n)
}

/** Parse a user USDC input string to raw bigint (6 decimals). Returns null on invalid input. */
export function parseUsdc(value: string): bigint | null {
  const trimmed = value.trim()
  if (!trimmed || isNaN(Number(trimmed))) return null
  try {
    const parts = trimmed.split('.')
    const whole = BigInt(parts[0] ?? '0')
    const fracStr = (parts[1] ?? '').substring(0, 6).padEnd(6, '0')
    const frac = BigInt(fracStr)
    return whole * 1_000_000n + frac
  } catch {
    return null
  }
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function parseOnchainError(error: unknown): string {
  const msg = (error as { message?: string; shortMessage?: string })?.shortMessage
    ?? (error as { message?: string })?.message
    ?? ''
  const lc = msg.toLowerCase()
  if (lc.includes('user rejected') || lc.includes('denied') || lc.includes('4001')) return 'Transaction cancelled.'
  if (lc.includes('invalidsignature')) return 'Signature is invalid or was not signed by the tab owner.'
  if (lc.includes('totalcallsnotincreased')) return 'This receipt has already been used (totalCalls not higher than claimed).'
  if (lc.includes('insufficienttabbalance')) return 'Tab balance is too low for this claim.'
  if (lc.includes('nottabclient')) return 'Only the tab owner can do this.'
  if (lc.includes('notserviceprovider')) return 'Only the service provider can do this.'
  if (lc.includes('tabalreadyclosed')) return 'This tab is already closed.'
  if (lc.includes('closenotrequest')) return 'No close has been requested on this tab.'
  if (lc.includes('closedelaynotexpired')) return 'Close delay has not elapsed yet — please wait.'
  if (lc.includes('closealreadypending')) return 'A close is already pending on this tab.'
  if (lc.includes('topupduringcloseperiod')) return 'Cannot top up while a close is pending.'
  if (lc.includes('tabnotfound')) return 'Tab not found.'
  if (lc.includes('servicenotfound')) return 'Service not found.'
  if (lc.includes('zeroamount')) return 'Amount must be greater than zero.'
  if (lc.includes('emptyname')) return 'Service name cannot be empty.'
  if (lc.includes('insufficient') || lc.includes('exceeds balance')) return 'Insufficient USDC balance.'
  if (lc.includes('reverted')) return 'Transaction reverted. Check inputs and try again.'
  if (lc.includes('network') || lc.includes('timeout')) return 'Network error. Please retry.'
  return 'Something went wrong. Please try again.'
}

// ─── EIP-712 signed receipt ────────────────────────────────────────────────

export interface SignedReceipt {
  tabId: number
  totalCalls: number
  signature: `0x${string}`
  signedAt: number  // unix ms
}

/**
 * Sign a Receipt(tabId, totalCalls) using EIP-712 typed data.
 * Uses wagmi's walletClient under the hood.
 * chainId defaults to Arc Mainnet (5042).
 */
export async function signReceipt(
  walletClient: WalletClient,
  tabId: bigint,
  totalCalls: bigint,
  chainId: number = ARC_MAINNET_ID,
): Promise<`0x${string}`> {
  const contractAddress = getAgentTabAddress(chainId)
  if (!contractAddress) throw new Error(`No AgentTabV2 address for chain ${chainId}`)

  const domain = {
    name: 'AgentTabV2',
    version: '1',
    chainId,
    verifyingContract: contractAddress,
  } as const

  const types = {
    Receipt: [
      { name: 'tabId', type: 'uint256' },
      { name: 'totalCalls', type: 'uint256' },
    ],
  } as const

  const message = { tabId, totalCalls } as const

  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('No account connected')

  return walletClient.signTypedData({
    account,
    domain,
    types,
    primaryType: 'Receipt',
    message,
  })
}

/** Format a countdown from a deadline (unix seconds) */
export function formatCountdown(deadlineSeconds: number): string {
  const now = Math.floor(Date.now() / 1000)
  const remaining = deadlineSeconds - now
  if (remaining <= 0) return 'Ready to close'
  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
