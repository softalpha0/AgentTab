# AgentTab

> Prepaid USDC tabs for AI agents and API providers — open a tab, sign usage receipts, provider claims, close when done.

---

## How it works

1. **Open a tab** — a client deposits USDC into a tab for a specific service. Funds sit in the contract.
2. **Sign receipts** — after each batch of API calls the client signs an EIP-712 receipt containing `(tabId, totalCalls)`. The receipt carries a running total, not a delta.
3. **Provider claims** — the provider submits the receipt on-chain. The contract pays `(totalCalls − callsClaimed) × pricePerCall` in USDC and advances the high-water mark.
4. **Two-step close** — the client calls `requestClose`, waits for `CLOSE_DELAY`, then calls `finalizeClose` to get the unspent balance back. The provider can call `closeByProvider` at any time to close and refund immediately.

---

## Security

- **EIP-712 signed receipts** — domain `{ name: "AgentTabV2", version: "1", chainId: 5042, verifyingContract: 0x77c91303cda1a54219cdec6aa55d4691dde09aea }`. Receipt type: `Receipt(uint256 tabId, uint256 totalCalls)`. Signatures bind to the exact contract and chain.
- **Monotonic `totalCalls` replay protection** — `callsClaimed` is a per-tab high-water mark stored on-chain. Any receipt with `totalCalls ≤ callsClaimed` reverts with `TotalCallsNotIncreased`.
- **ERC-1271 support** — `SignatureChecker.isValidSignatureNow` accepts both EOA signatures and smart-contract wallet signatures (AI agent wallets, multisigs, etc.).
- **`CLOSE_DELAY` minimum** — constructor reverts with `CloseDelayTooShort` if `closeDelay < 300` seconds. Mainnet is deployed with `CLOSE_DELAY = 3600` (1 hour), giving providers time to make a final claim before a tab closes.
- **`setRefundRecipient`** — clients can designate an alternate payout address before closing, guarding against USDC blocklist scenarios on the refund path.
- **`ReentrancyGuard`** on `claim`, `finalizeClose`, and `closeByProvider`.
- **`SafeERC20`** on all token transfers; **CEI order** (checks → effects → interactions) enforced throughout.

---

## Deployments

### Arc Mainnet (live)

| Field | Value |
|---|---|
| Address | [`0x77c91303cda1a54219cdec6aa55d4691dde09aea`](https://explorer.arc.io/address/0x77c91303cda1a54219cdec6aa55d4691dde09aea) |
| Chain | Arc Mainnet (chain ID 5042) |
| USDC | `0x3600000000000000000000000000000000000000` |
| CLOSE_DELAY | 3600 s (1 hour) |
| Example tx | [`0x8213c7fc514eb298a74ec4d84f8c2253cf10fd98952765a5932f965167b2f33c`](https://explorer.arc.io/tx/0x8213c7fc514eb298a74ec4d84f8c2253cf10fd98952765a5932f965167b2f33c) |

---

## Live app

**https://arc-studio-7b9cb270eee54f05855ff250.vercel.app**

Connect a wallet on Arc Mainnet (chain ID 5042) to use the app. The Client tab lets you browse services, open and top up tabs, sign usage receipts, and initiate or finalize a close. The Provider tab lets you register a service, view open tabs, and claim USDC by pasting a client-signed receipt.

---

## Built with Arc Studio

This project was generated entirely inside [Arc Studio](https://studio.arc.io) — Circle's tool for building money-powered onchain apps in minutes through natural conversation.

**What Arc Studio produced:**

- `contracts/AgentTabV2.sol` — the full Solidity contract, written to spec.
- `contracts/test/AgentTabV2.t.sol` — 18 Foundry unit tests + 1 fuzz test, all passing.
- Security review at max severity (two rounds across a rule-corpus auditor and a functional auditor); four findings fixed between rounds. Slither static analysis: zero High/Medium findings.
- The complete React + wagmi + ConnectKit frontend (Client page, Provider page, Deploy page).
- Deployment to Arc Testnet and Arc Mainnet via Arc Studio's deploy tool and the in-app `/deploy` page.

---

## Run locally

```bash
# Install dependencies
bun install

# Run Foundry unit tests
forge test

# Start the dev server
bun run dev
```

Requires [Bun](https://bun.sh) and [Foundry](https://getfoundry.sh). The app runs at `http://localhost:5173`.

To point the app at a different contract, update `AGENT_TAB_MAINNET_ADDRESS` in `src/contract.ts`.

---

## Roadmap

- **Service metadata on-chain or IPFS** — add a URI field to `registerService` so clients can discover pricing and descriptions without off-chain coordination.
- **Dispute window** — a short period after `requestClose` where the provider can make a final claim before the refund is released.
- **Provider-side receipt generation helper** — a small TypeScript library that signs receipts server-side so providers can issue them without manual EIP-712 construction.
- **Multi-token support** — accept any ERC-20 with 6 or 18 decimals, not just USDC.
- **Subscription mode** — fixed monthly fee debited automatically using a signed recurring receipt, without per-call granularity.
