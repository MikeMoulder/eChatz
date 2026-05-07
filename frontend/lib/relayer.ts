/**
 * Zama relayer-sdk integration for eChatz frontend.
 *
 * Based on skill.md §8.3 — exact relayer-sdk usage pattern.
 * Uses @zama-fhe/relayer-sdk ^0.4.1 (NOT the legacy fhevmjs).
 *
 * SECURITY: Never log plaintext decrypted values to console or remote logs.
 *           Do not persist ciphertext handles in localStorage.
 */

import {
  initSDK,
  createInstance,
  SepoliaConfig,
  type FhevmInstance,
} from "@zama-fhe/relayer-sdk/web";
import { BrowserProvider, Contract } from "ethers";

/** Convert a Uint8Array from the relayer SDK to a 0x-prefixed hex string. */
function u8ToHex(bytes: Uint8Array): `0x${string}` {
  return ("0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}

function userDecryptTypes(eip712: ReturnType<FhevmInstance["createEIP712"]>) {
  return {
    UserDecryptRequestVerification: [
      ...eip712.types.UserDecryptRequestVerification,
    ],
  };
}

function userDecryptResultValue(result: unknown, handle: string): unknown {
  return (result as Record<string, unknown>)[handle];
}

let _instance: FhevmInstance | null = null;
let _sdkReady = false;
// Single in-flight init promise prevents concurrent createInstance() calls
// (which each hit /v2/keyurl and cause 429 rate-limit errors).
let _initPromise: Promise<FhevmInstance> | null = null;

// ──────────────────────────────────────────────────────────────────
//  Singleton relayer instance
// ──────────────────────────────────────────────────────────────────

export async function getRelayerInstance(): Promise<FhevmInstance> {
  if (_instance) return _instance;
  if (_initPromise) return _initPromise;

  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("wallet not connected");
  }

  _initPromise = (async () => {
    if (!_sdkReady) {
      await initSDK();
      _sdkReady = true;
    }

    _instance = await createInstance({
      ...SepoliaConfig,
      // Route relayer requests through Next.js server proxy to avoid browser CORS.
      // /api/relayer/:path* is rewritten to https://relayer.testnet.zama.org/:path*
      relayerUrl: window.location.origin + "/api/relayer",
      network: window.ethereum,
    });

    return _instance;
  })().finally(() => {
    _initPromise = null;
  });

  return _initPromise;
}

// ──────────────────────────────────────────────────────────────────
//  Wallet helpers
// ──────────────────────────────────────────────────────────────────

export async function connectWallet() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("wallet not connected");
  }
  const provider = new BrowserProvider(window.ethereum);
  const signer   = await provider.getSigner();
  const account  = await signer.getAddress();
  return { provider, signer, account };
}

// ──────────────────────────────────────────────────────────────────
//  Encrypt a text message payload
// ──────────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string (max 32 bytes) as euint256 for sendMessage().
 * Returns { handle, inputProof } ready to pass to the contract.
 *
 * euint256 / bytes32 = 32 bytes max. For longer payloads upload to IPFS
 * and use encryptIpfsCid() instead.
 */
export async function encryptMessageContent(
  contractAddress: string,
  plaintext: string,
  /** Override the account used in createEncryptedInput (e.g. session key address). */
  callerAddress?: string,
): Promise<{ handle: string; inputProof: string }> {
  const { account } = await connectWallet();
  const effectiveAccount = callerAddress ?? account;
  const relayer = await getRelayerInstance();

  const encoder = new TextEncoder();
  const bytes   = encoder.encode(plaintext);

  if (bytes.length > 32) {
    throw new Error("message too large - upload to IPFS first (max 32 bytes inline)");
  }

  // Pad to 32 bytes (big-endian) and convert to bigint for add256 (euint256)
  const padded = new Uint8Array(32);
  padded.set(bytes);
  const paddedBigInt = BigInt("0x" + Array.from(padded).map(b => b.toString(16).padStart(2, "0")).join(""));

  const input   = relayer.createEncryptedInput(contractAddress, effectiveAccount);
  input.add256(paddedBigInt);

  const encrypted = await input.encrypt({ timeout: 120_000 }).catch((err) => {
    throw withRelayerContext(err);
  });

  const handle    = u8ToHex(encrypted.handles[0]);
  const inputProof = u8ToHex(encrypted.inputProof);

  return { handle, inputProof };
}

/**
 * Encrypt an IPFS CID (bytes32 hash) as euint256 for IPFS-routed messages.
 */
export async function encryptIpfsCid(
  contractAddress: string,
  cidBytes32: Uint8Array,
  /** Override the account used in createEncryptedInput (e.g. session key address). */
  callerAddress?: string,
): Promise<{ handle: string; inputProof: string }> {
  const { account } = await connectWallet();
  const effectiveAccount = callerAddress ?? account;
  const relayer = await getRelayerInstance();

  // CID is 32 bytes — convert directly to bigint for add256 (euint256)
  const bytes32 = cidBytes32.slice(0, 32);
  const paddedBigInt = BigInt("0x" + Array.from(bytes32).map(b => b.toString(16).padStart(2, "0")).join(""));

  const input = relayer.createEncryptedInput(contractAddress, effectiveAccount);
  input.add256(paddedBigInt);

  const encrypted  = await input.encrypt({ timeout: 120_000 }).catch((err) => {
    throw withRelayerContext(err);
  });
  const handle     = u8ToHex(encrypted.handles[0]);
  const inputProof = u8ToHex(encrypted.inputProof);

  return { handle, inputProof };
}

/**
 * Encrypt a uint64 amount (for PaymentRouter createRequest).
 */
export async function encryptUint64(
  contractAddress: string,
  amount: bigint,
  callerAddress?: string,
): Promise<{ handle: string; inputProof: string }> {
  const { account } = await connectWallet();
  const effectiveAccount = callerAddress ?? account;
  const relayer = await getRelayerInstance();

  const input = relayer.createEncryptedInput(contractAddress, effectiveAccount);
  input.add64(amount);

  const encrypted  = await input.encrypt({ timeout: 120_000 }).catch((err) => {
    throw withRelayerContext(err);
  });
  const handle     = u8ToHex(encrypted.handles[0]);
  const inputProof = u8ToHex(encrypted.inputProof);

  return { handle, inputProof };
}

/**
 * Encrypt a uint32 vote choice index (for VotingModule castVote).
 */
export async function encryptUint32(
  contractAddress: string,
  choice: number,
  callerAddress?: string,
): Promise<{ handle: string; inputProof: string }> {
  const { account } = await connectWallet();
  const effectiveAccount = callerAddress ?? account;
  const relayer = await getRelayerInstance();

  const input = relayer.createEncryptedInput(contractAddress, effectiveAccount);
  input.add32(choice);

  const encrypted  = await input.encrypt({ timeout: 120_000 }).catch((err) => {
    throw withRelayerContext(err);
  });
  const handle     = u8ToHex(encrypted.handles[0]);
  const inputProof = u8ToHex(encrypted.inputProof);

  return { handle, inputProof };
}

/**
 * Batch-encrypt a payment request's amount (euint64) + note (euint256) in a single
 * createEncryptedInput call, producing one shared inputProof for both handles.
 *
 * Required by PaymentRouter.createRequest() which takes both handles + one proof.
 */
export async function encryptPaymentRequest(
  contractAddress: string,
  amountWei: bigint,
  note: string,
  callerAddress?: string,
): Promise<{ amountHandle: string; noteHandle: string; inputProof: string }> {
  const { account } = await connectWallet();
  const effectiveAccount = callerAddress ?? account;
  const relayer = await getRelayerInstance();

  const encoder = new TextEncoder();
  const noteBytes = encoder.encode(note.slice(0, 32)); // clamp to 32 bytes
  const notePadded = new Uint8Array(32);
  notePadded.set(noteBytes);
  const noteBigInt = BigInt(
    "0x" + Array.from(notePadded).map(b => b.toString(16).padStart(2, "0")).join(""),
  );

  const input = relayer.createEncryptedInput(contractAddress, effectiveAccount);
  input.add64(amountWei);   // handles[0] = encAmountHandle (euint64)
  input.add256(noteBigInt); // handles[1] = noteHandle (euint256)

  const encrypted = await input.encrypt({ timeout: 120_000 }).catch((err) => {
    throw withRelayerContext(err);
  });

  return {
    amountHandle: u8ToHex(encrypted.handles[0]),
    noteHandle:   u8ToHex(encrypted.handles[1]),
    inputProof:   u8ToHex(encrypted.inputProof),
  };
}

// ──────────────────────────────────────────────────────────────────
//  Decrypt a message content handle
// ──────────────────────────────────────────────────────────────────

/**
 * Decrypt an euint256 message content handle using the relayer userDecrypt flow.
 * Returns the decrypted Uint8Array (caller strips trailing zeros to get the original string).
 *
 * Based on skill.md §8.3 decryptBalance pattern adapted for euint256.
 *
 * SECURITY: Do NOT log the result. Clear it from memory after use.
 */
export async function decryptMessageContent(
  handle: string,
  contractAddress: string,
): Promise<Uint8Array> {
  const decrypted = await decryptMessageBatch([{ handle, contractAddress }]);
  const raw = decrypted.get(handle);
  if (raw) return raw;
  throw new Error("decryption unauthorized");
}

// ──────────────────────────────────────────────────────────────────
//  Session-scoped decrypt credential cache
//
//  The EIP712 signature grants a decrypt window (durationDays).
//  We sign ONCE per contract set per session and reuse the credential
//  for all subsequent userDecrypt calls — no re-prompting the wallet.
// ──────────────────────────────────────────────────────────────────

interface DecryptCredential {
  keypair: { privateKey: string; publicKey: string };
  signature: string;
  account: string;
  contractAddresses: string[];
  startTimestamp: number;
  durationDays: number;
  expiresAt: number; // unix seconds
}

// Keyed by sorted+joined contract addresses
const _credCache = new Map<string, DecryptCredential>();
// Keyed by handle — plaintext bytes from a previous decrypt
const _decryptCache = new Map<string, Uint8Array>();

function withRelayerContext(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("failed to fetch") &&
    (lower.includes("input-proof") || lower.includes("relayer"))
  ) {
    return new Error(
      "Zama relayer input proof request failed from this browser. Check VPN/ad blocker/corporate firewall, then retry. Endpoint: https://relayer.testnet.zama.org/v2/input-proof.",
    );
  }

  return error instanceof Error ? error : new Error(message);
}

export function clearDecryptCache(): void {
  _credCache.clear();
  _decryptCache.clear();
}

function credentialCovers(
  cred: DecryptCredential,
  account: string,
  contractAddresses: string[],
  now: number,
): boolean {
  if (cred.account.toLowerCase() !== account.toLowerCase() || now >= cred.expiresAt - 60) {
    return false;
  }
  return contractAddresses.every((addr) =>
    cred.contractAddresses.some((cached) => cached.toLowerCase() === addr.toLowerCase()),
  );
}

export function hasDecryptSession(contractAddresses: string[]): boolean {
  if (_credCache.size === 0) return false;
  const now = Math.floor(Date.now() / 1000);
  const sorted = [...contractAddresses].sort();
  for (const cred of _credCache.values()) {
    if (credentialCovers(cred, cred.account, sorted, now)) return true;
  }
  return false;
}

export async function authorizeDecryptSession(contractAddresses: string[]): Promise<void> {
  const relayer = await getRelayerInstance();
  await _getCredential(relayer, contractAddresses);
}

async function _getCredential(
  relayer: FhevmInstance,
  contractAddresses: string[],
): Promise<DecryptCredential> {
  const sorted  = [...contractAddresses].sort();
  const credKey = sorted.join(",");
  const now     = Math.floor(Date.now() / 1000);
  const { account } = await connectWallet();

  for (const cred of _credCache.values()) {
    if (credentialCovers(cred, account, sorted, now)) return cred;
  }

  const cached = _credCache.get(credKey);
  // Reuse if still valid with >60 s margin
  if (cached && credentialCovers(cached, account, sorted, now)) {
    return cached;
  }

  const { signer } = await connectWallet();
  const keypair        = relayer.generateKeypair();
  const startTimestamp = now;
  const durationDays   = 1;

  const eip712 = relayer.createEIP712(
    keypair.publicKey,
    sorted,
    startTimestamp,
    durationDays,
  );

  const signature = await signer.signTypedData(
    eip712.domain,
    userDecryptTypes(eip712),
    eip712.message,
  );

  const cred: DecryptCredential = {
    keypair,
    signature,
    account,
    contractAddresses: sorted,
    startTimestamp,
    durationDays,
    expiresAt: startTimestamp + durationDays * 86_400,
  };
  _credCache.set(credKey, cred);
  return cred;
}

/**
 * Decrypt multiple handles in a single userDecrypt call.
 *
 * Signs at most ONCE per contract set per session — the credential is cached
 * and reused for all subsequent calls (polls, new messages, thread switches).
 * Already-decrypted handles are returned from the plaintext cache with no
 * network round-trip.
 */
export async function decryptMessageBatch(
  pairs: Array<{ handle: string; contractAddress: string }>,
  authorizationContractAddresses?: string[],
): Promise<Map<string, Uint8Array>> {
  if (pairs.length === 0) return new Map();

  // Only call userDecrypt for handles not already in the plaintext cache
  const uncached = pairs.filter((p) => !_decryptCache.has(p.handle));

  if (uncached.length > 0) {
    const relayer = await getRelayerInstance();
    const contractAddresses = [
      ...new Set(authorizationContractAddresses ?? uncached.map((p) => p.contractAddress)),
    ];
    const cred = await _getCredential(relayer, contractAddresses);

    const result = await relayer.userDecrypt(
      uncached,
      cred.keypair.privateKey,
      cred.keypair.publicKey,
      cred.signature,
      cred.contractAddresses,
      cred.account,
      cred.startTimestamp,
      cred.durationDays,
      { timeout: 60_000 },
    );

    for (const { handle } of uncached) {
      const raw = userDecryptResultValue(result, handle);
      if (raw instanceof Uint8Array) {
        _decryptCache.set(handle, raw);
      } else if (typeof raw === "bigint") {
        const hex = raw.toString(16).padStart(64, "0");
        _decryptCache.set(handle, new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16))));
      }
    }
  }

  const out = new Map<string, Uint8Array>();
  for (const { handle } of pairs) {
    const bytes = _decryptCache.get(handle);
    if (bytes) out.set(handle, bytes);
  }
  return out;
}

/**
 * Decrypt a euint32 tally handle.
 */
export async function decryptUint32(
  handle: string,
  contractAddress: string,
): Promise<number> {
  const relayer = await getRelayerInstance();
  const cred = await _getCredential(relayer, [contractAddress]);

  const result = await relayer.userDecrypt(
    [{ handle, contractAddress }],
    cred.keypair.privateKey,
    cred.keypair.publicKey,
    cred.signature,
    cred.contractAddresses,
    cred.account,
    cred.startTimestamp,
    cred.durationDays,
    { timeout: 60_000 },
  );

  const raw = userDecryptResultValue(result, handle);
  if (typeof raw === "number") return raw;
  if (typeof raw === "bigint") return Number(raw);
  throw new Error("decryption unauthorized");
}

/**
 * Encrypt username + bio strings for IdentityRegistry.registerUser().
 * Both values are added to a SINGLE encrypted input so they share one inputProof,
 * matching the contract signature: registerUser(usernameHandle, bioHandle, inputProof, publicKey).
 */
export async function encryptRegistrationFields(
  contractAddress: string,
  username: string,
  bio: string,
): Promise<{ usernameHandle: string; bioHandle: string; inputProof: string }> {
  const { account } = await connectWallet();
  const relayer = await getRelayerInstance();

  function strTo32BigInt(s: string): bigint {
    const enc = new TextEncoder().encode(s.slice(0, 32));
    const out = new Uint8Array(32);
    out.set(enc);
    return BigInt("0x" + Array.from(out).map(x => x.toString(16).padStart(2, "0")).join(""));
  }

  // Both values in ONE input — single proof covers both handles
  const input = relayer.createEncryptedInput(contractAddress, account);
  input.add256(strTo32BigInt(username));
  input.add256(strTo32BigInt(bio));
  const encrypted = await input.encrypt({ timeout: 120_000 }).catch((err) => {
    throw withRelayerContext(err);
  });

  return {
    usernameHandle: u8ToHex(encrypted.handles[0]),
    bioHandle:      u8ToHex(encrypted.handles[1]),
    inputProof:     u8ToHex(encrypted.inputProof),
  };
}

/**
 * Recover the wallet's 65-byte uncompressed ECDSA public key by signing a
 * deterministic message and calling ethers SigningKey.recoverPublicKey().
 * The contract verifies: keccak256(pubkey[1:65])[12:] == msg.sender.
 */
export async function getUncompressedPublicKey(): Promise<`0x${string}`> {
  const { signer } = await connectWallet();
  const { SigningKey, hashMessage, recoverAddress, Signature } = await import("ethers");

  const msg = "eChatz identity registration";
  const sig = await signer.signMessage(msg);
  const digest = hashMessage(msg);
  const pubKey = SigningKey.recoverPublicKey(digest, sig);
  // pubKey is 0x04<64 bytes> — already 65 bytes uncompressed
  return pubKey as `0x${string}`;
}

// ──────────────────────────────────────────────────────────────────
//  Error classifier
// ──────────────────────────────────────────────────────────────────

export function classifyError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const lower   = message.toLowerCase();

  if (lower.includes("wallet not connected"))      return new Error("wallet not connected");
  if (lower.includes("wrong network") || lower.includes("chain"))
    return new Error("wrong network");
  if (lower.includes("not allowed") || lower.includes("unauthorized") || lower.includes("acl"))
    return new Error("decryption unauthorized");
  if (lower.includes("timeout") || lower.includes("timed out"))
    return new Error("relayer timeout");
  if (lower.includes("user rejected"))
    return new Error("user rejected transaction");

  // Decode known on-chain custom error selectors
  if (message.includes("0xa5070af6"))
    return new Error("recipient is not registered on eChatz");
  if (message.includes("0x1a0743b2"))
    return new Error("your account is not registered on eChatz");
  if (message.includes("0x73bb9021"))
    return new Error("recipient has blocked you");
  if (message.includes("0xe438f8ce"))
    return new Error("you are not a participant in this thread");
  if (message.includes("0x989a539a"))
    return new Error("encryption proof invalid — please retry");

  return new Error(`unexpected error: ${message}`);
}
