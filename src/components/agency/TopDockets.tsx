'use client';

import { useEffect, useState } from 'react';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { stripQuotes } from '@/lib/utils/fieldFormat';
import { MiniDocketCard } from './MiniDocketCard';

/**
 * An agency's most-commented dockets (all-time), highest first. Backed by
 * getTopDocketsByComments(code).
 */
export function TopDockets({ agencyCode, limit = 10 }: { agencyCode: string; limit?: number }) {
  const { getTopDocketsByComments, isReady } = useDuckDBService();
  const [rows, setRows] = useState<Record<string, any>[] | null>(null);

  useEffect(() => {
    if (!isReady || !agencyCode) return;
    let cancelled = false;
    getTopDocketsByComments(agencyCode, limit)
      .then((r) => { if (!cancelled) setRows(r); })
      .catch((err) => { if (!cancelled) { console.error('TopDockets:', err); setRows([]); } });
    return () => { cancelled = true; };
  }, [isReady, agencyCode, limit, getTopDocketsByComments]);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Top dockets</h2>
        <span className="text-[10.5px] text-[var(--muted-foreground)]">most commented</span>
      </div>
      {rows === null ? (
        <div className="py-4 text-xs text-[var(--muted)]">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-4 text-xs text-[var(--muted)]">No dockets found.</div>
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
                variant="count"
                commentCount={Number(r.comment_count || 0)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
