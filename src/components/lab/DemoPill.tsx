interface DemoPillProps {
  reason?: string;
}

export function DemoPill({ reason }: DemoPillProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider"
      style={{
        background: 'rgba(217, 119, 6, 0.12)',
        color: 'var(--accent-amber)',
        border: '1px solid rgba(217, 119, 6, 0.25)',
      }}
      title={reason ?? 'This value is synthesized for the demo because the upstream pipeline drops the source field.'}
    >
      demo
    </span>
  );
}
