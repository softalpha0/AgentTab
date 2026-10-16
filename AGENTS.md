# [App Name]

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

[Brief description of what the app does and its primary use case]

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```

## Deployed Contracts

### AgentTabV2 v2.1 — Arc Mainnet (LIVE)
- **Address:** `0x77c91303cda1a54219cdec6aa55d4691dde09aea`
- **Chain ID:** 5042 (Arc mainnet)
- **USDC (constructor arg):** `0x3600000000000000000000000000000000000000`
- **CLOSE_DELAY:** 3600 seconds (1 hour)
- **Explorer:** https://explorer.arc.io/address/0x77c91303cda1a54219cdec6aa55d4691dde09aea
- **Source:** `contracts/AgentTabV2.sol`
- **Deployed:** 2026-10-16

### AgentTabV2 v2.1 — Arc Testnet
- **Address:** `0x711549c0f5a34ffdff22c02624f4d1d929d9c058`
- **USDC (constructor arg):** `0x3600000000000000000000000000000000000000`
- **CLOSE_DELAY:** 3600 seconds (1 hour)
- **Explorer:** https://explorer.testnet.arc.io/address/0x711549c0f5a34ffdff22c02624f4d1d929d9c058
- **Deploy tx:** `0x455a0c5d1867645e37b3f02e1bdf189d7271c0cc277a94a52b9279eda0017969`
- **Source:** `contracts/AgentTabV2.sol`
- **Tests:** `contracts/test/AgentTabV2.t.sol` (18 tests + 1 fuzz, all pass)
- **Added in this deploy:** `CloseDelayTooShort` error — constructor reverts if closeDelay < 300
- **Deployed:** 2026-10-15

### AgentTabV2 — Arc Testnet (superseded by v2.1)
- **Address:** `0x6959e28e2b05957817c7e04272d4b75a271aeb4a`
- **CLOSE_DELAY:** 600 seconds
- **Explorer:** https://explorer.testnet.arc.io/address/0x6959e28e2b05957817c7e04272d4b75a271aeb4a

### AgentTab v1 — Arc Testnet (superseded)
- **Address:** `0x6c1b0c8e1ed9e9dc677ab7c259506db9b591129e`
- **Explorer:** https://explorer.testnet.arc.io/address/0x6c1b0c8e1ed9e9dc677ab7c259506db9b591129e
- **Source:** `contracts/AgentTab.sol`
