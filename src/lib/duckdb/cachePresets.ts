/**
 * Shared cache presets for `runCachedQuery`. One module so every data hook
 * (useDuckDBService, useSourceQueries) applies identical TTL semantics.
 */

/**
 * Whole-dataset rollups that are identical for every viewer and only change
 * when the ETL refreshes (roughly daily). Served from IndexedDB across
 * reloads; the 6h TTL bounds staleness.
 */
export const ROLLUP_CACHE = { ttlMs: 6 * 60 * 60 * 1000, persist: true } as const;

/**
 * Per-entity detail reads (one docket's row, its document list, its comment
 * counts). Stable within a session — the underlying files change roughly
 * daily — but keyed per entity, so in-memory only to keep IndexedDB from
 * accumulating one entry per docket ever visited.
 */
export const DETAIL_CACHE = { ttlMs: 30 * 60 * 1000 } as const;

/**
 * Filtered/paginated list reads (feed variants, FR browse, source browsers).
 * Short enough that filter exploration stays fresh, long enough that
 * back-navigation and re-renders don't re-scan a multi-MB file.
 */
export const LIST_CACHE = { ttlMs: 10 * 60 * 1000 } as const;
