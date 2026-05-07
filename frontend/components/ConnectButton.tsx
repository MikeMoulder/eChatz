"use client";

import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { Identicon } from "./AddressBadge";
import { ZapIcon } from "./Icons";

interface Props {
  variant?: "primary" | "ghost";
  compact?: boolean;
}

export function ConnectButton({ variant = "primary", compact = false }: Props) {
  return (
    <RainbowConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready && account && chain && (!authenticationStatus || authenticationStatus === "authenticated");

        const baseBtn =
          "inline-flex items-center justify-center gap-2 h-10 px-4 text-[13px] font-medium tracking-tight transition-all";

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className={variant === "primary" ? `${baseBtn} btn-accent` : `${baseBtn} btn-ghost`}
                  >
                    <ZapIcon size={13} strokeWidth={2.4} />
                    {compact ? "Connect" : "Connect wallet"}
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className={`${baseBtn} bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25`}
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <div className="flex items-stretch border border-line">
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 text-[11px] font-mono uppercase tracking-wider text-ink-2 hover:bg-white/4 border-r border-line"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img alt={chain.name ?? "chain"} src={chain.iconUrl} width={12} height={12} />
                    )}
                    {chain.name}
                  </button>
                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="inline-flex items-center gap-2 pl-1.5 pr-3 hover:bg-white/4"
                  >
                    <Identicon seed={account.address} size={26} />
                    <span className="font-mono text-[12px] text-ink-1">{account.displayName}</span>
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}
