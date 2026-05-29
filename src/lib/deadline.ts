/**
 * Unified comment-deadline urgency vocabulary.
 *
 * One scale, applied identically everywhere a deadline appears — feed posts,
 * the docket header, the agency profile's open rulemakings, and the
 * DiscoveryRail "closing soon" readout — so "closes in 9d" reads the same
 * colour wherever you see it. Reference is the wireframe `StatusTag`:
 *
 *   days <= 3  → red    (closing)
 *   days <= 12 → amber  (soon)
 *   else       → green  (roomy)
 */
export type DeadlineLevel = 'green' | 'amber' | 'red';

/** Whole days from now until `date` (ceil). Null if unparseable/absent. */
export function daysUntil(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  const ms = (typeof date === 'string' ? new Date(date) : date).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.ceil((ms - Date.now()) / (1000 * 60 * 60 * 24));
}

export function deadlineLevel(daysLeft: number): DeadlineLevel {
  if (daysLeft <= 3) return 'red';
  if (daysLeft <= 12) return 'amber';
  return 'green';
}

export const DEADLINE_COLOR_VAR: Record<DeadlineLevel, string> = {
  green: 'var(--accent-green)',
  amber: 'var(--accent-amber)',
  red: 'var(--accent-red)',
};

/** Convenience: level for a comment-end date, or null if closed/absent. */
export function deadlineLevelFor(date: string | Date | null | undefined): DeadlineLevel | null {
  const d = daysUntil(date);
  if (d == null || d < 0) return null;
  return deadlineLevel(d);
}
