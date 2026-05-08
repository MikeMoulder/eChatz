import Link from "next/link";
import { ConnectButton } from "../components/ConnectButton";
import { Logo, LogoMark } from "../components/Logo";
import { LiveTransmission } from "../components/LiveTransmission";
import {
  ArrowRightIcon,
  GithubIcon,
  TerminalIcon,
} from "../components/Icons";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden animate-page-enter">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_8%,rgba(212,160,23,0.04),transparent_34%),radial-gradient(circle_at_85%_22%,rgba(212,160,23,0.03),transparent_32%)]"
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
            href="https://github.com/MikeMoulder/echatz"
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
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(0,0,0,0.55),transparent_56%),linear-gradient(to_bottom,rgba(0,0,0,0.34),rgba(0,0,0,0.18))]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-50" aria-hidden />
      <div className="pointer-events-none absolute inset-0 scanlines" aria-hidden />

      <div className="relative mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-12 lg:gap-12 items-center">
        <div className="lg:col-span-7 px-6 py-16 md:px-12 md:py-24">
          <div
            className="section-eyebrow mb-8 reveal"
            style={{ animationDelay: "60ms" }}
          >
            <span>FILE / 01 - welcome</span>
          </div>

          <div className="flex items-center gap-3 select-none">
            <LogoMark size={44} />
            <h1 className="font-display text-[15vw] md:text-[8vw] leading-none font-semibold tracking-tightest text-ink-0">
              echatz<span className="text-accent">.</span>
            </h1>
          </div>

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

        <div className="lg:col-span-5 px-6 pb-16 lg:py-24 lg:pl-0 lg:pr-12">
          <LiveTransmission />
        </div>
      </div>
    </section>
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
      links: [["GitHub", "https://github.com/MikeMoulder/echatz"]],
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
