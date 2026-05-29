'use client';

import { useEffect, useState } from 'react';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { stripQuotes } from '@/lib/utils/fieldFormat';
import { MiniDocketCard } from './MiniDocketCard';

/**
 * An agency's currently-open rulemakings (comment window still open), soonest
 * deadline first. Backed by getOpenRulemakings(code).
 */
export function OpenRulemakings({ agencyCode, limit = 8 }: { agencyCode: string; limit?: number }) {
  const { getOpenRulemakings, isReady } = useDuckDBService();
  const [rows, setRows] = useState<Record<string, any>[] | null>(null);

  useEffect(() => {
    if (!isReady || !agencyCode) return;
    let cancelled = false;
    getOpenRulemakings(agencyCode, limit)
      .then((r) => { if (!cancelled) setRows(r); })
      .catch((err) => { if (!cancelled) { console.error('OpenRulemakings:', err); setRows([]); } });
    return () => { cancelled = true; };
  }, [isReady, agencyCode, limit, getOpenRulemakings]);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Open rulemakings</h2>
        <span className="text-[10.5px] text-[var(--muted-foreground)]">comment window open · by deadline</span>
      </div>
      {rows === null ? (
        <div className="py-4 text-xs text-[var(--muted)]">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-4 text-xs text-[var(--muted)]">No open comment periods right now.</div>
      ) : (
        <div>
          {rows.map((r) => {
            const id = stripQuotes(r.docket_id);
            return (
              <MiniDocketCard
                key={id}
                docketId={id}
                agencyCode={agencyCode}
                title={stripQuotes(r.title)}
                variant="deadline"
                commentEndDate={stripQuotes(r.comment_end_date)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
