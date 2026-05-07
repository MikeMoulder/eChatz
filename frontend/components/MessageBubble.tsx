"use client";

import { useState, useEffect, useRef } from "react";
import { decryptMessageContent } from "@/lib/relayer";
import { fetchFromIpfs, bytes32ToCid } from "@/lib/ipfs";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { formatTimeOfDay } from "@/lib/format";
import { CheckIcon, FlameIcon, LockIcon, MoreIcon, CopyIcon } from "./Icons";

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
}

interface Props {
  message: MessageData;
  isSelf: boolean;
  showTail?: boolean;
  onMarkRead: () => void;
  onBurn: () => void;
}

export function MessageBubble({
  message,
  isSelf,
  showTail = true,
  onMarkRead,
  onBurn,
}: Props) {
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptErr, setDecryptErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    decrypt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.contentHandle, message.decryptedBytes]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  async function decrypt() {
    if (decrypting || decrypted !== null) return;

    // Fast path: pre-decrypted bytes are available (optimistic message or batch decrypt).
    // This handles optimistic messages where contentHandle is empty but bytes are already known.
    if (message.decryptedBytes) {
      try {
        const raw = message.decryptedBytes;
        if (message.storageType === 1) {
          const cid = bytes32ToCid(raw.slice(0, 32));
          const ipfsBytes = await fetchFromIpfs(cid);
          setDecrypted(new TextDecoder().decode(ipfsBytes));
        } else {
          const end = raw.findIndex((b) => b === 0);
          const trimmed = raw.slice(0, end === -1 ? raw.length : end);
          setDecrypted(new TextDecoder().decode(trimmed));
        }
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

      if (message.storageType === 1) {
        const cid = bytes32ToCid(raw.slice(0, 32));
        const ipfsBytes = await fetchFromIpfs(cid);
        setDecrypted(new TextDecoder().decode(ipfsBytes));
      } else {
        const end = raw.findIndex((b) => b === 0);
        const trimmed = raw.slice(0, end === -1 ? raw.length : end);
        setDecrypted(new TextDecoder().decode(trimmed));
      }
    } catch (err) {
      setDecryptErr(err instanceof Error ? err.message : "decryption failed");
    } finally {
      setDecrypting(false);
    }
  }

  const isSystemMsg = message.messageType !== 0;
  const ts = formatTimeOfDay(message.timestamp);

  if (isSystemMsg) {
    return (
      <div className="flex justify-center py-1.5 animate-fade-in">
        <span className="chip">
          <LockIcon size={11} /> system · {ts}
        </span>
      </div>
    );
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

          {!decrypting && decryptErr && (
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

          {!decrypting && decrypted !== null && (
            <p className="whitespace-pre-wrap break-words text-[14px] leading-snug">{decrypted}</p>
          )}

          {/* Inline footer */}
          <div
            className={`mt-1 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-wider ${
              isSelf ? "justify-end text-accent-ink/70" : "justify-start text-ink-3"
            }`}
          >
            <span className="tabular-nums">{ts}</span>
            <span>·</span>
            <span>{message.storageType === 1 ? "ipfs" : "on-chain"}</span>
            {message.pendingState ? (
              <>
                <span>·</span>
                <span className="animate-pulse-soft">pending</span>
              </>
            ) : (!decrypting && !decryptErr && decrypted !== null && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5">
                  <LockIcon size={9} /> decrypted
                </span>
              </>
            ))}
          </div>
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
