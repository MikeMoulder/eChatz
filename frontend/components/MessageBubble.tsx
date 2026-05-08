"use client";

import { memo, useState, useEffect, useRef } from "react";
import { BrowserProvider, Contract } from "ethers";
import { decryptMessageContent } from "@/lib/relayer";
import { fetchFromIpfs, bytes32ToCid } from "@/lib/ipfs";
import { CONTRACT_ADDRESSES, PAYMENT_ROUTER_ABI } from "@/lib/contracts";
import { formatTimeOfDay, shortAddress } from "@/lib/format";
import { CheckIcon, FlameIcon, LockIcon, MoreIcon, CopyIcon, SendIcon, ArrowRightIcon } from "./Icons";

export interface MessageData {
  id: number;
  sender: string;
  recipient: string;
  timestamp: number;
  messageType: number;
  storageType: number;
  contentHandle: string;
  threadId: number;
  decryptedBytes?: Uint8Array; // pre-decrypted by batch in useMessages; skips per-bubble signing
  /** Present only on optimistic (locally-appended) messages while the tx is in-flight. */
  pendingState?: "encrypting" | "confirming";
  /** Local-only synthetic bubbles (not sourced from chain indexers). */
  localOnly?: boolean;
}

interface Props {
  message: MessageData;
  isSelf: boolean;
  showTail?: boolean;
  onMarkRead: () => void;
  onBurn: () => void;
  onPayRequest?: (req: PaymentRequestPayload) => Promise<void>;
}

interface PaymentRequestPayload {
  requestId: string;
  amount: string;
  token: string;
  requester: string;
  payer: string;
  note: string;
}

export const MessageBubble = memo(MessageBubbleImpl, (prev, next) =>
  prev.message === next.message &&
  prev.isSelf === next.isSelf &&
  prev.showTail === next.showTail,
);

function MessageBubbleImpl({
  message,
  isSelf,
  showTail = true,
  onMarkRead,
  onBurn,
  onPayRequest,
}: Props) {
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptErr, setDecryptErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [requestPaid, setRequestPaid] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!message.decryptedBytes) return;
    if (decrypted !== null || decrypting) return;
    void decodeAndSet(message.decryptedBytes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.decryptedBytes, message.storageType]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  async function decodeAndSet(raw: Uint8Array) {
    if (message.storageType === 1) {
      const cid = bytes32ToCid(raw.slice(0, 32));
      const ipfsBytes = await fetchFromIpfs(cid);
      setDecryptErr(null);
      setDecrypted(new TextDecoder().decode(ipfsBytes));
    } else {
      const end = raw.findIndex((b) => b === 0);
      const trimmed = raw.slice(0, end === -1 ? raw.length : end);
      setDecryptErr(null);
      setDecrypted(new TextDecoder().decode(trimmed));
    }
  }

  async function decrypt() {
    if (decrypting || decrypted !== null) return;

    // Fast path: pre-decrypted bytes are available (optimistic message or batch decrypt).
    if (message.decryptedBytes) {
      try {
        await decodeAndSet(message.decryptedBytes);
      } catch (err) {
        setDecryptErr(err instanceof Error ? err.message : "decryption failed");
      }
      return;
    }

    if (!message.contentHandle) return;
    setDecrypting(true);
    setDecryptErr(null);
    try {
      const raw = await decryptMessageContent(message.contentHandle, CONTRACT_ADDRESSES.messageStore);
      await decodeAndSet(raw);
    } catch (err) {
      setDecryptErr(err instanceof Error ? err.message : "decryption failed");
    } finally {
      setDecrypting(false);
    }
  }

  const ts = formatTimeOfDay(message.timestamp);
  const payment = parsePaymentPayload(decrypted);
  const paymentRequest = parsePaymentRequestPayload(decrypted);

  useEffect(() => {
    let cancelled = false;
    if (!paymentRequest || !message.contentHandle) return;

    (async () => {
      try {
        if (typeof window === "undefined" || !window.ethereum) return;
        const provider = new BrowserProvider(window.ethereum);
        const payRouter = new Contract(CONTRACT_ADDRESSES.paymentRouter, PAYMENT_ROUTER_ABI, provider);
        const req = await payRouter.paymentRequests(BigInt(paymentRequest.requestId));
        if (!cancelled) setRequestPaid(Boolean(req.fulfilled));
      } catch {
        // Non-fatal: bubble still allows user to attempt pay.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paymentRequest?.requestId, message.contentHandle]);

  async function handlePayRequest() {
    if (!paymentRequest || !onPayRequest || requestPaid || isPaying) return;
    setPayErr(null);
    setIsPaying(true);
    try {
      await onPayRequest(paymentRequest);
      setRequestPaid(true);
    } catch (err) {
      setPayErr(err instanceof Error ? err.message : "payment failed");
    } finally {
      setIsPaying(false);
    }
  }

  const sentClasses = "bg-accent text-accent-ink border border-accent";
  const receivedClasses = "bg-bg-2 border border-line text-ink-1";

  return (
    <div className={`group flex animate-fade-in-up ${isSelf ? "justify-end" : "justify-start"}`}>
      <div className="relative max-w-[78%] sm:max-w-[68%]">
        {/* Sender label on first bubble of a sequence */}
        {showTail && !isSelf && (
          <div className="mb-1 ml-0.5 font-mono text-[10px] tracking-wider text-ink-3">
            #{String(message.id).padStart(4, "0")}
          </div>
        )}

        <div className={`px-3.5 py-2 ${isSelf ? sentClasses : receivedClasses}`}>
          {/* Body */}
          {/* Pending phase badge — shown on optimistic bubbles before tx confirms */}
          {message.pendingState && (
            <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wider text-accent-ink/70 animate-pulse-soft">
              <span className="h-1.5 w-1.5 bg-accent-ink/50" />
              {message.pendingState === "encrypting" ? "encrypting…" : "confirming…"}
            </div>
          )}

          {decrypting && (
            <div className="flex items-center gap-2 py-1">
              <span className={`skeleton h-3 w-32 ${isSelf ? "bg-accent-ink/10" : ""}`} />
            </div>
          )}

          {!decrypting && decrypted === null && decryptErr && (
            <div className="space-y-1">
              <p
                className={`text-[13px] italic ${
                  isSelf ? "text-accent-ink/70" : "text-ink-3"
                }`}
              >
                content unavailable
              </p>
              <button
                onClick={decrypt}
                className={`font-mono text-[10px] uppercase tracking-wider underline-offset-2 hover:underline ${
                  isSelf ? "text-accent-ink/70" : "text-ink-2"
                }`}
              >
                retry decryption
              </button>
            </div>
          )}

          {!decrypting && decrypted === null && !decryptErr && message.contentHandle && (
            <div className="space-y-1">
              <p
                className={`text-[13px] italic ${
                  isSelf ? "text-accent-ink/70" : "text-ink-3"
                }`}
              >
                encrypted message
              </p>
              <button
                onClick={decrypt}
                className={`font-mono text-[10px] uppercase tracking-wider underline-offset-2 hover:underline ${
                  isSelf ? "text-accent-ink/70" : "text-ink-2"
                }`}
              >
                decrypt now
              </button>
            </div>
          )}

          {!decrypting && decrypted !== null && (
            <div className="mt-0.5">
              {payment ? (
                <div className={`relative overflow-hidden border px-3 py-2 ${
                  isSelf
                    ? "border-accent-ink/30 bg-accent-ink/10"
                    : "border-line bg-bg-3"
                }`}>
                  <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-accent/20 blur-xl" />
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`font-mono text-[10px] uppercase tracking-[0.16em] ${
                        isSelf ? "text-accent-ink/75" : "text-ink-3"
                      }`}>
                        encrypted payment
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[15px] font-semibold leading-none">
                        <SendIcon size={13} /> {payment.amount} {payment.token}
                      </div>
                      <div className={`mt-1 inline-flex items-center gap-1 font-mono text-[10px] ${
                        isSelf ? "text-accent-ink/70" : "text-ink-3"
                      }`}>
                        <ArrowRightIcon size={10} /> {shortAddress(payment.to, 6, 4)}
                      </div>
                      {payment.note ? (
                        <div className={`mt-1.5 text-[12px] ${
                          isSelf ? "text-accent-ink/90" : "text-ink-2"
                        }`}>
                          "{payment.note}"
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : paymentRequest ? (
                <div className={`relative overflow-hidden border px-3 py-2 ${
                  isSelf
                    ? "border-accent-ink/30 bg-accent-ink/10"
                    : "border-line bg-bg-3"
                }`}>
                  <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-accent/20 blur-xl" />
                  <div className="relative space-y-2">
                    <div className={`font-mono text-[10px] uppercase tracking-[0.16em] ${
                      isSelf ? "text-accent-ink/75" : "text-ink-3"
                    }`}>
                      payment request
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[15px] font-semibold leading-none">
                      <SendIcon size={13} className="scale-x-[-1]" /> {paymentRequest.amount} {paymentRequest.token}
                    </div>
                    <div className={`inline-flex items-center gap-1 font-mono text-[10px] ${
                      isSelf ? "text-accent-ink/70" : "text-ink-3"
                    }`}>
                      <ArrowRightIcon size={10} /> {shortAddress(paymentRequest.payer, 6, 4)} → {shortAddress(paymentRequest.requester, 6, 4)}
                    </div>
                    {paymentRequest.note ? (
                      <div className={`text-[12px] ${
                        isSelf ? "text-accent-ink/90" : "text-ink-2"
                      }`}>
                        "{paymentRequest.note}"
                      </div>
                    ) : null}

                    {!isSelf && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={handlePayRequest}
                          disabled={requestPaid || isPaying}
                          className={`h-7 border px-2.5 font-mono text-[10px] uppercase tracking-wider ${
                            requestPaid
                              ? "border-ok/50 bg-ok/10 text-ok"
                              : "border-accent/50 bg-accent-soft text-accent-bright hover:border-accent"
                          } disabled:cursor-default disabled:opacity-90`}
                        >
                          {requestPaid ? "paid" : isPaying ? "paying..." : "pay"}
                        </button>
                        {payErr && (
                          <div className="mt-1 text-[11px] text-danger">{payErr}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words pb-0.5 text-[14px] leading-snug">
                  {decrypted}
                </p>
              )}
              <div className="mt-1 flex justify-end">
                <span
                  className={`pointer-events-none font-mono text-[9.5px] uppercase tracking-wider tabular-nums ${
                    isSelf ? "text-accent-ink/70" : "text-ink-3"
                  }`}
                >
                  {ts}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Hover-revealed action menu */}
        <div
          ref={menuRef}
          className={`absolute -top-3 ${
            isSelf ? "left-0 -translate-x-2" : "right-0 translate-x-2"
          } opacity-0 transition-opacity group-hover:opacity-100 ${menuOpen ? "opacity-100" : ""}`}
        >
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Message actions"
            className="grid h-7 w-7 place-items-center bg-bg-3 border border-line text-ink-2 hover:text-accent-bright"
          >
            <MoreIcon size={14} />
          </button>
          {menuOpen && (
            <div
              className={`absolute z-20 mt-1 w-44 surface p-1 animate-scale-in ${
                isSelf ? "left-0" : "right-0"
              }`}
            >
              {decrypted !== null && (
                <MenuItem
                  onClick={() => navigator.clipboard.writeText(decrypted)}
                  icon={<CopyIcon size={13} />}
                  label="Copy text"
                />
              )}
              {!isSelf && (
                <MenuItem onClick={onMarkRead} icon={<CheckIcon size={13} />} label="Mark read" />
              )}
              <MenuItem onClick={onBurn} icon={<FlameIcon size={13} />} label="Burn message" tone="danger" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function parsePaymentPayload(value: string | null): {
  amount: string;
  token: string;
  to: string;
  note: string;
} | null {
  if (!value || !value.startsWith("__payv1__")) return null;
  try {
    const parsed = JSON.parse(value.slice("__payv1__".length)) as {
      amount?: string;
      token?: string;
      to?: string;
      note?: string;
    };
    if (!parsed.amount || !parsed.token || !parsed.to) return null;
    return {
      amount: parsed.amount,
      token: parsed.token,
      to: parsed.to,
      note: parsed.note ?? "",
    };
  } catch {
    return null;
  }
}

function parsePaymentRequestPayload(value: string | null): PaymentRequestPayload | null {
  if (!value) return null;
  try {
    // Be robust to storage/decode artifacts (leading BOM/whitespace or wrapper text).
    const normalized = value.replace(/^\uFEFF/, "").trim();
    const marker = "__reqv1__";
    const markerPos = normalized.indexOf(marker);
    if (markerPos === -1) return null;

    const jsonStart = normalized.indexOf("{", markerPos + marker.length);
    if (jsonStart === -1) return null;

    const parsed = JSON.parse(normalized.slice(jsonStart)) as {
      requestId?: string | number;
      amount?: string;
      token?: string;
      requester?: string;
      payer?: string;
      note?: string;
    };
    if (!parsed.requestId || !parsed.amount || !parsed.token || !parsed.requester || !parsed.payer) {
      return null;
    }
    return {
      requestId: String(parsed.requestId),
      amount: parsed.amount,
      token: parsed.token,
      requester: parsed.requester,
      payer: parsed.payer,
      note: parsed.note ?? "",
    };
  } catch {
    return null;
  }
}

function MenuItem({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px] transition-colors ${
        tone === "danger" ? "text-danger hover:bg-danger/10" : "text-ink-1 hover:bg-bg-3"
      }`}
    >
      <span className={tone === "danger" ? "text-danger" : "text-ink-3"}>{icon}</span>
      {label}
    </button>
  );
}
