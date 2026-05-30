const DEMO_PILL_STYLE = {
  background: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
  color: 'var(--accent-amber)',
  border: '1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent)',
} as const;

interface DemoPillProps {
  /** Tooltip explaining why the adjacent value is synthesized. */
  reason?: string;
  className?: string;
}

/**
 * Small amber "demo" pill marking a value the data mirror can't supply, so it's
 * synthesized for the demo. The single treatment for every such marker.
 */
export function DemoPill({ reason, className = '' }: DemoPillProps) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider ${className}`}
      style={DEMO_PILL_STYLE}
      title={reason ?? 'This value is synthesized for the demo because the upstream pipeline drops the source field.'}
    >
      demo
    </span>
  );
}
