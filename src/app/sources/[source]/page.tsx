'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Virtuoso } from 'react-virtuoso';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { CoveragePill } from '@/components/sources/CoveragePill';
import { PageShell } from '@/components/ui/PageShell';
import { SourceCard } from '@/components/sources/SourceCard';
import { SourceFilterBar } from '@/components/sources/SourceFilterBar';
import { useSourceQueries } from '@/lib/duckdb/useSourceQueries';
import { usePageTitle } from '@/lib/hooks/usePageTitle';
import { getSource } from '@/lib/sources/registry';
import { useSourceParams } from '@/lib/sources/useSourceParams';
import type { SourceCardModel, SourceDef } from '@/lib/sources/types';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function SourceBrowser({ def }: { def: SourceDef }) {
  usePageTitle(def.label);

  const { getSourceRows, isReady } = useSourceQueries();
  const { sort, setSort, filterValues, setFilter } = useSourceParams(def);

  // Search input debounces into the query term so each keystroke doesn't
  // trigger a parquet scan. `?q=` seeds the initial term (deep links from
  // related panels) but isn't written back while typing — the URL params that
  // round-trip are the whitelisted sort/filter ones in useSourceParams.
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '');
  const [search, setSearch] = useState(searchInput);
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [cards, setCards] = useState<SourceCardModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  // Monotonic load token — lets a newer load discard a stale in-flight
  // response (e.g. a fast filter switch) so it can't clobber the current
  // filters. An in-flight flag blocks only the append path; a reset always
  // supersedes. Same pattern as the feed and FR browse.
  const reqRef = useRef(0);
  const inFlightRef = useRef(false);

  // Object identity of filterValues changes per render; key effects on content.
  const filtersKey = useMemo(() => JSON.stringify(filterValues), [filterValues]);

  const loadRows = useCallback(
    async (reset = false) => {
      if (!isReady) return;
      if (!reset && inFlightRef.current) return;
      const req = ++reqRef.current;
      inFlightRef.current = true;
      try {
        setLoading(true);
        const newOffset = reset ? 0 : offset;
        const rows = await getSourceRows(def, {
          search,
          filterValues,
          sortKey: sort,
          limit: PAGE_SIZE,
          offset: newOffset,
        });
        if (req !== reqRef.current) return;
        const mapped = rows.map(def.toCard);
        setError(null);
        if (reset) {
          setCards(mapped);
          setOffset(PAGE_SIZE);
        } else {
          setCards((prev) => [...prev, ...mapped]);
          setOffset((prev) => prev + PAGE_SIZE);
        }
        setHasMore(rows.length === PAGE_SIZE);
      } catch (err) {
        if (req === reqRef.current) {
          console.error(`Failed to load ${def.table}:`, err);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (req === reqRef.current) {
          inFlightRef.current = false;
          setLoading(false);
          setInitialLoading(false);
        }
      }
    },
    [isReady, offset, search, filterValues, sort, def, getSourceRows],
  );

  // Reset + reload whenever the query shape changes. The full-page spinner is
  // reserved for the genuine first load — a refine (typing in search, flipping
  // a filter) keeps the prior rows on screen with the footer indicator instead
  // of tearing the list down on every debounce commit.
  useEffect(() => {
    if (isReady) {
      if (cards.length === 0) setInitialLoading(true);
      loadRows(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, search, sort, filtersKey]);

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/sources"
          className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--accent-primary)] transition-colors mb-2"
        >
          <ArrowLeft size={12} />
          All sources
        </Link>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h1 className="text-xl font-bold">{def.label}</h1>
          {def.caveat && <CoveragePill reason={def.caveat} />}
        </div>
        <p className="text-sm text-[var(--muted)] max-w-2xl">
          {def.description}{' '}
          <span className="text-[var(--muted-foreground)]">Source: {def.provider}.</span>
        </p>
      </div>

      <Card interactive={false} className="mb-6 p-4">
        <SourceFilterBar
          def={def}
          search={searchInput}
          onSearchChange={setSearchInput}
          sort={sort}
          onSortChange={setSort}
          filterValues={filterValues}
          onFilterChange={setFilter}
        />
      </Card>

      {initialLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 size={32} className="animate-spin text-[var(--accent-primary)]" />
          <p className="text-[var(--muted)] text-sm">Loading {def.label}…</p>
        </div>
      ) : error && cards.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg text-[var(--muted)]">Couldn&apos;t load {def.label}.</p>
          <button
            onClick={() => loadRows(true)}
            className="filter-chip mt-3"
          >
            Try again
          </button>
        </div>
      ) : cards.length === 0 && !loading ? (
        <div className="text-center py-16">
          <p className="text-lg text-[var(--muted)]">No records found.</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div style={{ height: '75vh' }}>
          <Virtuoso
            style={{ height: '100%' }}
            data={cards}
            endReached={() => {
              if (hasMore && !loading) loadRows(false);
            }}
            overscan={400}
            itemContent={(_, card) => (
              <div className="pb-3">
                <SourceCard card={card} />
              </div>
            )}
            components={{
              Footer: () =>
                loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-[var(--accent-primary)]" />
                  </div>
                ) : !hasMore && cards.length > 0 ? (
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

function UnknownSource() {
  return (
    <div className="text-center py-24">
      <p className="text-lg text-[var(--muted)]">Unknown source.</p>
      <Link
        href="/sources"
        className="inline-flex items-center gap-1 text-sm text-[var(--accent-primary)] hover:underline mt-2"
      >
        <ArrowLeft size={13} />
        Browse all sources
      </Link>
    </div>
  );
}

function SourceRoute() {
  const params = useParams<{ source: string }>();
  const def = getSource(params.source);
  if (!def) return <UnknownSource />;
  // Keyed remount resets browser state (search, paging) when hopping sources.
  return <SourceBrowser key={def.key} def={def} />;
}

export default function SourcePage() {
  return (
    <PageShell maxWidth="4xl">
      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-[var(--accent-primary)]" />
          </div>
        }
      >
        <SourceRoute />
      </Suspense>
    </PageShell>
  );
}
