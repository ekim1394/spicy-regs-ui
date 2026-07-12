import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useAsyncData } from './useAsyncData';

// Mock the DuckDB context so we can drive isReady / init error directly without
// spinning up DuckDB-WASM. The hook only consumes { isReady, error }.
const mockDuckDB = vi.fn();
vi.mock('@/lib/duckdb/context', () => ({
  useDuckDB: () => mockDuckDB(),
}));

/** A promise plus its resolve/reject handles — lets a test control timing. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAsyncData', () => {
  beforeEach(() => {
    mockDuckDB.mockReturnValue({ isReady: true, error: null });
    // Quiet the intentional console.error on the error-path cases.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not call the fetcher until DuckDB is ready', async () => {
    mockDuckDB.mockReturnValue({ isReady: false, error: null });
    const fetcher = vi.fn(() => Promise.resolve('x'));

    const { result, rerender } = renderHook(() => useAsyncData(fetcher, ['k']));

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);

    // Flip to ready — the fetcher should now run.
    mockDuckDB.mockReturnValue({ isReady: true, error: null });
    await act(async () => {
      rerender();
    });
    await waitFor(() => expect(result.current.data).toBe('x'));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not call the fetcher when disabled', async () => {
    const fetcher = vi.fn(() => Promise.resolve('x'));

    const { result } = renderHook(() =>
      useAsyncData(fetcher, ['k'], { enabled: false }),
    );

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('happy path: loads, then resolves', async () => {
    const d = deferred<string>();
    const fetcher = vi.fn(() => d.promise);

    const { result } = renderHook(() => useAsyncData(fetcher, ['k']));

    // First render kicks off the fetch.
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.data).toBeUndefined();

    await act(async () => {
      d.resolve('done');
    });

    await waitFor(() => expect(result.current.data).toBe('done'));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('stale guard: a slow first request never overwrites a newer one', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const calls = [first, second];
    let i = 0;
    const fetcher = vi.fn(() => calls[i++].promise);

    let key = 'a';
    const { result, rerender } = renderHook(() => useAsyncData(fetcher, [key]));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    // Change deps -> second request starts before the first resolves.
    key = 'b';
    await act(async () => {
      rerender();
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));

    // Resolve the SECOND (current) request first, then the stale first one.
    await act(async () => {
      second.resolve('B');
    });
    await waitFor(() => expect(result.current.data).toBe('B'));

    await act(async () => {
      first.resolve('A');
    });
    // The stale 'A' must never appear.
    expect(result.current.data).toBe('B');
  });

  it('error path sets error, and refetch clears it and retries', async () => {
    const fail = deferred<string>();
    const ok = deferred<string>();
    const calls = [fail, ok];
    let i = 0;
    const fetcher = vi.fn(() => calls[i++].promise);

    const { result } = renderHook(() => useAsyncData(fetcher, ['k']));

    await waitFor(() => expect(result.current.isLoading).toBe(true));

    await act(async () => {
      fail.reject(new Error('boom'));
    });
    await waitFor(() => expect(result.current.error?.message).toBe('boom'));
    expect(result.current.isFetching).toBe(false);

    // Refetch: error clears immediately, fetcher runs again.
    await act(async () => {
      result.current.refetch();
    });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(fetcher).toHaveBeenCalledTimes(2);

    await act(async () => {
      ok.resolve('recovered');
    });
    await waitFor(() => expect(result.current.data).toBe('recovered'));
  });

  it('keepPreviousData keeps prior data during a dep-keyed refetch', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const calls = [first, second];
    let i = 0;
    const fetcher = vi.fn(() => calls[i++].promise);

    let key = 'a';
    const { result, rerender } = renderHook(() =>
      useAsyncData(fetcher, [key], { keepPreviousData: true }),
    );

    await act(async () => {
      first.resolve('A');
    });
    await waitFor(() => expect(result.current.data).toBe('A'));

    // Dep change: with keepPreviousData, 'A' stays on screen while refetching.
    key = 'b';
    await act(async () => {
      rerender();
    });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.data).toBe('A');
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      second.resolve('B');
    });
    await waitFor(() => expect(result.current.data).toBe('B'));
  });

  it('without keepPreviousData, a dep-keyed refetch resets to loading', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const calls = [first, second];
    let i = 0;
    const fetcher = vi.fn(() => calls[i++].promise);

    let key = 'a';
    const { result, rerender } = renderHook(() => useAsyncData(fetcher, [key]));

    await act(async () => {
      first.resolve('A');
    });
    await waitFor(() => expect(result.current.data).toBe('A'));

    key = 'b';
    await act(async () => {
      rerender();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('unmount before resolution does not warn or set state', async () => {
    const d = deferred<string>();
    const fetcher = vi.fn(() => d.promise);

    const { unmount } = renderHook(() => useAsyncData(fetcher, ['k']));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    unmount();
    // Resolving after unmount must be a no-op (no act warning, no throw).
    await act(async () => {
      d.resolve('late');
    });
  });

  it('init error is folded in without calling the fetcher', async () => {
    const initError = new Error('jsdelivr down');
    mockDuckDB.mockReturnValue({ isReady: false, error: initError });
    const fetcher = vi.fn(() => Promise.resolve('x'));

    const { result } = renderHook(() => useAsyncData(fetcher, ['k']));

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.error).toBe(initError);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
  });
});
