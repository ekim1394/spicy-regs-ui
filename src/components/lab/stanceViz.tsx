'use client';

import type { Stance } from '@/lib/text/stance';

/** Shared stance palette + viz, used by both the uniqueness and fidelity panels. */
export const STANCE_META: Record<Stance, { label: string; color: string }> = {
  support: { label: 'Support', color: 'var(--accent-green)' },
  oppose: { label: 'Oppose', color: 'var(--accent-red)' },
  mixed: { label: 'Mixed', color: 'var(--accent-amber)' },
  unclear: { label: 'Unclear', color: 'var(--muted)' },
};

/** Small inline chip, e.g. next to a cluster's comment count. */
export function StanceChip({ stance }: { stance: Stance }) {
  const meta = STANCE_META[stance];
  return (
    <span
      className="inline-flex items-center px-1.5 py-px rounded-md text-[10px] font-medium uppercase tracking-wider"
      style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

/**
 * Comment-weighted stance progress bar. `covered` is the number of comments the
 * stanced templates account for; `ofTotal` is the docket's total, used to state
 * how much of the docket the read covers.
 */
export function StanceSplit({
  totals,
  covered,
  ofTotal,
}: {
  totals: Record<Stance, number>;
  covered: number;
  ofTotal: number;
}) {
  const order: Stance[] = ['support', 'oppose', 'mixed', 'unclear'];
  const coveragePct = ofTotal > 0 ? (covered / ofTotal) * 100 : 0;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 mb-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2 flex flex-wrap items-baseline gap-x-2">
        <span>Stance across templates</span>
        <span className="font-normal normal-case tracking-normal">
          (heuristic — covers ≈{coveragePct.toFixed(0)}% of all comments)
        </span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {order.map(s => {
          const w = covered > 0 ? (totals[s] / covered) * 100 : 0;
          if (w <= 0) return null;
          return (
            <div
              key={s}
              style={{ width: `${w}%`, background: STANCE_META[s].color }}
              title={`${STANCE_META[s].label}: ${totals[s].toLocaleString()} (${w.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {order.map(s => (
          <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
            <span aria-hidden className="inline-block w-2 h-2 rounded-full" style={{ background: STANCE_META[s].color }} />
            {STANCE_META[s].label} {covered > 0 ? `${((totals[s] / covered) * 100).toFixed(0)}%` : '0%'}
          </span>
        ))}
      </div>
    </div>
  );
}
