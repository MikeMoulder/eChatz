/**
 * Pure formatting helpers used across the UI layer.
 * No external deps. Safe to import from server or client components.
 */

export function shortAddress(addr?: string | null, head = 4, tail = 4): string {
  if (!addr) return "";
  if (!addr.startsWith("0x") || addr.length < head + tail + 2) return addr;
  return `${addr.slice(0, 2 + head)}…${addr.slice(-tail)}`;
}

export function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function isEnsLike(value: string): boolean {
  return /\.eth$|\.xyz$|\.cb\.id$/.test(value.trim().toLowerCase());
}

/**
 * Stable HSL pair derived from any string. Used to colour identicons / chips
 * so the same address always renders with the same gradient.
 */
export function stableGradient(seed: string): { from: string; to: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const h1 = h % 360;
  const h2 = (h1 + 60) % 360;
  return {
    from: `hsl(${h1} 80% 60%)`,
    to: `hsl(${h2} 80% 50%)`,
  };
}

export function formatRelativeTime(unixSeconds: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - unixSeconds);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604_800) return `${Math.floor(diff / 86_400)}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatTimeOfDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateLabel(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";

  const diffDays = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
