'use client';

import { useMemo } from 'react';
import { stripQuotes } from '@/lib/utils/fieldFormat';
import { daysUntil, deadlineLevel, DEADLINE_COLOR_VAR } from '@/lib/deadline';

interface LifecycleTimelineProps {
  /** The docket's documents — used to detect Proposed Rule / Final Rule presence + dates. */
  documents: Array<Record<string, any>>;
  commentStartDate?: string | null;
  commentEndDate?: string | null;
}

type StageState = 'done' | 'active' | 'pending';

function fmtDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Earliest parseable posted_date among docs matching `test`, as an ISO-ish string. */
function earliestPostedDate(
  documents: Array<Record<string, any>>,
  test: (type: string) => boolean,
): string | null {
  let best: string | null = null;
  for (const d of documents) {
    if (!test(stripQuotes(d.document_type))) continue;
    const posted = stripQuotes(d.posted_date);
    if (posted && (!best || posted < best)) best = posted;
  }
  return best;
}

/**
 * "Where this rule is" — a quiet orientation rail (proposed → comment → final),
 * sitting in the docket header above the tabs.
 *
 * The visual weight is INVERTED relative to a naive stepper: the past matters
 * least, so completed stages are small muted dots; the *current* stage is the
 * one emphasized node; future stages are hollow. The single carrier of colour
 * is the deadline line below — the one actionable fact (can I still comment,
 * and for how long). Stage state + dates are inferred from the docket's
 * documents and comment window.
 *
 * The regulations.gov `withdrawn` flag is dropped by the mirror, so we don't
 * render a withdrawn node at all — surfacing an unknowable exception on every
 * healthy rule made each one look like it was missing something.
 */
export function LifecycleTimeline({ documents, commentStartDate, commentEndDate }: LifecycleTimelineProps) {
  const stages = useMemo(() => {
    const types = documents.map((d) => stripQuotes(d.document_type));
    const hasFinal = types.some((t) => /^rule$/i.test(t) || /final rule/i.test(t));
    const days = daysUntil(commentEndDate);
    const commentOpen = days != null && days >= 0;
    const commentClosed = days != null && days < 0;

    let commentState: StageState = 'pending';
    if (commentOpen) commentState = 'active';
    else if (commentClosed || hasFinal) commentState = 'done';

    let finalState: StageState = 'pending';
    if (hasFinal) finalState = 'done';
    else if (commentClosed) finalState = 'active'; // closed, awaiting a final rule

    const proposedDate =
      earliestPostedDate(documents, (t) => /proposed rule/i.test(t)) ??
      earliestPostedDate(documents, () => true);
    const finalDate = earliestPostedDate(documents, (t) => /^rule$/i.test(t) || /final rule/i.test(t));

    return [
      { key: 'proposed', label: 'Proposed', state: 'done' as StageState, date: proposedDate },
      { key: 'comment', label: 'Comment', state: commentState, date: null },
      { key: 'final', label: 'Final', state: finalState, date: finalDate },
    ];
  }, [documents, commentEndDate]);

  // The comment window: the page's single source of "can I still act", and the
  // only element here allowed to carry colour. When both ends of the window are
  // known we render a progress bar (length + position + open/closed); otherwise
  // we fall back to a one-line status.
  const endStr = fmtDate(commentEndDate);
  const days = daysUntil(commentEndDate);
  const isOpen = days != null && days >= 0;
  const hasWindow = Boolean(commentStartDate && commentEndDate);

  let statusText: string | null = null;
  let statusColor = 'var(--muted)';
  if (isOpen && days != null) {
    statusText = days <= 0 ? 'Comment window closes today' : `Comment window open · ${days}d left`;
    statusColor = DEADLINE_COLOR_VAR[deadlineLevel(days)];
  } else if (days != null) {
    statusText = endStr ? `Comment window closed · ended ${endStr}` : 'Comment window closed';
  }

  return (
    <div>
      <div className="flex items-end w-full">
        {stages.map((s, i) => {
          const filled = s.state === 'done' || s.state === 'active';
          return (
            <div key={s.key} className="flex items-end flex-1 min-w-0 last:flex-none">
              {/* node */}
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <span
                  className="rounded-full"
                  style={
                    s.state === 'active'
                      ? {
                          width: 11,
                          height: 11,
                          background: 'var(--accent-primary)',
                          boxShadow: '0 0 0 4px var(--accent-primary-soft)',
                        }
                      : s.state === 'done'
                        ? { width: 8, height: 8, background: 'var(--muted-foreground)' }
                        : {
                            width: 8,
                            height: 8,
                            background: 'var(--surface)',
                            border: '1.5px solid var(--border)',
                          }
                  }
                />
                <span
                  className={`text-[11px] leading-none ${s.state === 'active' ? 'font-semibold' : 'font-medium'}`}
                  style={{
                    color:
                      s.state === 'active'
                        ? 'var(--foreground)'
                        : s.state === 'done'
                          ? 'var(--muted)'
                          : 'var(--muted-foreground)',
                  }}
                >
                  {s.label}
                </span>
                <span className="text-[10px] leading-none h-[10px] text-[var(--muted-foreground)]">
                  {s.date ? fmtDate(s.date) : ''}
                </span>
              </div>

              {/* connector to next node (sits at dot height) */}
              {i < stages.length - 1 && (
                <span
                  className="flex-1 h-px mx-2 mb-[26px]"
                  style={{
                    background: filled ? 'var(--muted-foreground)' : 'var(--border)',
                    opacity: filled ? 0.5 : 1,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {hasWindow ? (
        <CommentPeriodBar startDate={commentStartDate!} endDate={commentEndDate!} />
      ) : statusText ? (
        <div className="mt-3 text-[11px] font-medium" style={{ color: statusColor }}>
          {statusText}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Comment-period progress bar: the full length of the window as a track, the
 * elapsed portion filled, and the boundary between them marking "now". Reads at
 * a glance — how long the period is, whether it's open, and where we are in it —
 * and borrows the comment chart's accent fill so the two views speak the same
 * visual language. The fill carries the deadline colour while open (green →
 * amber → red as the close approaches) and goes muted once the window closes.
 */
function CommentPeriodBar({ startDate, endDate }: { startDate: string; endDate: string }) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return (
      <div className="mt-3 text-[11px] font-medium text-[var(--muted)]">
        Comment window · {fmtDate(startDate)} – {fmtDate(endDate)}
      </div>
    );
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.round((endMs - startMs) / dayMs));
  const days = daysUntil(endDate);
  const isOpen = days != null && days >= 0;

  // Elapsed fraction of the window, clamped so a closed/not-yet-open period
  // renders a full/empty bar rather than overshooting.
  const frac = Math.min(1, Math.max(0, (Date.now() - startMs) / (endMs - startMs)));
  const fillColor = isOpen && days != null ? DEADLINE_COLOR_VAR[deadlineLevel(days)] : 'var(--muted-foreground)';

  let rightLabel: string;
  if (isOpen && days != null) rightLabel = days <= 0 ? 'Closes today' : `${days}d left`;
  else if (days != null) rightLabel = 'Closed';
  else rightLabel = '';

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-2 mb-1.5 text-[11px]">
        <span className="font-medium text-[var(--muted)]">{totalDays}-day comment period</span>
        {rightLabel && (
          <span className="font-semibold" style={{ color: fillColor }}>{rightLabel}</span>
        )}
      </div>
      <div
        className="relative h-1.5 rounded-full overflow-hidden"
        style={{ background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)' }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${frac * 100}%`, background: fillColor }}
        />
      </div>
      <div className="flex items-center justify-between mt-1 text-[10px] text-[var(--muted-foreground)]">
        <span>{fmtDate(startDate)}</span>
        <span>{fmtDate(endDate)}</span>
      </div>
    </div>
  );
}
