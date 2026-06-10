/**
 * Shared shape for the app's micro marker pills: a tiny uppercase chip used for
 * meta-markers ("demo", "deprecated") and stance labels. Owns only the
 * geometry/typography — callers supply the color (token-backed) via `style`.
 */
export const MARKER_PILL_CLASS =
  'inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider';

const AMBER_PILL_STYLE = {
  background: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
  color: 'var(--accent-amber)',
  border: '1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent)',
} as const;

interface DemoPillProps {
  /** Pill text. Defaults to "demo"; pass e.g. "deprecated" for sibling markers. */
  label?: string;
  /** Tooltip explaining the marker. */
  reason?: string;
  className?: string;
}

/**
 * Small amber meta-marker pill. The default "demo" marks a value the data
 * mirror can't supply (so it's synthesized for the demo); pass `label` for
 * sibling markers in the same amber family (e.g. a "deprecated" page badge).
 * The single treatment for every such marker.
 */
export function DemoPill({ label = 'demo', reason, className = '' }: DemoPillProps) {
  return (
    <span
      className={`${MARKER_PILL_CLASS} ${className}`}
      style={AMBER_PILL_STYLE}
      title={reason ?? 'This value is synthesized for the demo because the upstream pipeline drops the source field.'}
    >
      {label}
    </span>
  );
}
