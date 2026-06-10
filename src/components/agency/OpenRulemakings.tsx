'use client';

import { useEffect, useState } from 'react';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { stripQuotes } from '@/lib/utils/fieldFormat';
import { Card } from '@/components/ui/Card';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { MiniDocketCard } from './MiniDocketCard';

/**
 * An agency's currently-open rulemakings (comment window still open), soonest
 * deadline first. Backed by getOpenRulemakings(code).
 */
export function OpenRulemakings({ agencyCode, limit = 5 }: { agencyCode: string; limit?: number }) {
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
    <Card variant="gradient" interactive={false} className="p-6">
      <PanelHeader
        label="Open rulemakings"
        title="What's open for comment right now?"
        caption="Comment window open · soonest deadline first"
      />
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
    </Card>
  );
}
