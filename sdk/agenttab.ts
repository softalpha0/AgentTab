/**
 * AgentTab SDK
 * ============
 * TypeScript helpers for AI agents and API clients interacting with the
 * AgentTabV2 contract on Arc Mainnet (chain ID 5042).
 *
 * Usage (private-key agent / server — no RPC required for signing):
 *   import { AgentTabClient, verifyReceipt } from './sdk/agenttab'
 *   import { privateKeyToAccount } from 'viem/accounts'
 *   const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY)
 *   const agent = new AgentTabClient(account)
 *   const receipt = await agent.recordCall(0n)
 *
 * Usage (browser dapp — pass a WalletClient):
 *   const agent = new AgentTabClient(walletClient)
 */

import {
  type WalletClient,
  type PublicClient,
  type Address,
  type Hex,
  type LocalAccount,
  hashTypedData,
  recoverTypedDataAddress,
} from 'viem'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Arc Mainnet chain ID. */
export const ARC_MAINNET_CHAIN_ID = 5042

/** AgentTabV2 mainnet contract address. */
export const AGENT_TAB_ADDRESS: Address =
  '0x77c91303cda1a54219cdec6aa55d4691dde09aea'

// ---------------------------------------------------------------------------
// EIP-712 domain and types
// ---------------------------------------------------------------------------

/** EIP-712 domain for AgentTabV2. */
export const DOMAIN = {
  name: 'AgentTabV2',
  version: '1',
  chainId: ARC_MAINNET_CHAIN_ID,
  verifyingContract: AGENT_TAB_ADDRESS,
} as const

/** EIP-712 typed data types for a Receipt. */
export const RECEIPT_TYPES = {
  Receipt: [
    { name: 'tabId', type: 'uint256' },
    { name: 'totalCalls', type: 'uint256' },
  ],
} as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Receipt {
  tabId: bigint
  totalCalls: bigint
}

export interface SignedReceipt {
  tabId: bigint
  totalCalls: bigint
  /** EIP-712 signature, hex-encoded. */
  signature: Hex
  /** Address that signed. */
  signer: Address
}

// ---------------------------------------------------------------------------
// signReceipt
// ---------------------------------------------------------------------------

/**
 * Signs an EIP-712 Receipt on behalf of the agent (client).
 *
 * @param signer     A viem `LocalAccount` (from `privateKeyToAccount`) for
 *                   server/agent use — signs locally, no RPC call needed.
 *                   Or a `WalletClient` for browser dapp use (MetaMask, etc.).
 * @param tabId      The tab ID to sign for.
 * @param totalCalls Running total of calls made so far (monotonically increasing).
 * @returns          A SignedReceipt with the signature and signer address.
 *
 * @example — private-key agent (no RPC)
 * const account = privateKeyToAccount('0x...')
 * const receipt = await signReceipt(account, 0n, 5n)
 *
 * @example — browser wallet
 * const receipt = await signReceipt(walletClient, 0n, 5n)
 */
export async function signReceipt(
  signer: LocalAccount | WalletClient,
  tabId: bigint,
  totalCalls: bigint,
): Promise<SignedReceipt> {
  const message = { tabId, totalCalls }

  // LocalAccount: has both `signTypedData` and `address` as own properties.
  // Sign entirely locally — no eth_signTypedData_v4 RPC call needed.
  if ('address' in signer && 'signTypedData' in signer && typeof (signer as LocalAccount).address === 'string') {
    const local = signer as LocalAccount
    const signature = await local.signTypedData({
      domain: DOMAIN,
      types: RECEIPT_TYPES,
      primaryType: 'Receipt',
      message,
    })
    return { tabId, totalCalls, signature, signer: local.address }
  }

  // WalletClient: browser injected wallet — use JSON-RPC signing.
  const wc = signer as WalletClient
  const acct = wc.account ?? (await wc.getAddresses().then((a) => a[0]))
  if (!acct) throw new Error('No account available in WalletClient')
  const signerAddress: Address =
    typeof acct === 'string' ? (acct as Address) : (acct as LocalAccount).address

  const signature = await wc.signTypedData({
    account: acct as Address,
    domain: DOMAIN,
    types: RECEIPT_TYPES,
    primaryType: 'Receipt',
    message,
  })

  return { tabId, totalCalls, signature, signer: signerAddress }
}

// ---------------------------------------------------------------------------
// verifyReceipt
// ---------------------------------------------------------------------------

/**
 * Verifies a signed receipt off-chain.
 *
 * For EOA wallets: recovers the signer from the EIP-712 signature — no RPC.
 * For ERC-1271 smart-contract wallets: pass a `publicClient` and the function
 * calls `isValidSignature` on-chain.
 *
 * @param receipt        The SignedReceipt to verify.
 * @param expectedSigner The address expected to have signed (tab.client).
 * @param publicClient   Optional: required for ERC-1271 on-chain verification.
 * @returns              true if the receipt is valid and signed by expectedSigner.
 *
 * @example
 * const ok = await verifyReceipt(receipt, clientAddress)
 */
export async function verifyReceipt(
  receipt: SignedReceipt,
  expectedSigner: Address,
  publicClient?: PublicClient,
): Promise<boolean> {
  // ERC-1271: delegate to the smart-contract wallet's isValidSignature
  if (publicClient) {
    const ERC1271_MAGIC = '0x1626ba7e'
    const msgHash = hashTypedData({
      domain: DOMAIN,
      types: RECEIPT_TYPES,
      primaryType: 'Receipt',
      message: { tabId: receipt.tabId, totalCalls: receipt.totalCalls },
    })
    try {
      const result = await publicClient.readContract({
        address: expectedSigner,
        abi: [
          {
            type: 'function',
            name: 'isValidSignature',
            inputs: [
              { name: 'hash', type: 'bytes32' },
              { name: 'signature', type: 'bytes' },
            ],
            outputs: [{ name: '', type: 'bytes4' }],
            stateMutability: 'view',
          },
        ],
        functionName: 'isValidSignature',
        args: [msgHash, receipt.signature],
      })
      return (result as string) === ERC1271_MAGIC
    } catch {
      return false
    }
  }

  // EOA: recover signer from the typed-data signature (no RPC)
  try {
    const recovered = await recoverTypedDataAddress({
      domain: DOMAIN,
      types: RECEIPT_TYPES,
      primaryType: 'Receipt',
      message: { tabId: receipt.tabId, totalCalls: receipt.totalCalls },
      signature: receipt.signature,
    })
    return recovered.toLowerCase() === expectedSigner.toLowerCase()
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// AgentTabClient
// ---------------------------------------------------------------------------

/**
 * Stateful agent-side client.
 * Keeps a per-tab running call counter and signs fresh receipts on demand.
 *
 * @example — private-key agent (recommended for AI agents and servers)
 * const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY)
 * const agent = new AgentTabClient(account)
 * const receipt = await agent.recordCall(0n)  // totalCalls = 1
 * const receipt2 = await agent.recordCall(0n) // totalCalls = 2
 */
export class AgentTabClient {
  private signer: LocalAccount | WalletClient
  /** Per-tab call counters: tabId (string key) -> totalCalls */
  private counters: Map<string, bigint> = new Map()

  constructor(signer: LocalAccount | WalletClient) {
    this.signer = signer
  }

  /**
   * Returns the current total calls recorded for a tab (0n if none yet).
   */
  totalCalls(tabId: bigint): bigint {
    return this.counters.get(String(tabId)) ?? 0n
  }

  /**
   * Increments the call counter for a tab by 1 and returns a fresh
   * signed receipt. The receipt's `totalCalls` is the new running total.
   */
  async recordCall(tabId: bigint): Promise<SignedReceipt> {
    const prev = this.totalCalls(tabId)
    const next = prev + 1n
    this.counters.set(String(tabId), next)
    return signReceipt(this.signer, tabId, next)
  }

  /**
   * Resets the local counter for a tab (e.g. after finalizeClose).
   * Does not affect on-chain state.
   */
  resetTab(tabId: bigint): void {
    this.counters.delete(String(tabId))
  }
}
