'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { SourceDef } from './types';

/**
 * URL-backed sort + filter state for one source browser. A single hook owns
 * every param (sort + each registry filter) so the number of hook calls never
 * varies across sources with different filter counts.
 *
 * URL-only by design (like `useTabParam`): a source's filter set is
 * page-scoped exploration, not a sticky cross-session preference, and the URL
 * keeps a filtered view shareable. Values are validated against the registry
 * def — an invalid/hand-edited param reads as the default.
 */
export function useSourceParams(def: SourceDef) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const sort = useMemo(() => {
    const raw = searchParams.get('sort') ?? '';
    return def.sortOptions.some((o) => o.key === raw) ? raw : def.defaultSort;
  }, [searchParams, def]);

  const filterValues = useMemo(() => {
    const values: Record<string, string> = {};
    for (const filter of def.filters) {
      const raw = searchParams.get(filter.param) ?? '';
      values[filter.param] = filter.options.some((o) => o.value === raw) ? raw : '';
    }
    return values;
  }, [searchParams, def]);

  /** Set a param; the default value is removed from the URL to keep it clean. */
  const setParam = useCallback(
    (key: string, value: string, defaultValue: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const setSort = useCallback(
    (value: string) => setParam('sort', value, def.defaultSort),
    [setParam, def.defaultSort],
  );

  const setFilter = useCallback(
    (param: string, value: string) => setParam(param, value, ''),
    [setParam],
  );

  return { sort, setSort, filterValues, setFilter };
}
