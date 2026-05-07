"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useChainId } from "wagmi";
import { BrowserProvider, Contract } from "ethers";
import { encryptRegistrationFields, connectWallet, getUncompressedPublicKey } from "@/lib/relayer";
import { loadOrDeriveSessionKey } from "@/lib/session-key";
import { CONTRACT_ADDRESSES, IDENTITY_REGISTRY_ABI } from "@/lib/contracts";

export type RegistrationStatus = "loading" | "registered" | "unregistered" | "error" | "wrong-network";

const EXPECTED_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "11155111");

export function useRegistration() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [status, setStatus] = useState<RegistrationStatus>("loading");
  const [error, setError]   = useState<string | null>(null);

  const checkRegistration = useCallback(async () => {
    if (!isConnected || !address || typeof window === "undefined") {
      setStatus("unregistered");
      return;
    }
    if (chainId !== EXPECTED_CHAIN_ID) {
      setError(`Wrong network — please switch to Sepolia (chain ${EXPECTED_CHAIN_ID})`);
      setStatus("wrong-network");
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      const registry = new Contract(
        CONTRACT_ADDRESSES.identityRegistry,
        IDENTITY_REGISTRY_ABI,
        provider,
      );
      const registered: boolean = await registry.isRegistered(address);
      setStatus(registered ? "registered" : "unregistered");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [address, isConnected, chainId]);

  useEffect(() => {
    setStatus("loading");
    checkRegistration();
  }, [checkRegistration]);

  const register = useCallback(async (username: string, bio: string) => {
    setError(null);
    const { signer } = await connectWallet();
    const registry = new Contract(
      CONTRACT_ADDRESSES.identityRegistry,
      IDENTITY_REGISTRY_ABI,
      signer,
    );

    // Recover the 65-byte uncompressed public key (requires one personal_sign)
    const publicKey = await getUncompressedPublicKey();

    // Encrypt both fields together — one proof covers both handles
    const { usernameHandle, bioHandle, inputProof } =
      await encryptRegistrationFields(CONTRACT_ADDRESSES.identityRegistry, username, bio);

    // Tx 1: register user identity
    const tx = await registry.registerUser(
      usernameHandle,
      bioHandle,
      inputProof,
      publicKey,
    );
    await tx.wait();

    // Tx 2: derive session key (one personal_sign) + register on-chain
    // This runs immediately after registration so the user only visits
    // the registration flow once. They sign: one personal_sign (key derivation)
    // + one tx (registerSessionKey). Both happen automatically here.
    try {
      const { account: mainAddress } = await connectWallet();
      const sessionWallet = await loadOrDeriveSessionKey(mainAddress);
      const skTx = await registry.registerSessionKey(sessionWallet.address);
      await skTx.wait();
    } catch {
      // Non-fatal — user can set up session key later from the sidebar
    }

    await checkRegistration();
  }, [checkRegistration]);

  return { status, error, register, refresh: checkRegistration };
}
