interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
}

/**
 * echatz brand mark.
 *
 * The glyph is a sharp yellow square containing a custom "E" built from three
 * stacked bars — the middle one half-length and slightly offset, evoking a
 * redacted / partially-encrypted character. A 2x2 dot grid in the bottom-right
 * suggests ciphertext bytes.
 */
export function Logo({ size = "md", showWordmark = true }: Props) {
  const dim = size === "xl" ? 44 : size === "lg" ? 36 : size === "sm" ? 22 : 28;
  const text =
    size === "xl"
      ? "text-3xl"
      : size === "lg"
        ? "text-2xl"
        : size === "sm"
          ? "text-base"
          : "text-xl";

  return (
    <span className="inline-flex items-center gap-2.5 align-middle">
      <LogoMark size={dim} />
      {showWordmark && (
        <span className={`font-display font-semibold tracking-tighter leading-none ${text}`}>
          echatz<span className="text-accent">.</span>
        </span>
      )}
    </span>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* yellow plate */}
      <rect x="0" y="0" width="32" height="32" fill="#D4A017" />
      {/* "E" — three horizontal bars */}
      <rect x="6" y="7" width="18" height="3" fill="#0B0B0B" />
      <rect x="6" y="14.5" width="11" height="3" fill="#0B0B0B" />
      <rect x="6" y="22" width="18" height="3" fill="#0B0B0B" />
      {/* ciphertext-byte dot grid */}
      <rect x="22" y="14.5" width="1.5" height="1.5" fill="#0B0B0B" />
      <rect x="25" y="14.5" width="1.5" height="1.5" fill="#0B0B0B" />
      <rect x="22" y="17.5" width="1.5" height="1.5" fill="#0B0B0B" />
      <rect x="25" y="17.5" width="1.5" height="1.5" fill="#0B0B0B" />
    </svg>
  );
}
