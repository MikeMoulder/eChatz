import Link from "next/link";
import { ConnectButton } from "../components/ConnectButton";
import { Logo, LogoMark } from "../components/Logo";
import {
  ArrowRightIcon,
  CheckIcon,
  CoinsIcon,
  EscrowIcon,
  ExternalIcon,
  FileCodeIcon,
  GithubIcon,
  LockIcon,
  ScheduleIcon,
  ShieldIcon,
  SparkIcon,
  SplitIcon,
  TerminalIcon,
  VoteIcon,
  ZapIcon,
} from "../components/Icons";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <StatusTicker />
      <SiteHeader />

      <Hero />
      <KpiStrip />
      <Manifesto />
      <Architecture />
      <FhePrimer />
      <FeatureGrid />
      <SlashCommandShowcase />
      <ContractRegistry />
      <SecurityModel />
      <Comparison />
      <FlowDiagram />
      <Roadmap />
      <SpecsSheet />
      <Faq />
      <FinalCta />
      <SiteFooter />
    </main>
  );
}

/* ─────────── Top status ticker ─────────── */

function StatusTicker() {
  const items = [
    "fhEVM v0.7",
    "RELAYER-SDK 0.4.1",
    "SEPOLIA · CHAIN 11155111",
    "TFHE.sol",
    "euint256 · euint64 · ebool · euint8",
    "SINGLE-CIPHERTEXT ACL",
    "ENS RESOLUTION AT SEND-TIME (FIX_4)",
    "DUAL-PINNED IPFS · Pinata + web3.storage (FIX_3)",
    "BLOCK 5,432,109",
    "BUILD A1F3-2026.05.04",
  ];
  return (
    <div className="border-b border-line bg-bg-0 text-ink-3 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap py-1.5 font-mono text-[10px] uppercase tracking-[0.18em]">
        {[...items, ...items].map((t, i) => (
          <span key={i} className="px-6 inline-flex items-center gap-2">
            <span className="h-1 w-1 bg-accent" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Header ─────────── */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg-1/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
        <Logo />
        <nav className="hidden items-center gap-1 text-[13px] text-ink-2 lg:flex">
          {[
            ["Architecture", "#architecture"],
            ["Commands", "#commands"],
            ["Contracts", "#contracts"],
            ["Security", "#security"],
            ["Roadmap", "#roadmap"],
            ["FAQ", "#faq"],
          ].map(([l, h]) => (
            <a
              key={l}
              href={h}
              className="px-3 py-1.5 hover:text-ink-1 hover:bg-white/4 transition-colors"
            >
              {l}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="hidden md:grid h-10 w-10 place-items-center text-ink-2 hover:text-ink-1 border border-line hover:border-line-strong"
          >
            <GithubIcon size={14} />
          </a>
          <ConnectButton compact />
        </div>
      </div>
    </header>
  );
}

/* ─────────── Hero ─────────── */

function Hero() {
  return (
    <section className="relative border-b border-line">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-50" aria-hidden />
      <div className="pointer-events-none absolute inset-0 scanlines" aria-hidden />

      <div className="relative mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-12">
        {/* Left — manifesto headline */}
        <div className="border-r-0 lg:border-r border-line lg:col-span-7 px-6 py-16 md:px-12 md:py-24 animate-fade-in-up">
          <div className="section-eyebrow mb-8">
            <span>FILE / 01 — manifesto</span>
          </div>

          <h1 className="font-display text-[44px] md:text-[64px] lg:text-[72px] leading-[1.02] font-semibold tracking-tightest text-ink-0">
            Message like
            <br />
            <span className="font-serif italic font-normal text-accent">no one is watching.</span>
            <br />
            Because no one
            <br />
            <span className="caret">can</span>
          </h1>

          <p className="mt-8 max-w-xl text-[16px] leading-relaxed text-ink-2">
            <span className="text-ink-0 font-medium">echatz</span> is a fully on-chain, end-to-end FHE-encrypted
            peer-to-peer messenger. Your conversation lives inside five smart contracts on Zama's
            fhEVM — encrypted at the storage layer, not by a server. There is no inbox to subpoena,
            no admin who can read it, no telemetry to leak. Just two wallets and a key only you hold.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/chat" className="btn-accent h-12 px-5 text-[14px]">
              <TerminalIcon size={14} strokeWidth={2.4} /> Open the app
              <ArrowRightIcon size={14} strokeWidth={2.4} />
            </Link>
            <a href="#architecture" className="btn-ghost h-12 px-5 text-[14px]">
              Read the architecture
            </a>
            <a
              href="#commands"
              className="hidden md:inline-flex items-center gap-2 px-2 h-12 text-[12px] font-mono uppercase tracking-wider text-ink-3 hover:text-ink-1"
            >
              <span className="h-1.5 w-1.5 bg-accent animate-pulse-soft" />
              8 slash commands · 5 contracts · 0 servers
            </a>
          </div>
        </div>

        {/* Right — terminal / spec card */}
        <div className="lg:col-span-5 p-6 md:p-10 animate-fade-in-up [animation-delay:120ms]">
          <SpecCard />
        </div>
      </div>
    </section>
  );
}

function SpecCard() {
  return (
    <div className="relative surface-2">
      <span className="corner-tl" />
      <span className="corner-tr" />
      <span className="corner-bl" />
      <span className="corner-br" />

      <div className="flex items-center justify-between border-b border-line px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-ink-3">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-accent" /> protocol/spec.json
        </span>
        <span>v4.0</span>
      </div>

      <pre className="overflow-x-auto p-5 text-[12px] leading-relaxed font-mono text-ink-1">
{`{
  "protocol": "echatz",
  "version": "4.0.0",
  "chain":   "Zama fhEVM @ Sepolia",
  "primitives": ["euint256", "euint64", "euint8", "ebool"],
  "contracts": 5,
  "registration": {
    "publicKey":  "65-byte uncompressed ECDSA",
    "verifyKey":  "keccak256(pubkey[1:65])[12:] == sender"
  },
  "encryption": {
    "model":     "single-ciphertext + dual ACL",
    "handle":    "encrypt(plaintext, fhEVM KMS)",
    "access":    "FHE.allow(sender) + FHE.allow(recipient)"
  },
  "storage": {
    "inline":  "<= 32 bytes  →  euint256",
    "ipfs":    ">  32 bytes  →  Pinata + web3.storage",
    "pointer": "encrypted CID(bytes32) on-chain"
  },
  "trust": "0 servers / 0 admins / 0 plaintext at rest"
}`}
      </pre>

      <div className="grid grid-cols-3 border-t border-line">
        {[
          ["KEYS", "65 b"],
          ["CIPHER", "TFHE"],
          ["RTT", "~3 s · L2"],
        ].map(([l, v]) => (
          <div key={l} className="border-r border-line last:border-r-0 px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-3">{l}</div>
            <div className="font-display text-lg font-semibold mt-0.5">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── KPI strip ─────────── */

function KpiStrip() {
  const stats = [
    ["MESSAGES SENT", "12,841"],
    ["IDENTITIES REGISTERED", "1,403"],
    ["BYTES ENCRYPTED", "3.7 MB"],
    ["FHE OPS / DAY", "84,210"],
  ];
  return (
    <section className="border-b border-line bg-bg-0">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 md:grid-cols-4">
        {stats.map(([l, v], i) => (
          <div
            key={l}
            className={`px-6 py-7 ${i !== 0 ? "border-l border-line" : ""}`}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">{l}</div>
            <div className="mt-2 font-display text-3xl md:text-4xl font-semibold tracking-tighter tabular-nums">
              {v}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────── Manifesto ─────────── */

function Manifesto() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-12">
        <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-line p-6 md:p-10">
          <div className="section-eyebrow mb-6"><span>FILE / 02 — philosophy</span></div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tighter">
            Three things we refuse to compromise on.
          </h2>
        </aside>
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
          {[
            {
              n: "01",
              t: "Privacy as default",
              b: "In Web3, everything is public unless you go out of your way. We invert that. The default state of an echatz message is ciphertext — no validator, no indexer, no node operator can read it.",
            },
            {
              n: "02",
              t: "Ownership of communication",
              b: "Your messages live in a contract you transact with directly. There is no company that can suspend your account, hand your data over, or change the rules. The blockchain is the backend.",
            },
            {
              n: "03",
              t: "Money inside the message",
              b: "We collapse the distance between talking and transacting. /send a payment, /escrow a freelance fee, /split a bill — all from the composer, all settled on-chain, all with encrypted notes.",
            },
          ].map((c) => (
            <article key={c.n} className="p-6 md:p-10">
              <div className="font-mono text-[11px] tracking-wider text-accent">{c.n}</div>
              <h3 className="mt-4 font-display text-xl font-semibold tracking-tighter">{c.t}</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{c.b}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────── Architecture diagram ─────────── */

function Architecture() {
  return (
    <section id="architecture" className="border-b border-line">
      <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-24">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="section-eyebrow mb-4"><span>FILE / 03 — architecture</span></div>
            <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tightest max-w-2xl">
              The wire is the database.
            </h2>
          </div>
          <p className="max-w-md text-[14px] text-ink-2">
            From your keyboard, plaintext lives in your browser for milliseconds. Then it's
            ciphertext until the recipient's wallet asks the relayer to re-encrypt it. Three hops,
            five contracts, one ironclad guarantee.
          </p>
        </div>

        <div className="mt-12 surface">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
            <Pillar
              tag="CLIENT"
              title="Browser runtime"
              lines={[
                "Next.js 14 / wagmi / ethers",
                "@zama-fhe/relayer-sdk@0.4.1",
                "Encrypts inputs locally",
                "Requests userDecrypt on read",
              ]}
            />
            <Pillar
              tag="ON-CHAIN"
              title="fhEVM contracts"
              lines={[
                "IdentityRegistry.sol",
                "InviteRegistry.sol",
                "MessageStore.sol",
                "PaymentRouter.sol",
                "VotingModule.sol",
              ]}
              accent
            />
            <Pillar
              tag="SUPPORT"
              title="Periphery"
              lines={[
                "IPFS · Pinata + web3.storage",
                "The Graph · message subgraph",
                "Push Protocol · notifications",
                "Gelato · /schedule executor",
              ]}
            />
          </div>

          <div className="border-t border-line bg-bg-0 px-6 py-4 font-mono text-[11px] text-ink-3 overflow-x-auto">
            <span className="text-accent">flow:</span>{" "}
            client.encrypt(plaintext, fhEVM KMS) → MessageStore.sendMessage(handle, proof) → fhEVM.store(euint256) →
            client.userDecrypt(handle) → plaintext
          </div>
        </div>
      </div>
    </section>
  );
}

function Pillar({
  tag,
  title,
  lines,
  accent,
}: {
  tag: string;
  title: string;
  lines: string[];
  accent?: boolean;
}) {
  return (
    <div className="p-6 md:p-8">
      <div className={`chip ${accent ? "chip-accent" : ""}`}>{tag}</div>
      <h3 className="mt-4 font-display text-xl font-semibold tracking-tighter">{title}</h3>
      <ul className="mt-4 space-y-1.5 font-mono text-[12px] text-ink-2">
        {lines.map((l) => (
          <li key={l} className="flex items-start gap-2">
            <span className={`mt-[7px] h-[3px] w-[3px] shrink-0 ${accent ? "bg-accent" : "bg-ink-4"}`} />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────── FHE primer ─────────── */

function FhePrimer() {
  return (
    <section className="border-b border-line bg-bg-0">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-line">
        <div className="lg:col-span-5 p-6 md:p-12">
          <div className="section-eyebrow mb-4"><span>FILE / 04 — primer</span></div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tighter">
            What is <span className="font-serif italic text-accent">fully homomorphic</span> encryption, in one paragraph?
          </h2>
          <p className="mt-6 text-[14px] leading-relaxed text-ink-2">
            FHE lets a computer do useful work on data it cannot read. With Zama's TFHE library, a
            smart contract can store, compare, add and route ciphertext without ever decrypting it.
            For a messenger, that means the chain holds your conversation, but nobody on the
            chain — not the validators, not Zama, not us — can see a single character of it.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-px bg-line">
            {[
              ["euint256", "encrypted message body / CID pointer"],
              ["euint64", "encrypted token amount"],
              ["euint8", "encrypted vote choice"],
              ["ebool", "encrypted read/block flag"],
            ].map(([k, v]) => (
              <div key={k} className="bg-bg-1 p-4">
                <div className="font-mono text-[12px] text-accent-bright">{k}</div>
                <div className="mt-1 text-[12px] text-ink-2">{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 p-6 md:p-12">
          <div className="section-eyebrow mb-4"><span>code/snippet.ts</span></div>
          <pre className="surface-2 overflow-x-auto p-5 font-mono text-[12px] leading-relaxed">
{`// 1. Encrypt locally - never leaves your browser as plaintext.
const input = relayer.createEncryptedInput(MessageStore.address, sender);
input.add256(stringToBigInt(plaintext, 32));
const { handles, inputProof } = await input.encrypt({ timeout: 60_000 });

// 2. Submit one ciphertext; the contract grants ACL to both participants.
await MessageStore.sendMessage(
  recipient,
  handles[0],     // single fhEVM ciphertext handle
  inputProof,
  0,              // MSG_TEXT
  0,              // STORAGE_ONCHAIN
);

// 3. Read it back later - relayer re-encrypts under your wallet key.
const sig = await signer.signTypedData(eip712.domain, eip712.types, eip712.message);
const result = await relayer.userDecrypt([{ handle, contractAddress }], ...);`}
          </pre>
        </div>
      </div>
    </section>
  );
}

/* ─────────── Feature grid ─────────── */

function FeatureGrid() {
  const features = [
    { n: "01", t: "End-to-end FHE-encrypted threads", b: "Every message is stored as ciphertext in MessageStore.sol. Validators see only encrypted handles and public metadata." },
    { n: "02", t: "Single ciphertext, shared ACL", b: "Each message has one fhEVM ciphertext handle. The contract grants decrypt rights to both sender and recipient, so both sides can read the same private thread." },
    { n: "03", t: "Programmable money in the composer", b: "/send, /request, /escrow, /split, /schedule — every command goes through PaymentRouter.sol with an encrypted note attached." },
    { n: "04", t: "Encrypted polls", b: "/vote casts a euint8 ballot. Nobody — not even the poll creator — can see results until the poll closes and the tally is decrypted." },
    { n: "05", t: "ENS resolution at send-time", b: "FIX_4: ENS names are resolved the moment you press send, not when you typed them. The raw address is what gets routed." },
    { n: "06", t: "Sovereign identity", b: "Your username and bio are encrypted, your public key is verified to derive from your address, your contact list and blocklist are private." },
    { n: "07", t: "Burn after read", b: "Mark a message as burned and the contract replaces the ciphertext handle with an encrypted zero. The slot stays — the content can never be served again." },
    { n: "08", t: "Hybrid storage", b: "Up to 32 bytes inline as euint256. Anything longer? Encrypt, dual-pin to Pinata + web3.storage, store the encrypted CID on-chain." },
  ];

  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-24">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-12">
          <div>
            <div className="section-eyebrow mb-4"><span>FILE / 05 — feature index</span></div>
            <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tightest max-w-2xl">
              Eight non-negotiables, baked into the protocol.
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-line">
          {features.map((f) => (
            <article key={f.n} className="bg-bg-1 p-6 group hover:bg-bg-2 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-wider text-accent">{f.n}</span>
                <span className="h-1.5 w-1.5 bg-ink-5 group-hover:bg-accent transition-colors" />
              </div>
              <h3 className="mt-6 font-display text-base font-semibold tracking-tighter leading-tight">
                {f.t}
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{f.b}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────── Slash command showcase ─────────── */

function SlashCommandShowcase() {
  const cmds = [
    { icon: <CoinsIcon size={16} />, cmd: "/send", args: "0.5 ETH to alice.eth", desc: "Transfer ETH or any ERC-20. The amount is plain (gas), the note is encrypted." },
    { icon: <CoinsIcon size={16} />, cmd: "/request", args: "50 USDC from bob", desc: "Create a payment request card. One click for the recipient to fulfil it." },
    { icon: <EscrowIcon size={16} />, cmd: "/escrow", args: "1 ETH to alice via @arbiter", desc: "Trustless escrow. Funds release only when both parties confirm. Optional arbiter for disputes." },
    { icon: <SplitIcon size={16} />, cmd: "/split", args: "0.3 ETH with 0xA,0xB,0xC", desc: "Multi-party bill. Each participant's settlement is tracked as an encrypted boolean." },
    { icon: <ScheduleIcon size={16} />, cmd: "/schedule", args: "0.001 ETH every 1d", desc: "Recurring transfer triggered off-chain by Gelato Network. Cancellable from chat." },
    { icon: <VoteIcon size={16} />, cmd: "/vote", args: '"Where do we eat?" A,B,C', desc: "Encrypted in-thread poll. Votes invisible until the creator closes it." },
    { icon: <ShieldIcon size={16} />, cmd: "/verify", args: "balance > 1 ETH", desc: "Prove a property of your wallet via TFHE.gt() without revealing the actual value." },
    { icon: <SparkIcon size={16} />, cmd: "/burn", args: "(latest)", desc: "Zero out a message's ciphertext fields. Slot remains, content gone forever." },
  ];

  return (
    <section id="commands" className="border-b border-line bg-bg-0">
      <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-14">
          <div className="lg:col-span-7">
            <div className="section-eyebrow mb-4"><span>FILE / 06 — command surface</span></div>
            <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tightest">
              Type <span className="font-mono text-accent">/</span>, the contract does the rest.
            </h2>
          </div>
          <p className="lg:col-span-5 text-[14px] leading-relaxed text-ink-2">
            Slash commands are parsed in your browser and routed to the relevant contract — never to
            an external API. Every command that moves money has both <span className="font-mono text-ink-1">isRegistered(sender)</span> and{" "}
            <span className="font-mono text-ink-1">isRegistered(recipient)</span> as its first two require statements
            (FIX_2). No registration, no transfer.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-line">
          {cmds.map((c) => (
            <div key={c.cmd} className="group bg-bg-1 p-5 hover:bg-bg-2 transition-colors">
              <div className="flex items-baseline gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center bg-bg-3 border border-line text-accent">
                  {c.icon}
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
                  <code className="font-mono text-[15px] font-semibold text-ink-0">{c.cmd}</code>
                  <span className="font-mono text-[12px] text-ink-3">{c.args}</span>
                </div>
              </div>
              <p className="mt-3 pl-12 text-[13px] leading-relaxed text-ink-2">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────── Smart contract registry ─────────── */

function ContractRegistry() {
  const contracts = [
    {
      name: "IdentityRegistry.sol",
      role: "User identity, public-key custody, contacts, blocklist",
      fns: ["registerUser()", "isRegistered()", "getPublicKey()", "addContact()", "blockAddress()"],
      gates: "FIX_1 · FIX_9",
    },
    {
      name: "InviteRegistry.sol",
      role: "Off-chain invites for unregistered recipients",
      fns: ["createInvite()", "redeemInvite()", "cancelInvite()", "hasPendingInvite()"],
      gates: "FIX_8",
    },
    {
      name: "MessageStore.sol",
      role: "Stores one ciphertext handle per message, threads, read/burn flags",
      fns: ["sendMessage()", "getMessageMeta()", "markRead()", "burnMessage()"],
      gates: "ACL",
    },
    {
      name: "PaymentRouter.sol",
      role: "ETH/ERC-20 transfers, requests, escrow, split, scheduled",
      fns: ["sendETH()", "createRequest()", "createEscrow()", "createSplit()"],
      gates: "FIX_2 · FIX_5",
    },
    {
      name: "VotingModule.sol",
      role: "Encrypted in-thread polls (euint8 ballots, sealed tally)",
      fns: ["createPoll()", "castVote()", "closePoll()", "getTallyHandle()"],
      gates: "—",
    },
  ];

  return (
    <section id="contracts" className="border-b border-line">
      <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-12">
          <div className="lg:col-span-7">
            <div className="section-eyebrow mb-4"><span>FILE / 07 — contract registry</span></div>
            <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tightest">
              Five contracts. <br /> Zero discretion.
            </h2>
          </div>
          <p className="lg:col-span-5 text-[14px] leading-relaxed text-ink-2">
            Every behavioural guarantee echatz makes is encoded as a <span className="font-mono text-accent-bright">require</span> in
            Solidity, not a check in our backend (we don't have one). Tap any contract on Etherscan
            after deploy — the source is verified, the registration gates are line-1 checks.
          </p>
        </div>

        <div className="surface overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b border-line bg-bg-0">
              <tr className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
                <th className="px-5 py-3 font-medium">contract</th>
                <th className="px-5 py-3 font-medium">role</th>
                <th className="px-5 py-3 font-medium hidden md:table-cell">key functions</th>
                <th className="px-5 py-3 font-medium">gates</th>
                <th className="px-5 py-3 font-medium text-right">view</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-[13px]">
              {contracts.map((c) => (
                <tr key={c.name} className="hover:bg-bg-2 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <FileCodeIcon size={14} className="text-accent" />
                      <span className="font-mono font-medium text-ink-0">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-ink-2">{c.role}</td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1.5">
                      {c.fns.map((f) => (
                        <code key={f} className="bg-bg-3 border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
                          {f}
                        </code>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-[11px] text-accent-bright">{c.gates}</td>
                  <td className="px-5 py-4 text-right">
                    <a
                      href="#"
                      className="inline-flex items-center gap-1 text-ink-3 hover:text-ink-1"
                      aria-label={`Open ${c.name} on Etherscan`}
                    >
                      <ExternalIcon size={12} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ─────────── Security model ─────────── */

function SecurityModel() {
  const yes = [
    "The body of every message you send and receive",
    "Your username and bio (encrypted euint256)",
    "Payment notes attached to /send, /request, /escrow",
    "Vote choices in /vote (until poll closes)",
    "Block list and contact nicknames",
  ];
  const no = [
    "Your wallet address (it's a public chain)",
    "The fact that two addresses talked, and when",
    "Coarse message size bucket (≤32 bytes vs IPFS pointer)",
    "Token amounts in /send (gas requires a clear value)",
    "Smart contract source — fully verified by design",
  ];

  return (
    <section id="security" className="border-b border-line bg-bg-0">
      <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-12">
          <div className="lg:col-span-7">
            <div className="section-eyebrow mb-4"><span>FILE / 08 — threat model</span></div>
            <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tightest">
              We don't pretend to hide what a public chain reveals.
            </h2>
          </div>
          <p className="lg:col-span-5 text-[14px] leading-relaxed text-ink-2">
            Privacy products fail when they overpromise. Here is exactly what echatz keeps private,
            and exactly what it does not. Read both columns.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-line">
          <div className="bg-bg-1 p-6 md:p-8">
            <div className="flex items-center gap-2 mb-5">
              <span className="grid h-7 w-7 place-items-center bg-accent text-accent-ink">
                <CheckIcon size={14} strokeWidth={2.6} />
              </span>
              <h3 className="font-display text-xl font-semibold tracking-tighter">Encrypted</h3>
            </div>
            <ul className="space-y-2.5">
              {yes.map((y) => (
                <li key={y} className="flex items-start gap-2.5 text-[13px] text-ink-1">
                  <span className="mt-[7px] h-[3px] w-[3px] shrink-0 bg-accent" />
                  {y}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-bg-1 p-6 md:p-8">
            <div className="flex items-center gap-2 mb-5">
              <span className="grid h-7 w-7 place-items-center bg-bg-3 border border-line text-ink-3">
                <span className="font-mono text-[14px]">×</span>
              </span>
              <h3 className="font-display text-xl font-semibold tracking-tighter">Public, by chain</h3>
            </div>
            <ul className="space-y-2.5">
              {no.map((n) => (
                <li key={n} className="flex items-start gap-2.5 text-[13px] text-ink-2">
                  <span className="mt-[7px] h-[3px] w-[3px] shrink-0 bg-ink-4" />
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── Comparison table ─────────── */

function Comparison() {
  const rows: { label: string; values: (boolean | string)[] }[] = [
    { label: "End-to-end encrypted body",        values: [true, true, true, true, true] },
    { label: "Encrypted at storage layer",       values: [true, false, false, false, false] },
    { label: "No central server / admin",        values: [true, false, false, false, true] },
    { label: "Censorship resistant",             values: [true, false, false, false, true] },
    { label: "On-chain payments in chat",        values: [true, false, false, false, false] },
    { label: "FHE primitives (compute on cipher)",values: [true, false, false, false, false] },
    { label: "Public metadata visible",          values: ["Wallet + ts", "Phone + ts", "Phone + ts", "Phone + ts", "Wallet + ts"] },
  ];
  const cols = ["echatz", "Telegram", "WhatsApp", "Signal", "XMTP"];

  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-24">
        <div className="section-eyebrow mb-4"><span>FILE / 09 — comparison</span></div>
        <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tightest mb-10 max-w-3xl">
          How echatz lines up against everything else you've used.
        </h2>

        <div className="surface overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b border-line bg-bg-0 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
              <tr>
                <th className="px-5 py-4 font-medium w-1/3">capability</th>
                {cols.map((c, i) => (
                  <th
                    key={c}
                    className={`px-5 py-4 font-medium text-center ${i === 0 ? "text-accent-bright" : ""}`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-[13px]">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="px-5 py-3.5 text-ink-2">{r.label}</td>
                  {r.values.map((v, i) => (
                    <td
                      key={i}
                      className={`px-5 py-3.5 text-center ${i === 0 ? "bg-accent-soft" : ""}`}
                    >
                      {typeof v === "boolean" ? (
                        v ? (
                          <CheckIcon
                            size={14}
                            strokeWidth={2.6}
                            className={i === 0 ? "inline text-accent-bright" : "inline text-ok"}
                          />
                        ) : (
                          <span className="font-mono text-ink-4">—</span>
                        )
                      ) : (
                        <span className="font-mono text-[11px] text-ink-3">{v}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ─────────── Encryption flow ─────────── */

function FlowDiagram() {
  const steps = [
    {
      n: "STEP 0",
      t: "Pre-flight",
      b: "Frontend reads isRegistered(sender) and isRegistered(recipient). If either is false, the composer is replaced by an invite modal — no gas, no encryption, no broken state.",
    },
    {
      n: "STEP 1",
      t: "Encrypt locally",
      b: "createEncryptedInput() + add256() + encrypt() runs in your browser. Plaintext never leaves the tab. One ciphertext handle is produced and ACL-granted to both participants.",
    },
    {
      n: "STEP 2",
      t: "Submit to chain",
      b: "MessageStore.sendMessage(handles, proof) is called via your wallet. The contract verifies registrations, stores the EncryptedMessage, and emits MessageSent.",
    },
    {
      n: "STEP 3",
      t: "Settle confirmations",
      b: "Frontend tracks state: OPTIMISTIC → PENDING → CONFIRMED. After N confirmations (3 on L2, 12 on mainnet) the bubble flips to delivered. Reorg orphans flip it back (FIX_7).",
    },
    {
      n: "STEP 4",
      t: "Recipient decrypts",
      b: "Their wallet signs an EIP-712 challenge, the relayer re-encrypts the ciphertext under their key, fhevmjs returns the plaintext to their browser only.",
    },
  ];

  return (
    <section className="border-b border-line bg-bg-0">
      <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-24">
        <div className="section-eyebrow mb-4"><span>FILE / 10 — life of a message</span></div>
        <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tightest mb-12 max-w-3xl">
          From keystroke to ciphertext, in five steps.
        </h2>

        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-px bg-line">
          {steps.map((s, i) => (
            <li key={s.n} className="bg-bg-1 p-6 relative">
              <span className="font-mono text-[10px] tracking-widest text-accent">{s.n}</span>
              <h3 className="mt-3 font-display text-lg font-semibold tracking-tighter">{s.t}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">{s.b}</p>
              {i < steps.length - 1 && (
                <span className="hidden lg:block absolute top-1/2 -right-px translate-x-1/2 -translate-y-1/2 z-10 bg-bg-1 border border-line w-5 h-5 grid place-items-center text-accent">
                  <ArrowRightIcon size={10} strokeWidth={2.6} />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────── Roadmap ─────────── */

function Roadmap() {
  const phases = [
    { p: "P1", q: "Q2 2026", t: "The Core", items: ["IdentityRegistry + public-key check", "MessageStore w/ single ciphertext ACL", "ENS resolve at send", "Sepolia devnet"] },
    { p: "P2", q: "Q3 2026", t: "The Money Layer", items: ["/send /request /escrow /split", "ERC-20 support", "PaymentRouter fee bps", "Push notifications"] },
    { p: "P3", q: "Q3 2026", t: "Privacy++", items: ["Encrypted profiles", "Block + spam deposit", "Burn after read", "Encrypted attachments via IPFS"] },
    { p: "P4", q: "Q4 2026", t: "Power user", items: ["/vote with encrypted tally", "/schedule via Gelato", "/verify with TFHE.gt()", "/nft transfers"] },
    { p: "P5", q: "Q1 2027", t: "Scale", items: ["Group threads (≤10 members)", "Mobile PWA polish", "Developer SDK + bots", "Mainnet"] },
  ];

  return (
    <section id="roadmap" className="border-b border-line">
      <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-24">
        <div className="section-eyebrow mb-4"><span>FILE / 11 — roadmap</span></div>
        <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tightest mb-12 max-w-3xl">
          The road to a real protocol.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-px bg-line">
          {phases.map((ph, i) => (
            <article key={ph.p} className="bg-bg-1 p-6 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-wider text-accent">{ph.p}</span>
                <span className="font-mono text-[10px] tracking-widest text-ink-3">{ph.q}</span>
              </div>
              <div className="mt-4 mb-3 h-1 bg-bg-3 relative">
                <span
                  className="absolute inset-y-0 left-0 bg-accent"
                  style={{ width: `${i === 0 ? 100 : i === 1 ? 60 : 0}%` }}
                />
              </div>
              <h3 className="font-display text-lg font-semibold tracking-tighter">{ph.t}</h3>
              <ul className="mt-3 space-y-1.5">
                {ph.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-[12px] text-ink-2">
                    <span className="mt-[7px] h-[3px] w-[3px] shrink-0 bg-ink-4" />
                    {it}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────── Specs sheet ─────────── */

function SpecsSheet() {
  const rows: [string, string][] = [
    ["Inline message limit", "32 bytes (euint256)"],
    ["IPFS pinning", "Pinata (primary) + web3.storage (secondary)"],
    ["Public key format", "65-byte uncompressed ECDSA"],
    ["Key verification", "keccak256(pubkey[1:65])[12:] == sender"],
    ["Encrypted types", "euint256 · euint64 · euint8 · ebool"],
    ["Confirmations to ‘delivered’", "3 (L2) · 12 (mainnet)"],
    ["Optimistic UI states", "OPTIMISTIC → PENDING → CONFIRMED / FAILED"],
    ["Session keys", "ERC-4337, 4-hour TTL, renew banner @ T-5min"],
    ["Subgraph", "MessageSent · UserRegistered · InviteCreated"],
    ["Notifications", "Push Protocol channel"],
    ["Scheduler (recurring)", "Gelato Network"],
    ["Frontend", "Next.js 14 · wagmi 2 · @zama-fhe/relayer-sdk 0.4"],
  ];

  return (
    <section className="border-b border-line bg-bg-0">
      <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <div className="section-eyebrow mb-4"><span>FILE / 12 — datasheet</span></div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tightest">
              Hard numbers, no marketing.
            </h2>
            <p className="mt-6 text-[14px] text-ink-2 leading-relaxed">
              Want to integrate, audit, or just argue? Here are the constants the protocol commits to.
              Anything not listed here is not promised.
            </p>
          </div>

          <div className="lg:col-span-8 surface">
            <table className="min-w-full">
              <tbody className="divide-y divide-line text-[13px]">
                {rows.map(([k, v]) => (
                  <tr key={k}>
                    <td className="px-5 py-3.5 w-2/5 text-ink-3 font-mono text-[12px] uppercase tracking-wider">{k}</td>
                    <td className="px-5 py-3.5 font-mono text-ink-1">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── FAQ ─────────── */

function Faq() {
  const items = [
    {
      q: "Can Zama, validators, or anyone but the recipient read my messages?",
      a: "No. The contract stores ciphertext produced by Zama's TFHE primitives. Decrypting requires a re-encryption request signed by the recipient's wallet. There is no master key.",
    },
    {
      q: "What happens if I lose my wallet?",
      a: "You lose your message history with that wallet — the same trade-off as any self-custodial product. We support social-recovery wallets (Safe, Argent) so you can move identity if you set it up before loss.",
    },
    {
      q: "Why does my own sent message decrypt for me?",
      a: "MessageStore stores one fhEVM ciphertext handle and grants decrypt ACL to both sender and recipient. Both sides can decrypt the same handle through the relayer flow.",
    },
    {
      q: "What does sending cost?",
      a: "fhEVM operations are heavier than plain EVM. Expect ~1.5–3× the gas of an equivalent plaintext send. We mitigate with hybrid IPFS routing for long bodies and ERC-4337 session keys to batch.",
    },
    {
      q: "What about real-time delivery?",
      a: "On L2 fhEVM, blocks confirm in ~2–3 seconds. The composer renders an optimistic bubble immediately and reconciles state on confirmation (FIX_7).",
    },
    {
      q: "Can I message someone who hasn't registered yet?",
      a: "No — but the composer offers to generate an invite link encoded with the chain ID (FIX_8). When they register, the invite redeems automatically and you get a Push notification.",
    },
  ];

  return (
    <section id="faq" className="border-b border-line">
      <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <div className="section-eyebrow mb-4"><span>FILE / 13 — q&a</span></div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tightest">
              Plain answers to the questions you'll ask.
            </h2>
          </div>

          <div className="lg:col-span-8 divide-y divide-line border-y border-line">
            {items.map((it, i) => (
              <details key={i} className="group py-5 px-1">
                <summary className="flex cursor-pointer items-start justify-between gap-6 list-none">
                  <span className="font-display text-[17px] md:text-[18px] tracking-tighter text-ink-1 group-hover:text-accent-bright transition-colors">
                    {it.q}
                  </span>
                  <span className="mt-1 text-accent shrink-0 transition-transform duration-200 group-open:rotate-45 font-mono text-xl leading-none">
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink-2">{it.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── Final CTA ─────────── */

function FinalCta() {
  return (
    <section className="border-b border-line">
      <div className="relative mx-auto max-w-[1400px] px-6 py-20 md:py-28 md:px-12">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" aria-hidden />
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-7">
            <div className="section-eyebrow mb-4"><span>terminal/ready</span></div>
            <h2 className="font-display text-4xl md:text-6xl font-semibold tracking-tightest leading-[1.02]">
              Stop writing things you'd
              <br />
              <span className="font-serif italic font-normal text-accent">never want forwarded.</span>
            </h2>
          </div>

          <div className="lg:col-span-5">
            <p className="text-[14px] leading-relaxed text-ink-2">
              Connect your wallet, register your identity in a single transaction, and start the
              most private conversation of your life. No phone number, no email, no servers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/chat" className="btn-accent h-12 px-5 text-[14px]">
                Open echatz
                <ArrowRightIcon size={14} strokeWidth={2.4} />
              </Link>
              <a href="#architecture" className="btn-ghost h-12 px-5 text-[14px]">
                Read the spec
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── Footer ─────────── */

function SiteFooter() {
  const cols: { title: string; links: [string, string][] }[] = [
    { title: "Protocol", links: [["Architecture", "#architecture"], ["Contracts", "#contracts"], ["Security model", "#security"], ["Roadmap", "#roadmap"]] },
    { title: "Surface",  links: [["Slash commands", "#commands"], ["FAQ", "#faq"], ["Open the app", "/chat"]] },
    { title: "Build",    links: [["GitHub", "#"], ["Subgraph", "#"], ["SDK (soon)", "#"]] },
    { title: "Network",  links: [["Zama fhEVM", "https://zama.ai"], ["Sepolia", "#"], ["Etherscan", "#"]] },
  ];

  return (
    <footer className="bg-bg-0">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12 py-14">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          <div className="col-span-2">
            <Logo size="lg" />
            <p className="mt-5 max-w-xs text-[13px] text-ink-3 leading-relaxed">
              An encrypted on-chain messenger built for the Zama Developer Program. Nothing in
              this site uses telemetry — including this footer.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
                {c.title}
              </div>
              <ul className="mt-4 space-y-2">
                {c.links.map(([l, h]) => (
                  <li key={l}>
                    <a href={h} className="text-[13px] text-ink-1 hover:text-accent-bright transition-colors">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-t border-line pt-6">
          <span className="font-mono text-[11px] text-ink-3">
            © 2026 echatz protocol · Encrypted from the first byte.
          </span>
          <span className="font-mono text-[11px] text-ink-3 inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-ok" />
            sepolia: live · contracts: verified
          </span>
        </div>
      </div>

      {/* Giant editorial wordmark */}
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
