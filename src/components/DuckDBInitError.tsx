'use client';

import { TriangleAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useDuckDB } from '@/lib/duckdb/context';

/**
 * Full-panel fallback shown when DuckDB-WASM fails to initialize (most commonly
 * jsDelivr being blocked or unreachable — an ad-blocker, an offline network, or
 * a CDN outage). This is NOT a React render error, so `error.tsx` never sees it;
 * it must be rendered from context state. {@link PageShell} shows it in place of
 * page content whenever `useDuckDB().error` is set, so every data route recovers
 * from one integration point.
 *
 * "Try again" re-attempts initialization in place (no full reload); "Reload
 * page" is the hard fallback.
 */
export function DuckDBInitError() {
  const { error, retryInit } = useDuckDB();
  if (!error) return null;

  return (
    <div className="flex justify-center py-16">
      <Card variant="gradient" interactive={false} className="max-w-lg w-full p-6">
        <div className="flex items-start gap-3">
          <TriangleAlert size={20} className="mt-0.5 flex-none text-[var(--accent-primary)]" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Couldn&rsquo;t load the query engine
            </h2>
            <p className="mt-1.5 text-sm text-[var(--muted)] leading-relaxed">
              This app runs its database in your browser and needs to download
              DuckDB from <span className="font-mono-id">cdn.jsdelivr.net</span>.
              That download failed — check your internet connection or any
              ad-blocker / privacy extension that might be blocking the CDN, then
              try again.
            </p>
            {error.message && (
              <p className="mt-2 font-mono text-xs text-[var(--muted)] opacity-70 break-words">
                {error.message}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" className="text-sm" onClick={() => retryInit()}>
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
  );
}
