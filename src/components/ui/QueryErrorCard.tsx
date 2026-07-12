'use client';

import { Card } from '@/components/ui/Card';

export interface QueryErrorCardProps {
  /** Human-readable summary of what failed to load, e.g. "Couldn't load open rulemakings." */
  message?: string;
  /** The underlying error — its `message` is shown in mono for debugging. */
  error?: Error | null;
  /** Retry handler, typically the `refetch` from {@link useAsyncData}. */
  onRetry?: () => void;
  /** Extra classes on the card. */
  className?: string;
}

/**
 * Inline error card for a failed data query — the fail-loud replacement for the
 * silent empty states migrated consumers used to show. Matches the search
 * page's error-card style (a `.card` with muted body text and the raw
 * `error.message` in mono), plus a Retry action wired to `useAsyncData`'s
 * `refetch`.
 */
export function QueryErrorCard({
  message = "Couldn't load this data.",
  error,
  onRetry,
  className = '',
}: QueryErrorCardProps) {
  return (
    <Card interactive={false} className={`p-6 text-sm text-[var(--muted)] ${className}`}>
      <p>{message}</p>
      {error?.message && (
        <span className="block mt-1 font-mono text-xs opacity-70 break-words">
          {error.message}
        </span>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-xs font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
        >
          Retry
        </button>
      )}
    </Card>
  );
}
