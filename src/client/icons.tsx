/**
 * Inline SVG glyphs for dsh-tokbook.
 *
 * The browser bundle must NOT runtime-import a non-baseline package (bundle
 * purity gate), so we ship a couple of tiny stroke-style icons here. They keep
 * one visual language (2px stroke, round caps/joins) so the plugin reads as a
 * single, consistent icon set — no emoji or text glyphs as icons.
 *
 * Both glyphs inherit `currentColor` and take a `className` for sizing.
 *
 * @module dsh-tokbook/client/icons
 */

/** Usage / column chart glyph (footer trigger + overlay title). */
export function UsageGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  )
}

/** Dismiss / close glyph for the overlay. */
export function CloseGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

/** Refresh / re-sync glyph for the scan button. */
export function RefreshGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M18 9a8 8 0 1 0 2 5.3" />
      <path d="M18 2v4h-4" />
    </svg>
  )
}
