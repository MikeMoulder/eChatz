# eChatz

**On-chain encrypted peer-to-peer messaging and payments — powered by Zama fhEVM.**

eChatz is a fully on-chain messaging application where every message is encrypted at the smart-contract layer using Fully Homomorphic Encryption (FHE). There is no centralised server, no admin key, and no cleartext ever touches a database. Users communicate wallet-to-wallet; only the two parties in a thread can decrypt their conversation.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Frontend](#frontend)
- [Subgraph](#subgraph)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Tech Stack](#tech-stack)

---

## Overview

| Layer | Technology |
|---|---|
| Encryption | Zama fhEVM (`@fhevm/solidity`, `@zama-fhe/relayer-sdk`) |
| Smart contracts | Solidity 0.8.27 on Sepolia |
| Frontend | Next.js 14 (App Router), wagmi v2, RainbowKit |
| Indexer | The Graph (subgraph) |
| Large message storage | IPFS via Pinata |
| Gas wallet | Deterministic session key derived from MetaMask signature |

### Key properties

- **Single-ciphertext model.** fhEVM uses a global KMS key. One encrypted handle is stored per message; both sender and recipient are ACL-granted on it so either party can decrypt through the relayer.
- **Hybrid storage.** Messages ≤ 32 bytes are stored inline as `euint256`. Longer messages are uploaded to IPFS and only the encrypted CID pointer is stored on-chain.
- **Session key (gas wallet).** A lightweight burner wallet is derived deterministically from one MetaMask `personal_sign`. It pays gas on every send so the user is never interrupted by wallet popups mid-conversation.
- **Invited-only registration.** New users require an invite link, keeping the network quality-gated.

---

## Architecture

```
Browser
  │
  ├─ wagmi / RainbowKit        ← wallet connection
  ├─ @zama-fhe/relayer-sdk     ← FHE encrypt / userDecrypt
  │     └─ /api/relayer/v2/*   ← Next.js proxy (avoids CORS)
  │
  ├─ MessageInput              ← slash-command parser
  ├─ ChatWindow / Sidebar      ← UI shell
  │
  └─ ethers.js
        ├─ Session key wallet  ← signs sendMessage() txs
        └─ MetaMask signer     ← registration, session key setup

Smart Contracts (Sepolia)
  ├─ IdentityRegistry          ← user profiles, session keys, blocklist
  ├─ InviteRegistry            ← invite-gated registration
  ├─ MessageStore              ← encrypted P2P messages
  ├─ PaymentRouter             ← /send, /request, /escrow, /split
  ├─ VotingModule              ← encrypted on-chain polls (/vote)
  └─ ScheduleModule            ← recurring payments (/schedule)

Indexing
  └─ The Graph subgraph        ← thread inbox, unread counts, message IDs
```

---

## Smart Contracts

All contracts are deployed to **Sepolia** and inherit `ZamaEthereumConfig` from `@fhevm/solidity`.

### IdentityRegistry

`contracts/IdentityRegistry.sol`

Central identity store. Responsibilities:

- Register users with an encrypted username and bio (`euint256`), plus a 65-byte uncompressed ECDSA public key for identity verification.
- Maintain a session key registry (`owner → sessionKey`) so a gas wallet can be authorised to send messages on behalf of the main wallet.
- Store per-user contact lists, blocklists, and linked devices (all encrypted where appropriate).
- Gate registration behind InviteRegistry.

**Deployment dependency:** none (deployed first).

### InviteRegistry

`contracts/InviteRegistry.sol`

Manages invite links. Invite metadata (inviter, invitee, expiry) is stored on-chain; the actual invite slug lives off-chain. Invites expire after 7 days.

**Deployment dependency:** `IdentityRegistry`.

### MessageStore

`contracts/MessageStore.sol`

Core messaging contract.

- Accepts an `externalEuint256` content handle and `inputProof` from the relayer SDK.
- Resolves `msg.sender` through `IdentityRegistry.resolveUser()` so the session key wallet can send on behalf of the registered address.
- ACL-grants the ciphertext to both sender and recipient (`FHE.allow`).
- Tracks threads (order-independent pair hash), message IDs, and read/burn flags as encrypted booleans.
- Emits only metadata in events — no handles or content appear in logs.
- Trusted callers (`PaymentRouter`, `VotingModule`) may write system messages.

**Storage types:**

| `storageType` | Meaning |
|---|---|
| `0` | On-chain — `euint256` holds up to 32 bytes of plaintext |
| `1` | IPFS — `euint256` holds the encrypted CID pointer |

**Deployment dependency:** `IdentityRegistry`.

### PaymentRouter

`contracts/PaymentRouter.sol`

Handles in-chat payment slash commands. Supports:

| Command | Function |
|---|---|
| `/send <amount> <token>` | `sendETH` / `sendERC20` |
| `/request <amount> <token>` | `createRequest` + `fulfillRequest` |
| `/escrow` | `createEscrow` / `approveEscrowRelease` / `refundEscrow` |
| `/split` | `createSplit` / `contributeToSplit` |

Encrypted amounts use `euint64`; notes use `euint256`. A configurable protocol fee (default 0.30%) is taken from token transfers. After each action, a system message is written to `MessageStore`.

**Deployment dependency:** `MessageStore`, `IdentityRegistry`.

### VotingModule

`contracts/VotingModule.sol`

Encrypted on-chain polls tied to chat threads (`/vote` command).

- Votes are cast as `euint32` values. The tally for each option accumulates via `FHE.select()` — no individual ballot is ever readable.
- `hasVoted` is a plaintext mapping (participation is visible; choice is not).
- Maximum 5 options and 20 voters per poll.
- On close, the creator grants tally handles to specified addresses; only aggregate results are decryptable.

**Deployment dependency:** `MessageStore`, `IdentityRegistry`.

### ScheduleModule

`contracts/ScheduleModule.sol`

Recurring automated payments (`/schedule` command). Stores the payment config on-chain; an off-chain automation service (Gelato Network or Chainlink Automation) calls `executeScheduled()` at each interval. Minimum interval is 1 hour; capped at 365 executions.

**Deployment dependency:** `PaymentRouter`, `IdentityRegistry`.

---

## Frontend

`frontend/` — Next.js 14 App Router application.

### Directory layout

```
frontend/
├── app/
│   ├── page.tsx           ← Landing page
│   ├── chat/              ← Main chat shell
│   ├── api/ipfs/          ← IPFS upload proxy (keeps Pinata key server-side)
│   └── providers.tsx      ← wagmi + RainbowKit + relayer pre-warm
├── components/
│   ├── ChatWindow.tsx     ← Primary chat UI: sidebar + thread pane + onboarding
│   ├── Sidebar.tsx        ← Thread list, gas wallet panel
│   ├── MessageBubble.tsx  ← Renders text, payment, and vote message types
│   ├── MessageInput.tsx   ← Composer with slash-command suggestions
│   └── ...
├── hooks/
│   ├── useMessages.ts     ← Fetch, send, decrypt, burn messages
│   ├── useInbox.ts        ← Thread list from subgraph
│   ├── useRegistration.ts ← Check/perform user registration
│   └── useSessionKey.ts   ← Gas wallet lifecycle
└── lib/
    ├── relayer.ts         ← FhevmInstance singleton, encrypt/decrypt helpers
    ├── session-key.ts     ← Deterministic session key derivation + balance
    ├── contracts.ts       ← ABI fragments + address resolution
    ├── ipfs.ts            ← Upload/fetch with retry; dual-pin strategy
    ├── slash-commands.ts  ← /send, /request, /escrow, /split, /vote parser
    └── format.ts          ← Address shortening, date labels, ENS helpers
```

### Encryption flow (sending a message)

1. `useMessages.sendMessage()` checks message length.
2. If ≤ 32 bytes → `encryptMessageContent()` encrypts inline → `storageType = 0`.
3. If > 32 bytes → upload ciphertext bytes to IPFS → encrypt the CID → `storageType = 1`.
4. The session key wallet (or MetaMask if no session key) calls `MessageStore.sendMessage()`.
5. The relayer SDK `inputProof` is bundled with the transaction.

### Decryption flow (reading a message)

1. `useMessages` fetches message handles from the subgraph / contract.
2. `decryptMessageBatch()` calls `instance.userDecrypt()` for each handle in chunks.
3. Decrypted bytes are cached in `sessionStorage` keyed by handle — the relayer round-trip happens exactly once per handle per browser session.
4. For IPFS messages, the decrypted value is treated as a CID; the raw bytes are fetched from the IPFS gateway.

### Session key (gas wallet)

Managed in `lib/session-key.ts` and `hooks/useSessionKey.ts`.

1. User clicks **Set up gas wallet** in the sidebar.
2. MetaMask presents a deterministic `personal_sign` message (never changes for a given wallet).
3. The 65-byte signature is hashed with `keccak256` to produce a private key.
4. The resulting address is registered on-chain via `IdentityRegistry.registerSessionKey()`.
5. The private key is cached in `localStorage` for silent reuse; it can always be re-derived from the same signature if storage is cleared.
6. A low-balance banner appears in the sidebar when the session key holds < 0.002 ETH.

### Slash commands

Typed into the message composer with a leading `/`. Parsed by `lib/slash-commands.ts`.

| Command | Description |
|---|---|
| `/send 0.1 ETH` | Send ETH to the current recipient |
| `/send 0.1 ETH to 0x…` | Send ETH to an explicit address |
| `/send 0.1 ETH note dinner split` | Send with a note |
| `/request 0.05 ETH` | Request payment from the current recipient |
| `/request 0.05 ETH from 0x…` | Request from an explicit address |
| `/escrow 1 ETH to 0xBeneficiary via 0xArbitrator` | Create an escrow |
| `/split 0.3 ETH with 0xAddr1,0xAddr2` | Split a bill |
| `/schedule 0.001 ETH to 0x… every 1d` | Schedule a recurring payment |
| `/vote Question? options A,B,C` | Create an encrypted poll |
| `/burn` | Burn the selected message |

---

## Subgraph

`subgraph/` — The Graph subgraph for Sepolia.

Indexes `MessageSent`, `MessageRead`, `MessageBurned`, `UserRegistered`, `PaymentSent`, `RequestCreated`, and poll events. Exposes a GraphQL endpoint used by `useInbox` to populate the thread list with real unread counts and last-activity timestamps.

To rebuild after ABI changes:

```bash
cd subgraph
graph codegen && graph build
graph deploy --studio echatz
```

---

## Local Development

### Prerequisites

- Node.js ≥ 20
- A MetaMask wallet
- Hardhat configuration vars (see below)

### Install

```bash
# Root — contracts + Hardhat tooling
npm install

# Frontend
cd frontend && npm install
```

### Compile contracts

```bash
npm run compile
```

### Run tests

```bash
npm test
# With gas report:
npm run test:gas
```

### Start the frontend dev server

```bash
cd frontend
npm run dev
```

---

## Deployment

### Set Hardhat configuration variables

```bash
npx hardhat vars set MNEMONIC
npx hardhat vars set INFURA_API_KEY
npx hardhat vars set ETHERSCAN_API_KEY
```

### Deploy to Sepolia

```bash
npm run deploy:sepolia
```

The deploy script (`scripts/deploy.ts`) deploys all six contracts in dependency order and wires them together:

1. `IdentityRegistry`
2. `InviteRegistry` → `IdentityRegistry.setInviteRegistry()`
3. `MessageStore` → trust `PaymentRouter` and `VotingModule`
4. `PaymentRouter`
5. `VotingModule`
6. `ScheduleModule`

After deployment, copy the printed contract addresses into your `.env.local`.

### Verify on Etherscan

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> [constructor args]
```

---

## Environment Variables

Create `frontend/.env.local`:

```env
# Contract addresses (output of deploy script)
NEXT_PUBLIC_IDENTITY_REGISTRY_ADDR=0x...
NEXT_PUBLIC_INVITE_REGISTRY_ADDR=0x...
NEXT_PUBLIC_MESSAGE_STORE_ADDR=0x...
NEXT_PUBLIC_PAYMENT_ROUTER_ADDR=0x...
NEXT_PUBLIC_VOTING_MODULE_ADDR=0x...

# Chain
NEXT_PUBLIC_CHAIN_ID=11155111

# RPC (used by session key wallet for gas-paid transactions)
NEXT_PUBLIC_INFURA_API_KEY=...

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...

# Subgraph
NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../echatz/version/latest

# IPFS (server-side only — never expose to browser)
PINATA_API_KEY=...
PINATA_API_SECRET=...
NEXT_PUBLIC_IPFS_GATEWAY=https://ipfs.io/ipfs
```

---

## Tech Stack

| Category | Package | Version |
|---|---|---|
| FHE runtime | `@fhevm/solidity` | ^0.11.1 |
| FHE relayer | `@zama-fhe/relayer-sdk` | ^0.4.1 |
| Hardhat plugin | `@fhevm/hardhat-plugin` | ^0.4.2 |
| Smart contracts | Solidity | 0.8.27 |
| Contract framework | Hardhat | ^2.28 |
| Access control | OpenZeppelin Contracts | ^5.3 |
| Frontend framework | Next.js | 14 |
| Wallet integration | wagmi + RainbowKit | v2 |
| Ethereum library | ethers.js | ^6 |
| Styling | Tailwind CSS | v3 |
| Indexer | The Graph | — |
| IPFS pinning | Pinata | — |
| TypeScript | — | ^5.8 |

---

## License

`BSD-3-Clause-Clear` — matching the Zama fhEVM library license.
