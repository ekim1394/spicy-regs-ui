'use client';

import { useCallback } from 'react';

import { useDuckDB, R2_BASE_URL } from './context';
import { ROLLUP_CACHE, LIST_CACHE } from './cachePresets';
import { buildSourceQuery, buildStatsQuery, type SourceQueryOpts } from '@/lib/sources/query';
import { SOURCES, FEDERAL_REGISTER_ENTRY } from '@/lib/sources/registry';
import type { SourceDef, SourceRow, SourceStats } from '@/lib/sources/types';
import { stripQuotes } from '@/lib/utils/fieldFormat';

/**
 * Normalize a raw DuckDB row for the all-VARCHAR source tables: every value
 * becomes a clean string or null. Empty strings collapse to null — live
 * sampling showed nulls dominate and the handful of '' values (3 bill titles,
 * 1 case name) mean "missing" too, and null-collapse keeps semantics like
 * "date_terminated === null ⇒ case still pending" honest.
 */
function normalizeSourceRow(raw: Record<string, unknown>): SourceRow {
  const row: SourceRow = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) {
      row[key] = null;
    } else {
      const s = stripQuotes(String(value)).trim();
      row[key] = s === '' ? null : s;
    }
  }
  return row;
}

/**
 * Generic data access for the /sources section. All per-source knowledge
 * (projection, sorts, filters) comes in via the registry's `SourceDef`; this
 * hook only owns execution, caching, and row normalization.
 */
export function useSourceQueries() {
  const { runCachedQuery, isReady } = useDuckDB();

  /** One page of rows for a source browser. */
  const getSourceRows = useCallback(
    async (def: SourceDef, opts: SourceQueryOpts): Promise<SourceRow[]> => {
      if (!isReady) throw new Error('DuckDB not ready');
      const sql = buildSourceQuery(def, R2_BASE_URL, opts);
      // Every page of a browse shares LIST_CACHE (in-memory, short TTL).
      // Persisting only page 1 (the feed/FR gate) would let a stale
      // IndexedDB first page pair with a fresh page-2 scan after the daily
      // republish — duplicating/dropping rows at the page boundary.
      const rows = await runCachedQuery<Record<string, unknown>>(sql, LIST_CACHE);
      return rows.map(normalizeSourceRow);
    },
    [runCachedQuery, isReady],
  );

  /**
   * Row count + freshness per source table (keyed by table name) for the
   * index page, in one UNION ALL pass. Includes the Federal Register's
   * index-only entry.
   */
  const getSourceStats = useCallback(async (): Promise<Record<string, SourceStats>> => {
    if (!isReady) throw new Error('DuckDB not ready');
    const entries = [
      ...SOURCES.map((s) => ({ table: s.table, recencyExpr: s.recencyExpr })),
      { table: FEDERAL_REGISTER_ENTRY.table, recencyExpr: FEDERAL_REGISTER_ENTRY.recencyExpr },
    ];
    // One query per table rather than a single UNION ALL: a missing or
    // mid-republish parquet then costs only its own tile's stats instead of
    // zeroing every tile (the MCP server's skip-missing-table idiom).
    const results = await Promise.allSettled(
      entries.map((e) =>
        runCachedQuery<{ tbl: string; n: unknown; latest: unknown }>(
          buildStatsQuery([e], R2_BASE_URL),
          ROLLUP_CACHE,
        ),
      ),
    );
    const stats: Record<string, SourceStats> = {};
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const row of result.value) {
        const latest = row.latest == null ? null : stripQuotes(String(row.latest));
        stats[stripQuotes(String(row.tbl))] = {
          count: Number(row.n ?? 0),
          latest: latest || null,
        };
      }
    }
    return stats;
  }, [runCachedQuery, isReady]);

  return { getSourceRows, getSourceStats, isReady };
}
