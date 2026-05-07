"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { Contract, BrowserProvider } from "ethers";
import type { Eip1193Provider } from "ethers";
import type { WalletClient } from "viem";
import { parseSlashCommand } from "@/lib/slash-commands";
import {
  encryptMessageContent,
  encryptIpfsCid,
  encryptPaymentRequest,
  decryptMessageBatch,
  classifyError,
} from "@/lib/relayer";
import { requiresIpfs, uploadToIpfs, cidToBytes32 } from "@/lib/ipfs";
import { getStoredSessionKey, getSessionKeyProvider } from "@/lib/session-key";
import {
  CONTRACT_ADDRESSES,
  DECRYPT_SESSION_CONTRACTS,
  MESSAGE_STORE_ABI,
  PAYMENT_ROUTER_ABI,
  INVITE_REGISTRY_ABI,
} from "@/lib/contracts";
import type { MessageData } from "@/components/MessageBubble";

export type SendState = "idle" | "encrypting" | "confirming" | "done";

/**
 * Convert a wagmi WalletClient to an ethers BrowserProvider.
 * This works for any connected wallet (MetaMask, WalletConnect, Coinbase, etc.)
 * because viem's WalletClient implements the EIP-1193 request interface.
 */
function walletClientToBrowserProvider(wc: WalletClient): BrowserProvider {
  return new BrowserProvider(wc as unknown as Eip1193Provider);
}

export function useMessages(recipient: string) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  // tracks which recipient's messages we've already loaded — so reload after send
  // doesn't flash the skeleton (only new thread switches show skeletons)
  const loadedRecipientRef = useRef<string>("");

  const [messages, setMessages]   = useState<MessageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [sendState, setSendState] = useState<SendState>("idle");

  // ──────────────────────────────────────────────────────────────────
  //  Load messages from MessageStore
  // ──────────────────────────────────────────────────────────────────

  const loadMessages = useCallback(async () => {
    if (!recipient || !address || !walletClient || typeof window === "undefined") return;
    // Only show skeletons when switching to a new thread, not on background reloads
    const isNewThread = loadedRecipientRef.current !== recipient;
    if (isNewThread) {
      setMessages([]);
      setIsLoading(true);
    }
    setError(null);

    try {
      const provider = walletClientToBrowserProvider(walletClient);
      // Use signer so msg.sender is correct for the NotParticipant checks in
      // getMessageMeta and getMessageContent
      const signer = await provider.getSigner();
      const msgStoreContract = new Contract(
        CONTRACT_ADDRESSES.messageStore,
        MESSAGE_STORE_ABI,
        signer,
      );

      const threadId = await msgStoreContract.getThreadId(address, recipient);
      if (BigInt(threadId) === 0n) {
        setMessages([]);
        return;
      }

      const ids: bigint[] = await msgStoreContract.getThreadMessageIds(
        threadId, 0, 50,
      );

      const metas = await Promise.all(
        ids.map(async (id) => {
          try {
            const [sender, recip, ts, msgType, storType, tid] =
              await msgStoreContract.getMessageMeta(id);

            // staticCall gets the handle without spending gas.
            // ACL for both parties was already granted inside sendMessage().
            let contentHandle = "";
            try {
              contentHandle = await msgStoreContract.getMessageContent.staticCall(id);
            } catch {
              // burned message or ACL issue — show empty bubble
            }

            return {
              id: Number(id),
              sender,
              recipient: recip,
              timestamp: Number(ts),
              messageType: Number(msgType),
              storageType: Number(storType),
              contentHandle,
              threadId: Number(tid),
            } satisfies MessageData;
          } catch {
            return null;
          }
        }),
      );

      const validMetas = metas.filter((m): m is MessageData => m !== null);

      // Batch-decrypt all handles in one userDecrypt call — single wallet signature
      const handlesForDecrypt = validMetas
        .filter((m) => m.contentHandle)
        .map((m) => ({ handle: m.contentHandle, contractAddress: CONTRACT_ADDRESSES.messageStore }));

      let decryptedMap = new Map<string, Uint8Array>();
      try {
        decryptedMap = await decryptMessageBatch(handlesForDecrypt, DECRYPT_SESSION_CONTRACTS);
      } catch {
        // Non-fatal: bubbles will show retry button for individual messages
      }

      setMessages(
        validMetas.map((m) => ({
          ...m,
          decryptedBytes: decryptedMap.get(m.contentHandle),
        })),
      );
    } catch (err) {
      setError(classifyError(err).message);
    } finally {
      setIsLoading(false);
      loadedRecipientRef.current = recipient;
    }
  }, [address, recipient, walletClient]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Poll for new messages every 8 s so recipients see incoming messages quickly.
  useEffect(() => {
    if (!recipient) return;
    const id = setInterval(loadMessages, 8_000);
    return () => clearInterval(id);
  }, [recipient, loadMessages]);

  // ──────────────────────────────────────────────────────────────────
  //  Send: plain text or slash command
  // ──────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!address || !walletClient) throw new Error("wallet not connected");

      const parsed = parseSlashCommand(text);
      setSendState("encrypting");

      if (!parsed || parsed.type === "unknown") {
        // Optimistic: append the message locally so the sender sees it instantly.
        const optimisticId = -Date.now();
        const optimisticMsg: MessageData = {
          id: optimisticId,
          sender: address,
          recipient,
          timestamp: Math.floor(Date.now() / 1000),
          messageType: 0,
          storageType: 0,
          contentHandle: "",
          threadId: 0,
          decryptedBytes: new TextEncoder().encode(text),
          pendingState: "encrypting",
        };
        setMessages((prev) => [...prev, optimisticMsg]);

        const onSubmitted = () => {
          setSendState("confirming");
          // Flip the phase badge in the optimistic bubble to "confirming"
          setMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticId ? { ...m, pendingState: "confirming" as const } : m,
            ),
          );
        };

        let tx: Awaited<ReturnType<typeof _sendPlainMessage>>;
        try {
          tx = await _sendPlainMessage(text, recipient, address, walletClient, onSubmitted);
        } catch (err) {
          // Encrypt or tx submit failed — remove the optimistic bubble.
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          setSendState("idle");
          throw err;
        }

        setSendState("done");
        setTimeout(() => setSendState("idle"), 1500);

        // Reload ONLY after the tx is confirmed — the optimistic bubble stays visible
        // until then, so the sender never sees a gap where their message disappears.
        tx.wait()
          .then(() => loadMessages().catch(() => {}))
          .catch(() => {
            // Tx reverted on-chain — remove the optimistic bubble.
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          });
      } else {
        try {
          setSendState("confirming");
          await _handleSlashCommand(parsed, recipient, address, walletClient);
          setSendState("done");
          setTimeout(() => setSendState("idle"), 1500);
          loadMessages().catch(() => {});
        } catch (err) {
          setSendState("idle");
          throw err;
        }
      }
    },
    [address, walletClient, recipient, loadMessages],
  );

  // ──────────────────────────────────────────────────────────────────
  //  Mark read
  // ──────────────────────────────────────────────────────────────────

  const markRead = useCallback(async (messageId: number) => {
    if (!address || !walletClient) return;
    const provider = walletClientToBrowserProvider(walletClient);
    const signer   = await provider.getSigner();
    const contract = new Contract(
      CONTRACT_ADDRESSES.messageStore,
      MESSAGE_STORE_ABI,
      signer,
    );
    const tx = await contract.markRead(messageId);
    await tx.wait();
  }, [address, walletClient]);

  // ──────────────────────────────────────────────────────────────────
  //  Burn message
  // ──────────────────────────────────────────────────────────────────

  const burnMessage = useCallback(async (messageId: number) => {
    if (!address || !walletClient) return;
    const provider = walletClientToBrowserProvider(walletClient);
    const signer   = await provider.getSigner();
    const contract = new Contract(
      CONTRACT_ADDRESSES.messageStore,
      MESSAGE_STORE_ABI,
      signer,
    );
    const tx = await contract.burnMessage(messageId);
    await tx.wait();
    await loadMessages();
  }, [address, walletClient, loadMessages]);

  return { messages, isLoading, error, sendState, sendMessage, markRead, burnMessage, reload: loadMessages };
}

// ──────────────────────────────────────────────────────────────────
//  Internal: send plain text message
// ──────────────────────────────────────────────────────────────────

async function _sendPlainMessage(
  text: string,
  recipient: string,
  sender: string,
  walletClient: WalletClient,
  onSubmitted: () => void,
) {
  const sessionWallet = getStoredSessionKey(sender);
  const useSessionKey = sessionWallet !== null;
  const effectiveSender = useSessionKey ? sessionWallet!.address : sender;

  // Parallelise: resolve signer AND generate the encryption proof simultaneously.
  // Signer resolution (RPC call or wallet handshake) and proof generation (relayer
  // network round-trip) are independent — running them in parallel saves ~0.5-1 s.
  const signerPromise = useSessionKey
    ? Promise.resolve(sessionWallet!.connect(getSessionKeyProvider()))
    : walletClientToBrowserProvider(walletClient).getSigner();

  const encryptPromise = requiresIpfs(text)
    ? (async () => {
        const encoded  = new TextEncoder().encode(text);
        const cid      = await uploadToIpfs(encoded);
        const cidBytes = cidToBytes32(cid);
        const enc = await encryptIpfsCid(CONTRACT_ADDRESSES.messageStore, cidBytes, effectiveSender);
        return { ...enc, storageType: 1 as const };
      })()
    : encryptMessageContent(CONTRACT_ADDRESSES.messageStore, text, effectiveSender)
        .then((enc) => ({ ...enc, storageType: 0 as const }));

  const [signer, { handle, inputProof, storageType }] = await Promise.all([
    signerPromise,
    encryptPromise,
  ]);

  const contract = new Contract(CONTRACT_ADDRESSES.messageStore, MESSAGE_STORE_ABI, signer);

  const tx = await contract.sendMessage(recipient, handle, inputProof, 0, storageType);
  onSubmitted();
  // Return the TransactionResponse so the caller can call tx.wait() separately.
  // This lets the caller delay loadMessages() until confirmation without needing
  // to await the entire function (which would unwrap the inner promise).
  return tx;
}

// ──────────────────────────────────────────────────────────────────
//  Internal: handle slash commands
// ──────────────────────────────────────────────────────────────────

async function _handleSlashCommand(
  parsed: NonNullable<ReturnType<typeof parseSlashCommand>>,
  recipient: string,
  sender: string,
  walletClient: WalletClient,
) {
  const sessionWallet = getStoredSessionKey(sender);
  const useSessionKey = sessionWallet !== null;

  // Slash commands that move value always use the main wallet (MetaMask confirmation
  // is desired for security). Session key is used only for plain messages.
  const provider = walletClientToBrowserProvider(walletClient);
  const signer   = await provider.getSigner();

  if (parsed.type === "send") {
    const to     = parsed.to || recipient; // default to current chat recipient
    const isEth  = parsed.token === "ETH";
    const payRouter = new Contract(CONTRACT_ADDRESSES.paymentRouter, PAYMENT_ROUTER_ABI, signer);

    // Encrypt: note (euint256) only — amount is sent as msg.value for ETH
    const note = await encryptMessageContent(
      CONTRACT_ADDRESSES.paymentRouter,
      `Sent ${parsed.amount} ${parsed.token}`.slice(0, 32),
      sender,
    );

    if (isEth) {
      const weiValue = BigInt(Math.round(parseFloat(parsed.amount) * 1e18));
      const tx = await payRouter.sendETH(to, note.handle, note.inputProof, { value: weiValue });
      await tx.wait();
    } else {
      // ERC-20: caller must have approved the router; we pass amount as plaintext
      // (the note handle carries the privacy-layer annotation)
      throw new Error("ERC-20 send: approve the token to PaymentRouter first (coming soon)");
    }
    return;
  }

  if (parsed.type === "request") {
    const from = parsed.from || recipient; // default to current chat recipient
    const payRouter = new Contract(CONTRACT_ADDRESSES.paymentRouter, PAYMENT_ROUTER_ABI, signer);

    const amountWei = BigInt(Math.round(parseFloat(parsed.amount) * 1e18));
    const noteText  = `Requesting ${parsed.amount} ${parsed.token}`.slice(0, 32);

    // Batch-encrypt amount (euint64) + note (euint256) in a single proof call
    const { amountHandle, noteHandle, inputProof } = await encryptPaymentRequest(
      CONTRACT_ADDRESSES.paymentRouter,
      amountWei,
      noteText,
      sender,
    );

    // token address(0) = ETH request
    const tokenAddr = "0x0000000000000000000000000000000000000000";
    const tx = await payRouter.createRequest(
      from, tokenAddr, amountWei, amountHandle, noteHandle, inputProof,
    );
    await tx.wait();
    return;
  }

  if (parsed.type === "invite") {
    const invitee = parsed.address || recipient;
    if (!invitee || !/^0x[a-fA-F0-9]{40}$/.test(invitee)) {
      throw new Error("Please provide a valid Ethereum address: /invite 0x...");
    }
    const invReg = new Contract(CONTRACT_ADDRESSES.inviteRegistry, INVITE_REGISTRY_ABI, signer);
    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? window.location.origin;
    const link = `${baseUrl}/join?ref=${sender}`;
    const tx = await invReg.createInvite(invitee, link);
    await tx.wait();
    return;
  }

  throw new Error(`Unknown command: /${parsed.type}`);
}
