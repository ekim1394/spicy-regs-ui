'use client';

import { useEffect, useRef, useState, type DependencyList } from 'react';
import { useDuckDB } from '@/lib/duckdb/context';

/** Options for {@link useAsyncData}. */
export interface UseAsyncDataOptions<T> {
  /**
   * Extra gate beyond DuckDB's `isReady` (e.g. `tab === 'overview'`). When
   * false the fetcher is never called and the hook stays idle. Default `true`.
   */
  enabled?: boolean;
  /**
   * Keep the prior result on the screen during a dep-keyed refetch (e.g. a
   * filter switch) instead of dropping back to the loading state. Default
   * `false`.
   */
  keepPreviousData?: boolean;
  /** Seed value shown before the first fetch resolves. */
  placeholderData?: T;
}

/** Result of {@link useAsyncData}. */
export interface UseAsyncDataResult<T> {
  /** Latest resolved data, or `placeholderData`/`undefined` before/while loading. */
  data: T | undefined;
  /**
   * Latest error (normalized to `Error`). Cleared when a refetch starts. The
   * DuckDB init error is folded in, so an engine that never came up surfaces
   * here without the fetcher running.
   */
  error: Error | null;
  /** True only when there is nothing to show yet (first load, no placeholder). */
  isLoading: boolean;
  /** True whenever a fetch is in flight (including keepPreviousData refetches). */
  isFetching: boolean;
  /** Re-run the fetcher for the current deps. */
  refetch: () => void;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

interface InternalState<T> {
  data: T | undefined;
  error: Error | null;
  status: Status;
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Run an async `fetcher` keyed on `deps`, with the feed's proven stale-guard
 * centralized: a monotonic request token discards any response whose effect has
 * been superseded (a newer dep change or unmount), so a slow query can never
 * clobber a newer one. `useDuckDB()` gating and init-error fold-in are built in,
 * so consumers get "engine down" surfacing for free and never call the fetcher
 * before the engine is ready.
 *
 * The `fetcher` is read from a ref (refreshed every render), so callers don't
 * need to memoize it; `deps` is the cache key, exactly like `useEffect`.
 *
 * @param fetcher produces the data; only invoked when ready + enabled.
 * @param deps re-runs the fetcher when any entry changes (the cache key).
 * @param options see {@link UseAsyncDataOptions}.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  options?: UseAsyncDataOptions<T>,
): UseAsyncDataResult<T> {
  const { isReady, error: initError } = useDuckDB();
  const enabled = options?.enabled ?? true;
  const keepPreviousData = options?.keepPreviousData ?? false;
  const placeholderData = options?.placeholderData;

  // Fetcher lives in a ref so callers don't need useCallback; deps drive reruns.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Monotonic token: incremented per effect run and on cleanup. A resolved
  // fetch only commits if its token still matches — the feed's stale guard.
  const reqRef = useRef(0);

  const [state, setState] = useState<InternalState<T>>({
    data: placeholderData,
    error: null,
    status: 'idle',
  });

  const [retryCount, setRetryCount] = useState(0);

  const active = isReady && enabled && !initError;

  useEffect(() => {
    if (!active) return;

    // Monotonic token bumped per run; a local flag flipped on cleanup. Either a
    // superseding run (token mismatch) or this run's own cleanup (cancelled)
    // makes a late resolution a no-op — the feed's proven stale guard, so a slow
    // query can never clobber a newer one.
    const req = ++reqRef.current;
    let cancelled = false;

    // Starting a fetch clears any prior error. keepPreviousData holds the last
    // data on screen (isFetching only); otherwise drop to a bare loading state.
    setState((prev) => ({
      data: keepPreviousData ? prev.data : placeholderData,
      error: null,
      status: 'loading',
    }));

    fetcherRef.current()
      .then((result) => {
        if (cancelled || req !== reqRef.current) return;
        setState({ data: result, error: null, status: 'success' });
      })
      .catch((err) => {
        if (cancelled || req !== reqRef.current) return;
        const normalized = toError(err);
        console.error('[useAsyncData] fetch failed:', normalized);
        setState((prev) => ({ data: prev.data, error: normalized, status: 'error' }));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, retryCount, ...deps]);

  // Init failure reaches every consumer without calling the fetcher.
  if (initError) {
    return {
      data: state.data,
      error: initError,
      isLoading: false,
      isFetching: false,
      refetch: () => setRetryCount((c) => c + 1),
    };
  }

  const isFetching = state.status === 'loading';
  // "Loading" = nothing to show yet. A placeholder or kept previous datum means
  // we're merely refetching, not blank-loading.
  const isLoading = isFetching && state.data === undefined;

  return {
    data: state.data,
    error: state.error,
    isLoading,
    isFetching,
    refetch: () => setRetryCount((c) => c + 1),
  };
}
