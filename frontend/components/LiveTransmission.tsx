"use client";

import { useEffect, useState } from "react";

const TRANSMISSIONS = [
  { peer: "0x7a9f…e3c1", body: "see you at eight.", size: 142 },
  { peer: "0x4d2b…a5f7", body: "0.4 ETH on the way — confirm when received.", size: 96 },
  { peer: "0x9c1e…b8d2", body: "moved to friday. same place.", size: 187 },
  { peer: "0x2f8a…14de", body: "split locked in. the wallet pays at midnight.", size: 121 },
];

const STAGES = [
  { tag: "handshake",  meta: "fhevm",     ms: 142 },
  { tag: "encipher",   meta: "tfhe-rs",   ms: 184 },
  { tag: "dispatch",   meta: "p2p",       ms: 273 },
  { tag: "deliver",    meta: "on-device", ms: 141 },
];
const TOTAL_MS = STAGES.reduce((a, s) => a + s.ms, 0);

const PHASE_MS = [820, 820, 720, 720, 2000, 2600];
const HEX = "0123456789abcdef";

function buildHex(seed: number, len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += HEX[(seed * 9301 + i * 49297 + 7919) % 16];
  }
  return out;
}

function chunk(str: string, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < str.length; i += n) out.push(str.slice(i, i + n));
  return out;
}

function timecode(baseSec: number, frame: number): string {
  const totalMs = baseSec * 1000 + frame * 95;
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const h = Math.floor(totalSec / 3600) % 24;
  const m = Math.floor(totalSec / 60) % 60;
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

const SUFFIX = ["A", "B", "C", "D"];

export function LiveTransmission() {
  const [phase, setPhase] = useState(0);
  const [txIdx, setTxIdx] = useState(0);
  const [tick, setTick] = useState(0);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      if (phase >= 5) {
        setPhase(0);
        setTxIdx((i) => (i + 1) % TRANSMISSIONS.length);
      } else {
        setPhase((p) => p + 1);
      }
    }, PHASE_MS[phase]);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    const i = setInterval(() => setFrame((f) => (f + 1) % 100000), 95);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (phase !== 4) return;
    const i = setInterval(() => setTick((t) => t + 1), 95);
    return () => clearInterval(i);
  }, [phase]);

  const tx = TRANSMISSIONS[txIdx];
  const cipherVisible = phase >= 4;
  const plainVisible = phase >= 5;
  const cipherLen = phase === 4 ? Math.min(64, 16 + tick * 4) : 64;
  const cipherFull = cipherVisible ? buildHex(tick + txIdx * 13, 64) : "";
  const cipherChunks = chunk(cipherFull.slice(0, cipherLen), 8);

  return (
    <div
      className="relative reveal cipher-card surface bg-bg-2 select-none"
      style={{ animationDelay: "720ms" }}
    >
      <span className="corner-tl" aria-hidden />
      <span className="corner-tr" aria-hidden />
      <span className="corner-bl" aria-hidden />
      <span className="corner-br" aria-hidden />

      {/* Operator strip */}
      <div className="flex items-stretch border-b border-line bg-bg-1">
        <Metric label="t" value={timecode(15668, frame)} mono />
        <Metric label="net" value="fhevm.zama" mono />
        <Metric label="frame" value={String(frame % 10000).padStart(4, "0")} mono className="hidden md:flex" />
        <div className="ml-auto flex items-center gap-2 px-4">
          <span className="h-1 w-1 bg-ok animate-pulse-soft" />
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
            LIVE
          </span>
        </div>
      </div>

      {/* Section masthead */}
      <div className="flex items-baseline justify-between px-5 pt-6 pb-3">
        <h3 className="font-display text-[17px] font-medium tracking-tighter text-ink-0 lowercase">
          cipher stream
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-3 tabular-nums">
          {String(txIdx + 1).padStart(2, "0")} · {SUFFIX[txIdx % 4]}
        </span>
      </div>

      <Hairline />

      {/* Pipeline */}
      <div className="px-5 py-4 space-y-2.5">
        {STAGES.map((stage, i) => {
          const state = phase > i ? "done" : phase === i ? "active" : "pending";
          const numCls =
            state === "pending"
              ? "text-ink-5"
              : state === "active"
                ? "text-accent"
                : "text-ink-3";
          const tagCls =
            state === "pending"
              ? "text-ink-4"
              : state === "active"
                ? "text-ink-0"
                : "text-ink-1";
          const msCls = state === "pending" ? "text-ink-5" : "text-ink-2";
          return (
            <div
              key={stage.tag}
              className="grid grid-cols-[2.5ch_1fr_6ch_8ch] items-baseline gap-3 font-mono text-[12px] leading-none"
            >
              <span className={`tabular-nums ${numCls}`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={`tracking-tight ${tagCls}`}>{stage.tag}</span>
              <span className={`tabular-nums text-right ${msCls}`}>
                {state === "pending" ? "—" : `0.${String(stage.ms).padStart(3, "0")}s`}
              </span>
              <span className="text-ink-4 tracking-[0.08em] text-right">
                {stage.meta}
              </span>
            </div>
          );
        })}
      </div>

      <RuledLabel left="envelope" right={cipherVisible ? `${tx.size} B · sealed` : "— · sealed"} />

      {/* Cipher hex */}
      <div className="px-5 pt-3 pb-5 min-h-[5.4rem] overflow-hidden">
        {cipherVisible ? (
          <div className="font-mono text-[11px] md:text-[12px] leading-[1.7] text-ink-2 tracking-[0.02em] break-all">
            {cipherChunks.join(" ")}
            {phase === 4 && <span className="cipher-caret text-accent ml-1">▍</span>}
          </div>
        ) : (
          <div className="font-mono text-[12px] text-ink-5 tracking-[0.4em]">— — — —</div>
        )}
      </div>

      <RuledLabel left="plaintext" right="decrypted on device" />

      {/* Plaintext — editorial serif italic */}
      <div className="px-5 pt-5 pb-5 min-h-[4rem]">
        {plainVisible ? (
          <p className="font-serif italic text-[26px] md:text-[28px] leading-[1.05] tracking-[-0.01em] text-ink-0">
            <span className="text-ink-4">“</span>
            {tx.body}
            <span className="text-ink-4">”</span>
          </p>
        ) : (
          <p className="font-mono text-[11px] text-ink-5 tracking-wider">
            awaiting key…
          </p>
        )}
      </div>

      {/* Footer ledger */}
      <div className="grid grid-cols-2 border-t border-line bg-bg-0">
        <div className="flex items-baseline gap-3 px-5 py-3 border-r border-line">
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-ink-4">to</span>
          <span className="font-mono text-[12px] text-ink-1">{tx.peer}</span>
        </div>
        <div className="flex items-baseline justify-end gap-3 px-5 py-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-ink-4">Δ</span>
          <span className="font-mono text-[12px] text-ink-1 tabular-nums">
            {plainVisible ? `${(TOTAL_MS / 1000).toFixed(3)}s` : "—.———s"}
          </span>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-2 px-4 py-2.5 border-r border-line ${className ?? ""}`}>
      <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-ink-4">{label}</span>
      <span className={`text-[11px] text-ink-1 tabular-nums ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Hairline() {
  return <div className="h-px bg-line" />;
}

function RuledLabel({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center gap-3 px-5">
      <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-ink-3 shrink-0">
        {left}
      </span>
      <span className="h-px flex-1 bg-line" />
      <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-ink-4 shrink-0">
        {right}
      </span>
    </div>
  );
}
