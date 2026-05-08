"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { parseSlashCommand, isSlashCommand } from "@/lib/slash-commands";
import {
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
    icon: <SendIcon size={13} />,
  },
  {
    cmd: "/request",
    template: "/request 0.01 ETH",
    hint: "Request payment from current chat · optional: note <text>",
    icon: <SendIcon size={13} className="scale-x-[-1]" />,
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
  const isRequestDraft = value.trimStart().toLowerCase().startsWith("/request");
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

  function insertRequestPart(part: string) {
    const base = value.trim();
    const next = base.length === 0
      ? `/request 0.01 ETH ${part}`.trim()
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

      {/* Quick builder chips for /request */}
      {isRequestDraft && !showPalette && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setInputAndFocus("/request 0.01 ETH")}
            className="border border-line bg-bg-2 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-2 transition-colors hover:border-accent/50 hover:text-accent-bright"
          >
            template
          </button>
          <button
            type="button"
            onClick={() => insertRequestPart("note ")}
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
        <div className="relative flex-1 bg-bg-2">
          {/* Syntax-highlight backdrop — mirrors textarea layout exactly */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden px-3.5 py-3 text-[14px] leading-snug whitespace-pre-wrap break-words text-transparent"
            style={{ wordBreak: "break-word" }}
          >
            {highlightCommand(value)}
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            maxLength={MAX_MESSAGE_CHARS}
            placeholder={`Send an encrypted message  to ${shortRecipient(recipient)} · use / for commands`}
            rows={1}
            className="relative w-full resize-none bg-transparent px-3.5 py-3 text-[14px] leading-snug text-ink-1 caret-ink-1 placeholder:text-ink-3 focus:outline-none max-h-48"
            style={{ color: "transparent", caretColor: "rgba(255, 255, 255, 0.94)" }}
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

/**
 * Renders the textarea value with command keywords bolded in the backdrop.
 * Produces React nodes that are exactly as wide as the plain text so the
 * caret position on the transparent textarea stays aligned.
 */
function highlightCommand(raw: string): React.ReactNode {
  // Only highlight slash commands; plain messages pass through unchanged.
  if (!raw.startsWith("/")) return <span className="text-ink-1">{raw}</span>;

  // Token patterns for /send and /request
  // Each segment: keyword | address | amount+token | note text | plain
  const parts: React.ReactNode[] = [];
  let rest = raw;

  // Keywords we want to highlight
  const keywordRe = /^(\/send|\/request|to|from|note)(\s)/i;

  let i = 0;
  while (rest.length > 0) {
    const kwMatch = rest.match(keywordRe);
    if (kwMatch) {
      parts.push(
        <strong key={i++} className="font-semibold text-ink-0">
          {kwMatch[1]}
        </strong>,
        <span key={i++} className="text-ink-1">{kwMatch[2]}</span>,
      );
      rest = rest.slice(kwMatch[0].length);
      continue;
    }

    // Ethereum address — monospace + dimmed
    const addrMatch = rest.match(/^(0x[a-fA-F0-9]{1,40})/);
    if (addrMatch) {
      parts.push(
        <code key={i++} className="font-mono text-accent-bright">
          {addrMatch[1]}
        </code>,
      );
      rest = rest.slice(addrMatch[1].length);
      continue;
    }

    // Consume one character as plain text
    parts.push(<span key={i++} className="text-ink-1">{rest[0]}</span>);
    rest = rest.slice(1);
  }

  return <>{parts}</>;
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
    icon = <SendIcon size={13} />;
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
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] leading-snug">
          <span><strong>send:</strong> {parsed.amount} {parsed.token}</span>
          {parsed.to && (
            <span><strong>to:</strong> <code className="font-mono text-[12px] text-ink-0">{parsed.to}</code></span>
          )}
          {parsed.note && (
            <span><strong>note:</strong> <code className="font-mono text-[12px] text-ink-0">{parsed.note}</code></span>
          )}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
          {guide.join("  ·  ")}
        </div>
      </div>
    );
  } else if (parsed.type === "request") {
    icon = <SendIcon size={13} className="scale-x-[-1]" />;
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
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] leading-snug">
          <span><strong>request:</strong> {parsed.amount} {parsed.token}</span>
          <span><strong>from:</strong> {parsed.from
            ? <code className="font-mono text-[12px] text-ink-0">{parsed.from}</code>
            : <span className="text-ink-3">current chat</span>}
          </span>
          {parsed.note && (
            <span><strong>note:</strong> <code className="font-mono text-[12px] text-ink-0">{parsed.note}</code></span>
          )}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
          {guide.join("  ·  ")}
        </div>
      </div>
    );
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
