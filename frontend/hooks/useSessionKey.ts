"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { BrowserProvider, Contract, formatEther } from "ethers";
import {
  loadOrDeriveSessionKey,
  getStoredSessionKey,
  getSessionKeyBalance,
  clearSessionKeyFromDisk,
  SESSION_KEY_LOW_BALANCE_WEI,
} from "@/lib/session-key";
import { CONTRACT_ADDRESSES, IDENTITY_REGISTRY_ABI } from "@/lib/contracts";

export type SessionKeyStatus =
  | "loading"          // checking on-chain state
  | "not-registered"   // user registered but no session key on-chain yet
  | "ready"            // session key is on-chain and in localStorage
  | "needs-derive"     // on-chain key exists but not in localStorage (re-derive needed)
  | "error";

export interface SessionKeyInfo {
  status: SessionKeyStatus;
  /** The session key address (0x…) if known */
  address: string | null;
  /** ETH balance of the session key in wei */
  balanceWei: bigint;
  /** true when balance < SESSION_KEY_LOW_BALANCE_WEI */
  isLowBalance: boolean;
  /** Human-readable balance e.g. "0.0031" */
  balanceEth: string;
  error: string | null;
  /** Derive the session key + register it on-chain (called from registration flow) */
  setup: () => Promise<void>;
  /** Re-derive key from MetaMask sig (use when localStorage was cleared) */
  rederive: () => Promise<void>;
  /** Revoke on-chain + clear from localStorage */
  revoke: () => Promise<void>;
  /** Refresh balance */
  refreshBalance: () => Promise<void>;
}

const BALANCE_POLL_MS = 30_000;

export function useSessionKey(): SessionKeyInfo {
  const { address: mainAddress } = useAccount();

  const [status, setStatus]       = useState<SessionKeyStatus>("loading");
  const [skAddress, setSkAddress] = useState<string | null>(null);
  const [balanceWei, setBalanceWei] = useState<bigint>(0n);
  const [error, setError]         = useState<string | null>(null);

  // ──────────────────────────────────────────────────────────────────
  //  Check on-chain session key state
  // ──────────────────────────────────────────────────────────────────

  const checkOnChain = useCallback(async () => {
    if (!mainAddress || typeof window === "undefined") return;
    setError(null);

    try {
      const provider = new BrowserProvider(window.ethereum);
      const registry = new Contract(
        CONTRACT_ADDRESSES.identityRegistry,
        IDENTITY_REGISTRY_ABI,
        provider,
      );

      const onChainSk: string = await registry.getSessionKey(mainAddress);
      const hasOnChain = onChainSk !== "0x0000000000000000000000000000000000000000";

      if (!hasOnChain) {
        setStatus("not-registered");
        setSkAddress(null);
        return;
      }

      // On-chain key exists — check localStorage
      const local = getStoredSessionKey(mainAddress);
      if (local && local.address.toLowerCase() === onChainSk.toLowerCase()) {
        setStatus("ready");
        setSkAddress(onChainSk);
      } else {
        // On-chain key differs from local (cleared storage) — user needs to re-derive
        setStatus("needs-derive");
        setSkAddress(onChainSk);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [mainAddress]);

  useEffect(() => {
    setStatus("loading");
    checkOnChain();
  }, [checkOnChain]);

  // ──────────────────────────────────────────────────────────────────
  //  Balance polling
  // ──────────────────────────────────────────────────────────────────

  const refreshBalance = useCallback(async () => {
    if (!skAddress) return;
    try {
      const bal = await getSessionKeyBalance(skAddress);
      setBalanceWei(bal);
    } catch {
      // Non-fatal — balance display is best-effort
    }
  }, [skAddress]);

  useEffect(() => {
    if (!skAddress) return;
    refreshBalance();
    const id = setInterval(refreshBalance, BALANCE_POLL_MS);
    return () => clearInterval(id);
  }, [skAddress, refreshBalance]);

  // ──────────────────────────────────────────────────────────────────
  //  Setup: derive key + register on-chain
  // ──────────────────────────────────────────────────────────────────

  const setup = useCallback(async () => {
    if (!mainAddress) throw new Error("wallet not connected");
    setError(null);

    // 1. Derive session key (one MetaMask personal_sign)
    const wallet = await loadOrDeriveSessionKey(mainAddress);

    // 2. Register on-chain (one MetaMask tx confirmation)
    const provider = new BrowserProvider(window.ethereum);
    const signer   = await provider.getSigner();
    const registry = new Contract(
      CONTRACT_ADDRESSES.identityRegistry,
      IDENTITY_REGISTRY_ABI,
      signer,
    );

    const tx = await registry.registerSessionKey(wallet.address);
    await tx.wait();

    setSkAddress(wallet.address);
    setStatus("ready");
  }, [mainAddress]);

  // ──────────────────────────────────────────────────────────────────
  //  Re-derive: MetaMask sign → same key, updates localStorage
  // ──────────────────────────────────────────────────────────────────

  const rederive = useCallback(async () => {
    if (!mainAddress) throw new Error("wallet not connected");
    setError(null);

    const wallet = await loadOrDeriveSessionKey(mainAddress);

    // Verify it matches what's on-chain
    const provider = new BrowserProvider(window.ethereum);
    const registry = new Contract(
      CONTRACT_ADDRESSES.identityRegistry,
      IDENTITY_REGISTRY_ABI,
      provider,
    );
    const onChainSk: string = await registry.getSessionKey(mainAddress);
    if (wallet.address.toLowerCase() !== onChainSk.toLowerCase()) {
      throw new Error(
        "Derived session key does not match the one on-chain. " +
        "You may be using a different wallet or seed phrase.",
      );
    }

    setSkAddress(wallet.address);
    setStatus("ready");
  }, [mainAddress]);

  // ──────────────────────────────────────────────────────────────────
  //  Revoke
  // ──────────────────────────────────────────────────────────────────

  const revoke = useCallback(async () => {
    if (!mainAddress) throw new Error("wallet not connected");
    setError(null);

    const provider = new BrowserProvider(window.ethereum);
    const signer   = await provider.getSigner();
    const registry = new Contract(
      CONTRACT_ADDRESSES.identityRegistry,
      IDENTITY_REGISTRY_ABI,
      signer,
    );

    const tx = await registry.revokeSessionKey();
    await tx.wait();

    clearSessionKeyFromDisk(mainAddress);
    setStatus("not-registered");
    setSkAddress(null);
    setBalanceWei(0n);
  }, [mainAddress]);

  // ──────────────────────────────────────────────────────────────────
  //  Derived values
  // ──────────────────────────────────────────────────────────────────

  const isLowBalance = balanceWei < SESSION_KEY_LOW_BALANCE_WEI;
  const balanceEth   = parseFloat(formatEther(balanceWei)).toFixed(4);

  return {
    status,
    address: skAddress,
    balanceWei,
    isLowBalance,
    balanceEth,
    error,
    setup,
    rederive,
    revoke,
    refreshBalance,
  };
}
