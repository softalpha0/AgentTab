/**
 * AgentTabV2 contract addresses.
 *
 * Testnet  (Arc Testnet, chainId 5042002):
 *   0x711549c0f5a34ffdff22c02624f4d1d929d9c058   CLOSE_DELAY=3600
 *
 * Mainnet  (Arc, chainId 5042):
 *   *** PASTE YOUR MAINNET ADDRESS HERE after deploying via /deploy ***
 *   Set AGENT_TAB_MAINNET_ADDRESS below, then remove the null.
 */

export const AGENT_TAB_TESTNET_ADDRESS =
  '0x711549c0f5a34ffdff22c02624f4d1d929d9c058' as const

/** Arc mainnet contract address — deployed 2026-10-16, CLOSE_DELAY=3600. */
export const AGENT_TAB_MAINNET_ADDRESS: `0x${string}` =
  '0x77c91303cda1a54219cdec6aa55d4691dde09aea'

/** Returns the contract address for the given chain ID, or null if unknown. */
export function getAgentTabAddress(chainId: number): `0x${string}` | null {
  if (chainId === 5042) return AGENT_TAB_MAINNET_ADDRESS
  if (chainId === 5042002) return AGENT_TAB_TESTNET_ADDRESS
  return null
}

/**
 * @deprecated Use getAgentTabAddress(chainId) instead.
 * Kept for components not yet migrated to multi-chain.
 */
export const AGENT_TAB_ADDRESS = AGENT_TAB_TESTNET_ADDRESS

export const AGENT_TAB_ABI = [
  // ── constructor ────────────────────────────────────────────────────────────
  {
    "type": "constructor",
    "inputs": [
      { "name": "usdcAddress", "type": "address" },
      { "name": "closeDelay", "type": "uint256" }
    ],
    "stateMutability": "nonpayable"
  },
  // ── state reads ────────────────────────────────────────────────────────────
  { "type": "function", "name": "serviceCount", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "tabCount", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "CLOSE_DELAY", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "RECEIPT_TYPEHASH", "inputs": [], "outputs": [{ "name": "", "type": "bytes32" }], "stateMutability": "view" },
  { "type": "function", "name": "usdc", "inputs": [], "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view" },
  {
    "type": "function", "name": "services",
    "inputs": [{ "name": "", "type": "uint256" }],
    "outputs": [
      { "name": "provider", "type": "address" },
      { "name": "name", "type": "string" },
      { "name": "pricePerCall", "type": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function", "name": "tabs",
    "inputs": [{ "name": "", "type": "uint256" }],
    "outputs": [
      { "name": "client", "type": "address" },
      { "name": "refundRecipient", "type": "address" },
      { "name": "serviceId", "type": "uint256" },
      { "name": "balance", "type": "uint256" },
      { "name": "callsClaimed", "type": "uint256" },
      { "name": "closed", "type": "bool" },
      { "name": "closeRequestedAt", "type": "uint256" }
    ],
    "stateMutability": "view"
  },
  // EIP-712 domain
  {
    "type": "function", "name": "eip712Domain",
    "inputs": [],
    "outputs": [
      { "name": "fields", "type": "bytes1" },
      { "name": "name", "type": "string" },
      { "name": "version", "type": "string" },
      { "name": "chainId", "type": "uint256" },
      { "name": "verifyingContract", "type": "address" },
      { "name": "salt", "type": "bytes32" },
      { "name": "extensions", "type": "uint256[]" }
    ],
    "stateMutability": "view"
  },
  // ── writes ─────────────────────────────────────────────────────────────────
  {
    "type": "function", "name": "registerService",
    "inputs": [{ "name": "name", "type": "string" }, { "name": "pricePerCall", "type": "uint256" }],
    "outputs": [{ "name": "serviceId", "type": "uint256" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "openTab",
    "inputs": [{ "name": "serviceId", "type": "uint256" }, { "name": "amount", "type": "uint256" }],
    "outputs": [{ "name": "tabId", "type": "uint256" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "topUp",
    "inputs": [{ "name": "tabId", "type": "uint256" }, { "name": "amount", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "claim",
    "inputs": [
      { "name": "tabId", "type": "uint256" },
      { "name": "totalCalls", "type": "uint256" },
      { "name": "signature", "type": "bytes" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "requestClose",
    "inputs": [{ "name": "tabId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "finalizeClose",
    "inputs": [{ "name": "tabId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "closeByProvider",
    "inputs": [{ "name": "tabId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "setRefundRecipient",
    "inputs": [{ "name": "tabId", "type": "uint256" }, { "name": "recipient", "type": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  // ── events ─────────────────────────────────────────────────────────────────
  {
    "type": "event", "name": "ServiceRegistered",
    "inputs": [
      { "name": "serviceId", "type": "uint256", "indexed": true },
      { "name": "provider", "type": "address", "indexed": true },
      { "name": "name", "type": "string", "indexed": false },
      { "name": "pricePerCall", "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event", "name": "TabOpened",
    "inputs": [
      { "name": "tabId", "type": "uint256", "indexed": true },
      { "name": "client", "type": "address", "indexed": true },
      { "name": "serviceId", "type": "uint256", "indexed": true },
      { "name": "amount", "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event", "name": "TabToppedUp",
    "inputs": [
      { "name": "tabId", "type": "uint256", "indexed": true },
      { "name": "client", "type": "address", "indexed": true },
      { "name": "amount", "type": "uint256", "indexed": false },
      { "name": "newBalance", "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event", "name": "Claimed",
    "inputs": [
      { "name": "tabId", "type": "uint256", "indexed": true },
      { "name": "provider", "type": "address", "indexed": true },
      { "name": "totalCalls", "type": "uint256", "indexed": false },
      { "name": "claimAmount", "type": "uint256", "indexed": false },
      { "name": "remainingBalance", "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event", "name": "CloseRequested",
    "inputs": [
      { "name": "tabId", "type": "uint256", "indexed": true },
      { "name": "client", "type": "address", "indexed": true },
      { "name": "closeAfter", "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event", "name": "TabClosed",
    "inputs": [
      { "name": "tabId", "type": "uint256", "indexed": true },
      { "name": "client", "type": "address", "indexed": true },
      { "name": "refund", "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event", "name": "RefundRecipientChanged",
    "inputs": [
      { "name": "tabId", "type": "uint256", "indexed": true },
      { "name": "newRecipient", "type": "address", "indexed": true }
    ]
  },
  // ── errors ─────────────────────────────────────────────────────────────────
  { "type": "error", "name": "ServiceNotFound", "inputs": [] },
  { "type": "error", "name": "TabNotFound", "inputs": [] },
  { "type": "error", "name": "TabAlreadyClosed", "inputs": [] },
  { "type": "error", "name": "NotTabClient", "inputs": [{ "name": "tabId", "type": "uint256" }, { "name": "caller", "type": "address" }] },
  { "type": "error", "name": "NotServiceProvider", "inputs": [{ "name": "tabId", "type": "uint256" }, { "name": "caller", "type": "address" }] },
  { "type": "error", "name": "ZeroAmount", "inputs": [] },
  { "type": "error", "name": "EmptyName", "inputs": [] },
  { "type": "error", "name": "InsufficientTabBalance", "inputs": [{ "name": "tabId", "type": "uint256" }, { "name": "required", "type": "uint256" }, { "name": "available", "type": "uint256" }] },
  { "type": "error", "name": "ZeroAddress", "inputs": [] },
  { "type": "error", "name": "WrongTokenDecimals", "inputs": [] },
  { "type": "error", "name": "NotAContract", "inputs": [] },
  { "type": "error", "name": "InvalidSignature", "inputs": [{ "name": "tabId", "type": "uint256" }, { "name": "totalCalls", "type": "uint256" }] },
  { "type": "error", "name": "TotalCallsNotIncreased", "inputs": [{ "name": "tabId", "type": "uint256" }, { "name": "totalCalls", "type": "uint256" }, { "name": "callsClaimed", "type": "uint256" }] },
  { "type": "error", "name": "CloseNotRequested", "inputs": [{ "name": "tabId", "type": "uint256" }] },
  { "type": "error", "name": "CloseDelayNotExpired", "inputs": [{ "name": "tabId", "type": "uint256" }, { "name": "closeAfter", "type": "uint256" }, { "name": "now_", "type": "uint256" }] },
  { "type": "error", "name": "CloseAlreadyPending", "inputs": [{ "name": "tabId", "type": "uint256" }] },
  { "type": "error", "name": "TopUpDuringClosePeriod", "inputs": [{ "name": "tabId", "type": "uint256" }] },
  { "type": "error", "name": "CloseDelayTooShort", "inputs": [{ "name": "provided", "type": "uint256" }, { "name": "minimum", "type": "uint256" }] },
  { "type": "error", "name": "ReentrancyGuardReentrantCall", "inputs": [] },
  { "type": "error", "name": "SafeERC20FailedOperation", "inputs": [{ "name": "token", "type": "address" }] }
] as const
