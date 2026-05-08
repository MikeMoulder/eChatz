"use client";

import { ChatWindow } from "@/components/ChatWindow";
import { ConnectButton } from "@/components/ConnectButton";
import { RegisterPrompt } from "@/components/RegisterPrompt";
import { Logo } from "@/components/Logo";
import { LockIcon, ShieldIcon, ZapIcon } from "@/components/Icons";
import { useAccount } from "wagmi";
import { useRegistration } from "@/hooks/useRegistration";
import Link from "next/link";

export default function ChatPage() {
  const { isConnected } = useAccount();
  const { status, error, register } = useRegistration();

  if (!isConnected) return <ConnectGate />;
  if (status === "loading") return <IdentityLoadingGate />;
  if (status === "wrong-network") return <WrongNetworkGate />;
  if (status === "unregistered" || status === "error") {
    return <RegisterPrompt register={register} error={error} />;
  }

  return <ChatWindow />;
}

function ConnectGate() {
  return (
    <div className="relative grid min-h-screen place-items-center px-6 bg-bg-1">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="pointer-events-none absolute inset-0 scanlines" aria-hidden />

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        <div className="relative surface-2 p-8 md:p-10">
          <span className="corner-tl" />
          <span className="corner-tr" />
          <span className="corner-bl" />
          <span className="corner-br" />

          <div className="mb-6 flex items-center justify-between">
            <Logo size="md" />
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-3 hover:text-ink-1 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
              </Link>
              <span className="chip">offline</span>
            </div>
          </div>

          <div className="section-eyebrow"><span>auth · gate</span></div>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tightest leading-[1.05]">
            Connect your wallet <br /> to begin.
          </h1>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
            Your wallet is your identity, your encryption key, and your inbox — all in one. There
            is no email, no phone number, no password to lose.
          </p>

          <div className="mt-7">
            <ConnectButton />
          </div>

          <div className="mt-8 grid gap-px bg-line">
            <Bullet
              icon={<LockIcon size={13} />}
              text="We never see your private key. Encryption happens locally in your browser."
            />
            <Bullet
              icon={<ShieldIcon size={13} />}
              text="You'll register once before sending the first message and it all happens encrypted!"
            />
            <Bullet
              icon={<ZapIcon size={13} />}
              text="Sepolia / Zama fhEVM. Network detection runs once your wallet is connected."
            />
          </div>
        </div>

        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-wider text-ink-4">
          echatz · v4.0 · build A1F3-2026.05.04
        </p>
      </div>
    </div>
  );
}

function Bullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="bg-bg-1 flex items-start gap-3 p-3.5">
      <span className="grid h-6 w-6 shrink-0 place-items-center bg-bg-3 border border-line text-accent">
        {icon}
      </span>
      <p className="text-[12.5px] leading-relaxed text-ink-2">{text}</p>
    </div>
  );
}

function IdentityLoadingGate() {
  return (
    <div className="grid min-h-screen place-items-center px-6 bg-bg-1">
      <div className="text-center animate-fade-in">
        <div className="mx-auto mb-4 inline-block">
          <span className="block skeleton h-2 w-32" />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
          checking identityregistry…
        </p>
      </div>
    </div>
  );
}

function WrongNetworkGate() {
  return (
    <div className="grid min-h-screen place-items-center px-6 bg-bg-1">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="relative z-10 w-full max-w-md animate-fade-in-up text-center">
        <div className="relative surface-2 p-8">
          <span className="corner-tl" /><span className="corner-tr" />
          <span className="corner-bl" /><span className="corner-br" />
          <div className="section-eyebrow mb-3"><span>network · error</span></div>
          <h2 className="font-display text-2xl font-semibold tracking-tighter">Wrong network</h2>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
            eChatz is deployed on <span className="font-mono text-ink-0">Sepolia</span>.
            Please switch your wallet to Sepolia and try again.
          </p>
        </div>
      </div>
    </div>
  );
}
