/**
 * Session key (gas wallet) management for eChatz.
 *
 * The session key is a deterministic ephemeral wallet derived from a
 * one-time MetaMask personal_sign. The same signature always produces the
 * same private key, so the wallet is never truly "lost" — even if the user
 * clears localStorage, they can re-derive it by signing the same message.
 *
 * SECURITY:
 *  - The session key holds only a small amount of ETH (gas).
 *  - The private key is cached in localStorage for convenience; it can
 *    always be re-derived on demand so caching is not security-critical.
 *  - Never log or transmit the private key outside this module.
 */

import { Wallet, BrowserProvider, JsonRpcProvider, keccak256 } from "ethers";

// ──────────────────────────────────────────────────────────────────
//  Constants
// ──────────────────────────────────────────────────────────────────

const SK_STORAGE_PREFIX = "echatz:sk:";

// Warning threshold: show banner when session key balance drops below this
export const SESSION_KEY_LOW_BALANCE_WEI = 2_000_000_000_000_000n; // 0.002 ETH

// ──────────────────────────────────────────────────────────────────
//  Deterministic derivation message
// ──────────────────────────────────────────────────────────────────

/**
 * The exact message the user signs to derive their session key.
 * Must never change — changing it produces a different address and
 * strands any ETH already sent to the old address.
 */
export function sessionKeyDeriveMessage(mainAddress: string): string {
  return (
    `eChatz session key v1\n\n` +
    `Main wallet: ${mainAddress.toLowerCase()}\n\n` +
    `This signature derives your gas wallet private key.\n` +
    `Only sign this on the official eChatz app.\n` +
    `Never share this signature with anyone.`
  );
}

// ──────────────────────────────────────────────────────────────────
//  Storage helpers
// ──────────────────────────────────────────────────────────────────

function storageKey(mainAddress: string): string {
  return SK_STORAGE_PREFIX + mainAddress.toLowerCase();
}

function saveToDisk(mainAddress: string, pk: string): void {
  try {
    localStorage.setItem(storageKey(mainAddress), pk);
  } catch {
    // Ignore — storage quota or private-browsing restriction.
    // The key can be re-derived on next load.
  }
}

function loadFromDisk(mainAddress: string): string | null {
  try {
    return localStorage.getItem(storageKey(mainAddress));
  } catch {
    return null;
  }
}

export function clearSessionKeyFromDisk(mainAddress: string): void {
  try {
    localStorage.removeItem(storageKey(mainAddress));
  } catch {
    // ignore
  }
}

// ──────────────────────────────────────────────────────────────────
//  Derive / load session key
// ──────────────────────────────────────────────────────────────────

/**
 * Load the cached session key from localStorage, or derive it from a
 * deterministic MetaMask signature (prompts the user once).
 *
 * After derivation the private key is cached in localStorage so
 * subsequent page loads are silent.
 */
export async function loadOrDeriveSessionKey(mainAddress: string): Promise<Wallet> {
  const cached = loadFromDisk(mainAddress);
  if (cached) {
    return new Wallet(cached);
  }
  return await deriveSessionKey(mainAddress);
}

/**
 * Force-derive the session key from a new MetaMask signature.
 * Overwrites any cached value — useful if the user wants to re-generate.
 */
export async function deriveSessionKey(mainAddress: string): Promise<Wallet> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("wallet not connected");
  }

  const provider = new BrowserProvider(window.ethereum);
  const signer   = await provider.getSigner();

  // personal_sign — deterministic per (mainAddress, MetaMask seed phrase).
  // Same wallet + same message = same sig = same session key forever.
  const sig = await signer.signMessage(sessionKeyDeriveMessage(mainAddress));

  // Derive private key from the 65-byte signature bytes
  const pk = keccak256(sig as `0x${string}`);

  saveToDisk(mainAddress, pk);
  return new Wallet(pk);
}

/**
 * Synchronously return a Wallet from localStorage without any signing.
 * Returns null if no cached key exists (user needs to call loadOrDeriveSessionKey).
 */
export function getStoredSessionKey(mainAddress: string): Wallet | null {
  const cached = loadFromDisk(mainAddress);
  if (!cached) return null;
  return new Wallet(cached);
}

// ──────────────────────────────────────────────────────────────────
//  RPC provider for session key transactions
// ──────────────────────────────────────────────────────────────────

/**
 * Return a JsonRpcProvider connected to Sepolia via Infura.
 * Used by the session key wallet to broadcast transactions without MetaMask.
 */
export function getSessionKeyProvider(): JsonRpcProvider {
  const key = process.env.NEXT_PUBLIC_INFURA_API_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_INFURA_API_KEY not set");
  return new JsonRpcProvider(`https://sepolia.infura.io/v3/${key}`);
}

/**
 * Return the session key wallet connected to the Infura RPC provider,
 * ready to sign and broadcast transactions.
 */
export async function getConnectedSessionWallet(mainAddress: string): Promise<Wallet> {
  const wallet   = await loadOrDeriveSessionKey(mainAddress);
  const provider = getSessionKeyProvider();
  return wallet.connect(provider) as Wallet;
}

// ──────────────────────────────────────────────────────────────────
//  Balance helpers
// ──────────────────────────────────────────────────────────────────

export async function getSessionKeyBalance(sessionAddress: string): Promise<bigint> {
  const provider = getSessionKeyProvider();
  return await provider.getBalance(sessionAddress);
}
