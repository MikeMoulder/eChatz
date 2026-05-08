"use client";

import { useEffect, useRef, useMemo, useState, Fragment } from "react";
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

// ── Last-read timestamp helpers (per wallet + per peer) ──────────────────────
function lrKey(my: string, peer: string) {
  return `echatz:lr:${my.toLowerCase()}:${peer.toLowerCase()}`;
}
function loadLastRead(my: string, peer: string): number {
  try { return Number(localStorage.getItem(lrKey(my, peer)) ?? "0"); }
  catch { return 0; }
}
function saveLastRead(my: string, peer: string, ts: number) {
  try { localStorage.setItem(lrKey(my, peer), String(ts)); }
  catch {}
}

export function ChatWindow() {
  const { address } = useAccount();
  const [recipient, setRecipient] = useState<string>("");
  const [recents, setRecents] = useState<string[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [unlockingDecrypt, setUnlockingDecrypt] = useState(false);
  const [decryptUnlocked, setDecryptUnlocked] = useState(false);
  const [decryptUnlockError, setDecryptUnlockError] = useState<string | null>(null);
  const [lastReadTs, setLastReadTs] = useState(0);

  const {
    messages,
    isLoading,
    error: messagesError,
    sendState,
    sendMessage,
    markRead,
    burnMessage,
    payRequest,
    decryptMore,
    canDecryptMore,
    isDecryptingMore,
    reload,
  } = useMessages(recipient);
  const { threads: inboxThreads } = useInbox();

  // Track seen message counts to compute unread badges
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      if (raw) setRecents(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    function refreshDecryptUnlocked() {
      if (unlockingDecrypt) return;
      setDecryptUnlocked(hasDecryptSession(DECRYPT_SESSION_CONTRACTS));
    }

    refreshDecryptUnlocked();

    function onVisibilityChange() {
      if (document.visibilityState === "visible") refreshDecryptUnlocked();
    }

    window.addEventListener("focus", refreshDecryptUnlocked);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshDecryptUnlocked);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [address, unlockingDecrypt]);

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
    // Load stored last-read timestamp for this thread
    if (address) setLastReadTs(loadLastRead(address, recipient));
    // Mark as seen when opening the thread
    const t = inboxThreads.find((t) => t.peerAddress.toLowerCase() === recipient.toLowerCase());
    if (t) setSeenCounts((prev) => ({ ...prev, [t.peerAddress.toLowerCase()]: t.messageCount }));
  }, [recipient]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMarkAllRead() {
    if (!recipient || !address) return;
    const now = Math.floor(Date.now() / 1000);
    saveLastRead(address, recipient, now);
    setLastReadTs(now);
    // Dismiss sidebar unread badge
    const t = inboxThreads.find((t) => t.peerAddress.toLowerCase() === recipient.toLowerCase());
    if (t) setSeenCounts((prev) => ({ ...prev, [t.peerAddress.toLowerCase()]: t.messageCount }));
  }

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
            key={recipient}
            recipient={recipient}
            messages={messages}
            isLoading={isLoading}
            loadError={messagesError}
            sendState={sendState}
            address={address}
            lastReadTs={lastReadTs}
            onMarkAllRead={handleMarkAllRead}
            onBack={() => setRecipient("")}
            onOpenMenu={() => setMobileSidebarOpen(true)}
            onSend={sendMessage}
            onMarkRead={markRead}
            onBurn={burnMessage}
            onPayRequest={payRequest}
            onDecryptMore={decryptMore}
            canDecryptMore={canDecryptMore}
            isDecryptingMore={isDecryptingMore}
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
  lastReadTs,
  onMarkAllRead,
  onBack,
  onOpenMenu,
  onSend,
  onMarkRead,
  onBurn,
  onPayRequest,
  onDecryptMore,
  canDecryptMore,
  isDecryptingMore,
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
  lastReadTs: number;
  onMarkAllRead: () => void;
  onBack: () => void;
  onOpenMenu: () => void;
  onSend: (text: string) => Promise<void>;
  onMarkRead: (id: number) => Promise<void>;
  onBurn: (id: number) => Promise<void>;
  onPayRequest: (request: {
    requestId: string;
    amount: string;
    token: string;
    requester: string;
    payer: string;
    note: string;
  }) => Promise<void>;
  onDecryptMore: () => void;
  canDecryptMore: boolean;
  isDecryptingMore: boolean;
  onReload: () => void;
  decryptUnlocked: boolean;
  decryptUnlockError: string | null;
  unlockingDecrypt: boolean;
  onUnlockDecrypt: () => void;
}) {
  const groups = useMemo(() => groupByDay(messages), [messages]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const unreadRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const didInitScroll = useRef(false);
  const prevSendState = useRef<SendState>(sendState);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Resolve ENS name for the recipient — displayed in the chat header.
  // ENS registry lives on mainnet regardless of which chain we're chatting on.
  const isRawAddress = isAddressLike(recipient);
  const { data: ensName } = useEnsName({
    address: isRawAddress ? (recipient as `0x${string}`) : undefined,
    chainId: 1,
  });
  const recipientDisplay = ensName ?? (isEnsLike(recipient) ? recipient : null);

  // First unread message = first message from the peer after lastReadTs
  const firstUnreadId = useMemo(() => {
    if (!address || !lastReadTs) return null;
    for (const m of messages) {
      if (m.id > 0 && m.sender.toLowerCase() !== address.toLowerCase() && m.timestamp > lastReadTs) {
        return m.id;
      }
    }
    return null;
  }, [messages, address, lastReadTs]);

  // Initial scroll: jump to first unread divider (or bottom if all read)
  useEffect(() => {
    if (isLoading || didInitScroll.current || messages.length === 0) return;
    didInitScroll.current = true;
    if (unreadRef.current) {
      unreadRef.current.scrollIntoView({ behavior: "auto", block: "center" });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [isLoading, messages.length]);

  // After send completes: scroll to bottom + mark all read
  useEffect(() => {
    if (prevSendState.current !== "idle" && sendState === "idle") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      onMarkAllRead();
    }
    prevSendState.current = sendState;
  }, [sendState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark all read + hide FAB when bottom sentinel becomes visible
  useEffect(() => {
    if (!bottomRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setIsAtBottom(entry.isIntersecting);
        if (entry.isIntersecting) onMarkAllRead();
      },
      { threshold: 1.0 },
    );
    obs.observe(bottomRef.current);
    return () => obs.disconnect();
  }, [onMarkAllRead]);

  useEffect(() => {
    if (!loadError) {
      setShowErrorDetails(false);
    }
  }, [loadError]);

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
          </div>
        </div>

      </header>

      {/* Messages */}
      <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto bg-bg-1">
        {!isLoading && loadError && (
          <div className="absolute right-4 top-4 z-20">
            <button
              type="button"
              onClick={() => setShowErrorDetails(true)}
              className="group inline-flex h-9 w-9 items-center justify-center border border-danger/40 bg-bg-2/90 text-danger shadow-lg transition-colors hover:border-danger hover:bg-danger/10"
              aria-label="Open chat error details"
              title="Open error details"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m10.3 3.1-8.2 14a2 2 0 0 0 1.7 3h16.4a2 2 0 0 0 1.7-3l-8.2-14a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </button>
          </div>
        )}

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
            <div className="mb-2 flex items-center justify-between gap-3 border border-danger/30 bg-danger/10 px-3 py-2 animate-fade-in">
              <p className="truncate font-mono text-[10px] uppercase tracking-wider text-danger">
                transient fetch error - tap warning icon for details
              </p>
              <button
                type="button"
                onClick={onReload}
                className="h-7 border border-danger/40 px-2.5 font-mono text-[10px] uppercase tracking-wider text-danger hover:bg-danger/10"
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
                  const isFirstUnread = firstUnreadId !== null && m.id === firstUnreadId;
                  return (
                    <Fragment key={m.id}>
                      {isFirstUnread && (
                        <div ref={unreadRef} className="flex items-center gap-3 py-2 animate-fade-in">
                          <span className="h-px flex-1 bg-accent/40" />
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                            new messages
                          </span>
                          <span className="h-px flex-1 bg-accent/40" />
                        </div>
                      )}
                      <MessageBubble
                        message={m}
                        isSelf={isSelf}
                        showTail={showTail}
                        onMarkRead={() => onMarkRead(m.id)}
                        onBurn={() => onBurn(m.id)}
                        onPayRequest={onPayRequest}
                      />
                    </Fragment>
                  );
                })}
              </div>
            ))}

          {sendState !== "idle" && <SendStateBar state={sendState} />}
          <div ref={bottomRef} />
        </div>

        {/* Scroll-to-bottom FAB */}
        {!isAtBottom && (
          <button
            type="button"
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="absolute bottom-4 right-4 z-10 grid h-9 w-9 place-items-center border border-line bg-bg-2 text-ink-2 shadow-lg hover:border-accent/50 hover:bg-bg-3 hover:text-ink-1 transition-colors animate-fade-in"
            aria-label="Scroll to bottom"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 2v10M3 8l4 4 4-4" />
            </svg>
          </button>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-line bg-bg-1 px-3 py-3 md:px-6 md:py-4">
        <div className="mx-auto w-full max-w-3xl">
          <MessageInput recipient={recipient} onSend={onSend} />
        </div>
      </div>

      {showErrorDetails && loadError && (
        <ErrorDetailsModal
          recipient={recipient}
          error={loadError}
          onClose={() => setShowErrorDetails(false)}
          onRetry={onReload}
        />
      )}
    </>
  );
}

function ErrorDetailsModal({
  recipient,
  error,
  onClose,
  onRetry,
}: {
  recipient: string;
  error: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(error);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 border border-line bg-bg-1 shadow-2xl animate-fade-in-up">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h3 className="font-display text-xl tracking-tight text-ink-1">Chat Error Details</h3>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
              thread - {shortAddress(recipient, 6, 4)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 border border-line px-2.5 font-mono text-[10px] uppercase tracking-wider text-ink-2 hover:text-ink-1"
          >
            close
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">raw log</div>
          <pre className="max-h-[48vh] overflow-auto border border-line bg-bg-2 p-3 font-mono text-[11px] leading-relaxed text-ink-2 whitespace-pre-wrap break-words">
            {error}
          </pre>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="h-9 border border-accent/40 bg-accent-soft px-3.5 font-mono text-[10px] uppercase tracking-wider text-accent-bright hover:border-accent"
            >
              retry fetch
            </button>
            <button
              type="button"
              onClick={copyDetails}
              className="h-9 border border-line px-3.5 font-mono text-[10px] uppercase tracking-wider text-ink-2 hover:text-ink-1"
            >
              {copied ? "copied" : "copy log"}
            </button>
          </div>
        </div>
      </div>
    </div>
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
            and <code className="font-mono text-accent-bright">/request</code>.
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
