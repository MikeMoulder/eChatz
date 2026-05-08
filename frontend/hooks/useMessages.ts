"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { Contract, BrowserProvider, parseEther } from "ethers";
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
export interface PaymentRequestPayload {
  requestId: string;
  amount: string;
  token: string;
  requester: string;
  payer: string;
  note: string;
}

const AUTO_DECRYPT_CHUNK = 20;
const HANDLE_CACHE_STORAGE_KEY = "echatz:dec-cache:v1";
const MAX_MESSAGE_CHARS = 500;

// ──────────────────────────────────────────────────────────────────
//  Persistent plaintext cache (per browser tab via sessionStorage)
//
//  Keyed by ciphertext handle, value is the decrypted Uint8Array.
//  This survives thread switches AND page reloads within a tab, so the user
//  pays the relayer round-trip exactly once per ciphertext per session
//  rather than once per page load.
// ──────────────────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function loadPersistedHandleCache(): Map<string, Uint8Array> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = sessionStorage.getItem(HANDLE_CACHE_STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, string>;
    const m = new Map<string, Uint8Array>();
    for (const [k, v] of Object.entries(obj)) m.set(k, base64ToBytes(v));
    return m;
  } catch {
    return new Map();
  }
}

function persistHandleCache(cache: Map<string, Uint8Array>): void {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, string> = {};
    for (const [k, v] of cache.entries()) obj[k] = bytesToBase64(v);
    sessionStorage.setItem(HANDLE_CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Quota exceeded or storage disabled — keep in-memory cache only.
  }
}

/**
 * Convert a wagmi WalletClient to an ethers BrowserProvider.
 * This works for any connected wallet (MetaMask, WalletConnect, Coinbase, etc.)
 * because viem's WalletClient implements the EIP-1193 request interface.
 */
function walletClientToBrowserProvider(wc: WalletClient): BrowserProvider {
  return new BrowserProvider(wc as unknown as Eip1193Provider);
}

function participantsMatch(
  sender: string,
  recipient: string,
  a: string,
  b: string,
): boolean {
  const s = sender.toLowerCase();
  const r = recipient.toLowerCase();
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return (s === x && r === y) || (s === y && r === x);
}

function isInsufficientFundsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return lower.includes("insufficient funds") || lower.includes("insufficient_funds");
}

async function getMessageIdsByParticipantsCompat(
  msgStoreContract: Contract,
  a: string,
  b: string,
): Promise<bigint[]> {
  let nextMessageIdRaw: bigint;
  try {
    nextMessageIdRaw = await msgStoreContract.nextMessageId();
  } catch {
    // Some older deployments do not expose nextMessageId().
    // Treat this as "no ids resolved" instead of surfacing a CALL_EXCEPTION.
    return [];
  }
  const nextMessageId = Number(nextMessageIdRaw);
  if (!Number.isFinite(nextMessageId) || nextMessageId <= 0) return [];

  const windowSize = 500;
  const start = Math.max(1, nextMessageId - windowSize + 1);
  const candidateIds = Array.from(
    { length: nextMessageId - start + 1 },
    (_, i) => BigInt(start + i),
  );

  const matchedIds: bigint[] = [];
  const chunkSize = 40;

  for (let i = 0; i < candidateIds.length; i += chunkSize) {
    const chunk = candidateIds.slice(i, i + chunkSize);
    const metas = await Promise.all(
      chunk.map(async (id) => {
        try {
          const [sender, recipient] = await msgStoreContract.getMessageMeta(id);
          return { id, sender: String(sender), recipient: String(recipient) };
        } catch {
          return null;
        }
      }),
    );

    for (const entry of metas) {
      if (entry && participantsMatch(entry.sender, entry.recipient, a, b)) {
        matchedIds.push(entry.id);
      }
    }
  }

  if (matchedIds.length <= 50) return matchedIds;
  return matchedIds.slice(matchedIds.length - 50);
}

async function getThreadMessageIdsCompat(
  msgStoreContract: Contract,
  threadId: bigint,
): Promise<bigint[]> {
  try {
    return await msgStoreContract.getThreadMessageIds(threadId, 0, 50);
  } catch {
    // Compatibility path for older MessageStore deployments that do not expose
    // getThreadMessageIds(threadId, skip, first).
    let nextMessageIdRaw: bigint;
    try {
      nextMessageIdRaw = await msgStoreContract.nextMessageId();
    } catch {
      // If nextMessageId is also unavailable, stop fallback probing quietly.
      return [];
    }
    const nextMessageId = Number(nextMessageIdRaw);
    if (!Number.isFinite(nextMessageId) || nextMessageId <= 0) return [];

    const windowSize = 350;
    const start = Math.max(1, nextMessageId - windowSize + 1);
    const candidateIds = Array.from(
      { length: nextMessageId - start + 1 },
      (_, i) => BigInt(start + i),
    );

    const matchedIds: bigint[] = [];
    const chunkSize = 40;

    for (let i = 0; i < candidateIds.length; i += chunkSize) {
      const chunk = candidateIds.slice(i, i + chunkSize);
      const metas = await Promise.all(
        chunk.map(async (id) => {
          try {
            const meta = await msgStoreContract.getMessageMeta(id);
            return { id, thread: BigInt(meta[5]) };
          } catch {
            return null;
          }
        }),
      );

      for (const entry of metas) {
        if (entry && entry.thread === threadId) {
          matchedIds.push(entry.id);
        }
      }
    }

    if (matchedIds.length <= 50) return matchedIds;
    return matchedIds.slice(matchedIds.length - 50);
  }
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
  const [decryptBudget, setDecryptBudget] = useState(AUTO_DECRYPT_CHUNK);
  const [canDecryptMore, setCanDecryptMore] = useState(false);
  const [isDecryptingMore, setIsDecryptingMore] = useState(false);
  const decryptedHandleCacheRef = useRef<Map<string, Uint8Array>>(loadPersistedHandleCache());

  useEffect(() => {
    setDecryptBudget(AUTO_DECRYPT_CHUNK);
  }, [recipient]);

  // ──────────────────────────────────────────────────────────────────
  //  Load messages from MessageStore
  // ──────────────────────────────────────────────────────────────────

  const loadMessages = useCallback(async (opts?: { preserveOptimistic?: boolean }) => {
    const preserveOptimistic = opts?.preserveOptimistic ?? true;
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

      let ids: bigint[] = [];
      try {
        const threadIdRaw = await msgStoreContract.getThreadId(address, recipient);
        const threadId = BigInt(threadIdRaw);
        if (threadId !== 0n) {
          ids = await getThreadMessageIdsCompat(msgStoreContract, threadId);
        }
      } catch {
        // Compatibility path for deployments that do not expose
        // getThreadId(address,address) (selector 0x6c94f669).
      }

      if (ids.length === 0) {
        ids = await getMessageIdsByParticipantsCompat(msgStoreContract, address, recipient);
      }

      if (ids.length === 0) {
        setMessages([]);
        return;
      }

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

      // Filter out system messages (msgType !== 0) — they are reference hashes written
      // by PaymentRouter/VotingModule via sendSystemMessage and contain no readable content.
      // The actual readable payment receipt is written as a separate msgType=0 sendMessage.
      const validMetas = metas
        .filter((m): m is MessageData => m !== null && m.messageType === 0)
        .sort((a, b) => (a.timestamp === b.timestamp ? a.id - b.id : a.timestamp - b.timestamp));

      const handleCache = decryptedHandleCacheRef.current;

      // Step 1 — Reconcile against what's already on screen. Reuse existing object
      // references for messages whose meta + decrypted state hasn't changed. This is
      // critical: every 8 s poll used to spread new objects for every bubble, causing
      // a full list re-render and visible flicker. With a stable merge, an idle poll
      // returns `prev` unchanged and React skips the update entirely.
      setMessages((prev) => {
        const prevById = new Map(prev.map((m) => [m.id, m]));
        const localOptimistic = preserveOptimistic
          ? prev.filter((m) => m.pendingState !== undefined || m.localOnly)
          : [];

        let changed = false;
        const merged: MessageData[] = validMetas.map((m) => {
          const cachedBytes = m.contentHandle ? handleCache.get(m.contentHandle) : undefined;
          const existing = prevById.get(m.id);
          if (
            existing &&
            existing.contentHandle === m.contentHandle &&
            existing.timestamp === m.timestamp &&
            existing.decryptedBytes === cachedBytes
          ) {
            return existing;
          }
          changed = true;
          return { ...m, decryptedBytes: cachedBytes };
        });

        const realPrev = prev.filter(
          (m) => m.pendingState === undefined && !m.localOnly,
        );
        if (
          !changed &&
          realPrev.length === merged.length &&
          localOptimistic.length === prev.length - realPrev.length
        ) {
          // No real change — return same reference so React bails out.
          return prev;
        }

        if (localOptimistic.length === 0) return merged;
        return [...merged, ...localOptimistic].sort((a, b) => a.timestamp - b.timestamp);
      });

      // Step 2 — newest-first decryption queue. Take the last `decryptBudget` messages
      // (most recent at the bottom of the chat) and decrypt any that aren't cached.
      // One single batched userDecrypt call, not a per-message loop.
      const undecryptedNewestFirst: MessageData[] = [];
      for (let i = validMetas.length - 1; i >= 0; i -= 1) {
        const m = validMetas[i];
        if (m.contentHandle && !handleCache.has(m.contentHandle)) {
          undecryptedNewestFirst.push(m);
        }
      }

      const totalDecryptable = validMetas.filter((m) => Boolean(m.contentHandle)).length;
      const cachedCount = totalDecryptable - undecryptedNewestFirst.length;
      const targetSlice = undecryptedNewestFirst.slice(
        0,
        Math.max(0, decryptBudget - cachedCount),
      );

      setCanDecryptMore(undecryptedNewestFirst.length > targetSlice.length);

      if (targetSlice.length > 0) {
        setIsDecryptingMore(true);
        try {
          const result = await decryptMessageBatch(
            targetSlice.map((m) => ({
              handle: m.contentHandle,
              contractAddress: CONTRACT_ADDRESSES.messageStore,
            })),
            DECRYPT_SESSION_CONTRACTS,
          );
          for (const [handle, raw] of result) {
            handleCache.set(handle, raw);
          }
          persistHandleCache(handleCache);

          setMessages((prev) => {
            let changed = false;
            const next = prev.map((m) => {
              if (!m.contentHandle || m.decryptedBytes) return m;
              const raw = handleCache.get(m.contentHandle);
              if (!raw) return m;
              changed = true;
              return { ...m, decryptedBytes: raw };
            });
            return changed ? next : prev;
          });
        } catch (err) {
          // Surface only catastrophic failures (rate-limit / relayer down).
          // Per-bubble retry button still works for one-off failures.
          const lower = (err instanceof Error ? err.message : String(err)).toLowerCase();
          if (!lower.includes("429") && !lower.includes("too many requests")) {
            setError(classifyError(err).message);
          }
        } finally {
          setIsDecryptingMore(false);
        }
      }
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
      try {
        if (!address || !walletClient) throw new Error("wallet not connected");
        if (text.trim().length > MAX_MESSAGE_CHARS) {
          throw new Error(`Message must be ${MAX_MESSAGE_CHARS} characters or fewer.`);
        }

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
            .then(() => loadMessages({ preserveOptimistic: false }).catch(() => {}))
            .catch(() => {
              // Tx reverted on-chain — remove the optimistic bubble.
              setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
            });
        } else {
          const localPaymentId = -Date.now();
          const paymentTo = parsed.type === "send"
            ? (parsed.to || recipient)
            : parsed.type === "request"
              ? (parsed.from || recipient)
              : recipient;
          const paymentNote = parsed.type === "send" || parsed.type === "request" ? parsed.note : "";
          const localPaymentPayload =
            parsed.type === "send"
              ? serializePaymentReceipt({
                  amount: parsed.amount,
                  token: parsed.token,
                  to: paymentTo,
                  note: paymentNote,
                })
              : parsed.type === "request"
                ? serializePaymentRequest({
                    requestId: "pending",
                    amount: parsed.amount,
                    token: parsed.token,
                    requester: address,
                    payer: paymentTo,
                    note: paymentNote,
                  })
                : "";

          if (parsed.type === "send" || parsed.type === "request") {
            const optimisticMsg: MessageData = {
              id: localPaymentId,
              sender: address,
              recipient: paymentTo,
              timestamp: Math.floor(Date.now() / 1000),
              messageType: 0,
              storageType: 0,
              contentHandle: "",
              threadId: 0,
              decryptedBytes: new TextEncoder().encode(localPaymentPayload),
              pendingState: "encrypting",
              localOnly: true,
            };
            setMessages((prev) => [...prev, optimisticMsg]);
          }

          try {
            setSendState("confirming");
            await _handleSlashCommand(parsed, recipient, address, walletClient);

            if (parsed.type === "send" || parsed.type === "request") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === localPaymentId
                    ? { ...m, pendingState: undefined, timestamp: Math.floor(Date.now() / 1000) }
                    : m,
                ),
              );
            }

            setSendState("done");
            setTimeout(() => setSendState("idle"), 1500);
            loadMessages({ preserveOptimistic: false }).catch(() => {});
          } catch (err) {
            if (parsed.type === "send" || parsed.type === "request") {
              setMessages((prev) => prev.filter((m) => m.id !== localPaymentId));
            }
            setSendState("idle");
            throw err;
          }
        }
      } catch (err) {
        throw classifyError(err);
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

  const payRequest = useCallback(async (req: PaymentRequestPayload) => {
    if (!address || !walletClient) throw new Error("wallet not connected");
    if (req.token.toUpperCase() !== "ETH") {
      throw new Error("Only ETH requests are currently payable.");
    }

    const provider = walletClientToBrowserProvider(walletClient);
    const signer   = await provider.getSigner();

    const payRouter = new Contract(CONTRACT_ADDRESSES.paymentRouter, PAYMENT_ROUTER_ABI, signer);
    const amountWei = parseEther(req.amount);
    const noteText = (req.note.trim() || `Payment Sent for ${req.amount} ${req.token}`).slice(0, 32);
    const { amountHandle, noteHandle, inputProof } = await encryptPaymentRequest(
      CONTRACT_ADDRESSES.paymentRouter,
      amountWei,
      noteText,
      address,
    );
    const tx = await payRouter.fulfillRequestConfidential(
      BigInt(req.requestId),
      amountHandle,
      noteHandle,
      inputProof,
      { value: amountWei },
    );
    await tx.wait();

    // Emit a readable payment receipt in-thread so both sides see completion details.
    const receiptText = serializePaymentReceipt({
      amount: req.amount,
      token: req.token,
      to: req.requester,
      note: req.note || `Payment Sent for ${req.amount} ${req.token}`,
    });
    const encoded  = new TextEncoder().encode(receiptText);
    const cid      = await uploadToIpfs(encoded);
    const cidBytes = cidToBytes32(cid);
    const receiptEnc = await encryptIpfsCid(CONTRACT_ADDRESSES.messageStore, cidBytes, address);
    const msgStore = new Contract(CONTRACT_ADDRESSES.messageStore, MESSAGE_STORE_ABI, signer);
    const receiptTx = await msgStore.sendMessage(req.requester, receiptEnc.handle, receiptEnc.inputProof, 0, 1);
    await receiptTx.wait();

    await loadMessages({ preserveOptimistic: false });
  }, [address, walletClient, loadMessages]);

  const decryptMore = useCallback(() => {
    setDecryptBudget((prev) => prev + AUTO_DECRYPT_CHUNK);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendState,
    sendMessage,
    markRead,
    burnMessage,
    payRequest,
    decryptMore,
    canDecryptMore,
    isDecryptingMore,
    reload: loadMessages,
  };
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
  let useSessionKey = sessionWallet !== null;

  // Fast-path fallback: if a stored session key has zero balance, skip it.
  if (useSessionKey && sessionWallet) {
    try {
      const sessionProvider = getSessionKeyProvider();
      const bal = await sessionProvider.getBalance(sessionWallet.address);
      if (bal === 0n) useSessionKey = false;
    } catch {
      // If balance check fails, still attempt session key once and then fallback on error.
    }
  }

  async function sendWithMode(mode: "session" | "main") {
    const effectiveSender = mode === "session" && sessionWallet ? sessionWallet.address : sender;

    // Parallelise signer resolution and proof generation for the chosen sender.
    const signerPromise = mode === "session" && sessionWallet
      ? Promise.resolve(sessionWallet.connect(getSessionKeyProvider()))
      : walletClientToBrowserProvider(walletClient).getSigner();

    const encryptPromise = requiresIpfs(text)
      ? (async () => {
          const encoded = new TextEncoder().encode(text);
          const cid = await uploadToIpfs(encoded);
          const cidBytes = cidToBytes32(cid);
          const enc = await encryptIpfsCid(
            CONTRACT_ADDRESSES.messageStore,
            cidBytes,
            effectiveSender,
          );
          return { ...enc, storageType: 1 as const };
        })()
      : encryptMessageContent(CONTRACT_ADDRESSES.messageStore, text, effectiveSender)
          .then((enc) => ({ ...enc, storageType: 0 as const }));

    const [signer, { handle, inputProof, storageType }] = await Promise.all([
      signerPromise,
      encryptPromise,
    ]);

    const contract = new Contract(CONTRACT_ADDRESSES.messageStore, MESSAGE_STORE_ABI, signer);
    return await contract.sendMessage(recipient, handle, inputProof, 0, storageType);
  }

  try {
    const tx = useSessionKey ? await sendWithMode("session") : await sendWithMode("main");
    onSubmitted();
    return tx;
  } catch (err) {
    // Automatic recovery for unfunded/underfunded session keys.
    if (useSessionKey && isInsufficientFundsError(err)) {
      const tx = await sendWithMode("main");
      onSubmitted();
      return tx;
    }
    throw err;
  }
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
    const noteText = parsed.note.trim() || `Sent ${parsed.amount} ${parsed.token}`;

    if (parsed.token !== "ETH") {
      throw new Error("/send currently supports ETH only.");
    }

    if (!to || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
      throw new Error("Please provide a valid recipient: /send <amount> ETH to 0x...");
    }

    const payRouter = new Contract(CONTRACT_ADDRESSES.paymentRouter, PAYMENT_ROUTER_ABI, signer);

    // Level 1 confidential send: encrypt amount (euint64) + note (euint256) together
    // in one createEncryptedInput call producing a single shared inputProof.
    // The ETH still transfers via msg.value; the encrypted amount is stored on-chain
    // so only sender and recipient can decrypt it via FHE userDecrypt.
    const amountWei = parseEther(parsed.amount);
    const { amountHandle, noteHandle, inputProof } = await encryptPaymentRequest(
      CONTRACT_ADDRESSES.paymentRouter,
      amountWei,
      noteText,
      sender,
    );

    const tx = await payRouter.sendETHConfidential(to, amountHandle, noteHandle, inputProof, { value: amountWei });
    await tx.wait();

    // After the ETH transfer, send a readable payment receipt as a regular FHE-encrypted
    // message (msgType=0) so both sender and recipient can decrypt and see the payment bubble.
    // The receipt JSON always exceeds 32 bytes so always use the IPFS path.
    const receiptText = serializePaymentReceipt({
      amount: parsed.amount,
      token: parsed.token,
      to,
      note: noteText,
    });
    const encoded  = new TextEncoder().encode(receiptText);
    const cid      = await uploadToIpfs(encoded);
    const cidBytes = cidToBytes32(cid);
    const receiptEnc = await encryptIpfsCid(CONTRACT_ADDRESSES.messageStore, cidBytes, sender);
    const msgStore = new Contract(CONTRACT_ADDRESSES.messageStore, MESSAGE_STORE_ABI, signer);
    const receiptTx = await msgStore.sendMessage(to, receiptEnc.handle, receiptEnc.inputProof, 0, 1);
    await receiptTx.wait();
    return;
  }

  if (parsed.type === "request") {
    const from = parsed.from || recipient; // default to current chat recipient
    const payRouter = new Contract(CONTRACT_ADDRESSES.paymentRouter, PAYMENT_ROUTER_ABI, signer);

    const amountWei = parseEther(parsed.amount);
    const noteText  = (parsed.note.trim() || `Requesting ${parsed.amount} ${parsed.token}`).slice(0, 32);

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
    const receipt = await tx.wait();

    let requestId: string | null = null;
    for (const log of receipt.logs) {
      try {
        const parsedLog = payRouter.interface.parseLog(log);
        if (parsedLog?.name === "RequestCreated") {
          requestId = parsedLog.args.requestId.toString();
          break;
        }
      } catch {
        // skip non-PaymentRouter logs
      }
    }
    if (!requestId) {
      throw new Error("Request created but request id could not be resolved from receipt logs.");
    }

    // Publish a readable request payload bubble so recipient gets a "Pay" action UI.
    const requestPayload = serializePaymentRequest({
      requestId,
      amount: parsed.amount,
      token: parsed.token,
      requester: sender,
      payer: from,
      note: parsed.note.trim(),
    });
    const encoded  = new TextEncoder().encode(requestPayload);
    const cid      = await uploadToIpfs(encoded);
    const cidBytes = cidToBytes32(cid);
    const requestEnc = await encryptIpfsCid(CONTRACT_ADDRESSES.messageStore, cidBytes, sender);
    const msgStore = new Contract(CONTRACT_ADDRESSES.messageStore, MESSAGE_STORE_ABI, signer);
    const requestMsgTx = await msgStore.sendMessage(from, requestEnc.handle, requestEnc.inputProof, 0, 1);
    await requestMsgTx.wait();
    return;
  }

  throw new Error(`Unknown command: /${parsed.type}`);
}

function serializePaymentReceipt(input: {
  amount: string;
  token: string;
  to: string;
  note: string;
}): string {
  return `__payv1__${JSON.stringify(input)}`;
}

function serializePaymentRequest(input: PaymentRequestPayload): string {
  return `__reqv1__${JSON.stringify(input)}`;
}
