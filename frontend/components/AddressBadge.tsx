"use client";

import { useState } from "react";
import { shortAddress, stableGradient } from "@/lib/format";
import { CopyIcon, CheckIcon } from "./Icons";

interface Props {
  address: string;
  ens?: string | null;
  size?: "sm" | "md" | "lg";
  copy?: boolean;
  className?: string;
}

/**
 * Square identicon — same deterministic gradient seeded by address, but with
 * sharp edges and a faint inner border to fit the brutalist aesthetic.
 */
export function Identicon({ seed, size = 32 }: { seed: string; size?: number }) {
  const { from, to } = stableGradient(seed.toLowerCase());
  return (
    <span
      aria-hidden="true"
      className="relative inline-block"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.45)",
      }}
    >
      <span
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(0,0,0,0.10) 0 2px, transparent 2px 4px)",
        }}
      />
    </span>
  );
}

export function AddressBadge({ address, ens, size = "md", copy, className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  const dim = size === "lg" ? 36 : size === "sm" ? 22 : 28;
  const labelClass =
    size === "lg" ? "text-base font-semibold" : size === "sm" ? "text-xs" : "text-sm font-medium";

  const display = ens ?? shortAddress(address);

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Identicon seed={address} size={dim} />
      <span className="flex flex-col leading-tight min-w-0">
        <span className={`${labelClass} text-ink-1 truncate`}>{display}</span>
        {ens && (
          <span className="text-[11px] font-mono text-ink-3 truncate">{shortAddress(address)}</span>
        )}
      </span>
      {copy && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Address copied" : "Copy address"}
          className="ml-1 grid place-items-center w-7 h-7 text-ink-3 hover:text-accent-bright hover:bg-white/4 transition-colors"
        >
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
        </button>
      )}
    </span>
  );
}
