'use client';

import { useEffect } from 'react';

/** Brand suffix appended to every page title, e.g. "Feed | SpicyRegs". */
export const TITLE_SUFFIX = 'SpicyRegs';

/**
 * Upgrades `document.title` for a client page whose title depends on data only
 * available in the browser (DuckDB-backed docket/document detail). Server-
 * derivable titles use Metadata in a `layout.tsx`/`page.tsx` instead — that's
 * SSR'd and survives React re-commits, which an imperative set at mount does
 * not (the DuckDBProvider's init re-render would clobber it).
 *
 * Pass `null`/`undefined` while the data is still loading: the hook leaves the
 * SSR title in place until the real title is known, then sets it once — after
 * the data-load render, so it wins the race.
 *
 *   usePageTitle(docket ? `${title} (Docket ${id})` : null);
 */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    if (!title) return;
    document.title = `${title} | ${TITLE_SUFFIX}`;
  }, [title]);
}
