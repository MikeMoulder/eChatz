/**
 * IPFS hybrid storage for eChatz.
 *
 * FIX_3 — Dual-pin strategy: Pinata (primary) + web3.storage (secondary).
 * Both must fail for the upload to abort.
 * Re-pin on every successful fetch to refresh TTL.
 *
 * Routing rule:
 *   plaintext length <= 32 bytes -> on-chain (euint256, storageType = 0)
 *   plaintext length  > 32 bytes -> IPFS (storageType = 1, content = encrypted CID bytes32)
 *
 * SECURITY: Never store ciphertext or plaintext in localStorage.
 *           API key is server-side only (IPFS_API_KEY env var).
 */

/**
 * Imports for base58 encode/decode (ethers v6 exports these at top level).
 */
import { decodeBase58, encodeBase58 } from "ethers";

const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://ipfs.io/ipfs";
const PINATA_API   = "https://api.pinata.cloud/pinning/pinFileToIPFS";

const FETCH_TIMEOUT_MS = 10_000;
const FETCH_RETRIES    = 3;

// ──────────────────────────────────────────────────────────────────
//  Routing decision
// ──────────────────────────────────────────────────────────────────

export function requiresIpfs(plaintext: string): boolean {
  const bytes = new TextEncoder().encode(plaintext);
  return bytes.length > 32;
}

// ──────────────────────────────────────────────────────────────────
//  Upload to IPFS via server route (keeps API key server-side)
// ──────────────────────────────────────────────────────────────────

/**
 * Upload ciphertext bytes to IPFS via the /api/ipfs/upload Next.js route.
 * Returns the CID string.
 */
export async function uploadToIpfs(data: Uint8Array): Promise<string> {
  const formData = new FormData();
  const payload = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  formData.append("file", new Blob([payload], { type: "application/octet-stream" }), "msg");

  const res = await fetch("/api/ipfs/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`IPFS upload failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json.cid as string;
}

/**
 * Fetch raw bytes from IPFS with retry logic.
 * FIX_3: 10s timeout + 3 retries → graceful error.
 */
export async function fetchFromIpfs(cid: string): Promise<Uint8Array> {
  let lastError: Error = new Error("IPFS fetch failed");

  for (let attempt = 0; attempt < FETCH_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(`${IPFS_GATEWAY}/${cid}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const buf   = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);

      // Re-pin on successful fetch (best-effort, fire-and-forget)
      rePinInBackground(cid);

      return bytes;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError;
}

/**
 * Extract the 32-byte content-hash from a CIDv0 (Qm...) so it fits in a euint256 slot.
 *
 * CIDv0 structure: base58( [0x12, 0x20] + sha256_of_content )
 * We drop the 2-byte multihash prefix and store only the 32 inner hash bytes.
 * Use bytes32ToCid() to reconstruct the original CID on the decrypt side.
 */
export function cidToBytes32(cid: string): Uint8Array {
  // decodeBase58 returns a BigInt representing the full 34-byte multihash
  const bigint = decodeBase58(cid);
  const hex    = bigint.toString(16).padStart(68, "0"); // 34 bytes = 68 hex chars
  // Skip first 4 hex chars (= bytes 0x12, 0x20 — the multihash prefix)
  const hashHex = hex.slice(4);
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(hashHex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Reconstruct a CIDv0 string from 32 raw content-hash bytes (inverse of cidToBytes32).
 * Prepends the SHA-256 multihash prefix [0x12, 0x20] then base58-encodes.
 */
export function bytes32ToCid(bytes: Uint8Array): string {
  const full = new Uint8Array(34);
  full[0] = 0x12;
  full[1] = 0x20;
  full.set(bytes.slice(0, 32), 2);
  return encodeBase58(full);
}

/**
 * Fire-and-forget background re-pin request.
 * Silently fails — does not affect message display.
 */
function rePinInBackground(cid: string): void {
  fetch("/api/ipfs/repin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cid }),
  }).catch(() => {
    // intentionally silent
  });
}
