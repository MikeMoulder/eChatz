---
name: zama-fhe-build-skill
version: 2.0.0
last_verified: 2026-04-29
description: Autonomous execution manual for building Zama FHE apps from scratch.
stacks: [tfhe-rs, concrete, concrete-ml, fhevm]
pinned_versions:
  tfhe-rs: "~1.6.1"
  fhevm-solidity: "^0.11.1"
  fhevm-hardhat-plugin: "^0.4.2"
  relayer-sdk: "^0.4.1"
  concrete-ml: ">=1.9,<2.0"
  node: ">=20"
  npm: ">=7"
  rust: ">=1.84"
  solidity: "0.8.27"
tags: [fhe, zama, fhevm, tfhe-rs, concrete-ml, privacy, confidential-computing]
---

# Zama FHE Build Skill (Zero-Context, From Scratch)

This document is a self-contained engineering reference for building FHE applications in the Zama ecosystem. It is written for AI agents and developers with zero prior context.

Validated against public docs around April 2026 (notably TFHE-rs 1.6.x and the Zama Protocol docs).

## Table of Contents

- [§0 Versioning & Compatibility Matrix](#0-versioning--compatibility-matrix)
- [§1 Ecosystem Overview](#1-ecosystem-overview-what-to-use-when)
- [§2 Environment Setup](#2-environment-setup)
- [§3 Core FHE Concepts as Implemented by Zama](#3-core-fhe-concepts-as-implemented-by-zama)
- [§4 Build an App From Scratch (Scaffold)](#4-build-an-app-from-scratch-scaffold)
- [§5 Supported Operations by Data Type](#5-supported-operations-by-data-type)
- [§6 Performance Considerations](#6-performance-considerations)
- [§7 Common Errors and Exact Fixes](#7-common-errors-and-exact-fixes)
- [§8 Complete Working Examples (Runnable)](#8-complete-working-examples-runnable)
- [§9 Agent Execution Checklist](#9-agent-execution-checklist-use-this-before-coding)
- [§10 AI Agent Workflow Protocol](#10-ai-agent-workflow-protocol)
- [§11 Architecture Blueprints / Reusable Templates](#11-architecture-blueprints--reusable-templates)
- [§12 Security Anti-Patterns and Privacy Pitfalls](#12-security-anti-patterns-and-privacy-pitfalls)
- [§13 Layered Testing Methodology](#13-layered-testing-methodology)
- [§14 Deployment Recipes](#14-deployment-recipes)
- [§15 Decision Trees / Operational Heuristics](#15-decision-trees--operational-heuristics)
- [§16 Machine-Executable Orientation](#16-machine-executable-orientation)
- [§17 Glossary](#17-glossary)
- [§18 References](#18-references)

---

## 0) Versioning & Compatibility Matrix

Single source of truth. All code samples in this document target the versions below. If any sample diverges, treat this table as canonical and file a fix.

| Component | Pinned Version | Last Verified | Notes |
|---|---|---|---|
| `tfhe` (Rust crate) | `~1.6.1` | 2026-04-29 | HL API stable; CPU+GPU backends |
| `rustc` | `>=1.84` | 2026-04-29 | Edition 2021 |
| `@fhevm/solidity` | `^0.11.1` | 2026-04-29 | Provides `FHE.sol`, encrypted types |
| `@fhevm/hardhat-plugin` | `^0.4.2` | 2026-04-29 | Requires Node >=20 |
| `@fhevm/mock-utils` | `^0.4.2` | 2026-04-29 | Local Hardhat network mocks |
| `@zama-fhe/relayer-sdk` | `^0.4.1` | 2026-04-29 | Replaces legacy `fhevmjs` |
| `encrypted-types` | `^0.0.4` | 2026-04-29 | Shared TS type defs |
| `hardhat` | `^2.28.4` | 2026-04-29 | Node 20+ required |
| `ethers` | `^6.16.0` | 2026-04-29 | v6 API used throughout |
| `solc` (Solidity) | `0.8.27` | 2026-04-29 | `evmVersion: cancun` |
| `concrete-ml` | `>=1.9,<2.0` | 2026-04-29 | Python 3.8–3.12 |
| Node.js | `>=20` | 2026-04-29 | LTS 20 recommended |
| npm | `>=7` | 2026-04-29 | Needed by template |

When uncertain, prefer official operation pages and API docs over assumptions. In this ecosystem, small type/parameter mismatches can cause large correctness or performance regressions.

---

## 1) Ecosystem Overview (What to use, when)

### 1.1 Zama Stack at a Glance

| Component | Primary Language | Best For | Use It When |
|---|---|---|---|
| `tfhe-rs` | Rust | General encrypted computation, integer/boolean logic, high-performance server-side FHE | You need full control over encrypted arithmetic/logic and runtime performance |
| `Concrete` | Python compiler framework | Compiling FHE programs and lower-level FHE workflows | You need direct compiler-level tuning or custom FHE program compilation |
| `Concrete ML` | Python (scikit-learn / PyTorch) | Private ML inference (and selected encrypted training workflows) | You want to train/compile ML models and run encrypted inference quickly |
| Zama Protocol (FHEVM) Solidity library | Solidity | Confidential smart contracts on EVM-compatible chains | You need on-chain computation over encrypted state |
| `@fhevm/hardhat-plugin` | TypeScript/JS | Contract testing, encrypted inputs, local/devnet FHEVM workflows | You develop FHEVM contracts with Hardhat |
| `@zama-fhe/relayer-sdk` | TypeScript/JS | Frontend/backend dApp integration: encrypted inputs, user/public decryption | You need dApp-side encryption/decryption without managing gateway internals |
| `fhevmjs` (legacy) | JS | Older client integrations | Prefer `@zama-fhe/relayer-sdk` for new projects |

### 1.2 FHEVM Infrastructure Components

FHEVM is not "just a contract library"; it is a protocol. Every agent must understand the roles below before writing code:

| Role | Who Runs It | Holds Plaintext? | Purpose |
|---|---|---|---|
| **Coprocessor** | Zama / operators | No (only ciphertexts) | Executes encrypted ops off-chain, posts results back on-chain |
| **KMS (Key Management Service)** | Threshold committee | Key shares only | Holds the FHE decryption key as a threshold-shared secret |
| **Gateway** | Protocol | No | Mediates decryption requests, verifies ACL, coordinates KMS |
| **Relayer** | dApp backend or Zama | No | Accepts encrypted inputs + proofs from clients and forwards |
| **Client** | User browser/app | Yes (own plaintext) | Encrypts inputs, signs EIP-712 decryption requests |

Practical consequence: an FHEVM contract never "decrypts" locally. It either (a) returns an encrypted handle the user decrypts via the relayer + KMS, or (b) requests a public decryption that the Gateway fulfills asynchronously.

### 1.3 Practical Selection Rules

1. Confidential off-chain compute service → `tfhe-rs`.
2. Confidential ML API → `Concrete ML` (with optional deeper `Concrete` use).
3. Confidential smart contracts/dApps → FHEVM Solidity + Hardhat plugin + Relayer SDK.
4. Need strict control over operation graph and parameters → use `tfhe-rs` or `Concrete` directly, not only high-level wrappers.

---

## 2) Environment Setup

### 2.1 TFHE-rs (CPU backend)

**Requirements**

- Rust toolchain with `rustc >= 1.84`.
- CPU AES acceleration expected by default:
  - x86_64: `sse2`, `aesni`
  - aarch64: `aes`, `neon`

If the target CPU lacks required AES instructions, enable the software PRNG feature.

**Installation Steps**

```bash
# 1) Install/update Rust
rustup update
rustc --version
cargo --version

# 2) Create project
cargo new tfhe-app
cd tfhe-app
```

`Cargo.toml`:

```toml
[package]
name = "tfhe-app"
version = "0.1.0"
edition = "2021"

[dependencies]
tfhe = { version = "~1.6.1", features = ["integer"] }

[profile.release]
lto = "fat"
```

Optional compatibility fallback for older CPUs:

```toml
tfhe = { version = "~1.6.1", features = ["boolean", "shortint", "integer", "software-prng"] }
```

Run with optimization:

```bash
cargo run --release
```

Optional native tuning (non-portable binary):

```bash
RUSTFLAGS="-C target-cpu=native" cargo run --release
```

### 2.2 TFHE-rs (GPU backend)

**Requirements**

- Linux only (x86 / aarch64 supported).
- CUDA >= 10
- GPU Compute Capability >= 3.0
- `gcc >= 8.0`
- `cmake >= 3.24`
- `libclang >= 9.0`

**Cargo Features**

```toml
tfhe = { version = "~1.6.1", features = ["boolean", "shortint", "integer", "gpu"] }
```

**Important GPU Limitations**

- Key generation is CPU-side.
- Encryption/decryption is CPU-side.
- Encrypted strings (`FheAsciiString`) are not supported on GPU backend.
- CPU and GPU parameter sets must not be mixed if you care about expected GPU performance.

### 2.3 Concrete ML

**Requirements**

- Python supported: `3.8`, `3.9`, `3.10`, `3.11`, `3.12`.
- For pip installs: Linux or macOS (x86 and Apple Silicon).
- Linux: `glibc >= 2.28`.
- Windows: use Docker or WSL (in WSL, do not install under `/mnt/c/...`).

**Pip Installation**

```bash
python -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1

pip install -U pip wheel setuptools
pip install "concrete-ml>=1.9,<2.0"
```

**Docker Installation**

```bash
docker pull zamafhe/concrete-ml:latest
docker run --rm -it -p 8888:8888 zamafhe/concrete-ml
```

### 2.4 Zama Protocol FHEVM (Hardhat bootstrap)

This is the canonical bootstrap path that produces a compiling, deployable FHEVM project with no guesswork.

**Official template repository**

```
https://github.com/zama-ai/fhevm-hardhat-template
```

**Clone, install, compile**

```bash
git clone https://github.com/zama-ai/fhevm-hardhat-template.git fhevm-app
cd fhevm-app

# Enforce template engine constraints
npx -y check-node-version --node ">=20" --npm ">=7.0.0"

# Install exactly from lockfile
npm ci

# Compile contracts
npm run compile
```

**Node.js constraint**

```bash
# Option A: nvm users
nvm install 20
nvm use 20

# Option B: hard check in CI/local scripts
npx -y check-node-version --node ">=20" --npm ">=7.0.0"
```

**Required npm packages (template baseline)**

```json
{
  "dependencies": {
    "@fhevm/mock-utils": "^0.4.2",
    "@fhevm/solidity": "^0.11.1",
    "encrypted-types": "^0.0.4"
  },
  "devDependencies": {
    "hardhat": "^2.28.4",
    "@fhevm/hardhat-plugin": "^0.4.2",
    "@zama-fhe/relayer-sdk": "^0.4.1",
    "ethers": "^6.16.0",
    "@nomicfoundation/hardhat-ethers": "^3.1.3",
    "@nomicfoundation/hardhat-verify": "^2.1.3",
    "hardhat-deploy": "^0.11.45",
    "hardhat-gas-reporter": "^2.3.0",
    "typescript": "^5.9.3",
    "ts-node": "^10.9.2"
  }
}
```

**`hardhat.config.ts`** for local + Sepolia + mainnet FHEVM workflows:

```typescript
import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import { vars } from "hardhat/config";
import "solidity-coverage";

const MNEMONIC: string = vars.get(
  "MNEMONIC",
  "test test test test test test test test test test test junk",
);
const INFURA_API_KEY: string = vars.get("INFURA_API_KEY", "");

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: { deployer: 0 },
  etherscan: {
    apiKey: {
      sepolia: vars.get("ETHERSCAN_API_KEY", ""),
      mainnet: vars.get("ETHERSCAN_API_KEY", ""),
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: { mnemonic: MNEMONIC },
    },
    anvil: {
      chainId: 31337,
      url: "http://127.0.0.1:8545",
      accounts: { mnemonic: MNEMONIC, path: "m/44'/60'/0'/0/", count: 10 },
    },
    sepolia: {
      chainId: 11155111,
      url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
      accounts: { mnemonic: MNEMONIC, path: "m/44'/60'/0'/0/", count: 10 },
    },
    mainnet: {
      chainId: 1,
      url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
      accounts: { mnemonic: MNEMONIC, path: "m/44'/60'/0'/0/", count: 10 },
    },
  },
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: { enabled: true, runs: 800 },
      evmVersion: "cancun",
      metadata: { bytecodeHash: "none" },
    },
  },
};

export default config;
```

**Required Hardhat vars**

```bash
npx hardhat vars set MNEMONIC
npx hardhat vars set INFURA_API_KEY
npx hardhat vars set ETHERSCAN_API_KEY
```

| Variable | Purpose |
|---|---|
| `MNEMONIC` | Deterministic account derivation for local/testnet/mainnet signer(s). |
| `INFURA_API_KEY` | Builds RPC URLs for Sepolia and mainnet. |
| `ETHERSCAN_API_KEY` | Enables `hardhat verify` for explorer verification. |

**Smoke test**

```bash
npm run compile && npx hardhat test
```

### 2.5 Key & Ciphertext Serialization (TFHE-rs)

Production systems persist and transmit keys and ciphertexts. Serialization is where most integration bugs and DoS vectors live.

**Rules**

1. Always use `safe_serialize` / `safe_deserialize` (they enforce version + size limits).
2. Never deserialize untrusted bytes with `bincode::deserialize` without a size cap.
3. Prefer compressed forms (`CompressedServerKey`, `CompressedFheUintN`) for transport.

```rust
use tfhe::prelude::*;
use tfhe::{
    ConfigBuilder, FheUint8, CompressedServerKey,
    generate_keys, set_server_key,
    safe_serialization::{safe_serialize, safe_deserialize},
};

const MAX_BYTES: u64 = 1 << 30; // 1 GiB hard ceiling

fn persist_keys() -> std::io::Result<()> {
    let config = ConfigBuilder::default().build();
    let (client_key, server_key) = generate_keys(config);
    let compressed_sk = CompressedServerKey::new(&client_key);

    let mut ck_bytes = Vec::new();
    safe_serialize(&client_key, &mut ck_bytes, MAX_BYTES).unwrap();

    let mut sk_bytes = Vec::new();
    safe_serialize(&compressed_sk, &mut sk_bytes, MAX_BYTES).unwrap();

    std::fs::write("client.key", &ck_bytes)?;
    std::fs::write("server.key.compressed", &sk_bytes)?;
    Ok(())
}
```

On load, expand the compressed server key once:

```rust
let compressed_sk: CompressedServerKey =
    safe_deserialize(&*sk_bytes, MAX_BYTES).unwrap();
set_server_key(compressed_sk.decompress());
```

---

## 3) Core FHE Concepts as Implemented by Zama

### 3.1 Type Mapping

**TFHE-rs Types**

- Boolean: `FheBool`
- Unsigned integers: `FheUintN` where `N ∈ {2, 4, 6, 8, 10, 12, 14, 16, 32, 64, 128, 160, 256, 512, 1024, 2048}`
- Signed integers: `FheIntN` (same widths)
- Encrypted ASCII strings: `FheAsciiString` (CPU backend only)

Common aliases:

- `FheUint8` ↔ `u8`
- `FheUint64` ↔ `u64`
- `FheInt32` ↔ `i32`

**FHEVM Solidity Types**

- `ebool`
- `euint8`, `euint16`, `euint32`, `euint64`, `euint128`, `euint256`
- `eaddress`
- External input wrappers: `externalEuintXX`, `externalEbool`, `externalEaddress`

### 3.2 Key Roles

- `client_key` (private): used for encryption and decryption, must never leave the trusted client boundary.
- `server_key` (public-ish operational key): used by the compute service/VM to evaluate ciphertext operations.
- `public_key` / `CompactPublicKey` (public): used by third parties to encrypt inputs toward a server that holds the matching `server_key`.

TFHE-rs key generation:

```rust
let config = ConfigBuilder::default().build();
let (client_key, server_key) = generate_keys(config);
```

Before evaluating server-side operations in the same process:

```rust
set_server_key(server_key);
```

### 3.3 Encrypt → Compute → Decrypt Lifecycle

1. Configure types/params.
2. Generate keys.
3. Encrypt plaintext to ciphertext (`FheUint8::try_encrypt(...)`, etc.).
4. Set server key in the evaluator context.
5. Execute encrypted operations.
6. Decrypt final ciphertext with the client key.

### 3.4 Bootstrapping in Practice

- In TFHE-family schemes, ciphertext noise grows with operations.
- Programmable bootstrapping (PBS) refreshes noise and enables deeper computation.
- In TFHE-rs high-level API, bootstrapping is mostly implicit behind operations.
- Performance is often dominated by PBS-heavy paths.

**Practical implication**: design operation graphs to reduce expensive conditional/select-heavy patterns and unnecessary wide-precision arithmetic.

### 3.5 ACL Semantics (FHEVM)

The ACL is the bedrock of FHEVM privacy. A ciphertext handle is **inaccessible by default** to every address, including the contract that produced it.

| Function | Scope | Persistence | Use Case |
|---|---|---|---|
| `FHE.allow(handle, addr)` | Grant `addr` decrypt rights on `handle` | Persistent (stored) | User can decrypt their balance across txs |
| `FHE.allowThis(handle)` | Grant the contract itself access | Persistent | Contract reads its own state in future calls |
| `FHE.allowTransient(handle, addr)` | Grant `addr` access for the current tx only | Transient (in-memory) | Pass handle to another contract within one call |
| `FHE.isSenderAllowed(handle)` | Verify caller currently has access | Read-only check | Guard against forged handle passing |
| `FHE.isInitialized(handle)` | Verify handle is non-zero / valid | Read-only check | Defensive programming on storage reads |

**Critical rules**

1. After overwriting an `euintXX` storage slot, the new handle needs fresh `allow*` calls. Old grants do **not** transfer.
2. Transient grants expire at tx end. Using them across external calls in the same tx is fine; persisting is not.
3. Persistent grants cost gas per unique (handle, address) pair. Do not grant in loops.

### 3.6 Decryption Modes (FHEVM)

Three distinct flows exist. Picking the wrong one is a common design error.

| Mode | Who Sees Plaintext | When to Use | Flow |
|---|---|---|---|
| **User decryption** | One specific address (client) | User reads their own private data | Client builds EIP-712 request → Relayer → KMS → client decrypts with throwaway keypair |
| **Public decryption** | Everyone (on-chain) | Final auction winner, tally result | Contract calls `FHE.requestDecryption(handle, callbackSelector)` → Gateway callback returns plaintext |
| **Re-encryption** | Specific third party, never chain | Sharing secret between two users | Client requests ciphertext re-encrypted toward recipient's key |

**Anti-pattern**: never use public decryption for intermediate values. Only decrypt *aggregate* or *final* handles publicly.

### 3.7 Programmable Bootstrapping & CMUX Cost Model

Key mental model for cost estimation:

- Every non-linear operation (`select`, `eq`, `lt`, multiplication beyond a small constant) costs ~1 PBS.
- Linear operations on ciphertexts (addition, subtraction, scalar-mul) are effectively free relative to PBS.
- `FHE.select(cond, a, b)` is a CMUX ≈ 1 PBS per bit.
- Wider types multiply PBS count roughly linearly in bit width, super-linearly for some ops.

When in doubt: **count PBSes, not instructions**.

---

## 4) Build an App From Scratch (Scaffold)

### 4.1 Project Layout (TFHE-rs baseline)

```text
tfhe-app/
├── Cargo.toml
└── src/
    └── main.rs
```

### 4.2 Imports and Configuration

```rust
use tfhe::prelude::*;
use tfhe::{ConfigBuilder, FheUint8, generate_keys, set_server_key};
```

### 4.3 Lifecycle Snippet

```rust
let config = ConfigBuilder::default().build();
let (client_key, server_key) = generate_keys(config);

let a = FheUint8::try_encrypt(27u8, &client_key)?;
let b = FheUint8::try_encrypt(128u8, &client_key)?;

set_server_key(server_key);
let c = &a + &b;

let clear: u8 = c.decrypt(&client_key);
assert_eq!(clear, 27u8.wrapping_add(128u8));
```

### 4.4 FHEVM App Skeleton (High-Level Steps)

1. Initialize Hardhat project from FHEVM template (§2.4).
2. Write contract using `@fhevm/solidity/lib/FHE.sol`.
3. In client app, initialize relayer instance via `createInstance({...SepoliaConfig, network: ...})`.
4. Register encrypted inputs: `createEncryptedInput(...).addXX(...).encrypt()`.
5. Send ciphertext handles + proof to contract.
6. Grant ACL permissions in contract for intended decryption recipients.
7. Perform user decryption via relayer SDK when needed.

Full runnable contract and frontend in [§8.2](#82-full-fhevm-contract-confidentialledger) and [§8.3](#83-full-frontend-relayer-sdk-integration).

---

## 5) Supported Operations by Data Type

### 5.1 TFHE-rs `FheUintN`

**Arithmetic**

- `+`, `-`, `*`, `/`, `%`
- assign forms: `+=`, `-=`, `*=`, `/=`, `%=`
- `div_rem`
- overflow-aware: `overflowing_add`, `overflowing_sub`, `overflowing_mul`, `overflowing_neg`

**Comparison**

- `eq`, `ne`, `lt`, `le`, `gt`, `ge` (return `FheBool`)

**Min/Max**

- `min`, `max`

**Bitwise & Bit-shape**

- `&`, `|`, `^`, `!`
- Shifts: `<<`, `>>` (clear or encrypted shift counts per overload)
- Rotates: `rotate_left`, `rotate_right`
- Helpers: `reverse_bits`, `leading_zeros`, `leading_ones`, `trailing_zeros`, etc.

**Conditional & Casting**

- `FheBool::select(...)`, `if_then_else(...)`, scalar variants
- `cast_from`, `cast_into`

### 5.2 TFHE-rs `FheIntN`

**Arithmetic**

- `+`, `-`, `*`, `/`, `%`, unary negation
- Assign forms, `div_rem`
- Overflow-aware: `overflowing_add`, `overflowing_sub`, `overflowing_mul`, `overflowing_neg`
- Signed helpers: `abs`, `is_even`, `is_odd`

**Comparison**: `eq`, `ne`, `lt`, `le`, `gt`, `ge`

**Bitwise & Shifts**: `&`, `|`, `^`, `!`, `<<`, `>>`, `rotate_left`, `rotate_right`

**Conditional & Casting**: identical patterns to unsigned family.

### 5.3 TFHE-rs `FheBool`

- Logical/bitwise: `&`, `|`, `^`, `!`
- Equality: `eq`, `ne`
- Conditional multiplexing: `if_then_else`, `select`, scalar variants

### 5.4 FHEVM Solidity Encrypted Types

Types: `ebool`, `euint8/16/32/64/128/256`, `eaddress`.

**Arithmetic**: `FHE.add`, `FHE.sub`, `FHE.mul`, `FHE.min`, `FHE.max`, `FHE.neg`, `FHE.div`, `FHE.rem`

**Bitwise**: `FHE.and`, `FHE.or`, `FHE.xor`, `FHE.not`, `FHE.shl`, `FHE.shr`, `FHE.rotl`, `FHE.rotr`

**Comparison**: `FHE.eq`, `FHE.ne`, `FHE.lt`, `FHE.le`, `FHE.gt`, `FHE.ge`

**Conditional**: `FHE.select(cond, a, b)`

**Randomness**:

- `FHE.randEuintX()` — uniform over the full width.
- `FHE.randEuintX(upperBound)` — uniform over `[0, upperBound)`.

### 5.5 Known Operation Limitations

**TFHE-rs**

- Arithmetic is modular (wrap-around) by default.
- Zero behavior:
  - Division by zero returns `modulus - 1`.
  - Remainder by zero returns `lhs` unchanged.
- Comparisons are not Rust operator-overloaded (they would have to return `bool`, not `FheBool`). Use methods: `lt`, `eq`, ...

**FHEVM**

- `FHE.div` and `FHE.rem`: right-hand divisor must be **plaintext** (encrypted divisor unsupported).
- Shift amount is effectively modulo bit width of lhs encrypted type.
- Encrypted integer arithmetic wraps on overflow.
- ACL grants are per-handle; overwriting a storage slot invalidates prior grants on the old handle.

---

## 6) Performance Considerations

### 6.1 Baseline Expectations

- FHE operations are much slower than plaintext equivalents.
- GPU backend is reported up to ~$4.2\times$ faster than CPU on supported workloads.
- Speedups are operation-dependent.

### 6.2 Build-Time Optimization

- Always run release mode: `cargo run --release`.
- Enable LTO (`lto = "fat"`).
- Optionally target native CPU (`RUSTFLAGS="-C target-cpu=native"`) when portability is not required.

### 6.3 Runtime Strategy to Reduce PBS Overhead

1. Pick smallest sufficient bit width (`FheUint8` over `FheUint256` when possible).
2. Prefer ciphertext-scalar variants over ciphertext-ciphertext when semantics allow.
3. Avoid unnecessary `select` chains (CMUX-heavy patterns can be expensive).
4. Fuse arithmetic when available (`div_rem`, fused mul/div helpers).
5. Parallelize independent ops (use `rayon` patterns where appropriate).
6. Reuse server key context; avoid repeated setup churn.

### 6.4 GPU Usage Guidance

Use GPU when:

- You have long-running server-side encrypted compute workloads.
- Workload is arithmetic-heavy and batchable.
- Environment satisfies CUDA/GPU prerequisites.

Do **not** expect GPU gain when workload is dominated by keygen/encrypt/decrypt (those are CPU-side).

### 6.5 Reproducible Benchmark Commands

From the TFHE-rs repo:

```bash
make bench_integer
make bench_integer_gpu
make bench_pbs
make bench_pbs_gpu
make bench_ks_pbs
make bench_ks_pbs_gpu
```

### 6.6 FHEVM Gas Model

FHEVM logic is usually correct before it is affordable. Gas budgeting must happen during design, not after deployment. Numbers below are **indicative ranges as of April 2026** for `euint64`; validate with `hardhat-gas-reporter`.

| Operation | Approximate gas range (`euint64`) | Notes |
|---|---|---|
| `FHE.add` / `FHE.sub` | $35\text{k}{-}70\text{k}$ | Ciphertext-ciphertext path |
| `FHE.mul` | $80\text{k}{-}160\text{k}$ | Among the most expensive arithmetic ops |
| `FHE.lt` / `FHE.gt` / `FHE.le` / `FHE.ge` | $40\text{k}{-}85\text{k}$ | Returns `ebool` |
| `FHE.eq` / `FHE.ne` | $40\text{k}{-}85\text{k}$ | Similar profile to comparisons |
| `FHE.select` | $60\text{k}{-}130\text{k}$ | Expensive in hot paths |
| `FHE.and` / `FHE.or` / `FHE.xor` | $35\text{k}{-}65\text{k}$ | Cheaper than multiply/select |
| `FHE.allow` / `FHE.allowThis` | $20\text{k}{-}45\text{k}$ | Persistent ACL write |
| `FHE.allowTransient` | $5\text{k}{-}10\text{k}$ | Transient, cheaper than persistent |
| `FHE.fromExternal` | $30\text{k}{-}60\text{k}$ per handle | Proof verification dominates |
| User decrypt | N/A on-chain | Off-chain relayer/KMS flow |

**Width scaling (relative to `euint8`)**

| Width | Cost factor |
|---|---|
| `euint8` | $1.0\times$ baseline |
| `euint32` | $\sim 1.2\times{-}1.5\times$ |
| `euint64` | $\sim 1.2\times{-}1.6\times$ |
| `euint128` | $\sim 1.5\times{-}2.2\times$ |
| `euint256` | $\sim 1.8\times{-}2.8\times$ |

**Gas-expensive patterns to avoid**

1. Multiple `FHE.select` chains in a single function.
2. Repeated `FHE.fromExternal` calls for many inputs in one transaction.
3. `FHE.mul` when additive or scalar alternatives suffice.
4. Repeated `FHE.allow` / `FHE.allowThis` on unchanged handles.

**Gas-efficient substitutions**

1. Prefer scalar RHS over ciphertext RHS where supported.
2. Prefer `FHE.add`/`FHE.sub` over `FHE.mul` when model permits.
3. Cache intermediate encrypted results and reuse handles within a function.
4. Reduce width when value bounds allow (`euint64` instead of `euint256`).

**Estimate before deployment**

```typescript
const estimatedGas = await contract.myFunction.estimateGas(arg1, arg2, arg3);
console.log(`Estimated gas: ${estimatedGas.toString()}`);
```

```bash
REPORT_GAS=true npx hardhat test
```

Local hardhat vs Sepolia: opcode-level gas accounting is identical; paid cost differs due to base fee and mempool dynamics. Validate on Sepolia before mainnet.

---

## 7) Common Errors and Exact Fixes

| Symptom / Error | Root Cause | Exact Fix |
|---|---|---|
| `tfhe` fails to compile with Rust version error | Rust too old | `rustup update` and ensure `rustc >= 1.84` |
| Runtime failure when evaluating ciphertext ops | `set_server_key(...)` not called in evaluator process | Generate keys once, then call `set_server_key(server_key)` before encrypted ops |
| Hardhat plugin fails to load / odd Node errors | Node < 20 or odd-numbered Node (21/23) | Install Node LTS 20: `nvm install 20 && nvm use 20` |
| `Error HH1201: Cannot find a value for the configuration variable 'MNEMONIC'` | Missing Hardhat vars | `npx hardhat vars set MNEMONIC` (also `INFURA_API_KEY`, `ETHERSCAN_API_KEY`) |
| FHEVM panic on division/remainder | Encrypted divisor used in `FHE.div` / `FHE.rem` | Keep divisor plaintext, e.g. `FHE.div(encAmount, 10)` |
| `ACLNotAllowed` / `SenderNotAllowed` revert | Caller lacks ACL on handle | Contract must call `FHE.allow(handle, caller)` before read, or caller must use `FHE.allowTransient` on passed handles |
| `HandleDoesNotExist` | Reading uninitialized `euintXX` storage | Guard with `FHE.isInitialized(handle)` or ensure writer path ran |
| "Invalid EIP-712 signature" during user decrypt | Domain/chainId mismatch between client and contract | Re-fetch `createEIP712(...)` from the live relayer instance on the connected chain |
| User decryption fails for large batch | Total decrypted bit-length per request exceeds relayer limit | Split handles across multiple requests; verify exact limit against the SDK version in use |
| Relayer `InputVerification` timeout | Proof verification backend slow / unreachable | Increase `timeout` option in `input.encrypt({ timeout })`; verify relayer health |
| Concrete ML pip install fails on Windows | Native pip unsupported on Windows | Use Docker, or WSL and install outside `/mnt/c` |
| Concrete ML install fails on Linux (libc) | `glibc < 2.28` | Upgrade base distro/container or use Docker image |
| TFHE-rs GPU build fails (`nvcc`, `cmake`, `gcc`, `libclang`) | Missing/mismatched toolchain | Install: CUDA >= 10, gcc >= 8, cmake >= 3.24, libclang >= 9 |
| FHEVM user cannot decrypt own value | ACL not granted after state update | Ensure contract calls `FHE.allow(newHandle, userAddress)` after each write |
| Ciphertext deserialization panic on untrusted input | Used `bincode::deserialize` without limits | Use `safe_deserialize(bytes, MAX_BYTES)` with a sane ceiling |

---

## 8) Complete Working Examples (Runnable)

### 8.1 TFHE-rs Minimal Working Example

Full end-to-end encrypted computation (encrypt → compute → decrypt).

**`Cargo.toml`**

```toml
[package]
name = "tfhe-mwe"
version = "0.1.0"
edition = "2021"

[dependencies]
tfhe = { version = "~1.6.1", features = ["integer"] }

[profile.release]
lto = "fat"
```

**`src/main.rs`**

```rust
use tfhe::prelude::*;
use tfhe::{ConfigBuilder, FheUint8, generate_keys, set_server_key};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1) Configure and generate keys
    let config = ConfigBuilder::default().build();
    let (client_key, server_key) = generate_keys(config);

    // 2) Encrypt client inputs
    let clear_a: u8 = 27;
    let clear_b: u8 = 200;
    let a = FheUint8::try_encrypt(clear_a, &client_key)?;
    let b = FheUint8::try_encrypt(clear_b, &client_key)?;

    // 3) Server-side setup
    set_server_key(server_key);

    // 4) Compute on ciphertexts
    let sum = &a + &b;                    // wrapping arithmetic mod 256
    let is_a_gt_b = a.gt(&b);             // FheBool
    let selected = is_a_gt_b.select(&a, &b); // max(a, b)

    // 5) Decrypt result client-side
    let sum_clear: u8 = sum.decrypt(&client_key);
    let selected_clear: u8 = selected.decrypt(&client_key);

    // 6) Verify against plaintext semantics
    assert_eq!(sum_clear, clear_a.wrapping_add(clear_b));
    assert_eq!(selected_clear, if clear_a > clear_b { clear_a } else { clear_b });

    println!("sum = {}", sum_clear);
    println!("selected = {}", selected_clear);
    Ok(())
}
```

Run:

```bash
cargo run --release
```

### 8.2 Full FHEVM Contract: `ConfidentialLedger`

Drop-in confidential contract pattern with ACL, encrypted state updates, and secure encrypted comparisons.

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {
    FHE,
    ebool,
    euint64,
    externalEbool,
    externalEuint64
} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract ConfidentialLedger is SepoliaConfig {
    euint64 private _balance;
    ebool   private _isFrozen;

    constructor(uint64 initialBalance, bool initialFrozen) {
        _balance  = FHE.asEuint64(initialBalance);
        _isFrozen = FHE.asEbool(initialFrozen);

        FHE.allowThis(_balance);
        FHE.allowThis(_isFrozen);
        FHE.allow(_balance, msg.sender);
        FHE.allow(_isFrozen, msg.sender);
    }

    function applyDelta(
        externalEuint64 amountHandle,
        externalEbool isCreditHandle,
        bytes calldata inputProof
    ) external {
        require(inputProof.length > 0, "inputProof required");

        euint64 amount   = FHE.fromExternal(amountHandle, inputProof);
        ebool   isCredit = FHE.fromExternal(isCreditHandle, inputProof);

        euint64 increased = FHE.add(_balance, amount);
        euint64 decreased = FHE.sub(_balance, amount);
        _balance = FHE.select(isCredit, increased, decreased);

        FHE.allowThis(_balance);
        FHE.allow(_balance, msg.sender);

        _isFrozen = FHE.lt(_balance, FHE.asEuint64(10));
        FHE.allowThis(_isFrozen);
        FHE.allow(_isFrozen, msg.sender);
    }

    function getBalanceHandle() external returns (euint64) {
        FHE.allowThis(_balance);
        FHE.allow(_balance, msg.sender);
        return _balance;
    }

    function isBalanceGreaterThan(
        externalEuint64 rhsHandle,
        bytes calldata inputProof
    ) external returns (ebool) {
        require(inputProof.length > 0, "inputProof required");
        euint64 rhs = FHE.fromExternal(rhsHandle, inputProof);
        ebool result = FHE.gt(_balance, rhs);
        FHE.allowThis(result);
        FHE.allow(result, msg.sender);
        return result;
    }
}
```

**Deploy script (`scripts/deploy.ts`)**

```typescript
import { ethers } from "hardhat";

async function main(): Promise<void> {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const ConfidentialLedger = await ethers.getContractFactory("ConfidentialLedger");
    const ledger = await ConfidentialLedger.deploy(1_000n, false);
    await ledger.waitForDeployment();

    console.log("ConfidentialLedger deployed at:", await ledger.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
```

### 8.3 Full Frontend Relayer SDK Integration

Browser path from wallet connection to encrypted transaction submission and user decryption.

```bash
npm install @zama-fhe/relayer-sdk@^0.4.1 ethers@^6.16.0
```

```typescript
import { BrowserProvider, Contract, ethers } from "ethers";
import {
    createInstance,
    initSDK,
    SepoliaConfig,
} from "@zama-fhe/relayer-sdk/bundle";

declare global {
    interface Window { ethereum?: unknown; }
}

const SEPOLIA_CHAIN_ID = 11155111n;

const ledgerAbi = [
    "function applyDelta(bytes32 amountHandle, bytes32 isCreditHandle, bytes inputProof) external",
    "function getBalanceHandle() external returns (bytes32)",
] as const;

function toHex(value: unknown): `0x${string}` {
    if (typeof value === "string" && value.startsWith("0x")) return value as `0x${string}`;
    if (value instanceof Uint8Array) return ethers.hexlify(value) as `0x${string}`;
    throw new Error("Unsupported bytes format");
}

async function connectWallet() {
    if (!window.ethereum) throw new Error("wallet not connected");

    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);

    const network = await provider.getNetwork();
    if (network.chainId !== SEPOLIA_CHAIN_ID) throw new Error("wrong network");

    const signer = await provider.getSigner();
    return { provider, signer, account: await signer.getAddress() };
}

async function getRelayerInstance() {
    if (!window.ethereum) throw new Error("wallet not connected");
    await initSDK();
    return createInstance({ ...SepoliaConfig, network: window.ethereum });
}

export async function submitEncryptedDelta(
    contractAddress: string,
    amount: bigint,
    isCredit: boolean,
): Promise<string> {
    try {
        const { signer, account } = await connectWallet();
        const relayer = await getRelayerInstance();
        const contract = new Contract(contractAddress, ledgerAbi, signer);

        const input = relayer.createEncryptedInput(contractAddress, account);
        input.addUint64(amount);
        input.addBool(isCredit);

        const encrypted = await input.encrypt({ timeout: 60_000 });
        const amountHandle   = toHex(encrypted.handles[0]);
        const isCreditHandle = toHex(encrypted.handles[1]);
        const inputProof     = toHex(encrypted.inputProof);

        const tx = await contract.applyDelta(amountHandle, isCreditHandle, inputProof);
        await tx.wait();
        return tx.hash as string;
    } catch (error) {
        throw classifyFrontendError(error);
    }
}

export async function decryptBalance(contractAddress: string): Promise<bigint> {
    try {
        const { signer, account } = await connectWallet();
        const relayer = await getRelayerInstance();
        const contract = new Contract(contractAddress, ledgerAbi, signer);

        const handle = (await contract.getBalanceHandle.staticCall()) as string;

        const keypair = relayer.generateKeypair();
        const startTimestamp = Math.floor(Date.now() / 1000);
        const durationDays = 1;
        const extraData = await relayer.getExtraData();

        const eip712 = relayer.createEIP712(
            keypair.publicKey,
            [contractAddress],
            startTimestamp,
            durationDays,
            extraData,
        );

        const signature = await signer.signTypedData(
            eip712.domain,
            { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
            eip712.message,
        );

        const result = await relayer.userDecrypt(
            [{ handle, contractAddress }],
            keypair.privateKey,
            keypair.publicKey,
            signature,
            [contractAddress],
            account,
            startTimestamp,
            durationDays,
            extraData,
            { timeout: 60_000 },
        );

        const clear = result[handle as keyof typeof result];
        if (typeof clear === "bigint") return clear;
        if (typeof clear === "number") return BigInt(clear);
        if (typeof clear === "string") return BigInt(clear);
        throw new Error("decryption unauthorized");
    } catch (error) {
        throw classifyFrontendError(error);
    }
}

function classifyFrontendError(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    if (lower.includes("wallet not connected"))         return new Error("wallet not connected");
    if (lower.includes("wrong network") || lower.includes("chain")) return new Error("wrong network");
    if (lower.includes("not allowed") || lower.includes("unauthorized") || lower.includes("acl"))
        return new Error("decryption unauthorized");
    if (lower.includes("timeout") || lower.includes("timed out")) return new Error("relayer timeout");
    return new Error(`unexpected error: ${message}`);
}
```

**Do not in production**

- Do not log plaintext decrypted values to the console or remote logs.
- Do not persist ciphertext handles or proofs in `localStorage` without strict lifecycle controls.

### 8.4 Concrete ML Encrypted Inference Workflow

Full train → compile → keygen → encrypt → run → decrypt loop.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install "concrete-ml>=1.9,<2.0" scikit-learn numpy
```

```python
import numpy as np
from sklearn.datasets import make_classification
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from concrete.ml.sklearn import LogisticRegression


def choose_n_bits() -> int:
    # n_bits controls quantization precision:
    # higher n_bits -> usually better accuracy, slower/heavier FHE.
    return 8


def server_run_encrypted(model, encrypted_q_input):
    return model.fhe_circuit.run(encrypted_q_input)


def client_decrypt_output(model, encrypted_q_output):
    q_output = model.fhe_circuit.decrypt(encrypted_q_output)
    return model.post_processing(model.dequantize_output(q_output))


def main() -> None:
    np.random.seed(7)
    n_bits = choose_n_bits()

    X, y = make_classification(
        n_samples=800, n_features=20, n_informative=12,
        n_redundant=4, class_sep=1.5, random_state=7,
    )
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42,
    )

    # 1) Train sklearn-compatible Concrete ML model in the clear.
    model = LogisticRegression(n_bits=n_bits)
    model.fit(X_train, y_train)

    # 2) Compile to FHE using representative data.
    model.compile(X_train)

    # 3) Generate FHE keys for the compiled circuit.
    model.fhe_circuit.keygen(force=False)

    # 4) Fast iteration: FHE simulation (no real encryption overhead).
    y_sim = model.predict(X_test[:80], fhe="simulate")
    acc_sim = accuracy_score(y_test[:80], y_sim)

    # 5) Real encrypted inference (convenience path).
    y_fhe = model.predict(X_test[:20], fhe="execute")
    acc_fhe = accuracy_score(y_test[:20], y_fhe)

    # 6) Manual client/server flow: quantize -> encrypt -> server run -> decrypt.
    x_client = X_test[[0]]
    q_input = model.quantize_input(x_client)
    encrypted_q_input = model.fhe_circuit.encrypt(q_input)
    encrypted_q_output = server_run_encrypted(model, encrypted_q_input)
    y_manual = client_decrypt_output(model, encrypted_q_output)

    # Clear baseline for regression checks.
    y_clear = model.predict(X_test[:80], fhe="disable")
    acc_clear = accuracy_score(y_test[:80], y_clear)

    print(f"n_bits={n_bits}")
    print(f"Accuracy clear(80):    {acc_clear:.4f}")
    print(f"Accuracy simulate(80): {acc_sim:.4f}")
    print(f"Accuracy execute(20):  {acc_fhe:.4f}")
    print(f"Manual single-sample decrypted prediction: {y_manual}")

    if acc_sim + 0.05 < acc_clear:
        print(
            "Accuracy drop detected after FHE compilation. "
            "Try increasing n_bits (e.g. 8 -> 10) or simplifying the model."
        )


if __name__ == "__main__":
    main()
```

---

## 9) Agent Execution Checklist (Use This Before Coding)

1. Choose stack (`tfhe-rs`, `Concrete ML`, or `FHEVM`) based on app class.
2. Verify toolchain versions and hardware prerequisites first (see [§0](#0-versioning--compatibility-matrix)).
3. Pin dependency versions (start from `tfhe ~1.6.1` unless project mandates otherwise).
4. Implement minimal encrypt → compute → decrypt smoke test.
5. Add operation-specific tests for overflow, division-by-zero behavior, and comparisons.
6. Measure latency in release mode before any optimization claims.
7. For FHEVM, validate ACL/decryption flows early (most integration bugs are there).

---

## 10) AI Agent Workflow Protocol

### 10.1 App Type Classification (Deterministic)

1. If requirements include on-chain state, wallet signatures, EVM composability, or smart-contract-enforced confidentiality → **FHEVM** (Solidity + `@fhevm/hardhat-plugin` + `@zama-fhe/relayer-sdk`).
2. Else if requirements are server-side confidential business logic, private API computation, or encrypted off-chain analytics → **`tfhe-rs`** (Rust + `tfhe` crate).
3. Else if primary workload is model inference/training on private data → **Concrete ML** (Python + `concrete-ml`, with `Concrete` for low-level tuning).
4. If mixed requirements → **hybrid**: keep only trust-minimized logic on-chain; move heavy encrypted compute off-chain.

### 10.2 Required Build Sequence

Always execute these phases in order:

1. Implement plaintext reference logic.
2. Identify sensitive/private state and public state.
3. Map sensitive state to encrypted types with fixed bit-width choices.
4. Replace plaintext operations with encrypted equivalents.
5. Add parity tests against plaintext reference.
6. Add ACL/permission tests and failure tests.
7. Benchmark representative workload.
8. Deploy to local, then testnet, then production.

### 10.3 Pre-Coding Assumptions Contract

Do not start coding until the template below is fully filled. This is the machine-parseable version of the §16.1 freeze.

```yaml
assumptions_contract:
  stack: <tfhe-rs|concrete-ml|fhevm|hybrid>
  rationale: <one sentence>

  inputs:
    encrypted: []        # [{ name, type, bit_width }]
    public: []           # [{ name, type }]

  outputs:
    - name: <var>
      type: <ebool|euintN|FheUintN|...>
      decryptors: []     # [<address|role>]
      mode: <user|public|re-encrypt|never>

  acl:
    grants: []           # [{ handle, addr, persistence: <persistent|transient> }]
    revokes: []
    deny_by_default: true

  types:
    widths: {}           # { var: euint32 | FheUint16 | ... }
    overflow_policy: <wrap|guarded|reject>

  performance:
    latency_p95_ms: <int>
    throughput_target_ops_per_sec: <int>
    gpu_required: <true|false>

  threat_model:
    metadata_leakage_reviewed: <true|false>
    public_state_correlation_reviewed: <true|false>
```

### 10.4 Failure Stop Conditions

Pause implementation and fix design first if any of these are true:

1. Decryption recipients are not explicitly defined per data item.
2. Ciphertext widths are undecided.
3. Permission model is not testable.
4. Latency budget is unknown.
5. Public metadata may reveal sensitive conditions.

---

## 11) Architecture Blueprints / Reusable Templates

### 11.1 Confidential Messaging dApp (FHEVM)

**Components**: `MessageInbox` contract; Relayer SDK client; frontend; optional indexer (no plaintext).

**Data Flow**

1. Sender wallet signs session.
2. Frontend encrypts message payload via relayer SDK.
3. Frontend submits ciphertext handle + proof to contract.
4. Contract stores handle; emits only non-sensitive metadata.
5. Recipient queries message handles.
6. Recipient decrypts authorized handles via relayer flow.

**ACL**: grant recipient + contract; optional self-grant for sender; deny-by-default for all others.

### 11.2 Encrypted Voting System (FHEVM)

**Components**: `Election` contract; voter registry; ballot client; tally workflow.

**Data Flow**

1. Admin starts election with window + candidate config.
2. Voter encrypts ballot and submits encrypted vote.
3. Contract enforces one vote per voter.
4. Tally phase computes encrypted totals.
5. **Public decryption** is requested **only** on the final aggregate handle — never on per-ballot handles.

**ACL**

- Per-ballot decryption: none.
- Final tally decryption: request public decryption via Gateway; alternatively, grant threshold group only.
- Optional voter receipt decryption: voter only.

### 11.3 Private Balances / Payment Ledger

**Components**: encrypted balances (`euint64`/`FheUint64`); transfer engine; per-account ACL; wallet dashboard.

**Data Flow**

1. User encrypts amount or reads encrypted balance handle.
2. Transfer operation updates encrypted balances.
3. Sender/recipient fetch updated encrypted handles.
4. Users decrypt own balances client-side.

**ACL**: owner decrypts own balance; optional auditor decrypts aggregate metrics only; no cross-user grants.

### 11.4 Sealed-Bid Auction

**Components**: auction contract with phases (create/bid/close/settle); encrypted bid storage; winner computation (`max`/`select`); bid client.

**Data Flow**

1. Seller creates auction window.
2. Bidders encrypt bids and submit ciphertext handles.
3. After close, system computes encrypted winning bid.
4. Authorized parties decrypt settlement output only.

**ACL**: decrypt winner identity/price only for settlement roles. Do **not** grant decryption on the full bid set.

---

## 12) Security Anti-Patterns and Privacy Pitfalls

### 12.1 Common Pitfalls and Mitigations

| Pitfall | How Privacy Breaks | Mitigation |
|---|---|---|
| Emitting decrypted values in events/logs | Public chain/log stream reveals secret | Emit only opaque ids/status codes; never emit plaintext secrets |
| Public metadata leaks sensitive logic | Timing/size/frequency reveals user state | Normalize metadata granularity; batch updates; avoid value-correlated metadata |
| State-transition leakage | Branches visibly differ for secret conditions | Use constant-shape transitions; avoid condition-dependent public side effects |
| Improper ACL grants | Unauthorized party gains decryption ability | Least privilege; grant per-handle; explicit revoke paths |
| Broad decryption permissions | Single compromise exposes many records | Scope ACL to user+record; avoid wildcard/role-wide decrypt rights |
| Ciphertext/public-state correlation | Public counters map to private values statistically | De-correlate IDs; randomize batching; avoid 1:1 public mirrors |
| Frontend plaintext exposure | Browser logs/storage/extensions leak secrets | Disable debug logs in prod; no `localStorage` for plaintext; clear transient state |
| Insecure key handling | Team assumes relayer/backend can hold user secrets | Keep client keys user-side; treat backend as untrusted for plaintext |
| Public-decrypting intermediate values | Reveals partial computation state | Only public-decrypt final aggregates |
| Reusing old handle after state overwrite | `HandleDoesNotExist` or stale grants | Re-`allow*` new handle after every write |

### 12.2 Security Best Practices

1. Apply data classification at design time: secret vs public vs derivable.
2. Enforce deny-by-default ACL policy.
3. Add permission regression tests for every release.
4. Avoid decrypt-in-contract patterns unless explicitly required and audited.
5. Remove debug instrumentation before production deployment.
6. Threat-model metadata leakage, not only ciphertext confidentiality.

---

## 13) Layered Testing Methodology

### 13.1 Test Layers

1. **Unit parity**: encrypted arithmetic/logic equals plaintext reference for representative vectors.
2. **Integration pipeline**: frontend encryption → contract/backend compute → client decryption.
3. **Permission**: authorized decrypt succeeds; unauthorized decrypt fails.
4. **Adversarial**: malformed ciphertext rejected; invalid proof rejected; replay rejected; revoked permission blocks access.
5. **Performance**: p50/p95 latency, throughput, resource usage.

### 13.2 Recommended Test Order

1. Plaintext reference tests.
2. Encrypted unit parity tests.
3. ACL/permission tests.
4. End-to-end integration tests.
5. Adversarial tests.
6. Performance benchmarks.
7. Deployment smoke test on target network.

### 13.3 Minimal Adversarial Matrix

| Scenario | Expected Result |
|---|---|
| Replay same encrypted payload with same nonce | Rejected |
| Submit tampered handle/proof | Rejected |
| Decrypt after ACL revoke | Rejected |
| Decrypt by non-recipient wallet | Rejected |
| Forge handle address and pass to function expecting owned handle | Rejected (`FHE.isSenderAllowed`) |

---

## 14) Deployment Recipes

### 14.1 Local Development Deployment (FHEVM)

```bash
npm ci
npx hardhat compile
npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts --network localhost
```

Configure frontend with local contract addresses, chain id `31337`, and local relayer endpoint.

### 14.2 Testnet Deployment (Sepolia FHEVM)

**Required runtime config**

- `MNEMONIC`
- `INFURA_API_KEY` (or equivalent RPC provider key)
- `ETHERSCAN_API_KEY` (for contract verification)
- Frontend vars:
  - `NEXT_PUBLIC_CHAIN_ID` = `11155111`
  - `NEXT_PUBLIC_RPC_URL`
  - `NEXT_PUBLIC_RELAYER_NETWORK`
  - `NEXT_PUBLIC_CONTRACT_ADDRESS`

```bash
npx hardhat vars set MNEMONIC
npx hardhat vars set INFURA_API_KEY
npx hardhat vars set ETHERSCAN_API_KEY

npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat verify --network sepolia <DEPLOYED_ADDRESS> <CTOR_ARGS_IF_ANY>
```

### 14.3 Relayer Configuration Recipe (Client)

```typescript
import { createInstance, initSDK, SepoliaConfig } from "@zama-fhe/relayer-sdk/bundle";

await initSDK();
const relayer = await createInstance({
    ...SepoliaConfig,
    network: window.ethereum,
});
```

**Execution checks**

1. Wallet connected to expected chain id.
2. Relayer instance initialized successfully.
3. Encrypted input registration succeeds.
4. User decrypt flow succeeds for authorized handles.

### 14.4 Frontend Production Connection Steps

1. Pin exact deployed contract addresses.
2. Pin chain id and RPC provider.
3. Pin relayer network configuration.
4. Disable development logging.
5. Validate encryption/decryption with a production build.

### 14.5 Post-Deployment Validation Checklist

1. Contract bytecode verified (if explorer supports it).
2. ACL grants/revocations work as expected.
3. Unauthorized decrypt attempts fail.
4. Replay protection works.
5. No sensitive plaintext in logs, events, analytics, or crash reports.
6. p95 latency within target budget.

### 14.6 CI/CD Recipe (GitHub Actions)

`.github/workflows/fhevm.yml`:

```yaml
name: fhevm-ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Enforce engine versions
        run: npx -y check-node-version --node ">=20" --npm ">=7.0.0"

      - name: Install
        run: npm ci

      - name: Compile
        run: npm run compile

      - name: Unit + integration tests
        run: npx hardhat test

      - name: Gas report
        env:
          REPORT_GAS: "true"
        run: npx hardhat test

  tfhe-rs:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          toolchain: "1.84"
      - name: Build release
        working-directory: ./rust
        run: cargo build --release
      - name: Test
        working-directory: ./rust
        run: cargo test --release
```

---

## 15) Decision Trees / Operational Heuristics

### 15.1 Stack Selection Tree

```text
Need on-chain confidential state?
├── Yes → FHEVM
│         └── Also heavy off-chain compute?
│               ├── Yes → Hybrid (FHEVM + tfhe-rs worker)
│               └── No  → Pure FHEVM
└── No  → Encrypted ML inference/training?
          ├── Yes → Concrete ML
          │          └── Need compiler-level tuning?
          │                └── Yes → Add Concrete (low-level)
          └── No  → tfhe-rs
```

### 15.2 Encrypted Division Heuristic

```text
Using FHEVM Solidity?
├── Yes → rhs MUST be plaintext for FHE.div / FHE.rem
└── No  → tfhe-rs supports ciphertext division and div_rem paths
```

### 15.3 GPU Worth-It Heuristic

Use GPU when **all** are true:

1. Workload is server-side encrypted compute heavy.
2. Large batch or sustained throughput target.
3. CUDA toolchain + compatible GPU available.

Stay CPU when workload is mostly keygen/encrypt/decrypt or low-volume latency-insensitive jobs.

### 15.4 Ciphertext Width Heuristic

1. Determine max legal value range.
2. Pick smallest width that safely contains range.
3. If overflow is unacceptable, add explicit guards/tests.
4. Upgrade width only when failing range tests, not preemptively.

### 15.5 Hybrid Architecture Heuristic

Use encrypted/public hybrid design when:

- Confidential core state needs privacy.
- Non-sensitive metadata can remain public for UX/indexing.
- Full FHE on every field would exceed latency/cost budgets.

### 15.6 Decryption Mode Heuristic

```text
Does exactly one address need the plaintext?
├── Yes → User decryption (EIP-712 + Relayer + KMS)
└── No  → Should everyone see it on-chain?
          ├── Yes → Public decryption (Gateway callback)
          └── No  → Re-encryption toward a different key
```

---

## 16) Machine-Executable Orientation

### 16.1 Explicit Assumptions Contract

Before execution, the agent must declare and freeze the YAML in [§10.3](#103-pre-coding-assumptions-contract). That file is the contract.

### 16.2 Deterministic Build Runbook

Fixed state machine for every task:

1. `design` — plaintext model + type map + ACL map.
2. `build` — implement encrypted logic.
3. `verify` — parity + permissions + adversarial tests.
4. `benchmark` — latency/throughput checks.
5. `deploy` — local → testnet → production.
6. `validate` — post-deploy checklist.

No skipping states.

### 16.3 Failure Recovery Paths

1. **Build/tooling failure** — verify versions ([§0](#0-versioning--compatibility-matrix)); re-run the minimal sample from [§8.1](#81-tfhe-rs-minimal-working-example).
2. **Functional mismatch vs plaintext** — reduce to smallest failing operation; check width/overflow assumptions.
3. **Permission failure** — inspect ACL grant path; re-run authorized/unauthorized tests.
4. **Performance failure** — profile hottest encrypted ops; downsize widths or move to hybrid/GPU path.
5. **Deployment failure** — validate network config, signer, contract addresses; re-run post-deploy checklist.

### 16.4 Done Criteria for Autonomous Agent

Task is complete only when **all** are true:

1. Plaintext parity tests pass.
2. ACL tests pass including unauthorized failure cases.
3. Adversarial tests pass.
4. Latency benchmark meets budget (or documented exception approved).
5. Deployment and post-deployment checklist fully pass.

---

## 17) Glossary

| Term | Definition |
|---|---|
| **ACL** | Access Control List. Per-(handle, address) decryption permission in FHEVM. |
| **Bootstrapping (PBS)** | Programmable Bootstrapping. Refreshes ciphertext noise and optionally applies a lookup table. |
| **Ciphertext** | Encrypted value; opaque to anyone without the corresponding key. |
| **CMUX** | Ciphertext MUX — an encrypted conditional select (`cond ? a : b`). Costs ~1 PBS. |
| **Compact Public Key** | Small public key used by clients to encrypt inputs toward a server holding the matching server key. |
| **Coprocessor** | Off-chain FHEVM executor that runs encrypted ops and posts results. |
| **Gateway** | Protocol component mediating decryption requests between contracts, KMS, and relayer. |
| **Handle** | On-chain reference to a ciphertext (typically `bytes32`). The ciphertext itself lives off-chain. |
| **KMS** | Key Management Service. Threshold-holds the FHE decryption key. |
| **Noise budget** | Remaining "headroom" before a ciphertext becomes undecryptable; consumed by ops, refreshed by PBS. |
| **PBS** | Programmable Bootstrapping; see *Bootstrapping*. |
| **Public decryption** | Decryption mode where plaintext is revealed on-chain via Gateway callback. |
| **Relayer** | Service that accepts encrypted inputs + proofs from clients and forwards to the coprocessor. |
| **Re-encryption** | Converting a ciphertext from one key to another without revealing plaintext. |
| **Server key** | Public-ish evaluation key used to compute on ciphertexts. |
| **Transient ACL** | `FHE.allowTransient` — grant valid only for the current transaction. |
| **Trivial encryption** | Encrypting a public value without randomness; useful for constants, insecure for secrets. |
| **User decryption** | Decryption mode where a specific address decrypts via EIP-712 + Relayer + KMS. |

---

## 18) References

All URLs are the **authoritative** sources consulted for this skill. When facts drift, these pages win.

- **TFHE-rs docs**: https://docs.zama.ai/tfhe-rs
- **TFHE-rs repository**: https://github.com/zama-ai/tfhe-rs
- **Concrete docs**: https://docs.zama.ai/concrete
- **Concrete ML docs**: https://docs.zama.ai/concrete-ml
- **Zama Protocol (FHEVM) docs**: https://docs.zama.ai/protocol
- **FHEVM Solidity library**: https://github.com/zama-ai/fhevm-solidity
- **FHEVM Hardhat template**: https://github.com/zama-ai/fhevm-hardhat-template
- **Relayer SDK**: https://github.com/zama-ai/relayer-sdk
- **Zama Bounty Program / developer resources**: https://www.zama.ai/

---

When uncertain, prefer official operation pages and API docs over assumptions. In this ecosystem, small type/parameter mismatches can cause large correctness or performance regressions.