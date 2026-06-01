'use client';

import { useState, useCallback, useEffect, useLayoutEffect, Suspense, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Virtuoso } from 'react-virtuoso';
import { PageShell } from '@/components/ui/PageShell';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { DocketPost } from '@/components/feed/DocketPost';
import { FederalRegisterPost } from '@/components/feed/FederalRegisterPost';
import { FeedFilters } from '@/components/feed/FeedFilters';
import { DiscoveryRail } from '@/components/feed/discovery/DiscoveryRail';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { useFilterState } from '@/lib/hooks/useFilterState';
import {
  DATE_STORAGE_KEY,
  DEFAULT_DATE,
  DEFAULT_INCLUDE_FR,
  DEFAULT_SORT,
  DEFAULT_TOPIC,
  DEFAULT_TYPE,
  INCLUDE_FR_STORAGE_KEY,
  SORT_STORAGE_KEY,
  TOPIC_STORAGE_KEY,
  TYPE_STORAGE_KEY,
  isDateRange,
  isDocketType,
  isIncludeFR,
  isSortOption,
  isTopicKey,
  type DateRange,
  type DocketType,
  type IncludeFR,
  type SortOption,
  type TopicKey,
} from '@/lib/feedFilters';
import type { FederalRegisterDoc } from '@/lib/fr/types';
import { Loader2 } from 'lucide-react';
import { stripQuotes } from '@/lib/utils/fieldFormat';

const PAGE_SIZE = 20;

type FeedRow =
  | { kind: 'docket'; date: number; key: string; data: Record<string, any> }
  | { kind: 'fr'; date: number; key: string; data: FederalRegisterDoc };

function tsOf(date: string | null | undefined): number {
  if (!date) return 0;
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function DocketFeed() {
  const { getRecentDocketsWithCounts, getRecentFederalRegister, getFeedCount, isReady } = useDuckDBService();

  const [dockets, setDockets] = useState<Record<string, any>[]>([]);
  const [frDocs, setFrDocs] = useState<FederalRegisterDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [docketOffset, setDocketOffset] = useState(0);
  const [frOffset, setFrOffset] = useState(0);
  const [docketHasMore, setDocketHasMore] = useState(true);
  const [frHasMore, setFrHasMore] = useState(true);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  // Total matching dockets for the active filters — drives the feed header count.
  // Null until the first count resolves so we don't flash a "0 dockets".
  const [totalCount, setTotalCount] = useState<number | null>(null);
  // Monotonic load token — lets a newer load() discard a stale in-flight response.
  const reqRef = useRef(0);
  // Tracks whether a load is in flight without making `load` depend on `loading`.
  const inFlightRef = useRef(false);

  // The feed is an inner-scrolling region (the rail + filters stay put while the
  // river scrolls). Sizing it to a fixed 75vh leaves a gap above the footer once
  // the discovery rail is hidden and the page is shorter than the viewport, so
  // we measure the space from the region's top to the footer and grow into it —
  // floored at 75vh so a present rail (or a short viewport) still scrolls.
  const feedRef = useRef<HTMLDivElement>(null);
  const [feedHeight, setFeedHeight] = useState<string>();
  // True once the river has scrolled away from its top — drives the top scroll
  // fade (the horizontal-axis sibling of the discovery rail's edge fades).
  const [showTopFade, setShowTopFade] = useState(false);

  // Filters
  // Agency is URL-driven (no UI control): the agency profile's "View all
  // dockets →" CTA links here as /feed?agency=CODE. Read-only from the URL.
  const searchParams = useSearchParams();
  const selectedAgency = (searchParams.get('agency') || '').toUpperCase();
  const [sortBy, setSortBy] = useFilterState<SortOption>(
    'sort', SORT_STORAGE_KEY, DEFAULT_SORT, isSortOption,
  );
  const [dateRange, setDateRange] = useFilterState<DateRange>(
    'date', DATE_STORAGE_KEY, DEFAULT_DATE, isDateRange,
  );
  const [docketType, setDocketType] = useFilterState<DocketType>(
    'type', TYPE_STORAGE_KEY, DEFAULT_TYPE, isDocketType,
  );
  const [topic, setTopic] = useFilterState<TopicKey>(
    'topic', TOPIC_STORAGE_KEY, DEFAULT_TOPIC, isTopicKey,
  );
  const [includeFRState, setIncludeFRState] = useFilterState<IncludeFR>(
    'fr', INCLUDE_FR_STORAGE_KEY, DEFAULT_INCLUDE_FR, isIncludeFR,
  );
  const includeFR = includeFRState === 'on';

  // The DiscoveryRail describes the whole dataset, so it's noise once the user
  // has narrowed the feed. (Sort + FR-toggle aren't narrowing filters.)
  const filtersActive = Boolean(selectedAgency || dateRange || docketType || topic);

  // FR interleaving is only coherent for the recency river — the other sorts
  // order dockets by comment_count / deadline, which FR can't be merged into.
  const interleaveFR = includeFR && sortBy === 'recent';

  const load = useCallback(async (reset: boolean) => {
    if (!isReady) return;
    // Only the append path is blocked by an in-flight load; a reset (filter
    // change) must always supersede so a fast filter switch isn't dropped.
    if (!reset && inFlightRef.current) return;
    const req = ++reqRef.current;
    inFlightRef.current = true;
    try {
      setLoading(true);
      const dOff = reset ? 0 : docketOffset;
      const fOff = reset ? 0 : frOffset;

      const tasks: [
        Promise<{ dockets: any[]; commentCounts: Record<string, number> }>,
        Promise<FederalRegisterDoc[]> | null,
      ] = [
        getRecentDocketsWithCounts(
          PAGE_SIZE, dOff, selectedAgency || undefined, sortBy,
          dateRange || undefined, docketType || undefined, topic || undefined,
        ),
        interleaveFR ? getRecentFederalRegister(PAGE_SIZE, fOff, { sortBy: 'recent' }) : null,
      ];
      const [docketResult, frResult] = await Promise.all([tasks[0], tasks[1]]);

      // A newer load (e.g. another filter change) started while we awaited —
      // discard this stale response so it can't clobber the current filters.
      if (req !== reqRef.current) return;

      if (reset) {
        setDockets(docketResult.dockets);
        setCommentCounts(docketResult.commentCounts);
        setDocketOffset(PAGE_SIZE);
        setFrDocs(frResult ?? []);
        setFrOffset(frResult ? PAGE_SIZE : 0);
      } else {
        setDockets(prev => [...prev, ...docketResult.dockets]);
        setCommentCounts(prev => ({ ...prev, ...docketResult.commentCounts }));
        setDocketOffset(prev => prev + PAGE_SIZE);
        if (frResult) {
          setFrDocs(prev => [...prev, ...frResult]);
          setFrOffset(prev => prev + PAGE_SIZE);
        }
      }
      setDocketHasMore(docketResult.dockets.length === PAGE_SIZE);
      if (frResult) setFrHasMore(frResult.length === PAGE_SIZE);
    } catch (err) {
      if (req === reqRef.current) console.error('Failed to load feed:', err);
    } finally {
      if (req === reqRef.current) {
        inFlightRef.current = false;
        setLoading(false);
        setInitialLoading(false);
      }
    }
  }, [
    isReady, docketOffset, frOffset, selectedAgency, sortBy, dateRange,
    docketType, topic, interleaveFR, getRecentDocketsWithCounts, getRecentFederalRegister,
  ]);

  // Reset + reload whenever a filter (or FR toggle / sort) changes.
  useEffect(() => {
    if (isReady) {
      setInitialLoading(true);
      load(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, selectedAgency, sortBy, dateRange, docketType, topic, interleaveFR]);

  // Total matching-docket count for the header. Mirrors the feed's filters
  // (sort matters: open/closed change membership). FR rows aren't counted —
  // the header reads "N dockets". A stale-token guard keeps a fast filter
  // switch from leaving an out-of-date number.
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    setTotalCount(null);
    getFeedCount({
      agencyCode: selectedAgency || undefined,
      sortBy,
      dateRange: dateRange || undefined,
      docketType: docketType || undefined,
      topic: topic || undefined,
    })
      .then((n) => { if (!cancelled) setTotalCount(n); })
      .catch((err) => console.error('Failed to load feed count:', err));
    return () => { cancelled = true; };
  }, [isReady, selectedAgency, sortBy, dateRange, docketType, topic, getFeedCount]);

  // De-duplicate dockets by id.
  const uniqueDockets = useMemo(() => {
    const seen = new Set<string>();
    return dockets.filter(d => {
      const id = stripQuotes(d.docket_id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [dockets]);

  // De-duplicate FR by document number (pagination can re-surface a row, and
  // the same publication can appear under a tie in publication_date ordering).
  const uniqueFR = useMemo(() => {
    const seen = new Set<string>();
    return frDocs.filter(f => {
      if (seen.has(f.documentNumber)) return false;
      seen.add(f.documentNumber);
      return true;
    });
  }, [frDocs]);

  /**
   * Merge dockets + FR by date (desc), then apply a watermark: only render rows
   * newer than the most-recent loaded tail among streams that still have more.
   * This guarantees we never show an item that an unloaded item from the other
   * stream should precede — so already-rendered rows never reorder on scroll.
   */
  const rows = useMemo<FeedRow[]>(() => {
    // The merge/watermark date MUST match the docket stream's pagination order
    // (getRecentDocketsWithCounts sorts the recent feed by modify_date DESC).
    // Using date_created here would let a later page surface a docket whose
    // date_created sits above the current floor, splicing it in above
    // already-rendered rows — the exact reorder the watermark prevents.
    const docketRows: FeedRow[] = uniqueDockets.map(d => ({
      kind: 'docket', key: `d:${stripQuotes(d.docket_id)}`,
      date: tsOf(stripQuotes(d.modify_date) || stripQuotes(d.date_created)), data: d,
    }));
    if (!interleaveFR) return docketRows;

    const frRows: FeedRow[] = uniqueFR.map(f => ({
      kind: 'fr', key: `f:${f.documentNumber}`, date: tsOf(f.publicationDate), data: f,
    }));
    const all = [...docketRows, ...frRows].sort((a, b) => b.date - a.date);

    let floor = -Infinity;
    if (docketHasMore && docketRows.length) {
      floor = Math.max(floor, Math.min(...docketRows.map(r => r.date)));
    }
    if (frHasMore && frRows.length) {
      floor = Math.max(floor, Math.min(...frRows.map(r => r.date)));
    }
    return floor === -Infinity ? all : all.filter(r => r.date >= floor);
  }, [uniqueDockets, uniqueFR, interleaveFR, docketHasMore, frHasMore]);

  const hasMore = docketHasMore || (interleaveFR && frHasMore);

  // Grow the feed region to meet the footer. Re-measure on resize and whenever
  // the rail toggles (filtersActive) or the first load resolves, since both move
  // the region's top. When the rail is shown its top sits below the viewport, so
  // the available space goes negative and the 75vh floor takes over — meaning we
  // never need to track the rail's async height growth.
  useLayoutEffect(() => {
    const measure = () => {
      const el = feedRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const footerH = document.querySelector('footer')?.offsetHeight ?? 0;
      const available = window.innerHeight - top - footerH;
      const floor = window.innerHeight * 0.75;
      setFeedHeight(`${Math.round(Math.max(floor, available))}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [filtersActive, initialLoading]);

  return (
    <div>
      {/* Discovery rail — hides when a filter narrows the feed. */}
      <DiscoveryRail filtersActive={filtersActive} />

      {/* Feed header — names the river (sibling of "Notable activity") and gives
          the filters below it a home. Carries a live count so the filters have
          visible feedback, and absorbs the agency-scoped state: the feed has no
          agency control of its own, it's reached via the agency profile's
          "View all dockets →" CTA (/feed?agency=CODE), so keep it clearable. */}
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <SectionLabel
          label={
            selectedAgency ? (
              <>
                Dockets from{' '}
                <Link href={`/sr/${selectedAgency}`} className="normal-case" style={{ color: 'var(--accent-primary)' }}>
                  sr/{selectedAgency}
                </Link>
              </>
            ) : (
              'All rulemaking'
            )
          }
          caption={
            totalCount !== null
              ? `${totalCount.toLocaleString()} ${totalCount === 1 ? 'docket' : 'dockets'}`
              : undefined
          }
        />
        {selectedAgency && (
          <Link href="/feed" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] whitespace-nowrap">
            Clear ✕
          </Link>
        )}
      </div>

      {/* Filter Bar — always visible */}
      <Card interactive={false} className="mb-6 p-4">
        <FeedFilters
          selectedAgency={selectedAgency}
          onAgencyChange={() => {}}
          sortBy={sortBy}
          onSortChange={setSortBy}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          docketType={docketType}
          onDocketTypeChange={setDocketType}
          topic={topic}
          onTopicChange={setTopic}
          includeFR={includeFR}
          onIncludeFRChange={(next) => setIncludeFRState(next ? 'on' : 'off')}
        />
      </Card>

      {/* Feed — `feedHeight` grows the scroll region to fill the space down to
          the footer (no gap) when the discovery rail is hidden, while a 75vh
          floor keeps the virtual list usable when the rail pushes it down or on
          short viewports. A definite px height is also what Virtuoso needs for
          its `height: 100%` scroller to resolve. */}
      <div ref={feedRef} className="relative" style={{ height: feedHeight ?? '75vh' }}>
        {initialLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <Loader2 size={32} className="animate-spin text-[var(--accent-primary)]" />
            <p className="text-[var(--muted)] text-sm">Loading feed...</p>
          </div>
        ) : rows.length === 0 && !loading ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <p className="text-lg text-[var(--muted)]">No dockets found.</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Try adjusting your filters or search.
            </p>
          </div>
        ) : (
          <Virtuoso
            style={{ height: '100%' }}
            data={rows}
            endReached={() => { if (hasMore && !loading) load(false); }}
            onScroll={(e) => setShowTopFade((e.target as HTMLElement).scrollTop > 1)}
            overscan={400}
            itemContent={(_index, row) => (
              <div className="pb-3">
                {row.kind === 'fr' ? (
                  <FederalRegisterPost doc={row.data} dashed />
                ) : (
                  <DocketPost
                    item={row.data}
                    commentCount={
                      Number(row.data.comment_count || 0) ||
                      commentCounts[stripQuotes(row.data.docket_id).toUpperCase()] || 0
                    }
                    documentCount={Number(row.data.document_count || 0)}
                  />
                )}
              </div>
            )}
            components={{
              Footer: () =>
                loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-[var(--accent-primary)]" />
                  </div>
                ) : !hasMore && rows.length > 0 ? (
                  <div className="text-center py-6 text-sm text-[var(--muted)]">
                    You&apos;ve reached the end 🌶️
                  </div>
                ) : null,
            }}
          />
        )}

        {/* Top scroll fade — the discovery rail's edge fade rotated onto the
            horizontal axis: the river dissolves into the background as it
            scrolls up under the filter bar, instead of cutting off hard. Only
            shown once scrolled away from the top, so the cue is present only
            when there's actually hidden content above. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[var(--background)] to-transparent transition-opacity duration-200 ${
            showTopFade ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PageShell maxWidth="4xl">
      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-[var(--accent-primary)]" />
          </div>
        }
      >
        <DocketFeed />
      </Suspense>
    </PageShell>
  );
}
