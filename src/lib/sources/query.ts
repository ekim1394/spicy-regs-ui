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

/**
 * Unified Agenda entries related to one regulations.gov docket, via the only
 * machine path between them: the docket's Federal Register documents
 * (`fr_docket_links`, docket-sorted → cheap) carry RIN arrays, and RINs key
 * the agenda. Deduped to each RIN's latest agenda edition (the agenda is one
 * row per RIN *per semiannual edition*). `def` must be the unified-agenda
 * registry entry — its selectCols shape what the panel renders.
 */
export function buildAgendaForDocketQuery(
  def: SourceDef,
  docketId: string,
  baseUrl: string,
  limit: number,
): string {
  return `
    WITH rins AS (
      -- No predicate on regulation_id_numbers_json: filtering that column
      -- makes DuckDB-WASM parse its parquet footer statistics for pushdown,
      -- which fails with "TProtocolException: Invalid data" (native DuckDB
      -- reads them fine). Filter the docket-sorted link rows first, then
      -- project/unnest the JSON column; NULL/empty arrays yield zero rows.
      SELECT DISTINCT unnest(CAST(json_extract(regulation_id_numbers_json, '$') AS VARCHAR[])) AS rin
      FROM read_parquet('${baseUrl}/fr_docket_links.parquet')
      WHERE docket_id = '${sqlStr(docketId)}'
    )
    SELECT ${def.selectCols}
    FROM ${sourceRef(def.table, baseUrl)} ua
    JOIN rins USING (rin)
    QUALIFY ROW_NUMBER() OVER (PARTITION BY rin ORDER BY agenda_edition DESC) = 1
    ORDER BY rin
    LIMIT ${Math.floor(limit)}
  `;
}

/**
 * Recent APA-review suits naming an agency. Court dockets carry no machine
 * key to the corpus — the defendant agency appears in `case_name` — so this
 * is a substring match on the agency's FULL name. Callers must pass a real
 * full name, never a bare code (short codes like "EPA" substring-match
 * unrelated words — "D-epa-rtment"). `def` must be the court-dockets
 * registry entry.
 */
export function buildLitigationForAgencyQuery(
  def: SourceDef,
  agencyName: string,
  baseUrl: string,
  limit: number,
): string {
  return `
    SELECT ${def.selectCols}
    FROM ${sourceRef(def.table, baseUrl)}
    WHERE case_name ILIKE '%${sqlStr(agencyName)}%'
    ORDER BY date_filed DESC NULLS LAST, ${def.tiebreak}
    LIMIT ${Math.floor(limit)}
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
