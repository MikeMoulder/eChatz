"use client";

import { useState } from "react";
import { Logo } from "./Logo";
import { LockIcon, ShieldIcon, ZapIcon, CheckIcon, FileCodeIcon } from "./Icons";

interface Props {
  register: (username: string, bio: string) => Promise<void>;
  error?: string | null;
}

export function RegisterPrompt({ register, error }: Props) {
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"idle" | "signing" | "encrypting" | "submitting">("idle");
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    setLocalError(null);
    try {
      setStep("signing");
      const t1 = setTimeout(() => setStep("encrypting"), 1500);
      const t2 = setTimeout(() => setStep("submitting"), 3500);
      try {
        await register(username.trim(), bio.trim());
      } finally {
        clearTimeout(t1);
        clearTimeout(t2);
      }
      setStep("idle");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
      setStep("idle");
    } finally {
      setBusy(false);
    }
  }

  const displayError = localError ?? error;

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg-1">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" aria-hidden />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-[1280px] grid-cols-1 lg:grid-cols-[1.1fr_1fr] lg:items-stretch">
        {/* Left — pitch */}
        <aside className="hidden lg:flex flex-col justify-between border-r border-line p-12 animate-fade-in-up">
          <div>
            <Logo size="lg" />
            <div className="mt-12 section-eyebrow"><span>onboarding · register</span></div>
            <h1 className="mt-4 font-display text-4xl xl:text-5xl font-semibold tracking-tightest leading-[1.05]">
              Create your <span className="font-serif italic text-accent">encrypted</span> identity.
            </h1>
            <p className="mt-5 max-w-md text-[14px] leading-relaxed text-ink-2">
              Your username, bio and public key live inside <span className="font-mono text-ink-0">an Onchain Registry</span> on
              Zama fhEVM. The contract verifies your key derives from your address before storing
              anything. There is no off-chain directory and no recovery account.
            </p>
          </div>

          <ol className="mt-10 grid gap-px bg-line">
            <Bullet
              n="01"
              icon={<ZapIcon size={13} />}
              title="One signature for your public key"
              body="A wallet sign challenge lets the program recover your 65-byte uncompressed ECDSA key. No extra wallet permissions."
            />
            <Bullet
              n="02"
              icon={<LockIcon size={13} />}
              title="One FHE encryption pass"
              body="Username and bio are added to a single encryptedInput, sealed with one inputProof, before they ever leave your browser."
            />
            <Bullet
              n="03"
              icon={<ShieldIcon size={13} />}
              title="One on-chain transaction"
              body="All transactions stored onchain are verifiable, immutable."
            />
          </ol>

          <div className="mt-10 surface px-4 py-3 font-mono text-[11px] text-ink-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <FileCodeIcon size={12} className="text-accent" /> IdentityRegistry.sol
            </span>
            <span>v4.0 · sepolia</span>
          </div>
        </aside>

        {/* Right — form */}
        <div className="p-6 md:p-12 flex items-center animate-fade-in-up [animation-delay:80ms]">
          <div className="w-full max-w-md mx-auto">
            <div className="lg:hidden mb-8 flex justify-center">
              <Logo size="md" />
            </div>

            <div className="relative surface-2 p-8">
              <span className="corner-tl" />
              <span className="corner-tr" />
              <span className="corner-bl" />
              <span className="corner-br" />

              <div className="section-eyebrow"><span>form · echatz/register</span></div>
              <h2 className="mt-3 font-display text-2xl font-semibold tracking-tighter">
                Register your handle
              </h2>
              <p className="mt-1 text-[13px] text-ink-2">
                Encrypted on-chain. Stored once. Yours forever.
              </p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                <Field
                  label="Username"
                  hint="Up to 32 bytes · stored as euint256"
                  input={
                    <input
                      type="text"
                      maxLength={32}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="satoshi"
                      className="input-base h-11 w-full px-3.5 text-[14px]"
                      required
                      autoFocus
                    />
                  }
                  counter={`${username.length}/32`}
                />

                <Field
                  label="Bio"
                  hint="Optional · also encrypted"
                  input={
                    <input
                      type="text"
                      maxLength={32}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="building in the open"
                      className="input-base h-11 w-full px-3.5 text-[14px]"
                    />
                  }
                  counter={`${bio.length}/32`}
                />

                {busy && (
                  <div className="surface p-3 animate-fade-in">
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <ProgressStep label="Sign"   active={step === "signing"}    done={step === "encrypting" || step === "submitting"} />
                      <ProgressStep label="Encrypt" active={step === "encrypting"} done={step === "submitting"} />
                      <ProgressStep label="Submit"  active={step === "submitting"} />
                    </div>
                  </div>
                )}

                {displayError && (
                  <div className="border border-danger/30 bg-danger/10 p-3 text-[12px] text-danger animate-fade-in font-mono">
                    {displayError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy || !username.trim()}
                  className="btn-accent h-11 w-full text-[14px]"
                >
                  {busy ? "Registering…" : "Register identity"}
                </button>

                <p className="text-center font-mono text-[10px] uppercase tracking-wider text-ink-3">
                  1 signature · 1 encryption · 1 transaction
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  input,
  counter,
}: {
  label: string;
  hint: string;
  input: React.ReactNode;
  counter?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">{label}</span>
        {counter && <span className="font-mono text-[10px] text-ink-4">{counter}</span>}
      </div>
      {input}
      <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-wider text-ink-3">
        {hint}
      </span>
    </label>
  );
}

function Bullet({
  n,
  icon,
  title,
  body,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="bg-bg-1 flex gap-4 p-4">
      <div className="flex flex-col items-center gap-2 shrink-0">
        <span className="grid h-7 w-7 place-items-center bg-accent text-accent-ink">{icon}</span>
        <span className="font-mono text-[10px] tracking-wider text-ink-3">{n}</span>
      </div>
      <div>
        <p className="font-display text-[15px] font-semibold tracking-tighter text-ink-1">{title}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{body}</p>
      </div>
    </li>
  );
}

function ProgressStep({
  label,
  active,
  done,
}: {
  label: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`grid h-5 w-5 place-items-center text-[10px] transition-colors ${
          done
            ? "bg-accent text-accent-ink"
            : active
              ? "bg-accent-soft text-accent-bright border border-accent/40 animate-pulse-soft"
              : "bg-bg-3 text-ink-4 border border-line"
        }`}
      >
        {done ? <CheckIcon size={11} strokeWidth={2.5} /> : null}
      </span>
      <span className={`font-mono uppercase tracking-wider text-[10px] ${done || active ? "text-ink-1" : "text-ink-3"}`}>
        {label}
      </span>
    </div>
  );
}
