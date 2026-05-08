"use client";

import { useMemo, useState, useCallback } from "react";
import { useAccount, useSendTransaction, useDisconnect } from "wagmi";
import { parseEther } from "viem";
import { Logo } from "./Logo";
import { Identicon, AddressBadge } from "./AddressBadge";
import { ConnectButton } from "./ConnectButton";
import { PlusIcon, SearchIcon, LockIcon, SettingsIcon, ExternalIcon } from "./Icons";
import { isAddressLike, isEnsLike, shortAddress } from "@/lib/format";
import { useSessionKey } from "@/hooks/useSessionKey";

export interface ThreadEntry {
  address: string;
  ens?: string | null;
  preview?: string;
  unread?: number;
  pinned?: boolean;
}

interface Props {
  threads: ThreadEntry[];
  activeAddress: string;
  onSelect: (addr: string) => void;
  onClose?: () => void;
  onNewChat: (input: string) => void;
}

export function Sidebar({ threads, activeAddress, onSelect, onClose, onNewChat }: Props) {
  const { address } = useAccount();
  const { sendTransaction, isPending: isTopUpPending } = useSendTransaction();
  const { disconnect } = useDisconnect();
  const [filter, setFilter] = useState("");
  const [composing, setComposing] = useState(threads.length === 0);
  const [draft, setDraft] = useState("");
  const [showGasPanel, setShowGasPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const sessionKey = useSessionKey();

  function handleTopUp() {
    if (!sessionKey.address) return;
    sendTransaction({
      to: sessionKey.address as `0x${string}`,
      value: parseEther("0.01"),
    });
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) => t.address.toLowerCase().includes(q) || (t.ens && t.ens.toLowerCase().includes(q)),
    );
  }, [threads, filter]);

  const draftValid = isAddressLike(draft) || isEnsLike(draft);

  function startThread(e: React.FormEvent) {
    e.preventDefault();
    if (!draftValid) return;
    onNewChat(draft.trim());
    setDraft("");
    setComposing(false);
  }

  return (
    <aside className="flex h-full w-full flex-col bg-bg-1 md:w-[300px] md:border-r md:border-line">
      {/* Brand row */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <Logo />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="md:hidden grid h-8 w-8 place-items-center text-ink-3 hover:bg-white/5 hover:text-ink-1"
            aria-label="Close menu"
          >
            ✕
          </button>
        )}
      </div>

      {/* Section label */}
      <div className="px-4 py-2.5 border-b border-line bg-bg-0 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
          inbox · {threads.length}
        </span>
        <button
          type="button"
          onClick={() => setComposing((v) => !v)}
          aria-label="New conversation"
          className="grid h-6 w-6 place-items-center text-ink-3 hover:text-accent-bright hover:bg-white/5"
        >
          <PlusIcon size={13} strokeWidth={2.4} />
        </button>
      </div>

      {/* New chat composer */}
      {composing && (
        <form
          onSubmit={startThread}
          className="border-b border-line bg-bg-2 p-3 animate-fade-in"
        >
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
            recipient · 0x or ens
          </label>
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="0x… or alice.eth"
            className="input-base mt-1.5 h-9 w-full px-3 font-mono text-[12px]"
          />
          {draft && !draftValid && (
            <p className="mt-1.5 font-mono text-[10px] text-warn">
              ! invalid address — expect 0x[40hex] or *.eth
            </p>
          )}
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setComposing(false);
                setDraft("");
              }}
              className="btn-ghost h-7 px-2.5 text-[11px]"
            >
              Cancel
            </button>
            <button type="submit" disabled={!draftValid} className="btn-accent h-7 px-3 text-[11px]">
              Open thread
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="border-b border-line p-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3">
            <SearchIcon size={13} />
          </span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search threads"
            className="input-base h-9 w-full pl-8 pr-3 text-[13px]"
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyThreads hasFilter={Boolean(filter)} />
        ) : (
          <ul className="divide-y divide-line/60">
            {filtered.map((t, idx) => {
              const active = t.address.toLowerCase() === activeAddress.toLowerCase();
              return (
                <li key={t.address}>
                  <button
                    type="button"
                    onClick={() => onSelect(t.address)}
                    className={`group relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      active ? "bg-bg-3" : "hover:bg-bg-2"
                    }`}
                  >
                    {active && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent" />}
                    <Identicon seed={t.address} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-[13px] ${
                            active ? "font-semibold text-ink-0" : "font-medium text-ink-1"
                          }`}
                        >
                          {t.ens ?? shortAddress(t.address)}
                        </span>
                        <span className="font-mono text-[10px] text-ink-4">
                          #{String(idx + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <span className="mt-0.5 inline-flex items-center gap-1.5 truncate font-mono text-[10px] uppercase tracking-wider text-ink-3">
                        <LockIcon size={10} /> euint256
                        {typeof t.unread === "number" && t.unread > 0 && (
                          <span className="ml-1.5 px-1 bg-accent text-accent-ink font-semibold tracking-normal">
                            {t.unread} new
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Gas wallet low-balance warning banner */}
      {sessionKey.status === "ready" && sessionKey.isLowBalance && (
        <div className="border-t border-warn/40 bg-warn/10 px-4 py-2 flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-warn">
            ⚠ gas wallet low · {sessionKey.balanceEth} ETH
          </p>
          <button
            type="button"
            onClick={() => setShowGasPanel(true)}
            className="font-mono text-[10px] uppercase tracking-wider text-accent-bright hover:underline"
          >
            top up
          </button>
        </div>
      )}

      {/* Gas wallet panel (expanded) */}
      {showGasPanel && sessionKey.status !== "loading" && (
        <div className="border-t border-line bg-bg-2 px-4 py-3 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
              gas wallet
            </span>
            <button
              type="button"
              onClick={() => setShowGasPanel(false)}
              className="font-mono text-[10px] text-ink-4 hover:text-ink-2"
            >
              ✕
            </button>
          </div>

          {sessionKey.status === "not-registered" && (
            <div>
              <p className="font-mono text-[11px] text-ink-3 mb-2">
                No gas wallet set up. Set one up to send messages without MetaMask popups.
              </p>
              <button
                type="button"
                onClick={() => sessionKey.setup().catch((e) => alert(e.message))}
                className="btn-accent h-7 w-full text-[11px]"
              >
                Set up gas wallet
              </button>
            </div>
          )}

          {sessionKey.status === "needs-derive" && (
            <div>
              <p className="font-mono text-[11px] text-ink-3 mb-2">
                Gas wallet found on-chain but not in this browser. Sign once to restore it.
              </p>
              <button
                type="button"
                onClick={() => sessionKey.rederive().catch((e) => alert(e.message))}
                className="btn-accent h-7 w-full text-[11px]"
              >
                Restore gas wallet
              </button>
            </div>
          )}

          {sessionKey.status === "ready" && sessionKey.address && (
            <div className="space-y-2">
              {/* Address + balance */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="font-mono text-[11px] text-ink-2 truncate max-w-[140px]">
                    {shortAddress(sessionKey.address)}
                  </span>
                  <a
                    href={`https://sepolia.etherscan.io/address/${sessionKey.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open gas wallet on Sepolia Etherscan"
                    title="View on Sepolia Etherscan"
                    className="grid h-5 w-5 place-items-center text-ink-3 hover:text-accent-bright"
                  >
                    <ExternalIcon size={11} />
                  </a>
                </div>
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    sessionKey.isLowBalance ? "text-warn" : "text-accent-bright"
                  }`}
                >
                  {sessionKey.balanceEth} ETH
                </span>
              </div>

              {/* Top-up button — uses wagmi sendTransaction (works with any wallet) */}
              <button
                type="button"
                onClick={handleTopUp}
                disabled={isTopUpPending}
                className="btn-accent flex h-7 w-full items-center justify-center text-[11px] disabled:opacity-50"
              >
                {isTopUpPending ? "Sending…" : "Top up 0.01 ETH"}
              </button>

              {/* Revoke */}
              <button
                type="button"
                onClick={() =>
                  confirm("Revoke gas wallet? You can set up a new one anytime.")
                  && sessionKey.revoke().catch((e) => alert(e.message))
                }
                className="btn-ghost h-7 w-full text-[11px] text-ink-4"
              >
                Revoke
              </button>
            </div>
          )}

          {sessionKey.error && (
            <p className="mt-1 font-mono text-[10px] text-red-400">{sessionKey.error}</p>
          )}
        </div>
      )}

      {/* Identity footer */}
      <div className="border-t border-line bg-bg-0 p-3">
        {address ? (
          <div className="flex items-center justify-between gap-2">
            <AddressBadge address={address} size="sm" copy />
            <div className="flex items-center gap-1">
              {/* Gas wallet indicator dot */}
              <button
                type="button"
                onClick={() => setShowGasPanel((v) => !v)}
                aria-label="Gas wallet"
                title={
                  sessionKey.status === "ready"
                    ? `Gas wallet: ${sessionKey.balanceEth} ETH`
                    : "Gas wallet not set up"
                }
                className="relative grid h-8 w-8 place-items-center text-ink-3 hover:bg-white/5 hover:text-ink-1"
              >
                {/* Fuel / wallet icon — simple inline SVG */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 22V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
                  <path d="M17 12h2a2 2 0 0 1 2 2v3a1 1 0 0 0 1 1 1 1 0 0 0 1-1V9l-3-3" />
                  <line x1="3" y1="22" x2="21" y2="22" />
                  <rect x="7" y="10" width="6" height="4" />
                </svg>
                {/* Status dot */}
                <span
                  className={`absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${
                    sessionKey.status === "ready" && !sessionKey.isLowBalance
                      ? "bg-green-400"
                      : sessionKey.status === "ready" && sessionKey.isLowBalance
                      ? "bg-warn"
                      : "bg-ink-4"
                  }`}
                />
              </button>

              <div className="relative">
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center text-ink-3 hover:bg-white/5 hover:text-ink-1"
                  aria-label="Settings"
                  onClick={() => setShowSettings((v) => !v)}
                >
                  <SettingsIcon size={14} />
                </button>
                {showSettings && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowSettings(false)}
                    />
                    <div className="absolute bottom-full right-0 z-20 mb-1 w-44 border border-line bg-bg-2 py-1 shadow-lg">
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-[12px] text-danger hover:bg-white/5"
                        onClick={() => {
                          disconnect();
                          setShowSettings(false);
                        }}
                      >
                        Disconnect wallet
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <ConnectButton compact />
        )}
      </div>
    </aside>
  );
}

function EmptyThreads({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="grid place-items-center px-6 py-12 text-center">
      <div className="grid h-9 w-9 place-items-center bg-bg-3 border border-line text-ink-3">
        <LockIcon size={16} />
      </div>
      <p className="mt-3 max-w-[220px] font-mono text-[11px] uppercase tracking-wider text-ink-3">
        {hasFilter ? "no threads match" : "your encrypted threads appear here"}
      </p>
    </div>
  );
}
