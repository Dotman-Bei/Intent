/**
 * All glyphs are drawn here rather than pulled from an icon package or a brand set — the design
 * calls for `currentColor`/`--faint` fills at 12–15px, and third-party marks do not travel with
 * this style.
 */
type IconProps = { size?: number; className?: string };

export function BrandMark({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
      <path d="M1.6 3.2h8.8M1.6 6h5.6M1.6 8.8h8.8" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="9.1" cy="6" r="1.5" fill="#fff" />
    </svg>
  );
}

export function ArrowRight({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
      <path
        d="M2 6h8M6.6 2.6 10 6l-3.4 3.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CopyGlyph({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
      <rect x="4" y="4" width="6.4" height="6.4" rx="1.4" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M8 2.6a1.4 1.4 0 0 0-1.4-1.4H3a1.4 1.4 0 0 0-1.4 1.4v3.6c0 .5.3 1 .8 1.2"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CheckGlyph({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
      <path
        d="M2.4 6.3 4.8 8.7l4.8-5.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* --- tiles used in the floating flow pill and the stack strip ------------- */

export function ChatGlyph({ size = 13, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={className} fill="currentColor">
      <path d="M2 3.2A1.8 1.8 0 0 1 3.8 1.4h6.4A1.8 1.8 0 0 1 12 3.2v4.4a1.8 1.8 0 0 1-1.8 1.8H6.1L3.2 12V9.4H3.8A1.8 1.8 0 0 1 2 7.6V3.2Z" />
    </svg>
  );
}

export function AgentGlyph({ size = 13, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={className} fill="currentColor">
      <rect x="3.1" y="4.2" width="7.8" height="6.4" rx="1.8" />
      <rect x="6.4" y="1.6" width="1.2" height="2.2" rx="0.6" />
      <circle cx="7" cy="1.6" r="1" />
      <rect x="0.9" y="6" width="1.4" height="3" rx="0.7" />
      <rect x="11.7" y="6" width="1.4" height="3" rx="0.7" />
    </svg>
  );
}

export function ShieldGlyph({ size = 13, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={className} fill="currentColor">
      <path d="M7 1 2.4 3v4.1c0 2.7 1.9 5.1 4.6 5.9 2.7-.8 4.6-3.2 4.6-5.9V3L7 1Z" />
    </svg>
  );
}

export function ChainGlyph({ size = 13, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={className} fill="currentColor">
      <rect x="1.2" y="5.2" width="5.4" height="3.6" rx="1.8" />
      <rect x="7.4" y="5.2" width="5.4" height="3.6" rx="1.8" />
      <rect x="4.6" y="6.4" width="4.8" height="1.2" />
    </svg>
  );
}

export function VaultGlyph({ size = 13, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={className} fill="currentColor">
      <rect x="1.6" y="2.2" width="10.8" height="9.6" rx="2" />
      <circle cx="7" cy="7" r="2.6" fill="#fff" />
      <circle cx="7" cy="7" r="1" />
    </svg>
  );
}

export function ChartGlyph({ size = 13, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={className} fill="currentColor">
      <rect x="1.8" y="7.6" width="2.4" height="4.6" rx="0.8" />
      <rect x="5.8" y="4.4" width="2.4" height="7.8" rx="0.8" />
      <rect x="9.8" y="1.8" width="2.4" height="10.4" rx="0.8" />
    </svg>
  );
}

export function WalletGlyph({ size = 13, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={className} fill="currentColor">
      <rect x="1.4" y="3" width="11.2" height="8" rx="2" />
      <circle cx="10.2" cy="7" r="1.1" fill="#fff" />
    </svg>
  );
}

export function CodeGlyph({ size = 13, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={className} fill="currentColor">
      <path d="M4.6 3.4 1 7l3.6 3.6 1-1.1L2.9 7l2.7-2.5-1-1.1ZM9.4 3.4l-1 1.1L11.1 7 8.4 9.5l1 1.1L13 7 9.4 3.4Z" />
    </svg>
  );
}
