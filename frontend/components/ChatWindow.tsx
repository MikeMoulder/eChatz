"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { useAccount, useEnsName } from "wagmi";
import { MessageInput } from "./MessageInput";
import { MessageBubble, type MessageData } from "./MessageBubble";
import { Sidebar, type ThreadEntry } from "./Sidebar";
import { AddressBadge } from "./AddressBadge";
import { MessageSkeleton } from "./Skeleton";
import { ArrowLeftIcon, CheckIcon, LockIcon, MoreIcon, ShieldIcon, TerminalIcon, ZapIcon } from "./Icons";
import { useMessages, type SendState } from "@/hooks/useMessages";
import { useInbox } from "@/hooks/useInbox";
import { formatDateLabel, isAddressLike, isEnsLike, shortAddress } from "@/lib/format";
import { DECRYPT_SESSION_CONTRACTS } from "@/lib/contracts";
import { authorizeDecryptSession, hasDecryptSession } from "@/lib/relayer";

const RECENTS_KEY = "echatz:recent-threads";

export function ChatWindow() {
  const { address } = useAccount();
  const [recipient, setRecipient] = useState<string>("");
  const [recents, setRecents] = useState<string[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [unlockingDecrypt, setUnlockingDecrypt] = useState(false);
  const [decryptUnlocked, setDecryptUnlocked] = useState(false);
  const [decryptUnlockError, setDecryptUnlockError] = useState<string | null>(null);

  const { messages, isLoading, error: messagesError, sendState, sendMessage, markRead, burnMessage, reload } = useMessages(recipient);
  const { threads: inboxThreads } = useInbox();

  // Track seen message counts to compute unread badges
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      if (raw) setRecents(JSON.parse(raw));
    } catch {}
    setDecryptUnlocked(hasDecryptSession(DECRYPT_SESSION_CONTRACTS));
  }, []);

  async function unlockDecryptSession() {
    setUnlockingDecrypt(true);
    setDecryptUnlockError(null);
    try {
      await authorizeDecryptSession(DECRYPT_SESSION_CONTRACTS);
      setDecryptUnlocked(true);
      reload();
    } catch (err) {
      setDecryptUnlockError(err instanceof Error ? err.message : "failed to unlock decrypt session");
    } finally {
      setUnlockingDecrypt(false);
    }
  }

  useEffect(() => {
    if (!recipient) return;
    setRecents((prev) => {
      const next = [recipient, ...prev.filter((r) => r.toLowerCase() !== recipient.toLowerCase())].slice(0, 30);
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    setMobileSidebarOpen(false);
    // Mark as seen when opening the thread
    const t = inboxThreads.find((t) => t.peerAddress.toLowerCase() === recipient.toLowerCase());
    if (t) setSeenCounts((prev) => ({ ...prev, [t.peerAddress.toLowerCase()]: t.messageCount }));
  }, [recipient]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge subgraph inbox with localStorage recents so recipient sees incoming threads
  const threads: ThreadEntry[] = useMemo(() => {
    const map = new Map<string, ThreadEntry>();

    // Subgraph threads come first (they have real unread counts and lastActivity)
    for (const t of inboxThreads) {
      const key = t.peerAddress.toLowerCase();
      const seen = seenCounts[key] ?? 0;
      const unread = key === recipient.toLowerCase() ? 0 : Math.max(0, t.messageCount - seen);
      map.set(key, {
        address: t.peerAddress,
        ens: isEnsLike(t.peerAddress) ? t.peerAddress : null,
        unread: unread > 0 ? unread : undefined,
      });
    }

    // Fill in any locally-opened threads not yet in the subgraph
    for (const addr of recents) {
      const key = addr.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { address: addr, ens: isEnsLike(addr) ? addr : null });
      }
    }

    return Array.from(map.values());
  }, [inboxThreads, recents, seenCounts, recipient]);

  function handleNewChat(input: string) {
    const trimmed = input.trim();
    if (!isAddressLike(trimmed) && !isEnsLike(trimmed)) return;
    setRecipient(trimmed);
  }

  return (
    <div className="grid h-[100dvh] grid-cols-1 md:grid-cols-[300px_1fr]">
      <div className="hidden md:block">
        <Sidebar threads={threads} activeAddress={recipient} onSelect={setRecipient} onNewChat={handleNewChat} />
      </div>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={() => setMobileSidebarOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-0 h-full w-[88%] max-w-[340px] animate-fade-in-up">
            <Sidebar
              threads={threads}
              activeAddress={recipient}
              onSelect={setRecipient}
              onNewChat={handleNewChat}
              onClose={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <main className="flex min-w-0 flex-col overflow-hidden">
        {recipient ? (
          <ThreadPane
            recipient={recipient}
            messages={messages}
            isLoading={isLoading}
            loadError={messagesError}
            sendState={sendState}
            address={address}
            onBack={() => setRecipient("")}
            onOpenMenu={() => setMobileSidebarOpen(true)}
            onSend={sendMessage}
            onMarkRead={markRead}
            onBurn={burnMessage}
            onReload={reload}
            decryptUnlocked={decryptUnlocked}
            decryptUnlockError={decryptUnlockError}
            unlockingDecrypt={unlockingDecrypt}
            onUnlockDecrypt={unlockDecryptSession}
          />
        ) : (
          <ConversationEmptyState
            onOpenMenu={() => setMobileSidebarOpen(true)}
            decryptUnlocked={decryptUnlocked}
            unlockingDecrypt={unlockingDecrypt}
            onUnlockDecrypt={unlockDecryptSession}
          />
        )}
      </main>
    </div>
  );
}

function ThreadPane({
  recipient,
  messages,
  isLoading,
  loadError,
  sendState,
  address,
  onBack,
  onOpenMenu,
  onSend,
  onMarkRead,
  onBurn,
  onReload,
  decryptUnlocked,
  decryptUnlockError,
  unlockingDecrypt,
  onUnlockDecrypt,
}: {
  recipient: string;
  messages: MessageData[];
  isLoading: boolean;
  loadError: string | null;
  sendState: SendState;
  address?: string;
  onBack: () => void;
  onOpenMenu: () => void;
  onSend: (text: string) => Promise<void>;
  onMarkRead: (id: number) => Promise<void>;
  onBurn: (id: number) => Promise<void>;
  onReload: () => void;
  decryptUnlocked: boolean;
  decryptUnlockError: string | null;
  unlockingDecrypt: boolean;
  onUnlockDecrypt: () => void;
}) {
  const groups = useMemo(() => groupByDay(messages), [messages]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Resolve ENS name for the recipient — displayed in the chat header.
  // ENS registry lives on mainnet regardless of which chain we're chatting on.
  const isRawAddress = isAddressLike(recipient);
  const { data: ensName } = useEnsName({
    address: isRawAddress ? (recipient as `0x${string}`) : undefined,
    chainId: 1,
  });
  const recipientDisplay = ensName ?? (isEnsLike(recipient) ? recipient : null);

  // Scroll to bottom whenever messages update or a new send completes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sendState]);

  return (
    <>
      {/* Thread header — dense, technical */}
      <header className="border-b border-line bg-bg-1">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onOpenMenu}
              className="grid h-8 w-8 place-items-center text-ink-2 hover:bg-white/5 hover:text-ink-1 md:hidden"
              aria-label="Open conversations"
            >
              <ArrowLeftIcon size={14} />
            </button>
            <button
              type="button"
              onClick={onBack}
              className="hidden h-8 w-8 place-items-center text-ink-2 hover:bg-white/5 hover:text-ink-1 md:grid"
              aria-label="Back to conversations"
            >
              <ArrowLeftIcon size={14} />
            </button>

            <AddressBadge address={recipient} ens={recipientDisplay} size="md" copy />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUnlockDecrypt}
              disabled={decryptUnlocked || unlockingDecrypt}
              className={`hidden h-8 items-center gap-2 border px-3 font-mono text-[10px] uppercase tracking-wider transition-colors md:inline-flex ${
                decryptUnlocked
                  ? "border-line bg-bg-2 text-ok"
                  : "border-accent/40 bg-accent-soft text-accent-bright hover:border-accent"
              } disabled:cursor-default`}
              title="Authorize one decrypt session signature for all message handles"
            >
              <LockIcon size={11} />
              {decryptUnlocked ? "unlocked" : unlockingDecrypt ? "unlocking" : "unlock once"}
            </button>
            <span className="chip chip-accent">
              <LockIcon size={11} /> Encrypted
            </span>
            <button
              type="button"
              className="hidden h-8 w-8 place-items-center text-ink-2 hover:bg-white/5 hover:text-ink-1 md:grid"
              aria-label="Thread options"
            >
              <MoreIcon size={14} />
            </button>
          </div>
        </div>

        {/* Tech meta strip */}
        <div className="hidden md:flex items-center justify-between border-t border-line bg-bg-0 px-6 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
          <span>thread / {recipientDisplay ?? shortAddress(recipient)}</span>
          <span className="flex items-center gap-4">
            <span>msg · {messages.length}</span>
            <span>storage · euint256 / ipfs</span>
            <span>cipher · TFHE</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-ok animate-pulse-soft" />
            live · sepolia
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="relative flex-1 overflow-y-auto bg-bg-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1.5 px-4 py-6 md:px-8">
          {decryptUnlockError && (
            <div className="mb-2 border border-danger/30 bg-danger/10 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-danger animate-fade-in">
              {decryptUnlockError}
            </div>
          )}

          {isLoading && (
            <div className="space-y-3">
              <MessageSkeleton side="left" />
              <MessageSkeleton side="right" />
              <MessageSkeleton side="left" />
            </div>
          )}

          {!isLoading && loadError && (
            <div className="flex flex-col items-center gap-3 py-10 animate-fade-in">
              <p className="font-mono text-[11px] uppercase tracking-wider text-danger text-center max-w-xs">
                {loadError}
              </p>
              <button
                type="button"
                onClick={onReload}
                className="btn-ghost h-8 px-3 text-[12px] font-mono"
              >
                retry
              </button>
            </div>
          )}

          {!isLoading && !loadError && messages.length === 0 && <FreshThreadHero recipient={recipient} />}

          {!isLoading &&
            groups.map((g, gi) => (
              <div key={gi} className="space-y-1.5">
                <div className="flex items-center gap-3 py-3">
                  <span className="h-px flex-1 bg-line" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
                    {formatDateLabel(g.day)}
                  </span>
                  <span className="h-px flex-1 bg-line" />
                </div>
                {g.items.map((m, idx) => {
                  const next = g.items[idx + 1];
                  const isSelf = address ? m.sender.toLowerCase() === address.toLowerCase() : false;
                  const showTail = !next || next.sender !== m.sender;
                  return (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      isSelf={isSelf}
                      showTail={showTail}
                      onMarkRead={() => onMarkRead(m.id)}
                      onBurn={() => onBurn(m.id)}
                    />
                  );
                })}
              </div>
            ))}

          {sendState !== "idle" && <SendStateBar state={sendState} />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-line bg-bg-1 px-3 py-3 md:px-6 md:py-4">
        <div className="mx-auto w-full max-w-3xl">
          <MessageInput recipient={recipient} onSend={onSend} />
        </div>
      </div>
    </>
  );
}

function FreshThreadHero({ recipient }: { recipient: string }) {
  return (
    <div className="mx-auto my-12 max-w-md text-center animate-fade-in-up">
      <div className="relative mx-auto inline-block">
        <span className="corner-tl" />
        <span className="corner-tr" />
        <span className="corner-bl" />
        <span className="corner-br" />
        <div className="grid h-14 w-14 place-items-center bg-accent text-accent-ink">
          <LockIcon size={22} strokeWidth={2.4} />
        </div>
      </div>

      <h3 className="mt-6 font-display text-xl font-semibold tracking-tighter">
        Say hello, in private.
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
        This thread with{" "}
        <span className="font-mono text-ink-1">
          {isEnsLike(recipient) ? recipient : `${recipient.slice(0, 6)}…${recipient.slice(-4)}`}
        </span>{" "}
        is end-to-end encrypted on Zama fhEVM. Only the two of you can read it.
      </p>

      <div className="mt-6 grid gap-px bg-line text-left">
        <div className="bg-bg-2 p-3.5 flex items-start gap-3">
          <ShieldIcon size={14} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[12px] text-ink-2 leading-relaxed">
            A single ciphertext is ACL-granted to both participants for private thread history.
          </p>
        </div>
        <div className="bg-bg-2 p-3.5 flex items-start gap-3">
          <TerminalIcon size={14} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[12px] text-ink-2 leading-relaxed">
            Type <code className="font-mono text-ink-0 bg-bg-3 px-1 py-px">/</code> in the composer
            to use slash commands like <code className="font-mono text-accent-bright">/send</code>{" "}
            and <code className="font-mono text-accent-bright">/vote</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConversationEmptyState({
  onOpenMenu,
  decryptUnlocked,
  unlockingDecrypt,
  onUnlockDecrypt,
}: {
  onOpenMenu: () => void;
  decryptUnlocked: boolean;
  unlockingDecrypt: boolean;
  onUnlockDecrypt: () => void;
}) {
  return (
    <div className="relative grid h-full place-items-center px-6 py-12">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" aria-hidden />
      <div className="relative mx-auto max-w-md text-center animate-fade-in-up">
        <div className="relative mx-auto inline-block">
          <span className="corner-tl" />
          <span className="corner-tr" />
          <span className="corner-bl" />
          <span className="corner-br" />
          <div className="grid h-14 w-14 place-items-center bg-bg-3 border border-line text-accent">
            <LockIcon size={22} strokeWidth={2} />
          </div>
        </div>
        <h2 className="mt-6 font-display text-2xl font-semibold tracking-tightest">
          Pick a thread.
        </h2>
        <p className="mt-2 max-w-sm text-[13px] text-ink-2">
          Choose an existing conversation on the left, or start a new one with any 0x address or
          ENS name. Everything happens at the smart-contract layer — there is no server in
          between.
        </p>
        <button
          type="button"
          onClick={onOpenMenu}
          className="btn-accent mt-6 h-10 px-4 text-[13px] md:hidden"
        >
          Browse threads
        </button>
        <button
          type="button"
          onClick={onUnlockDecrypt}
          disabled={decryptUnlocked || unlockingDecrypt}
          className="btn-ghost mt-3 h-10 px-4 text-[12px] font-mono uppercase tracking-wider"
        >
          {decryptUnlocked ? "decrypt session unlocked" : unlockingDecrypt ? "unlocking decrypt session" : "unlock decrypt session"}
        </button>

        <div className="mt-10 grid grid-cols-3 gap-px bg-line">
          {[
            ["MSGS", messagesPlaceholder()],
            ["KEYS", "65 b"],
            ["GAS", "L2"],
          ].map(([k, v]) => (
            <div key={k} className="bg-bg-2 p-3">
              <div className="font-mono text-[9px] uppercase tracking-widest text-ink-3">{k}</div>
              <div className="font-display text-base font-semibold mt-1">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SendStateBar({ state }: { state: SendState }) {
  const configs = {
    encrypting: { label: "Encrypting message…", icon: <ZapIcon size={11} />, pulse: true },
    confirming: { label: "Transaction submitted — waiting for confirmation…", icon: <ZapIcon size={11} />, pulse: true },
    done:       { label: "Message confirmed", icon: <CheckIcon size={11} strokeWidth={2.5} />, pulse: false },
  } as const;

  const cfg = configs[state as keyof typeof configs];
  if (!cfg) return null;

  return (
    <div className={`flex items-center justify-end gap-2 animate-fade-in ${state === "done" ? "text-ok" : "text-accent-bright"}`}>
      <span className={state !== "done" ? "animate-pulse-soft" : ""}>{cfg.icon}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{cfg.label}</span>
    </div>
  );
}

function messagesPlaceholder() {
  if (typeof window === "undefined") return "—";
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (raw) return String(JSON.parse(raw).length || 0);
  } catch {}
  return "0";
}

function groupByDay(messages: MessageData[]): { day: number; items: MessageData[] }[] {
  if (messages.length === 0) return [];
  const out: { day: number; items: MessageData[] }[] = [];
  let cur: { day: number; items: MessageData[] } | null = null;
  for (const m of messages) {
    const d = new Date(m.timestamp * 1000);
    d.setHours(0, 0, 0, 0);
    const key = Math.floor(d.getTime() / 1000);
    if (!cur || cur.day !== key) {
      cur = { day: key, items: [] };
      out.push(cur);
    }
    cur.items.push(m);
  }
  return out;
}
