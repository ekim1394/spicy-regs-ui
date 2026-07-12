'use client';

import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import { stripQuotes } from '@/lib/utils/fieldFormat';
import { Card } from '@/components/ui/Card';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { QueryErrorCard } from '@/components/ui/QueryErrorCard';
import { MiniDocketCard } from './MiniDocketCard';

/**
 * An agency's currently-open rulemakings (comment window still open), soonest
 * deadline first. Backed by getOpenRulemakings(code).
 */
export function OpenRulemakings({ agencyCode, limit = 5 }: { agencyCode: string; limit?: number }) {
  const { getOpenRulemakings } = useDuckDBService();
  const { data: rows, error, refetch } = useAsyncData(
    () => getOpenRulemakings(agencyCode, limit),
    [agencyCode, limit],
    { enabled: !!agencyCode },
  );

  return (
    <Card variant="gradient" interactive={false} className="p-6">
      <PanelHeader
        label="Open rulemakings"
        title="What's open for comment right now?"
        caption="Comment window open · soonest deadline first"
      />
      {error ? (
        <QueryErrorCard
          message="Couldn't load open rulemakings."
          error={error}
          onRetry={refetch}
          className="mt-2"
        />
      ) : rows === undefined ? (
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
