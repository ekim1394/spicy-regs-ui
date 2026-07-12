'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { clearQueryCache } from '@/lib/duckdb/context';

/**
 * Global client error boundary — the backstop for render-time bugs anywhere in
 * the app. Async data errors are handled pre-render by useAsyncData, and DuckDB
 * init failures render from context state, so this only catches genuine render
 * crashes.
 *
 * Decision: one global boundary, no per-route error.tsx — every route shares the
 * same failure domain (the in-browser DuckDB corpus). "Try again" first clears
 * the query cache so a poisoned cached row can't immediately re-crash the
 * re-rendered tree, then re-renders via reset().
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[error boundary]', error);
  }, [error]);

  const handleRetry = () => {
    // Clear all cached query results before re-rendering — a corrupt/poisoned
    // cached row would otherwise re-crash the tree the instant it re-renders.
    void clearQueryCache().finally(() => reset());
  };

  return (
    <PageShell maxWidth="3xl" mainClassName="w-full max-w-3xl mx-auto px-4 py-16 flex-1">
      <div className="flex justify-center">
        <Card variant="gradient" interactive={false} className="max-w-lg w-full p-6">
          <div className="flex items-start gap-3">
            <TriangleAlert size={20} className="mt-0.5 flex-none text-[var(--accent-primary)]" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-[var(--foreground)]">
                Something went wrong
              </h1>
              <p className="mt-1.5 text-sm text-[var(--muted)] leading-relaxed">
                An unexpected error interrupted this page. You can try again — if
                it keeps happening, reloading usually clears it.
              </p>
              {error.message && (
                <p className="mt-2 font-mono text-xs text-[var(--muted)] opacity-70 break-words">
                  {error.message}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" className="text-sm" onClick={handleRetry}>
                  Try again
                </Button>
                <Button
                  variant="secondary"
                  className="text-sm"
                  onClick={() => window.location.reload()}
                >
                  Reload page
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
