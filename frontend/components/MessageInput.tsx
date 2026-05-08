"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { parseSlashCommand, isSlashCommand } from "@/lib/slash-commands";
import {
  CoinsIcon,
  InviteIcon,
  SendIcon,
  ZapIcon,
} from "./Icons";

interface Props {
  recipient: string;
  onSend: (text: string) => Promise<void>;
}

interface CommandDef {
  cmd: string;
  template: string;
  hint: string;
  icon: React.ReactNode;
}

const COMMANDS: CommandDef[] = [
  {
    cmd: "/send",
    template: "/send 0.01 ETH",
    hint: "ETH only · optional: to <addr> · note <text> (encrypted, 32-byte max)",
    icon: <CoinsIcon size={13} />,
  },
  {
    cmd: "/request",
    template: "/request 0.01 ETH",
    hint: "Request payment · optional: from <addr> · note <text>",
    icon: <CoinsIcon size={13} />,
  },
  {
    cmd: "/invite",
    template: "/invite ",
    hint: "Send an eChatz invite link to an address",
    icon: <InviteIcon size={13} />,
  },
];

const ON_CHAIN_BYTE_LIMIT = 32;
const MAX_MESSAGE_CHARS = 500;

export function MessageInput({ recipient, onSend }: Props) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showPalette = value.startsWith("/") && (value === "/" || value.indexOf(" ") === -1);

  const matches = useMemo(() => {
    if (!showPalette) return [];
    const q = value.toLowerCase();
    return COMMANDS.filter((c) => c.cmd.startsWith(q));
  }, [value, showPalette]);

  useEffect(() => {
    if (paletteIndex >= matches.length) setPaletteIndex(0);
  }, [matches, paletteIndex]);

  const isCommand = isSlashCommand(value);
  const parsed = isCommand ? parseSlashCommand(value) : null;
  const isSendDraft = value.trimStart().toLowerCase().startsWith("/send");
  const hasToClause = /\bto\s+\S+/i.test(value);
  const hasNoteClause = /\bnote\s+/i.test(value);

  const byteLength = new TextEncoder().encode(value).length;
  const overInline = byteLength > ON_CHAIN_BYTE_LIMIT;
  const charLength = value.length;

  function applyCommand(cmd: CommandDef) {
    setValue(cmd.template);
    setPaletteIndex(0);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(cmd.template.length, cmd.template.length);
      autoResize(ta);
    });
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function setInputAndFocus(next: string) {
    const limited = next.slice(0, MAX_MESSAGE_CHARS);
    setValue(limited);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(limited.length, limited.length);
      autoResize(ta);
    });
  }

  function insertSendPart(part: string) {
    const base = value.trim();
    const next = base.length === 0
      ? `/send 0.01 ETH ${part}`.trim()
      : `${base}${base.endsWith(" ") ? "" : " "}${part}`;
    setInputAndFocus(next);
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!value.trim() || sending) return;
    if (value.trim().length > MAX_MESSAGE_CHARS) {
      setError(`Message must be ${MAX_MESSAGE_CHARS} characters or fewer.`);
      return;
    }
    setError(null);
    setSending(true);
    try {
      await onSend(value.trim());
      setValue("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showPalette && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPaletteIndex((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPaletteIndex((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        applyCommand(matches[paletteIndex]);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value.slice(0, MAX_MESSAGE_CHARS));
    autoResize(e.target);
  }

  return (
    <div className="relative">
      {/* Slash command palette */}
      {showPalette && matches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 surface-2 animate-scale-in">
          <div className="flex items-center justify-between border-b border-line px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
            <span>slash · {matches.length} match</span>
            <span>↑↓ navigate · tab insert</span>
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {matches.map((c, i) => {
              const active = i === paletteIndex;
              return (
                <li key={c.cmd}>
                  <button
                    type="button"
                    onClick={() => applyCommand(c)}
                    onMouseEnter={() => setPaletteIndex(i)}
                    className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                      active ? "bg-bg-3" : "hover:bg-bg-2"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center border ${
                        active
                          ? "bg-accent text-accent-ink border-accent"
                          : "bg-bg-2 text-ink-2 border-line"
                      }`}
                    >
                      {c.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[13px] text-ink-1">{c.cmd}</div>
                      <div className="truncate text-[11.5px] text-ink-3">{c.hint}</div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Parsed command preview */}
      {parsed && parsed.type !== "unknown" && !showPalette && <CommandPreview parsed={parsed} />}

      {/* Quick builder chips for /send */}
      {isSendDraft && !showPalette && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setInputAndFocus("/send 0.01 ETH")}
            className="border border-line bg-bg-2 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-2 transition-colors hover:border-accent/50 hover:text-accent-bright"
          >
            template
          </button>
          <button
            type="button"
            onClick={() => insertSendPart(`to ${recipient || "0x"}`)}
            disabled={hasToClause}
            className="border border-line bg-bg-2 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-2 transition-colors hover:border-accent/50 hover:text-accent-bright disabled:cursor-not-allowed disabled:opacity-45"
          >
            add recipient
          </button>
          <button
            type="button"
            onClick={() => insertSendPart("note ")}
            disabled={hasNoteClause}
            className="border border-line bg-bg-2 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-2 transition-colors hover:border-accent/50 hover:text-accent-bright disabled:cursor-not-allowed disabled:opacity-45"
          >
            add note
          </button>
        </div>
      )}

      {error && (
        <div className="mb-2 border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger animate-fade-in">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-px bg-line"
      >
        <div className="flex-1 bg-bg-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            maxLength={MAX_MESSAGE_CHARS}
            placeholder={`Send an encrypted message  to ${shortRecipient(recipient)} · use / for commands`}
            rows={1}
            className="w-full resize-none bg-transparent px-3.5 py-3 text-[14px] leading-snug text-ink-1 placeholder:text-ink-3 focus:outline-none max-h-48"
            disabled={sending}
            aria-label="Message"
          />
        </div>

        <div className="flex shrink-0 items-stretch bg-bg-2">
          <span
            className={`hidden sm:flex items-center px-3 font-mono text-[10px] tabular-nums border-r border-line ${
              overInline ? "text-warn" : "text-ink-4"
            }`}
            title={overInline ? "Will route via IPFS" : "Will be stored on-chain"}
          >
            {charLength}/{MAX_MESSAGE_CHARS}
          </span>
          <button
            type="submit"
            disabled={!value.trim() || sending}
            className="btn-accent h-auto px-4 text-[13px]"
            aria-label="Send message"
          >
            {sending ? (
              <span className="inline-block h-3 w-3 animate-pulse-soft bg-accent-ink/40" />
            ) : (
              <SendIcon size={14} strokeWidth={2.4} />
            )}
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      </form>

      {/* Hint row */}
      <div className="mt-2 flex items-center justify-end font-mono text-[10px] uppercase tracking-wider text-ink-4">
        <span className="inline-flex items-center gap-3">
          {overInline ? (
            <span className="inline-flex items-center gap-1 text-warn">
              <ZapIcon size={11} /> ipfs route
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function shortRecipient(r: string) {
  if (!r) return "this address";
  if (r.length > 12) return `${r.slice(0, 6)}…${r.slice(-4)}`;
  return r;
}

function CommandPreview({
  parsed,
}: {
  parsed: NonNullable<ReturnType<typeof parseSlashCommand>>;
}) {
  let summary: React.ReactNode = null;
  let icon: React.ReactNode = <ZapIcon size={13} />;
  let label: string = parsed.type;

  if (parsed.type === "send") {
    icon = <CoinsIcon size={13} />;
    label = "payment / send";
    const noteBytes = new TextEncoder().encode(parsed.note).length;
    const guide = [
      `1) amount: ${parsed.amount || "missing"}`,
      `2) token: ${parsed.token || "missing"} (ETH only)`,
      `3) recipient: ${parsed.to ? "custom" : "current chat"}`,
      `4) note: ${parsed.note ? `${noteBytes}/32 bytes` : "optional (use: note <text>)"}`,
    ];
    summary = (
      <div className="space-y-1">
        <div>
          Transfer <strong>{parsed.amount} {parsed.token}</strong>
          {parsed.to
            ? <> → <code className="font-mono text-[12px] text-ink-0">{parsed.to}</code></>
            : <> → current recipient</>}
        </div>
        {parsed.note ? (
          <div className="truncate">
            note: <code className="font-mono text-[12px] text-ink-0">{parsed.note}</code>
          </div>
        ) : null}
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
          {guide.join("  ·  ")}
        </div>
      </div>
    );
  } else if (parsed.type === "request") {
    icon = <CoinsIcon size={13} />;
    label = "payment / request";
    const noteBytes = new TextEncoder().encode(parsed.note).length;
    const guide = [
      `1) amount: ${parsed.amount || "missing"}`,
      `2) token: ${parsed.token || "missing"}`,
      `3) payer: ${parsed.from ? "custom" : "current chat"}`,
      `4) note: ${parsed.note ? `${noteBytes}/32 bytes` : "optional (use: note <text>)"}`,
    ];
    summary = (
      <div className="space-y-1">
        <div>
          Request <strong>{parsed.amount} {parsed.token}</strong>
          {parsed.from
            ? <> from <code className="font-mono text-[12px] text-ink-0">{parsed.from}</code></>
            : <> from current recipient</>}
        </div>
        {parsed.note ? (
          <div className="truncate">
            note: <code className="font-mono text-[12px] text-ink-0">{parsed.note}</code>
          </div>
        ) : null}
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
          {guide.join("  ·  ")}
        </div>
      </div>
    );
  } else if (parsed.type === "invite") {
    icon = <InviteIcon size={13} />;
    label = "invite";
    summary = parsed.address
      ? <> Invite <code className="font-mono text-[12px]">{parsed.address}</code></>
      : <>Send invite link to current recipient</>;
  }

  return (
    <div className="mb-2 flex items-center gap-3 border border-accent/40 bg-accent-soft px-3 py-2.5 animate-fade-in">
      <span className="grid h-7 w-7 shrink-0 place-items-center bg-accent text-accent-ink">
        {icon}
      </span>
      <div className="min-w-0 flex-1 text-[13px] text-ink-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-bright">{label}</div>
        <div className="truncate">{summary}</div>
      </div>
    </div>
  );
}
