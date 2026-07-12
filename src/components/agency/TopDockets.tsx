'use client';

import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import { stripQuotes } from '@/lib/utils/fieldFormat';
import { Card } from '@/components/ui/Card';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { QueryErrorCard } from '@/components/ui/QueryErrorCard';
import { MiniDocketCard } from './MiniDocketCard';

/**
 * An agency's most-commented dockets (all-time), highest first. Backed by
 * getTopDocketsByComments(code).
 */
export function TopDockets({ agencyCode, limit = 5 }: { agencyCode: string; limit?: number }) {
  const { getTopDocketsByComments } = useDuckDBService();
  const { data: rows, error, refetch } = useAsyncData(
    () => getTopDocketsByComments(agencyCode, limit),
    [agencyCode, limit],
    { enabled: !!agencyCode },
  );

  return (
    <Card variant="gradient" interactive={false} className="p-6">
      <PanelHeader
        label="Top dockets"
        title="What drew the most public comment?"
        caption="Most commented · all time"
      />
      {error ? (
        <QueryErrorCard
          message="Couldn't load top dockets."
          error={error}
          onRetry={refetch}
          className="mt-2"
        />
      ) : rows === undefined ? (
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
    </Card>
  );
}
