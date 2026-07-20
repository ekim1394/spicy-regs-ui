import { sqlStr } from '@/lib/duckdb/sql';
import type { SourceDef } from './types';

/**
 * Pure SQL builders for the generic source browser. Kept free of React/DuckDB
 * imports (the R2 base URL is a parameter) so they unit-test as plain
 * functions.
 */

/** `read_parquet()` reference for a source table on R2. */
export function sourceRef(table: string, baseUrl: string): string {
  return `read_parquet('${baseUrl}/${table}.parquet')`;
}

export interface SourceQueryOpts {
  /** Free-text search, ILIKE-matched across the def's searchFields. */
  search?: string;
  /** Active select-filter values keyed by filter param. */
  filterValues?: Record<string, string>;
  /** Key into def.sortOptions; falls back to def.defaultSort. */
  sortKey?: string;
  limit: number;
  offset: number;
}

/** Build the row query for one source browser page. */
export function buildSourceQuery(
  def: SourceDef,
  baseUrl: string,
  opts: SourceQueryOpts,
): string {
  const conditions: string[] = [];

  const search = opts.search?.trim() ?? '';
  if (search) {
    // sqlStr handles quote injection; the replace escapes LIKE wildcards
    // (\ % _) so user text matches literally instead of as a pattern.
    const escaped = sqlStr(search.replace(/([\\%_])/g, '\\$1'));
    const like = `'%${escaped}%' ESCAPE '\\'`;
    conditions.push(`(${def.searchFields.map((f) => `${f} ILIKE ${like}`).join(' OR ')})`);
  }

  for (const filter of def.filters) {
    const value = opts.filterValues?.[filter.param];
    if (!value) continue;
    // Only registry-declared option values ever reach SQL — an unknown value
    // (hand-edited URL) is dropped rather than interpolated.
    const option = filter.options.find((o) => o.value === value);
    if (!option || option.value === '') continue;
    conditions.push(option.where ?? `${filter.field} = '${sqlStr(option.value)}'`);
  }

  const sort =
    def.sortOptions.find((s) => s.key === opts.sortKey) ??
    def.sortOptions.find((s) => s.key === def.defaultSort) ??
    def.sortOptions[0];
  if (sort.where) conditions.push(sort.where);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // The tiebreak makes the ORDER BY a total order: each OFFSET page is an
  // independent Top-N query, and without it, rows tied on the sort column
  // could duplicate or drop across page boundaries.
  return `
    SELECT ${def.selectCols}
    FROM ${sourceRef(def.table, baseUrl)}
    ${whereClause}
    ORDER BY ${sort.orderBy}, ${def.tiebreak}
    LIMIT ${Math.floor(opts.limit)} OFFSET ${Math.floor(opts.offset)}
  `;
}

/** One entry of the index-page stats query. */
export interface StatsEntry {
  table: string;
  recencyExpr: string | null;
}

/**
 * Single UNION ALL query producing `(tbl, n, latest)` per source for the
 * index page. COUNT(*) reads parquet footers (no data scan); `latest` scans
 * one column per table with a recency expression.
 */
export function buildStatsQuery(entries: StatsEntry[], baseUrl: string): string {
  return entries
    .map(
      (e) => `SELECT '${sqlStr(e.table)}' AS tbl, COUNT(*) AS n,
        CAST(${e.recencyExpr ?? 'NULL'} AS VARCHAR) AS latest
        FROM ${sourceRef(e.table, baseUrl)}`,
    )
    .join('\nUNION ALL\n');
}
