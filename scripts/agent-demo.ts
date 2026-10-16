/**
 * agent-demo.ts
 * =============
 * Simulates an AI agent making 5 API calls to a provider and signing a
 * usage receipt after each one. At the end it prints the final receipt
 * the provider can submit on-chain with claim(tabId, totalCalls, signature).
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x<key> TAB_ID=0 bun scripts/agent-demo.ts
 *
 * The private key is read ONLY from the environment — never hardcode it.
 */

import { type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { AgentTabClient, verifyReceipt, AGENT_TAB_ADDRESS, type SignedReceipt } from '../sdk/agenttab'

// ---------------------------------------------------------------------------
// Read config from environment
// ---------------------------------------------------------------------------

const rawKey = process.env.AGENT_PRIVATE_KEY
if (!rawKey) {
  console.error('Error: AGENT_PRIVATE_KEY environment variable is not set.')
  console.error('Usage: AGENT_PRIVATE_KEY=0x<key> TAB_ID=<id> bun scripts/agent-demo.ts')
  process.exit(1)
}
const privateKey: Hex = rawKey.startsWith('0x') ? (rawKey as Hex) : (`0x${rawKey}`)

const tabId = BigInt(process.env.TAB_ID ?? '0')
const TOTAL_CALLS = 5

// LocalAccount signs locally — no RPC call needed for receipt signing.
const account = privateKeyToAccount(privateKey)

// ---------------------------------------------------------------------------
// Simulate API calls
// ---------------------------------------------------------------------------

const agent = new AgentTabClient(account)

console.log('AgentTab demo — signing receipts for tab', tabId.toString())
console.log('Agent address:', account.address)
console.log('Contract:     ', AGENT_TAB_ADDRESS)
console.log()

let lastReceipt: SignedReceipt | null = null
for (let i = 1; i <= TOTAL_CALLS; i++) {
  // Simulate doing useful work
  console.log(`[Call ${i}] Processing API request...`)

  // Record the call and get a signed receipt
  const receipt = await agent.recordCall(tabId)
  lastReceipt = receipt

  // Verify the receipt locally before passing it to the provider
  const ok = await verifyReceipt(receipt, account.address)
  console.log(`  totalCalls=${receipt.totalCalls}  verified=${ok}`)
}

if (!lastReceipt) {
  console.error('No calls were made.')
  process.exit(1)
}

console.log()
console.log('=== Final receipt for provider ===')
console.log('tabId:     ', lastReceipt.tabId.toString())
console.log('totalCalls:', lastReceipt.totalCalls.toString())
console.log('signer:    ', lastReceipt.signer)
console.log('signature: ', lastReceipt.signature)
console.log()
console.log('Provider claims with:')
console.log(`  claim(${lastReceipt.tabId}, ${lastReceipt.totalCalls}, "${lastReceipt.signature}")`)
