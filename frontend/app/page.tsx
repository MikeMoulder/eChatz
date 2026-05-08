import Link from "next/link";
import { ConnectButton } from "../components/ConnectButton";
import { Logo, LogoMark } from "../components/Logo";
import {
  ArrowRightIcon,
  CheckIcon,
  GithubIcon,
  LockIcon,
  TerminalIcon,
  ZapIcon,
} from "../components/Icons";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden animate-page-enter">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_8%,rgba(212,160,23,0.10),transparent_32%),radial-gradient(circle_at_85%_22%,rgba(212,160,23,0.08),transparent_30%)]"
        aria-hidden
      />
      <SiteHeader />
      <Hero />
      <Manifesto />
      <FeatureGrid />
      <Faq />
      <FinalCta />
      <SiteFooter />
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg-1/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
        <Logo />
        <nav className="hidden items-center gap-1 text-[13px] text-ink-2 lg:flex">
          {[
            ["Why eChatz", "#why"],
            ["Features", "#features"],
            ["FAQ", "#faq"],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="px-3 py-1.5 hover:text-ink-1 hover:bg-white/4 transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="hidden md:grid h-10 w-10 place-items-center text-ink-2 hover:text-ink-1 border border-line hover:border-line-strong transition-colors"
          >
            <GithubIcon size={14} />
          </a>
          <ConnectButton compact />
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative border-b border-line">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-50" aria-hidden />
      <div className="pointer-events-none absolute inset-0 scanlines" aria-hidden />

      <div className="relative mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-12">
        <div className="border-r-0 lg:border-r border-line lg:col-span-7 px-6 py-16 md:px-12 md:py-24">
          <div
            className="section-eyebrow mb-8 reveal"
            style={{ animationDelay: "60ms" }}
          >
            <span>FILE / 01 - welcome</span>
          </div>

          <h1 className="font-display text-[44px] md:text-[64px] lg:text-[72px] leading-[1.02] font-semibold tracking-tightest text-ink-0">
            <span className="reveal block" style={{ animationDelay: "120ms" }}>
              Message like
            </span>
            <span
              className="reveal block font-serif italic font-normal text-accent hero-italic"
              style={{ animationDelay: "220ms" }}
            >
              no one is watching.
            </span>
            <span className="reveal block" style={{ animationDelay: "320ms" }}>
              Keep your chat,
            </span>
            <span className="reveal block" style={{ animationDelay: "400ms" }}>
              your way.
            </span>
          </h1>

          <p
            className="reveal mt-8 max-w-xl text-[16px] leading-relaxed text-ink-2"
            style={{ animationDelay: "520ms" }}
          >
            <span className="text-ink-0 font-medium">echatz</span> is private chat for people who
            care about ownership. No phone number, no central inbox, and no admin account that can
            take over your identity.
          </p>

          <div
            className="reveal mt-10 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "620ms" }}
          >
            <Link href="/chat" className="btn-accent btn-press h-12 px-5 text-[14px]">
              <TerminalIcon size={14} strokeWidth={2.4} /> Open the app
              <ArrowRightIcon size={14} strokeWidth={2.4} />
            </Link>
            <a href="#why" className="btn-ghost btn-press h-12 px-5 text-[14px]">
              Why eChatz
            </a>
          </div>
        </div>

        <div className="lg:col-span-5 p-6 md:p-10 reveal" style={{ animationDelay: "320ms" }}>
          <CipherPreview />
        </div>
      </div>
    </section>
  );
}

function CipherPreview() {
  return (
    <div className="cipher-card relative flex min-h-[560px] flex-col surface-2 overflow-hidden">
      <span className="corner-tl" />
      <span className="corner-tr" />
      <span className="corner-bl" />
      <span className="corner-br" />

      {/* Static ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_-12%,rgba(212,160,23,0.20),transparent_44%),radial-gradient(circle_at_-8%_112%,rgba(212,160,23,0.08),transparent_48%)]"
        aria-hidden
      />

      {/* Status strip */}
      <div className="relative flex items-center justify-between border-b border-line/70 bg-bg-2/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
        <span>cipher · thread</span>
        <span className="flex items-center gap-1.5 text-accent-bright">
          <LockIcon size={10} strokeWidth={2.4} />
          end-to-end
        </span>
      </div>

      {/* Identity row */}
      <div className="relative flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center border border-accent/40 bg-accent/[0.08] font-display text-[15px] font-semibold text-accent-bright">
          A
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-[15px] font-medium text-ink-1">alex.eth</span>
            <span className="inline-flex items-center gap-1 border border-accent/30 bg-accent/[0.06] px-1.5 py-[2px] font-mono text-[9px] uppercase tracking-[0.14em] text-accent-bright">
              <CheckIcon size={9} strokeWidth={2.8} /> verified
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-ink-3">
            <span>0x42a9…f7a3</span>
            <span className="text-ink-5">·</span>
            <span className="inline-flex items-center gap-1 text-ok">
              <span className="h-1 w-1 rounded-full bg-ok" /> online
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="relative flex-1 overflow-hidden px-4 py-5">
        <div className="space-y-3.5">
          <Bubble side="in" name="alex.eth" time="14:02" delay={560}>
            dinner was perfect — split it three ways?
          </Bubble>
          <Bubble side="out" name="you" time="14:03" delay={780}>
            on it.
          </Bubble>
          <PaymentCard delay={960} />
          <Bubble side="in" name="alex.eth" time="14:05" delay={1180}>
            received <span className="text-accent">✦</span> thanks
          </Bubble>
        </div>
      </div>

      {/* Composer */}
      <div
        className="reveal relative border-t border-line bg-bg-2/60"
        style={{ animationDelay: "1320ms" }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="font-mono text-[11px] tracking-wider text-accent">/pay</span>
          <span className="flex-1 truncate font-mono text-[12px] text-ink-2">
            alex.eth <span className="text-ink-3">·</span> 14 dai
            <span
              className="cipher-caret ml-1 inline-block h-[12px] w-[1.5px] translate-y-[2px] bg-accent align-middle"
              aria-hidden
            />
          </span>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="inline-flex items-center gap-1.5 border border-accent/50 bg-accent/[0.10] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-bright hover:bg-accent/[0.18] transition-colors"
          >
            send <ArrowRightIcon size={10} strokeWidth={2.6} />
          </button>
        </div>
        <div className="flex items-center gap-2 border-t border-line/70 px-4 py-2 font-mono text-[10px] text-ink-3">
          <span className="uppercase tracking-[0.16em]">try</span>
          {["/split", "/escrow", "/vote", "/schedule"].map((cmd) => (
            <span
              key={cmd}
              className="border border-line bg-bg-3 px-1.5 py-[2px] text-ink-2 hover:border-accent/40 hover:text-accent-bright transition-colors cursor-default"
            >
              {cmd}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Bubble({
  side,
  name,
  time,
  children,
  delay,
}: {
  side: "in" | "out";
  name: string;
  time: string;
  children: React.ReactNode;
  delay: number;
}) {
  const isOut = side === "out";
  return (
    <div
      className={`reveal flex flex-col ${isOut ? "items-end" : "items-start"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`flex items-baseline gap-2 px-1 ${isOut ? "flex-row-reverse" : ""}`}>
        <span
          className={`font-display text-[12px] font-medium ${
            isOut ? "text-accent-bright" : "text-ink-1"
          }`}
        >
          {name}
        </span>
        <span className="font-mono text-[10px] text-ink-3">{time}</span>
      </div>
      <div
        className={`mt-1 max-w-[86%] border px-3 py-2 text-[13px] leading-relaxed ${
          isOut
            ? "border-accent/30 bg-accent/[0.08] text-ink-1"
            : "border-line bg-bg-2/70 text-ink-1"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function PaymentCard({ delay }: { delay: number }) {
  return (
    <div className="reveal" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-baseline gap-2 px-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
          payment
        </span>
        <span className="font-mono text-[10px] text-ink-3">14:04</span>
      </div>
      <div className="mt-1 border border-accent/40 bg-accent/[0.06]">
        <div className="flex items-center gap-3 px-3 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center border border-accent/40 bg-accent/[0.12] text-accent">
            <ZapIcon size={14} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[20px] leading-none text-ink-0">14.00</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                dai
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-ink-3">
              <span>→ alex.eth</span>
              <span className="text-ink-5">·</span>
              <span className="text-ink-2">0xb1c0…2e87</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 self-start border border-accent/40 px-1.5 py-[2px] font-mono text-[9px] uppercase tracking-[0.14em] text-accent-bright whitespace-nowrap">
            <CheckIcon size={9} strokeWidth={2.8} /> confirmed
          </span>
        </div>
      </div>
    </div>
  );
}

function Manifesto() {
  return (
    <section id="why" className="border-b border-line">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-12">
        <aside className="reveal lg:col-span-4 border-b lg:border-b-0 lg:border-r border-line p-6 md:p-10">
          <div className="section-eyebrow mb-6">
            <span>FILE / 02 - values</span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tighter">
            Three reasons people choose eChatz.
          </h2>
        </aside>
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
          {[
            {
              n: "01",
              t: "Private by default",
              b: "Your chat experience starts from privacy, not from tracking or account collection.",
            },
            {
              n: "02",
              t: "You own your identity",
              b: "Your wallet is your account. You are not tied to a centralized profile system.",
            },
            {
              n: "03",
              t: "Useful in real life",
              b: "Plan, discuss, and settle payments in one conversation flow.",
            },
          ].map((card, index) => (
            <article
              key={card.n}
              className="reveal p-6 md:p-10"
              style={{ animationDelay: `${120 + index * 100}ms` }}
            >
              <div className="font-mono text-[11px] tracking-wider text-accent">{card.n}</div>
              <h3 className="mt-4 font-display text-xl font-semibold tracking-tighter">
                {card.t}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{card.b}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureGrid() {
  const features = [
    {
      n: "01",
      t: "Wallet-first onboarding",
      b: "Get started without phone numbers, emails, or recovery forms.",
    },
    {
      n: "02",
      t: "Clean conversation flow",
      b: "A familiar interface with fast actions and clear message history.",
    },
    {
      n: "03",
      t: "Payments in context",
      b: "Handle common payment actions without leaving your chat.",
    },
    {
      n: "04",
      t: "No central gatekeeper",
      b: "Your identity and communication are not controlled by one company.",
    },
    {
      n: "05",
      t: "Built for teams",
      b: "Coordinate plans, costs, and decisions in one place.",
    },
    {
      n: "06",
      t: "Made for web3 users",
      b: "Designed around how wallet-native users already work every day.",
    },
  ];

  return (
    <section id="features" className="border-b border-line">
      <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-24">
        <div className="reveal section-eyebrow mb-4">
          <span>FILE / 03 - features</span>
        </div>
        <h2 className="reveal mb-12 max-w-2xl font-display text-3xl md:text-5xl font-semibold tracking-tightest">
          The essentials, without the technical clutter.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-line">
          {features.map((feature, index) => (
            <article
              key={feature.n}
              className="reveal feature-card group bg-bg-1 p-6 transition-colors"
              style={{ animationDelay: `${100 + index * 70}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-wider text-accent">
                  {feature.n}
                </span>
                <span className="h-1.5 w-1.5 bg-ink-5 transition-colors group-hover:bg-accent group-hover:animate-pulse-soft" />
              </div>
              <h3 className="mt-6 font-display text-base font-semibold tracking-tighter leading-tight">
                {feature.t}
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{feature.b}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    {
      q: "Do I need a phone number to use eChatz?",
      a: "No. You connect with your wallet and create your profile there.",
    },
    {
      q: "Who controls my account?",
      a: "You do. Your identity stays tied to your wallet.",
    },
    {
      q: "Can I send payments in chat?",
      a: "Yes. eChatz supports common payment actions directly inside conversations.",
    },
    {
      q: "Is this only for technical users?",
      a: "No. The goal is a familiar and easy messaging experience for everyday use.",
    },
  ];

  return (
    <section id="faq" className="border-b border-line">
      <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="reveal lg:col-span-4">
            <div className="section-eyebrow mb-4">
              <span>FILE / 04 - faq</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tightest">
              Plain answers, no jargon.
            </h2>
          </div>

          <div className="lg:col-span-8 divide-y divide-line border-y border-line">
            {items.map((item, index) => (
              <details
                key={index}
                className="reveal group py-5 px-1"
                style={{ animationDelay: `${100 + index * 80}ms` }}
              >
                <summary className="flex cursor-pointer items-start justify-between gap-6 list-none">
                  <span className="font-display text-[17px] md:text-[18px] tracking-tighter text-ink-1 group-hover:text-accent-bright transition-colors">
                    {item.q}
                  </span>
                  <span className="mt-1 text-accent shrink-0 transition-transform duration-200 group-open:rotate-45 font-mono text-xl leading-none">
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink-2">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-b border-line">
      <div className="relative mx-auto max-w-[1400px] px-6 py-20 md:py-28 md:px-12">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" aria-hidden />
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="reveal lg:col-span-7">
            <div className="section-eyebrow mb-4">
              <span>ready to start</span>
            </div>
            <h2 className="font-display text-4xl md:text-6xl font-semibold tracking-tightest leading-[1.02]">
              Chat with ownership,
              <br />
              <span className="font-serif italic font-normal text-accent">not compromise.</span>
            </h2>
          </div>

          <div className="reveal lg:col-span-5" style={{ animationDelay: "120ms" }}>
            <p className="text-[14px] leading-relaxed text-ink-2">
              Connect your wallet, create your profile, and start your first conversation in
              minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/chat" className="btn-accent btn-press h-12 px-5 text-[14px]">
                Open eChatz
                <ArrowRightIcon size={14} strokeWidth={2.4} />
              </Link>
              <a href="#features" className="btn-ghost btn-press h-12 px-5 text-[14px]">
                Explore features
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  const cols: { title: string; links: [string, string][] }[] = [
    {
      title: "Product",
      links: [["Why eChatz", "#why"], ["Features", "#features"], ["FAQ", "#faq"]],
    },
    {
      title: "App",
      links: [["Open chat", "/chat"], ["Connect wallet", "/chat"]],
    },
    {
      title: "Build",
      links: [["GitHub", "#"]],
    },
    {
      title: "Network",
      links: [["Zama", "https://zama.ai"]],
    },
  ];

  return (
    <footer className="bg-bg-0">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12 py-14">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          <div className="col-span-2">
            <Logo size="lg" />
            <p className="mt-5 max-w-xs text-[13px] text-ink-3 leading-relaxed">
              Private wallet-native messaging for people who want control of their conversations.
            </p>
          </div>
          {cols.map((column) => (
            <div key={column.title}>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
                {column.title}
              </div>
              <ul className="mt-4 space-y-2">
                {column.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-[13px] text-ink-1 hover:text-accent-bright transition-colors"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-t border-line pt-6">
          <span className="font-mono text-[11px] text-ink-3">
            © 2026 echatz · Private conversations, owned by you.
          </span>
          <span className="font-mono text-[11px] text-ink-3 inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-ok" />
            wallet-native messaging · live now
          </span>
        </div>
      </div>

      <div className="overflow-hidden border-t border-line">
        <div className="mx-auto max-w-[1400px] px-6 py-10 md:py-16 md:px-12">
          <div className="flex items-center justify-center gap-4 select-none">
            <LogoMark size={64} />
            <span className="font-display text-[18vw] md:text-[14vw] leading-none font-semibold tracking-tightest text-ink-0">
              echatz<span className="text-accent">.</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
