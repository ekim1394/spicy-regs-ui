'use client';

import { daysUntil, deadlineLevel, DEADLINE_COLOR_VAR } from '@/lib/deadline';

export interface StatusTagProps {
  /** Comment-period end date. Drives open/closed + days-left + colour. */
  commentEndDate?: string | null;
  /**
   * Force a state. `final` shows "Final rule"; `closed` shows "Comment
   * period closed"; `open` requires a future commentEndDate. When omitted the
   * state is derived from commentEndDate.
   */
  state?: 'open' | 'closed' | 'final';
  className?: string;
}

/**
 * The single deadline/status chip used across feed posts, the docket header,
 * the agency profile, and the discovery rail. Same green/amber/red urgency
 * scale everywhere (see lib/deadline). Renders nothing when there's no
 * deadline signal to show (no date and no forced state).
 */
export function StatusTag({ commentEndDate, state, className = '' }: StatusTagProps) {
  if (state === 'final') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)]" />
        Final rule
      </span>
    );
  }

  const days = daysUntil(commentEndDate);
  const isClosed = state === 'closed' || (days != null && days < 0);

  if (isClosed) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)]" />
        Comment period closed
      </span>
    );
  }

  if (days == null) return null;

  const color = DEADLINE_COLOR_VAR[deadlineLevel(days)];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`}
      style={{ color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {days <= 0 ? 'Closes today' : `${days}d left`}
    </span>
  );
}
