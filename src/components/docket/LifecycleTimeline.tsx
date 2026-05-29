'use client';

import { useMemo } from 'react';
import { DemoPill } from '@/components/lab/DemoPill';
import { stripQuotes } from '@/lib/utils/fieldFormat';
import { daysUntil } from '@/lib/deadline';

interface LifecycleTimelineProps {
  /** The docket's documents — used to detect Proposed Rule / Final Rule presence. */
  documents: Array<Record<string, any>>;
  commentEndDate?: string | null;
}

type StageState = 'done' | 'active' | 'pending';

function dot(state: StageState): string {
  if (state === 'done') return 'var(--accent-primary)';
  if (state === 'active') return 'var(--accent-primary)';
  return 'var(--muted-foreground)';
}

/**
 * "Where this rule is" — a single orienting strip (proposed → comment → final),
 * folded into Overview rather than living on its own tab (a one-bar timeline is
 * a glance, not a destination). Stage state is inferred from the docket's
 * documents + comment window.
 *
 * The "withdrawn" stage can't be determined: the data mirror drops the
 * regulations.gov `withdrawn` / `reason_withdrawn` flags, so it wears a
 * DemoPill instead of a real state.
 */
export function LifecycleTimeline({ documents, commentEndDate }: LifecycleTimelineProps) {
  const { proposed, comment, final } = useMemo(() => {
    const types = documents.map((d) => stripQuotes(d.document_type));
    const hasFinal = types.some((t) => /^rule$/i.test(t) || /final rule/i.test(t));
    const days = daysUntil(commentEndDate);
    const commentOpen = days != null && days >= 0;
    const commentClosed = days != null && days < 0;

    const proposedState: StageState = 'done'; // a docket exists ⇒ it was proposed
    let commentState: StageState = 'pending';
    if (commentOpen) commentState = 'active';
    else if (commentClosed || hasFinal) commentState = 'done';

    let finalState: StageState = 'pending';
    if (hasFinal) finalState = 'done';
    else if (commentClosed) finalState = 'active'; // closed, awaiting a final rule

    return {
      proposed: proposedState,
      comment: commentState,
      final: finalState,
    };
  }, [documents, commentEndDate]);

  const stages: { label: string; state: StageState }[] = [
    { label: 'Proposed', state: proposed },
    { label: 'Comment window', state: comment },
    { label: 'Final', state: final },
  ];

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Where this rule is
        </span>
        <span className="text-[10.5px] text-[var(--muted-foreground)]">proposed → comment → final</span>
      </div>

      <div className="flex items-center gap-2">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={`flex-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium border ${
                s.state === 'done'
                  ? 'border-transparent text-white'
                  : s.state === 'active'
                    ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]'
                    : 'bg-[var(--surface-elevated)] text-[var(--muted)] border-[var(--border)]'
              }`}
              style={s.state === 'done' ? { background: 'var(--accent-primary)' } : undefined}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full"
                      style={{ background: s.state === 'done' ? 'white' : dot(s.state) }} />
                {s.label}
              </span>
            </div>
            {i < stages.length - 1 && <span className="text-[var(--border)]">→</span>}
          </div>
        ))}

        {/* Withdrawn — unknowable from the mirror. */}
        <span className="text-[var(--border)]">→</span>
        <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium border border-dashed border-[var(--border)] text-[var(--muted-foreground)]">
          withdrawn?
          <DemoPill reason="The upstream pipeline drops regulations.gov's `withdrawn` / `reason_withdrawn` flags, so we can't tell whether a rule was withdrawn." />
        </div>
      </div>
    </div>
  );
}
