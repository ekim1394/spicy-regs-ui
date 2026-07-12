'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Virtuoso } from 'react-virtuoso';
import { Loader2 } from 'lucide-react';

import { PageShell } from '@/components/ui/PageShell';
import { Card } from '@/components/ui/Card';
import { DemoPill } from '@/components/ui/DemoPill';
import { FederalRegisterPost } from '@/components/feed/FederalRegisterPost';
import { FRFeedFilters } from '@/components/feed/FRFeedFilters';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { useFilterState } from '@/lib/hooks/useFilterState';
import type {
  FRDateRange,
  FRDocumentTypeFilter,
  FederalRegisterDoc,
  FRFilters,
  FRSort,
} from '@/lib/fr/types';

const PAGE_SIZE = 20;

const FR_TYPE_KEY = 'fr-doc-type';
const FR_DATE_KEY = 'fr-date-range';
const FR_SORT_KEY = 'fr-sort';

function isFRDocType(s: string): s is FRDocumentTypeFilter {
  return ['', 'Rule', 'Proposed Rule', 'Notice', 'Presidential Document'].includes(s);
}
function isFRDateRange(s: string): s is FRDateRange {
  return ['', '7d', '30d', '90d', '365d'].includes(s);
}
function isFRSort(s: string): s is FRSort {
  return ['recent', 'oldest', 'comment-deadline'].includes(s);
}

function FederalRegisterFeed() {
  const { getRecentFederalRegister, isReady } = useDuckDBService();

  const [docs, setDocs] = useState<FederalRegisterDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  // Monotonic load token — lets a newer load discard a stale in-flight response
  // (e.g. a fast filter switch) so it can't clobber the current filters. An
  // in-flight flag blocks only the append path; a reset always supersedes.
  const reqRef = useRef(0);
  const inFlightRef = useRef(false);

  const [documentType, setDocumentType] = useFilterState<FRDocumentTypeFilter>(
    'type', FR_TYPE_KEY, '', isFRDocType,
  );
  const [dateRange, setDateRange] = useFilterState<FRDateRange>(
    'date', FR_DATE_KEY, '', isFRDateRange,
  );
  const [sortBy, setSortBy] = useFilterState<FRSort>(
    'sort', FR_SORT_KEY, 'recent', isFRSort,
  );
  // agencySlug stays out of localStorage — too long-tail to be a sticky pref.
  const [agencySlug, setAgencySlug] = useState('');

  const filters: FRFilters = useMemo(
    () => ({
      documentType: documentType || undefined,
      dateRange: dateRange || undefined,
      agencySlug: agencySlug || undefined,
      sortBy,
    }),
    [documentType, dateRange, agencySlug, sortBy],
  );

  const loadDocs = useCallback(async (reset = false) => {
    if (!isReady) return;
    // Only the append path is blocked by an in-flight load; a reset (filter
    // change) must always supersede so a fast filter switch isn't dropped.
    if (!reset && inFlightRef.current) return;
    const req = ++reqRef.current;
    inFlightRef.current = true;
    try {
      setLoading(true);
      const newOffset = reset ? 0 : offset;
      const rows = await getRecentFederalRegister(PAGE_SIZE, newOffset, filters);
      // A newer load started while we awaited — discard this stale response so
      // it can't clobber the current filters.
      if (req !== reqRef.current) return;
      if (reset) {
        setDocs(rows);
        setOffset(PAGE_SIZE);
      } else {
        setDocs((prev) => [...prev, ...rows]);
        setOffset((prev) => prev + PAGE_SIZE);
      }
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err) {
      if (req === reqRef.current) console.error('Failed to load Federal Register docs:', err);
    } finally {
      if (req === reqRef.current) {
        inFlightRef.current = false;
        setLoading(false);
        setInitialLoading(false);
      }
    }
  }, [isReady, offset, filters, getRecentFederalRegister]);

  // Reset + reload whenever filters change.
  useEffect(() => {
    if (isReady) {
      setInitialLoading(true);
      loadDocs(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, documentType, dateRange, agencySlug, sortBy]);

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-bold">Federal Register</h1>
          <DemoPill
            label="deprecated"
            reason="Federal Register entries are now folded into the main feed via the 'include Federal Register' toggle. This standalone page is kept for now and slated for removal."
          />
        </div>
        <p className="text-sm text-[var(--muted)]">
          Rules, proposed rules, notices, and presidential documents published in the
          Federal Register since 2000. Now also available inline in the{' '}
          <Link href="/feed" className="text-[var(--accent-primary)] hover:underline">main feed</Link>{' '}
          via the &ldquo;include Federal Register&rdquo; toggle.
        </p>
      </div>

      <Card interactive={false} className="mb-6 p-4">
        <FRFeedFilters
          documentType={documentType}
          onDocumentTypeChange={setDocumentType}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          sortBy={sortBy}
          onSortChange={setSortBy}
          agencySlug={agencySlug}
          onAgencySlugChange={setAgencySlug}
        />
      </Card>

      {initialLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 size={32} className="animate-spin text-[var(--accent-primary)]" />
          <p className="text-[var(--muted)] text-sm">Loading Federal Register…</p>
        </div>
      ) : docs.length === 0 && !loading ? (
        <div className="text-center py-16">
          <p className="text-lg text-[var(--muted)]">No publications found.</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Try adjusting your filters.
          </p>
        </div>
      ) : (
        <div style={{ height: '75vh' }}>
          <Virtuoso
            style={{ height: '100%' }}
            data={docs}
            endReached={() => {
              if (hasMore && !loading) loadDocs(false);
            }}
            overscan={400}
            itemContent={(_, item) => (
              <div className="pb-3">
                <FederalRegisterPost doc={item} />
              </div>
            )}
            components={{
              Footer: () =>
                loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-[var(--accent-primary)]" />
                  </div>
                ) : !hasMore && docs.length > 0 ? (
                  <div className="text-center py-6 text-sm text-[var(--muted)]">
                    You&apos;ve reached the end 🌶️
                  </div>
                ) : null,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function FederalRegisterPage() {
  return (
    <PageShell maxWidth="4xl">
      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-[var(--accent-primary)]" />
          </div>
        }
      >
        <FederalRegisterFeed />
      </Suspense>
    </PageShell>
  );
}
