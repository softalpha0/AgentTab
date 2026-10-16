/**
 * AgentTab SDK unit tests
 * Run with: bun test sdk/agenttab.test.ts
 *
 * All signing is done locally via LocalAccount — no RPC calls needed.
 */

import { describe, it, expect } from 'bun:test'
import { recoverTypedDataAddress, type Hex } from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import {
  signReceipt,
  verifyReceipt,
  AgentTabClient,
  DOMAIN,
  RECEIPT_TYPES,
  AGENT_TAB_ADDRESS,
  ARC_MAINNET_CHAIN_ID,
} from './agenttab'

// ---------------------------------------------------------------------------
// Deterministic test key — NOT a real funded key, safe to commit in tests
// (Hardhat/Foundry's well-known account #0 private key, no real funds)
// ---------------------------------------------------------------------------

const TEST_PRIVATE_KEY: Hex =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const account = privateKeyToAccount(TEST_PRIVATE_KEY)

// ---------------------------------------------------------------------------
// signReceipt — LocalAccount path (no RPC)
// ---------------------------------------------------------------------------

describe('signReceipt', () => {
  it('returns a signature, signer and correct tab/call values', async () => {
    const receipt = await signReceipt(account, 0n, 5n)
    expect(receipt.tabId).toBe(0n)
    expect(receipt.totalCalls).toBe(5n)
    expect(receipt.signature).toMatch(/^0x[0-9a-f]{130}$/)
    expect(receipt.signer.toLowerCase()).toBe(account.address.toLowerCase())
  })

  it('uses the correct EIP-712 domain (name, version, chainId, verifyingContract)', async () => {
    const receipt = await signReceipt(account, 1n, 3n)
    // If the domain were wrong, recovery would fail or mismatch
    const recovered = await recoverTypedDataAddress({
      domain: DOMAIN,
      types: RECEIPT_TYPES,
      primaryType: 'Receipt',
      message: { tabId: 1n, totalCalls: 3n },
      signature: receipt.signature,
    })
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase())
  })

  it('domain chainId is 5042 (Arc Mainnet)', () => {
    expect(DOMAIN.chainId).toBe(5042)
  })

  it('domain verifyingContract matches deployed mainnet address', () => {
    expect(DOMAIN.verifyingContract.toLowerCase()).toBe(
      '0x77c91303cda1a54219cdec6aa55d4691dde09aea',
    )
  })

  it('different (tabId, totalCalls) produce different signatures', async () => {
    const r1 = await signReceipt(account, 0n, 1n)
    const r2 = await signReceipt(account, 0n, 2n)
    const r3 = await signReceipt(account, 1n, 1n)
    expect(r1.signature).not.toBe(r2.signature)
    expect(r1.signature).not.toBe(r3.signature)
  })
})

// ---------------------------------------------------------------------------
// verifyReceipt
// ---------------------------------------------------------------------------

describe('verifyReceipt', () => {
  it('returns true for a receipt signed by the expected signer', async () => {
    const receipt = await signReceipt(account, 0n, 7n)
    const ok = await verifyReceipt(receipt, account.address)
    expect(ok).toBe(true)
  })

  it('returns false when expectedSigner is a different address', async () => {
    const other = privateKeyToAccount(generatePrivateKey())
    const receipt = await signReceipt(account, 0n, 7n)
    const ok = await verifyReceipt(receipt, other.address)
    expect(ok).toBe(false)
  })

  it('returns false for a tampered signature', async () => {
    const receipt = await signReceipt(account, 0n, 7n)
    // Flip two hex chars in the middle of the signature
    const tampered = (receipt.signature.slice(0, 10) +
      'ff' +
      receipt.signature.slice(12)) as Hex
    const ok = await verifyReceipt(
      { ...receipt, signature: tampered },
      account.address,
    )
    expect(ok).toBe(false)
  })

  it('returns false when totalCalls is changed after signing', async () => {
    const receipt = await signReceipt(account, 0n, 5n)
    const ok = await verifyReceipt({ ...receipt, totalCalls: 6n }, account.address)
    expect(ok).toBe(false)
  })

  it('returns false when tabId is changed after signing', async () => {
    const receipt = await signReceipt(account, 0n, 5n)
    const ok = await verifyReceipt({ ...receipt, tabId: 1n }, account.address)
    expect(ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// AgentTabClient
// ---------------------------------------------------------------------------

describe('AgentTabClient', () => {
  it('starts with totalCalls 0 for any tab', () => {
    const agent = new AgentTabClient(account)
    expect(agent.totalCalls(0n)).toBe(0n)
    expect(agent.totalCalls(99n)).toBe(0n)
  })

  it('recordCall increments the counter monotonically', async () => {
    const agent = new AgentTabClient(account)
    const r1 = await agent.recordCall(0n)
    expect(r1.totalCalls).toBe(1n)
    const r2 = await agent.recordCall(0n)
    expect(r2.totalCalls).toBe(2n)
    const r3 = await agent.recordCall(0n)
    expect(r3.totalCalls).toBe(3n)
    expect(agent.totalCalls(0n)).toBe(3n)
  })

  it('counters are independent across tabs', async () => {
    const agent = new AgentTabClient(account)
    await agent.recordCall(0n)
    await agent.recordCall(0n)
    await agent.recordCall(1n)
    expect(agent.totalCalls(0n)).toBe(2n)
    expect(agent.totalCalls(1n)).toBe(1n)
  })

  it('each receipt is valid and verifiable', async () => {
    const agent = new AgentTabClient(account)
    for (let i = 1; i <= 5; i++) {
      const receipt = await agent.recordCall(0n)
      expect(receipt.totalCalls).toBe(BigInt(i))
      const ok = await verifyReceipt(receipt, account.address)
      expect(ok).toBe(true)
    }
  })

  it('resetTab clears the counter without affecting other tabs', async () => {
    const agent = new AgentTabClient(account)
    await agent.recordCall(0n)
    await agent.recordCall(0n)
    await agent.recordCall(1n)
    agent.resetTab(0n)
    expect(agent.totalCalls(0n)).toBe(0n)
    expect(agent.totalCalls(1n)).toBe(1n)
  })

  it('after reset, counter restarts from 1 on next recordCall', async () => {
    const agent = new AgentTabClient(account)
    await agent.recordCall(0n)
    await agent.recordCall(0n)
    agent.resetTab(0n)
    const r = await agent.recordCall(0n)
    expect(r.totalCalls).toBe(1n)
  })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('AGENT_TAB_ADDRESS', () => {
  it('is the correct checksummed mainnet address', () => {
    expect(AGENT_TAB_ADDRESS.toLowerCase()).toBe(
      '0x77c91303cda1a54219cdec6aa55d4691dde09aea',
    )
  })

  it('ARC_MAINNET_CHAIN_ID is 5042', () => {
    expect(ARC_MAINNET_CHAIN_ID).toBe(5042)
  })
})
