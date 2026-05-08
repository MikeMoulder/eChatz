/**
 * Slash command parser for eChatz message input.
 *
 * Supported commands (active):
 *   /send <amount> <token> [to <address>]
 *       — send ETH or ERC-20 to the chat recipient (or explicit address)
 *
 *   /request <amount> <token> [from <address>]
 *       — create a confidential payment request from the chat recipient (or explicit address)
 *
 */

export type ParsedCommand =
  | { type: "send";    amount: string; token: string; to: string; note: string }
  | { type: "request"; amount: string; token: string; from: string; note: string }
  | { type: "unknown"; raw: string };

export function parseSlashCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  // /send <amount> <token> [to <address>] [note <text>]
  // note consumes the rest of the command so users can write freeform text.
  const sendHead = trimmed.match(/^\/send\s+([\d.]+)\s+(\w+)(?:\s+(.*))?$/i);
  if (sendHead) {
    const amount = sendHead[1];
    const token = sendHead[2].toUpperCase();
    const tail = (sendHead[3] ?? "").trim();
    let to = "";
    let note = "";

    if (tail) {
      let rest = tail;
      while (rest.length > 0) {
        if (/^to\s+/i.test(rest)) {
          const next = rest.replace(/^to\s+/i, "");
          const addrMatch = next.match(/^(\S+)(?:\s+(.*))?$/);
          if (!addrMatch) return { type: "unknown", raw: trimmed };
          to = addrMatch[1];
          rest = (addrMatch[2] ?? "").trim();
          continue;
        }

        if (/^note\s+/i.test(rest)) {
          note = rest.replace(/^note\s+/i, "").trim();
          break;
        }

        return { type: "unknown", raw: trimmed };
      }
    }

    return { type: "send", amount, token, to, note };
  }

  // /request <amount> <token> [from <address>] [note <text>]
  const reqHead = trimmed.match(/^\/request\s+([\d.]+)\s+(\w+)(?:\s+(.*))?$/i);
  if (reqHead) {
    const amount = reqHead[1];
    const token = reqHead[2].toUpperCase();
    const tail = (reqHead[3] ?? "").trim();
    let from = "";
    let note = "";

    if (tail) {
      let rest = tail;
      while (rest.length > 0) {
        if (/^from\s+/i.test(rest)) {
          const next = rest.replace(/^from\s+/i, "");
          const addrMatch = next.match(/^(\S+)(?:\s+(.*))?$/);
          if (!addrMatch) return { type: "unknown", raw: trimmed };
          from = addrMatch[1];
          rest = (addrMatch[2] ?? "").trim();
          continue;
        }

        if (/^note\s+/i.test(rest)) {
          note = rest.replace(/^note\s+/i, "").trim();
          break;
        }

        return { type: "unknown", raw: trimmed };
      }
    }

    return { type: "request", amount, token, from, note };
  }

  return { type: "unknown", raw: trimmed };
}

export function isSlashCommand(text: string): boolean {
  return text.trim().startsWith("/");
}

export function getCommandHelp(): string {
  return [
    "/send 0.01 ETH",
    "/send 0.01 ETH to 0xABC...",
    "/send 0.01 ETH note dinner split",
    "/send 0.01 ETH to 0xABC... note dinner split",
    "/request 0.05 ETH from 0xABC...",
    "/request 0.05 ETH note lunch split",
    "/request 0.05 ETH from 0xABC... note lunch split",
    "/escrow 1 ETH to 0xBeneficiary via 0xArbitrator",
    "/split 0.3 ETH with 0xAddr1,0xAddr2,0xAddr3",
    "/schedule 0.001 ETH to 0xABC... every 1d",
    "/vote Which option is better? options Option A,Option B,Option C",
    "/burn",
  ].join("\n");
}
