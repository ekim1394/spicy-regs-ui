"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { PageShell } from "@/components/ui/PageShell";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SearchInput } from "@/components/SearchInput";
import {
  SearchResultCard,
  SearchResultCardSkeleton,
} from "@/components/SearchResultCard";
import { FederalRegisterPost } from "@/components/feed/FederalRegisterPost";
import { useDocketSearch } from "@/lib/search/useDocketSearch";
import { useDuckDBService } from "@/lib/duckdb/useDuckDBService";
import type { SearchResult, SearchSort } from "@/lib/search/types";
import type { FederalRegisterDoc } from "@/lib/fr/types";

const PAGE_SIZE = 20;

function SkeletonList({ n = 5 }: { n?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <SearchResultCardSkeleton key={i} />
      ))}
    </div>
  );
}

function SearchBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const agency = searchParams.get("agency") ?? "";
  const sortParam = (searchParams.get("sort") as SearchSort | null) ?? "relevance";

  const { ensure, status, search, error } = useDocketSearch();
  const { searchFederalRegister, isReady: duckdbReady } = useDuckDBService();

  const [pageCount, setPageCount] = useState(1);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);

  const [frResults, setFrResults] = useState<FederalRegisterDoc[]>([]);
  const [frSearching, setFrSearching] = useState(false);

  // Reset pagination when query/sort/agency changes
  useEffect(() => {
    setPageCount(1);
  }, [query, sortParam, agency]);

  // Kick off index load as soon as the page mounts with a query
  useEffect(() => {
    if (query) void ensure().catch(() => {});
  }, [query, ensure]);

  // Federal Register: separate query path, runs in parallel with the docket
  // search. Uses DuckDB ILIKE since the FR dataset is too large to ship as
  // a client-side MiniSearch index. Cancellable so a fast typist doesn't
  // race conditions across queries.
  useEffect(() => {
    if (!query || !duckdbReady) {
      setFrResults([]);
      return;
    }
    setFrSearching(true);
    let cancelled = false;
    // Debounce: each call full-scans the ~793K-row FR parquet, so don't fire
    // one per keystroke as the query param updates while the user types.
    const debounce = setTimeout(() => {
      searchFederalRegister(query, 10, 0, agency || undefined)
        .then((rows) => {
          if (!cancelled) setFrResults(rows);
        })
        .catch((err) => {
          console.error('FR search failed:', err);
          if (!cancelled) setFrResults([]);
        })
        .finally(() => {
          if (!cancelled) setFrSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [query, agency, duckdbReady, searchFederalRegister]);

  // Run the search when query/sort/agency/pageCount changes
  useEffect(() => {
    if (!query || !search) {
      setResults([]);
      setTotal(0);
      return;
    }
    setSearching(true);
    // Defer to next tick so the skeleton flickers don't stutter on fast queries
    const id = setTimeout(() => {
      const limit = pageCount * PAGE_SIZE;
      const hits = search.search(query, {
        limit,
        offset: 0,
        sort: sortParam,
        agency: agency || undefined,
      });
      const t = search.searchTotal(query, { agency: agency || undefined });
      setResults(hits);
      setTotal(t);
      setSearching(false);
    }, 0);
    return () => clearTimeout(id);
  }, [query, sortParam, agency, pageCount, search]);

  const setSort = useCallback(
    (s: SearchSort) => {
      const params = new URLSearchParams(searchParams);
      if (s === "relevance") params.delete("sort");
      else params.set("sort", s);
      router.replace(`/search?${params.toString()}`);
    },
    [router, searchParams],
  );

  const clearAgency = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("agency");
    router.replace(`/search?${params.toString()}`);
  }, [router, searchParams]);

  const hasMore = results.length < total;

  const emptyHint = useMemo(() => {
    if (!query) return "Use the search bar above to find regulations.";
    if (status === "error") return "Search is temporarily unavailable.";
    if (status !== "ready") return null;
    return `No dockets matched “${query}”.`;
  }, [query, status]);

  if (!query) {
    return (
      <div className="text-center py-16 text-[var(--muted)] text-sm">
        {emptyHint}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Search input mirror for on-page refinement */}
      <div>
        <SearchInput initialQuery={query} />
      </div>

      {/* Query echo + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          Results for <span className="gradient-text">&ldquo;{query}&rdquo;</span>
          {status === "ready" && total > 0 && (
            <span className="ml-2 text-xs font-normal text-[var(--muted)]">
              {total.toLocaleString()} {total === 1 ? "docket" : "dockets"}
            </span>
          )}
        </h2>

        <div className="flex items-center gap-2 text-xs">
          {agency && (
            <button
              onClick={clearAgency}
              className="filter-chip filter-chip-active"
              title="Clear agency filter"
            >
              Agency: {agency} ✕
            </button>
          )}
          <FilterSelect
            value={sortParam}
            onValueChange={(v) => setSort(v as SearchSort)}
            prefix="Sort"
            ariaLabel="Sort results"
            options={[
              { value: "relevance", label: "Most relevant" },
              { value: "recency", label: "Most recently updated" },
            ]}
          />
        </div>
      </div>

      {/* Loading / error / empty / results */}
      {status === "loading" && results.length === 0 && <SkeletonList />}

      {status === "error" && (
        <div className="card p-6 text-sm text-[var(--muted)]">
          Couldn&rsquo;t load the search index.
          {error?.message && (
            <span className="block mt-1 font-mono text-xs opacity-70">
              {error.message}
            </span>
          )}
        </div>
      )}

      {status === "ready" && results.length === 0 && !searching && (
        <div className="text-center py-16 text-[var(--muted)] text-sm">
          {emptyHint}
        </div>
      )}

      {results.length > 0 && (
        <>
          <SectionLabel label="Dockets" className="pt-2" />
          <div className="space-y-3">
            {results.map((r) => (
              <SearchResultCard key={r.docket.docketId} result={r} />
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-[var(--muted)]">
              Showing {results.length.toLocaleString()} of {total.toLocaleString()}
            </span>
            {hasMore && (
              <Button
                variant="secondary"
                onClick={() => setPageCount((n) => n + 1)}
                className="text-xs"
              >
                Load more
              </Button>
            )}
          </div>
        </>
      )}

      {/* Federal Register section — fail-soft if no matches or DuckDB not ready */}
      {(frResults.length > 0 || frSearching) && (
        <section className="pt-4">
          <SectionLabel
            className="mb-2"
            label={
              <span className="inline-flex items-center gap-2">
                Federal Register
                {frSearching && (
                  <Loader2 size={14} className="animate-spin text-[var(--accent-primary)]" />
                )}
              </span>
            }
            caption={
              !frSearching && frResults.length > 0
                ? `${frResults.length} ${frResults.length === 1 ? 'match' : 'matches'}`
                : undefined
            }
          />
          <div className="space-y-3">
            {frResults.map((d) => (
              <FederalRegisterPost key={d.documentNumber} doc={d} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <PageShell maxWidth="4xl">
      <Suspense fallback={<SkeletonList />}>
        <SearchBody />
      </Suspense>
    </PageShell>
  );
}
