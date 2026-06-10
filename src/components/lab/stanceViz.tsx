'use client';

import type { Stance } from '@/lib/text/stance';
import { Card } from '@/components/ui/Card';
import { MARKER_PILL_CLASS } from '@/components/ui/DemoPill';

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
      className={MARKER_PILL_CLASS}
      style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

/** Coverage share (0–100) of the docket the stanced templates account for. */
export function stanceCoveragePct(covered: number, ofTotal: number): number {
  return ofTotal > 0 ? (covered / ofTotal) * 100 : 0;
}

/**
 * Comment-weighted stance progress bar. `covered` is the number of comments the
 * stanced templates account for; `ofTotal` is the docket's total, used to state
 * how much of the docket the read covers.
 *
 * By default it frames itself in a Card with an internal header (the Lab
 * fidelity panel relies on this). Pass `bare` to render just the bar + legend,
 * so a caller can supply its own header-outside-the-card treatment.
 */
export function StanceSplit({
  totals,
  covered,
  ofTotal,
  bare = false,
}: {
  totals: Record<Stance, number>;
  covered: number;
  ofTotal: number;
  bare?: boolean;
}) {
  const order: Stance[] = ['support', 'oppose', 'mixed', 'unclear'];
  const coveragePct = stanceCoveragePct(covered, ofTotal);

  const body = (
    <>
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
    </>
  );

  if (bare) return body;

  return (
    <Card interactive={false} className="p-3.5 mb-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2 flex flex-wrap items-baseline gap-x-2">
        <span>Stance across templates</span>
        <span className="font-normal normal-case tracking-normal">
          (heuristic — covers ≈{coveragePct.toFixed(0)}% of all comments)
        </span>
      </div>
      {body}
    </Card>
  );
}
