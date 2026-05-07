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
 *   /invite [<address>]
 *       — send an eChatz invite link
 */

export type ParsedCommand =
  | { type: "send";    amount: string; token: string; to: string }
  | { type: "request"; amount: string; token: string; from: string }
  | { type: "invite";  address: string }
  | { type: "unknown"; raw: string };

export function parseSlashCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  // /send <amount> <token> [to <address>]
  const sendFull  = trimmed.match(/^\/send\s+([\d.]+)\s+(\w+)\s+to\s+(\S+)$/i);
  if (sendFull) {
    return { type: "send", amount: sendFull[1], token: sendFull[2].toUpperCase(), to: sendFull[3] };
  }
  const sendShort = trimmed.match(/^\/send\s+([\d.]+)\s+(\w+)$/i);
  if (sendShort) {
    return { type: "send", amount: sendShort[1], token: sendShort[2].toUpperCase(), to: "" };
  }

  // /request <amount> <token> [from <address>]
  const reqFull  = trimmed.match(/^\/request\s+([\d.]+)\s+(\w+)\s+from\s+(\S+)$/i);
  if (reqFull) {
    return { type: "request", amount: reqFull[1], token: reqFull[2].toUpperCase(), from: reqFull[3] };
  }
  const reqShort = trimmed.match(/^\/request\s+([\d.]+)\s+(\w+)$/i);
  if (reqShort) {
    return { type: "request", amount: reqShort[1], token: reqShort[2].toUpperCase(), from: "" };
  }

  // /invite [<address>]
  const inviteFull = trimmed.match(/^\/invite\s+(\S+)$/i);
  if (inviteFull) {
    return { type: "invite", address: inviteFull[1] };
  }
  if (trimmed.toLowerCase() === "/invite") {
    return { type: "invite", address: "" };
  }

  return { type: "unknown", raw: trimmed };
}

export function isSlashCommand(text: string): boolean {
  return text.trim().startsWith("/");
}

export function getCommandHelp(): string {
  return [
    "/send 0.01 ETH to 0xABC...",
    "/send 100 USDC to alice.eth",
    "/request 0.05 ETH from 0xABC...",
    "/escrow 1 ETH to 0xBeneficiary via 0xArbitrator",
    "/split 0.3 ETH with 0xAddr1,0xAddr2,0xAddr3",
    "/schedule 0.001 ETH to 0xABC... every 1d",
    "/vote Which option is better? options Option A,Option B,Option C",
    "/invite 0xABC...",
    "/burn",
  ].join("\n");
}
