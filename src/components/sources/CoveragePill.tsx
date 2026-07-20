import { MARKER_PILL_CLASS } from '@/components/ui/DemoPill';

/**
 * Neutral coverage marker for external sources whose data is bounded
 * (sampled, windowed, single-edition). Shares the marker-pill geometry but
 * uses muted tokens — the amber family stays reserved for DemoPill's
 * demo/deprecated meanings.
 */
const NEUTRAL_PILL_STYLE = {
  background: 'color-mix(in srgb, var(--muted) 10%, transparent)',
  color: 'var(--muted)',
  border: '1px solid color-mix(in srgb, var(--muted) 25%, transparent)',
} as const;

interface CoveragePillProps {
  /** Pill text. Defaults to "partial". */
  label?: string;
  /** Tooltip explaining the coverage bound. */
  reason?: string;
  className?: string;
}

export function CoveragePill({ label = 'partial', reason, className = '' }: CoveragePillProps) {
  return (
    <span
      className={`${MARKER_PILL_CLASS} ${className}`}
      style={NEUTRAL_PILL_STYLE}
      title={reason}
    >
      {label}
    </span>
  );
}
