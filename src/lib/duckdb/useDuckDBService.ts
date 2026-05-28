"use client";

import { useCallback, useRef } from "react";
import { useDuckDB, R2_BASE_URL } from "./context";
import { RegulationsDataTypes } from "@/lib/db/models";
import { TOPIC_MAPPINGS, type TopicKey } from "@/lib/feedFilters";
import type { FederalRegisterDoc, FRFilters } from "@/lib/fr/types";
import { stripQuotes } from "@/lib/utils/fieldFormat";

/** Default row limit to prevent OOM in the browser */
const DEFAULT_LIMIT = 1000;

/**
 * Build a read_parquet() reference for a given data type.
 * For comments, uses the flat comments.parquet (best for full scans).
 * For agency-scoped comment queries, use commentsForAgency() instead.
 */
const parquetRef = (dataType: RegulationsDataTypes) => {
  return `read_parquet('${R2_BASE_URL}/${dataType}.parquet')`;
};

/**
 * Build a read_parquet() reference for the comments index.
 * Maps each partition (agency/docket/year/month) to its row count.
 */
const commentsIndexRef = () => {
  return `read_parquet('${R2_BASE_URL}/comments_index.parquet')`;
};

/**
 * Build a read_parquet() reference for the pre-computed feed summary.
 * Contains dockets with pre-joined comment_count and comment_end_date.
 */
const feedSummaryRef = () => {
  return `read_parquet('${R2_BASE_URL}/feed_summary.parquet')`;
};

/**
 * Build a read_parquet() reference for federal_register.parquet.
 * Sourced from federalregister.gov/api/v1, ~793K rows.
 */
const federalRegisterRef = () => {
  return `read_parquet('${R2_BASE_URL}/federal_register.parquet')`;
};

/**
 * Normalize one row from federal_register.parquet into the camel-cased
 * FederalRegisterDoc view used across components. The DuckDB query is expected
 * to alias docket_ids_json into a parsed VARCHAR[] called `docket_ids`.
 */
function normalizeFRRow(row: Record<string, unknown>): FederalRegisterDoc {
  const rawDocketIds = row.docket_ids;
  let docketIds: string[] = [];
  if (Array.isArray(rawDocketIds)) {
    docketIds = rawDocketIds.map((d) => stripQuotes(d)).filter(Boolean);
  }
  return {
    documentNumber: stripQuotes(row.document_number),
    title: stripQuotes(row.title),
    abstract: stripQuotes(row.abstract),
    documentType: stripQuotes(row.document_type),
    subtype: stripQuotes(row.subtype),
    publicationDate: stripQuotes(row.publication_date),
    effectiveOn: row.effective_on ? stripQuotes(row.effective_on) : null,
    commentsCloseOn: row.comments_close_on ? stripQuotes(row.comments_close_on) : null,
    signingDate: row.signing_date ? stripQuotes(row.signing_date) : null,
    agencySlugs: stripQuotes(row.agency_slugs),
    docketIds,
    htmlUrl: stripQuotes(row.html_url),
    pdfUrl: stripQuotes(row.pdf_url),
    executiveOrderNumber: row.executive_order_number
      ? stripQuotes(row.executive_order_number)
      : null,
  };
}

/**
 * Common SELECT clause for FR queries — projects the parquet columns we need
 * and parses docket_ids_json into a typed array on the DuckDB side so the
 * normalizer doesn't have to JSON.parse on the main thread.
 */
const FR_SELECT_COLS = `
  document_number,
  title,
  abstract,
  document_type,
  subtype,
  publication_date,
  effective_on,
  comments_close_on,
  signing_date,
  agency_slugs,
  CAST(json_extract(docket_ids_json, '$') AS VARCHAR[]) AS docket_ids,
  html_url,
  pdf_url,
  executive_order_number
`;

/** SQL escape: replace ' with ''. */
function sqlStr(s: string): string {
  return s.replace(/'/g, "''");
}

/**
 * Hook that provides data fetching via DuckDB-WASM + Parquet on R2.
 */
export function useDuckDBService() {
  const { runQuery, isReady } = useDuckDB();

  /** Cache agency list to avoid re-fetching dockets.parquet just for DISTINCT agency_code */
  const agencyCache = useRef<string[] | null>(null);

  /**
   * Build a read_parquet() SQL expression for comment partitions by querying the index.
   * Returns a SQL source expression like read_parquet([url1, url2, ...]).
   */
  const buildCommentsSource = useCallback(
    async (agencyCode: string, docketId?: string): Promise<string | null> => {
      const conditions = [`agency_code = '${agencyCode}'`];
      if (docketId) conditions.push(`docket_id = '${docketId}'`);

      const rows = await runQuery<{
        agency_code: string; docket_id: string; year: number; month: number;
      }>(`SELECT agency_code, docket_id, year, month FROM ${commentsIndexRef()} WHERE ${conditions.join(' AND ')}`);

      if (rows.length === 0) return null;

      const urls = rows.map(r =>
        `'${R2_BASE_URL}/comments/agency_code=${r.agency_code}/docket_id=${r.docket_id}/year=${r.year}/month=${r.month}/part-0.parquet'`
      );

      return `read_parquet([${urls.join(', ')}], union_by_name=true)`;
    },
    [runQuery]
  );

  /**
   * Get data with filters and pagination.
   * Enforces a default LIMIT to prevent large result sets from OOM.
   */
  const getData = useCallback(
    async (
      dataType: RegulationsDataTypes,
      agencyCode: string,
      docketId?: string,
      _maxCacheAgeHours = Infinity,
      limit?: number,
      offset?: number
    ): Promise<any[]> => {
      if (!isReady) throw new Error("DuckDB not ready");

      const conditions: string[] = [];
      const upperAgency = agencyCode?.toUpperCase();
      if (upperAgency) {
        conditions.push(`agency_code = '${upperAgency}'`);
      }
      if (docketId) {
        conditions.push(`docket_id = '${docketId.toUpperCase()}'`);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const effectiveLimit = limit ?? DEFAULT_LIMIT;

      // For comments, use the partition index to find the right files
      let source: string;
      if (dataType === 'comments' && upperAgency) {
        const commentsSource = await buildCommentsSource(upperAgency, docketId?.toUpperCase());
        if (!commentsSource) return [];
        source = commentsSource;
      } else {
        source = parquetRef(dataType);
      }

      const cols = dataType === 'dockets'
        ? 'docket_id, agency_code, title, abstract, docket_type, modify_date'
        : '*';

      let query = `SELECT ${cols} FROM ${source} ${whereClause} LIMIT ${effectiveLimit}`;
      if (offset !== undefined) query += ` OFFSET ${offset}`;

      return runQuery(query);
    },
    [runQuery, isReady, buildCommentsSource]
  );

  /**
   * Get count of records (never materializes rows).
   */
  const getDataCount = useCallback(
    async (
      dataType: RegulationsDataTypes,
      agencyCode: string,
      docketId?: string
    ): Promise<number> => {
      if (!isReady) throw new Error("DuckDB not ready");

      const upperAgency = agencyCode?.toUpperCase();

      // For comments, use the index for fast counts without reading data files
      if (dataType === 'comments' && upperAgency) {
        const conditions = [`agency_code = '${upperAgency}'`];
        if (docketId) conditions.push(`docket_id = '${docketId.toUpperCase()}'`);
        const query = `SELECT COALESCE(CAST(SUM(row_count) AS BIGINT), 0) as count FROM ${commentsIndexRef()} WHERE ${conditions.join(' AND ')}`;
        const result = await runQuery<{ count: number }>(query);
        return Number(result[0]?.count ?? 0);
      }

      const conditions: string[] = [];
      if (upperAgency) {
        conditions.push(`agency_code = '${upperAgency}'`);
      }
      if (docketId) {
        conditions.push(`docket_id = '${docketId.toUpperCase()}'`);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const query = `SELECT COUNT(*) as count FROM ${parquetRef(dataType)} ${whereClause}`;
      const result = await runQuery<{ count: number }>(query);
      return Number(result[0]?.count ?? 0);
    },
    [runQuery, isReady]
  );

  /**
   * Get list of agencies.
   */
  const getAgencies = useCallback(async (): Promise<string[]> => {
    if (!isReady) throw new Error("DuckDB not ready");

    // Return cached list if available (populated by getRecentDocketsWithCounts)
    if (agencyCache.current) return agencyCache.current;

    const query = `SELECT DISTINCT agency_code FROM ${parquetRef("dockets" as RegulationsDataTypes)} ORDER BY agency_code`;
    const result = await runQuery<{ agency_code: string }>(query);
    agencyCache.current = result.map((r) => r.agency_code);
    return agencyCache.current;
  }, [runQuery, isReady]);

  /**
   * Get list of dockets for an agency.
   */
  const getDockets = useCallback(
    async (agencyCode: string): Promise<string[]> => {
      if (!isReady) throw new Error("DuckDB not ready");

      const query = `SELECT DISTINCT docket_id FROM ${parquetRef("dockets" as RegulationsDataTypes)} WHERE agency_code = '${agencyCode.toUpperCase()}' ORDER BY docket_id DESC`;
      const result = await runQuery<{ docket_id: string }>(query);
      return result.map((r) => r.docket_id);
    },
    [runQuery, isReady]
  );

  /**
   * Get a single docket by its ID.
   */
  const getDocketById = useCallback(
    async (docketId: string): Promise<Record<string, any> | null> => {
      if (!isReady) throw new Error("DuckDB not ready");

      const escaped = docketId.replace(/'/g, "''");
      const query = `SELECT * FROM ${parquetRef("dockets" as RegulationsDataTypes)} WHERE docket_id = '${escaped}' LIMIT 1`;
      const results = await runQuery<Record<string, any>>(query);
      return results[0] || null;
    },
    [runQuery, isReady]
  );

  /**
   * Get recent dockets with comment counts.
   * Uses pre-computed feed_summary.parquet — no JOINs needed.
   */
  const getRecentDocketsWithCounts = useCallback(
    async (
      limit: number = 20,
      offset: number = 0,
      agencyCode?: string,
      sortBy: 'recent' | 'popular' | 'open' | 'closed' = 'recent',
      dateRange?: '7d' | '30d' | '90d' | '365d',
      docketType?: 'rule' | 'nonrule' | 'other',
      topic?: Exclude<TopicKey, ''>
    ): Promise<{ dockets: any[]; commentCounts: Record<string, number> }> => {
      if (!isReady) throw new Error("DuckDB not ready");

      const source = feedSummaryRef();
      const upperAgency = agencyCode?.toUpperCase();

      // Build conditions
      const conditions: string[] = [];
      if (upperAgency) conditions.push(`agency_code = '${upperAgency}'`);

      if (docketType === 'rule') {
        conditions.push(`docket_type = 'Rulemaking'`);
      } else if (docketType === 'nonrule') {
        conditions.push(`docket_type = 'Nonrulemaking'`);
      } else if (docketType === 'other') {
        conditions.push(`(docket_type NOT IN ('Rulemaking','Nonrulemaking') OR docket_type IS NULL)`);
      }

      // Topic: cross-agency category. Match agency codes OR keywords in title/abstract.
      // Agencies are an authoritative signal; keywords broaden recall to dockets from
      // outside the obvious agency set (e.g. an FDA/DEA collab on opioids hitting "drug").
      if (topic && TOPIC_MAPPINGS[topic]) {
        const def = TOPIC_MAPPINGS[topic];
        const agencyList = def.agencies.map(a => `'${a.toUpperCase()}'`).join(',');
        const keywordClauses = def.keywords
          .map(k => k.replace(/'/g, "''"))
          .flatMap(k => [`title ILIKE '%${k}%'`, `abstract ILIKE '%${k}%'`])
          .join(' OR ');
        conditions.push(`(agency_code IN (${agencyList}) OR (${keywordClauses}))`);
      }

      // Date range target depends on sort: comment-window sorts filter on comment_end_date;
      // recent/popular filter on the docket's modify/create date.
      const dateMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
      const dateDays = dateRange ? dateMap[dateRange] : undefined;
      if (dateDays) {
        const dateCol = (sortBy === 'open' || sortBy === 'closed')
          ? 'comment_end_date'
          : 'COALESCE(date_created, modify_date)';
        conditions.push(`TRY_CAST(${dateCol} AS TIMESTAMP) >= CAST(NOW() AS TIMESTAMP) - INTERVAL '${dateDays}' DAY`);
      }

      // Sort + filter logic
      let orderClause: string;
      let extraCondition = '';

      if (sortBy === 'popular') {
        orderClause = 'ORDER BY comment_count DESC, modify_date DESC';
      } else if (sortBy === 'open') {
        extraCondition = `TRY_CAST(comment_end_date AS TIMESTAMP) > CAST(NOW() AS TIMESTAMP)`;
        orderClause = 'ORDER BY comment_end_date ASC';
      } else if (sortBy === 'closed') {
        extraCondition = `TRY_CAST(comment_end_date AS TIMESTAMP) < CAST(NOW() AS TIMESTAMP)`;
        orderClause = 'ORDER BY comment_end_date DESC';
      } else {
        orderClause = 'ORDER BY modify_date DESC';
      }

      if (extraCondition) conditions.push(extraCondition);
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT docket_id, agency_code, title, abstract, docket_type, modify_date,
               date_created, comment_count, comment_end_date
        FROM ${source}
        ${whereClause}
        ${orderClause}
        LIMIT ${limit} OFFSET ${offset}
      `;

      const rows = await runQuery<any>(query);

      const commentCounts: Record<string, number> = {};
      const dockets = rows.map((row: any) => {
        const id = String(row.docket_id).toUpperCase();
        commentCounts[id] = Number(row.comment_count || 0);
        return row;
      });

      return { dockets, commentCounts };
    },
    [runQuery, isReady]
  );

  /** Legacy single-query version (used by detail pages) */
  const getRecentDockets = useCallback(
    async (
      limit: number = 20,
      offset: number = 0,
      agencyCode?: string,
      sortBy: 'recent' | 'popular' | 'open' = 'recent'
    ): Promise<any[]> => {
      if (!isReady) throw new Error("DuckDB not ready");

      const conditions: string[] = [];
      if (agencyCode) {
        conditions.push(`agency_code = '${agencyCode.toUpperCase()}'`);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const orderClause = 'ORDER BY modify_date DESC';
      const cols = 'docket_id, agency_code, title, abstract, docket_type, modify_date';
      const query = `SELECT ${cols} FROM ${parquetRef("dockets" as RegulationsDataTypes)} ${whereClause} ${orderClause} LIMIT ${limit} OFFSET ${offset}`;
      return runQuery(query);
    },
    [runQuery, isReady]
  );

  /**
   * Get comments for a specific docket.
   * Extracts agency code from docket_id prefix to read only that agency's
   * partition file instead of scanning the full 3GB+ comments dataset.
   */
  const getCommentsForDocket = useCallback(
    async (
      docketId: string,
      limit: number = 10,
      offset: number = 0,
      sortBy: 'recent' | 'oldest' = 'recent',
      modifyDate?: string
    ): Promise<any[]> => {
      if (!isReady) throw new Error("DuckDB not ready");

      const cleanId = docketId.replace(/^"|"$/g, '').toUpperCase();
      const agency = cleanId.split('-')[0];
      const commentsSource = await buildCommentsSource(agency, cleanId);
      if (!commentsSource) return [];

      const orderClause = sortBy === 'oldest'
        ? 'ORDER BY posted_date ASC'
        : 'ORDER BY posted_date DESC';

      const query = `SELECT comment_id, docket_id, agency_code, title, comment, posted_date, modify_date FROM ${commentsSource} WHERE docket_id = '${cleanId}' ${orderClause} LIMIT ${limit} OFFSET ${offset}`;
      return runQuery(query);
    },
    [runQuery, isReady, buildCommentsSource]
  );

  /**
   * Get documents for a specific docket.
   * Reads from documents.parquet (~57MB) with a docket_id filter.
   */
  const getDocumentsForDocket = useCallback(
    async (
      docketId: string,
      limit: number = 50
    ): Promise<any[]> => {
      if (!isReady) throw new Error("DuckDB not ready");

      const cleanId = docketId.replace(/^"|"$/g, '').toUpperCase();
      const query = `
        SELECT document_id, title, document_type, posted_date,
               comment_start_date, comment_end_date, file_url
        FROM ${parquetRef("documents" as RegulationsDataTypes)}
        WHERE docket_id = '${cleanId}'
        ORDER BY posted_date DESC
        LIMIT ${limit}
      `;
      return runQuery(query);
    },
    [runQuery, isReady]
  );

  /**
   * Get comment counts for a batch of docket IDs.
   * Groups docket IDs by agency prefix and queries each agency's comment partition.
   */
  /**
   * Get comment counts for a batch of docket IDs.
   * Uses the comments index directly — no need to read actual data files.
   */
  const getCommentCounts = useCallback(
    async (docketIds: string[]): Promise<Record<string, number>> => {
      if (!isReady || docketIds.length === 0) return {};

      const cleanIds = docketIds.map(id => id.replace(/^"|"$/g, '').toUpperCase());
      const inClause = cleanIds.map(id => `'${id}'`).join(',');

      const rows = await runQuery<{ did: string; cnt: number }>(`
        SELECT docket_id as did, CAST(SUM(row_count) AS BIGINT) as cnt
        FROM ${commentsIndexRef()}
        WHERE docket_id IN (${inClause})
        GROUP BY docket_id
      `);

      const result: Record<string, number> = {};
      for (const id of cleanIds) result[id] = 0;
      for (const r of rows) {
        result[r.did] = Number(r.cnt);
      }
      return result;
    },
    [runQuery, isReady]
  );

  /**
   * Get aggregate stats for an agency (docket, document, comment counts).
   * Queries each parquet source separately: dockets, documents, and the agency comment partition.
   */
  /**
   * Get aggregate stats for an agency.
   * Comment counts come from the index — no need to read data files.
   */
  const getAgencyStats = useCallback(
    async (agencyCode: string): Promise<{ docketCount: number; documentCount: number; commentCount: number }> => {
      if (!isReady) throw new Error("DuckDB not ready");

      const upper = agencyCode.toUpperCase();

      const [docketResult, docResult, commentResult] = await Promise.all([
        runQuery<{ count: number }>(`
          SELECT COUNT(*) as count
          FROM ${parquetRef("dockets" as RegulationsDataTypes)}
          WHERE agency_code = '${upper}'
        `),
        runQuery<{ count: number }>(`SELECT COUNT(*) as count FROM ${parquetRef("documents" as RegulationsDataTypes)} WHERE agency_code = '${upper}'`),
        runQuery<{ count: number }>(`SELECT COALESCE(CAST(SUM(row_count) AS BIGINT), 0) as count FROM ${commentsIndexRef()} WHERE agency_code = '${upper}'`),
      ]);

      return {
        docketCount: Number(docketResult[0]?.count ?? 0),
        documentCount: Number(docResult[0]?.count ?? 0),
        commentCount: Number(commentResult[0]?.count ?? 0),
      };
    },
    [runQuery, isReady]
  );

  /**
   * Get agencies ranked by docket count (most dockets first).
   */
  const getPopularAgencies = useCallback(
    async (limit: number = 4): Promise<{ agency_code: string; docket_count: number }[]> => {
      if (!isReady) throw new Error("DuckDB not ready");

      const query = `SELECT agency_code, COUNT(*) as docket_count FROM ${parquetRef("dockets" as RegulationsDataTypes)} GROUP BY agency_code ORDER BY docket_count DESC LIMIT ${limit}`;
      return runQuery<{ agency_code: string; docket_count: number }>(query);
    },
    [runQuery, isReady]
  );

  /**
   * Get docket counts for all agencies.
   * Only counts dockets (from dockets.parquet). Comment counts are omitted
   * since they'd require scanning 3GB+ of comment partitions.
   */
  const getAllAgencyCounts = useCallback(
    async (): Promise<Record<string, { dockets: number; comments: number }>> => {
      if (!isReady) throw new Error("DuckDB not ready");

      const query = `
        SELECT agency_code, COUNT(*) as docket_cnt
        FROM ${parquetRef("dockets" as RegulationsDataTypes)}
        GROUP BY agency_code
      `;

      const rows = await runQuery<{ agency_code: string; docket_cnt: number }>(query);
      const result: Record<string, { dockets: number; comments: number }> = {};
      for (const r of rows) {
        const code = r.agency_code?.replace(/^"|"$/g, '') || '';
        result[code] = {
          dockets: Number(r.docket_cnt),
          comments: 0,
        };
      }
      return result;
    },
    [runQuery, isReady]
  );

  /**
   * Get ALL comments for a docket (for export). No pagination, capped at 50k rows.
   */
  const getAllCommentsForDocket = useCallback(
    async (docketId: string): Promise<any[]> => {
      if (!isReady) throw new Error("DuckDB not ready");

      const cleanId = docketId.replace(/^"|"$/g, '').toUpperCase();
      const agency = cleanId.split('-')[0];
      const commentsSource = await buildCommentsSource(agency, cleanId);
      if (!commentsSource) return [];

      const query = `SELECT * FROM ${commentsSource} WHERE docket_id = '${cleanId}' ORDER BY posted_date DESC LIMIT 50000`;
      return runQuery(query);
    },
    [runQuery, isReady, buildCommentsSource]
  );

  /**
   * Federal Register: paginated browse with optional filters.
   * Used by the /federal-register page. Reads federal_register.parquet
   * over HTTP range requests via DuckDB-WASM (no client-side index).
   */
  const getRecentFederalRegister = useCallback(
    async (
      limit = 20,
      offset = 0,
      filters: FRFilters = {}
    ): Promise<FederalRegisterDoc[]> => {
      if (!isReady) throw new Error("DuckDB not ready");

      const conditions: string[] = [];
      if (filters.documentType) {
        conditions.push(`document_type = '${sqlStr(filters.documentType)}'`);
      }
      if (filters.agencySlug) {
        // agency_slugs is a comma-joined list — substring match keeps the
        // query simple and pushes down predicates inside DuckDB.
        conditions.push(`agency_slugs LIKE '%${sqlStr(filters.agencySlug)}%'`);
      }
      const dateMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
      if (filters.dateRange && dateMap[filters.dateRange]) {
        const days = dateMap[filters.dateRange];
        conditions.push(
          `TRY_CAST(publication_date AS DATE) >= CAST(NOW() AS DATE) - INTERVAL '${days}' DAY`
        );
      }

      let orderClause: string;
      if (filters.sortBy === 'oldest') {
        orderClause = 'ORDER BY publication_date ASC NULLS LAST';
      } else if (filters.sortBy === 'comment-deadline') {
        // Surface anything still open for comment, soonest deadline first.
        conditions.push(`TRY_CAST(comments_close_on AS DATE) >= CAST(NOW() AS DATE)`);
        orderClause = 'ORDER BY comments_close_on ASC';
      } else {
        orderClause = 'ORDER BY publication_date DESC NULLS LAST';
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT ${FR_SELECT_COLS}
        FROM ${federalRegisterRef()}
        ${whereClause}
        ${orderClause}
        LIMIT ${limit} OFFSET ${offset}
      `;
      const rows = await runQuery<Record<string, unknown>>(query);
      return rows.map(normalizeFRRow);
    },
    [runQuery, isReady]
  );

  /**
   * Federal Register: find publications linked to a specific regulations.gov
   * docket via FR's docket_ids_json field. Used by the RelatedFederalRegister
   * section on the docket detail page.
   *
   * Match strategy: substring on docket_ids_json with surrounding double
   * quotes so we don't false-match a docket ID that's a substring of another.
   */
  const getFRPublicationsForDocket = useCallback(
    async (docketId: string, limit = 5): Promise<FederalRegisterDoc[]> => {
      if (!isReady) throw new Error("DuckDB not ready");
      const cleanId = stripQuotes(docketId);
      if (!cleanId) return [];

      const query = `
        SELECT ${FR_SELECT_COLS}
        FROM ${federalRegisterRef()}
        WHERE docket_ids_json LIKE '%"${sqlStr(cleanId)}"%'
        ORDER BY publication_date DESC NULLS LAST
        LIMIT ${limit}
      `;
      const rows = await runQuery<Record<string, unknown>>(query);
      return rows.map(normalizeFRRow);
    },
    [runQuery, isReady]
  );

  /**
   * Federal Register: free-text search via DuckDB ILIKE. Used by the FR
   * section on /search. Plain substring match — there's no client-side
   * MiniSearch index for FR (parquet is too large).
   */
  const searchFederalRegister = useCallback(
    async (
      query: string,
      limit = 20,
      offset = 0,
      agencySlug?: string
    ): Promise<FederalRegisterDoc[]> => {
      if (!isReady) throw new Error("DuckDB not ready");
      const q = query.trim();
      if (!q) return [];

      const conditions = [
        `(title ILIKE '%${sqlStr(q)}%' OR abstract ILIKE '%${sqlStr(q)}%')`,
      ];
      if (agencySlug) {
        conditions.push(`agency_slugs LIKE '%${sqlStr(agencySlug)}%'`);
      }

      const sql = `
        SELECT ${FR_SELECT_COLS}
        FROM ${federalRegisterRef()}
        WHERE ${conditions.join(' AND ')}
        ORDER BY publication_date DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `;
      const rows = await runQuery<Record<string, unknown>>(sql);
      return rows.map(normalizeFRRow);
    },
    [runQuery, isReady]
  );

  /* ───────────────────── /lab (experimental) queries ───────────────────── */

  /**
   * Per-month document counts for the agency-activity small multiples on /lab.
   * Filters on document_type so the panel can show e.g. only "Rule" rows
   * against admin-transition bands.
   */
  const getDocumentCountsByAgencyMonth = useCallback(
    async (
      documentTypes: string[],
      since: string = '2014-01-01',
      agencyCodes?: string[]
    ): Promise<{ agency_code: string; document_type: string; month: string; n: number }[]> => {
      if (!isReady) throw new Error('DuckDB not ready');

      const typesIn = documentTypes.map(t => `'${sqlStr(t)}'`).join(',');
      const conditions = [
        `document_type IN (${typesIn})`,
        `TRY_CAST(posted_date AS DATE) >= DATE '${since}'`,
      ];
      if (agencyCodes && agencyCodes.length > 0) {
        const list = agencyCodes.map(a => `'${sqlStr(a.toUpperCase())}'`).join(',');
        conditions.push(`agency_code IN (${list})`);
      }

      const query = `
        SELECT agency_code,
               document_type,
               strftime(date_trunc('month', TRY_CAST(posted_date AS DATE)), '%Y-%m-%d') AS month,
               COUNT(*) AS n
        FROM ${parquetRef('documents' as RegulationsDataTypes)}
        WHERE ${conditions.join(' AND ')}
        GROUP BY 1, 2, 3
        ORDER BY 1, 2, 3
      `;
      const rows = await runQuery<{ agency_code: string; document_type: string; month: string; n: number }>(query);
      return rows.map(r => ({ ...r, n: Number(r.n) }));
    },
    [runQuery, isReady]
  );

  /**
   * Volume curve + form-letter clusters for a single docket — drives /lab
   * Panel 2 (comment orchestration). Three rolled-up shapes returned together
   * so the panel does one round-trip.
   */
  const getCommentVolumeAndClusters = useCallback(
    async (
      docketId: string
    ): Promise<{
      docketTitle: string;
      docketAbstract: string;
      commentStartDate: string | null;
      commentEndDate: string | null;
      totals: { total: number; unique: number; empty: number };
      volumeByDay: { day: string; n: number }[];
      clusters: { hash: string; n: number; sample: string; firstDay: string; lastDay: string }[];
    }> => {
      if (!isReady) throw new Error('DuckDB not ready');

      const cleanId = docketId.replace(/^"|"$/g, '').toUpperCase();
      const agency = cleanId.split('-')[0];

      const commentsSource = await buildCommentsSource(agency, cleanId);

      // feed_summary carries the pre-joined comment_end_date from the
      // Proposed Rule document and is the authoritative answer for "when
      // did the comment period close." We fall back to dockets.parquet for
      // metadata if the docket isn't in feed_summary.
      const metaRows = await runQuery<{ title: string; abstract: string; comment_end_date: string | null }>(`
        WITH fs AS (
          SELECT title, abstract, comment_end_date
          FROM ${feedSummaryRef()}
          WHERE docket_id = '${sqlStr(cleanId)}'
          LIMIT 1
        ),
        dk AS (
          SELECT title, abstract, NULL AS comment_end_date
          FROM ${parquetRef('dockets' as RegulationsDataTypes)}
          WHERE docket_id = '${sqlStr(cleanId)}'
          LIMIT 1
        )
        SELECT * FROM fs
        UNION ALL
        SELECT * FROM dk WHERE NOT EXISTS (SELECT 1 FROM fs)
        LIMIT 1
      `);
      const docketTitle = stripQuotes(metaRows[0]?.title);
      const docketAbstract = stripQuotes(metaRows[0]?.abstract);
      const commentEndDate = metaRows[0]?.comment_end_date
        ? stripQuotes(metaRows[0].comment_end_date)
        : null;

      if (!commentsSource) {
        return {
          docketTitle,
          docketAbstract,
          commentEndDate,
          totals: { total: 0, unique: 0, empty: 0 },
          volumeByDay: [],
          clusters: [],
        };
      }

      const [totals, volumeByDay, clusters, startDateRows] = await Promise.all([
        runQuery<{ total: number; unique: number; empty: number }>(`
          SELECT COUNT(*) AS total,
                 COUNT(DISTINCT md5(LOWER(TRIM(comment)))) AS unique,
                 COUNT(*) FILTER (WHERE comment IS NULL OR TRIM(comment) = '') AS empty
          FROM ${commentsSource}
          WHERE docket_id = '${sqlStr(cleanId)}'
        `),
        runQuery<{ day: string; n: number }>(`
          SELECT strftime(date_trunc('day', TRY_CAST(posted_date AS DATE)), '%Y-%m-%d') AS day,
                 COUNT(*) AS n
          FROM ${commentsSource}
          WHERE docket_id = '${sqlStr(cleanId)}'
            AND TRY_CAST(posted_date AS DATE) IS NOT NULL
          GROUP BY 1
          ORDER BY 1
        `),
        runQuery<{ hash: string; n: number; sample: string; firstDay: string; lastDay: string }>(`
          SELECT md5(LOWER(TRIM(comment))) AS hash,
                 COUNT(*) AS n,
                 LEFT(ANY_VALUE(comment), 240) AS sample,
                 strftime(MIN(TRY_CAST(posted_date AS DATE)), '%Y-%m-%d') AS firstDay,
                 strftime(MAX(TRY_CAST(posted_date AS DATE)), '%Y-%m-%d') AS lastDay
          FROM ${commentsSource}
          WHERE docket_id = '${sqlStr(cleanId)}'
            AND comment IS NOT NULL AND TRIM(comment) <> ''
          GROUP BY 1
          ORDER BY n DESC
          LIMIT 20
        `),
        runQuery<{ start_date: string | null }>(`
          SELECT strftime(MIN(TRY_CAST(comment_start_date AS DATE)), '%Y-%m-%d') AS start_date
          FROM ${parquetRef('documents' as RegulationsDataTypes)}
          WHERE docket_id = '${sqlStr(cleanId)}'
            AND comment_start_date IS NOT NULL
        `),
      ]);

      const commentStartDate = startDateRows[0]?.start_date
        ? stripQuotes(startDateRows[0].start_date)
        : null;

      return {
        docketTitle,
        docketAbstract,
        commentStartDate,
        commentEndDate,
        totals: {
          total: Number(totals[0]?.total ?? 0),
          unique: Number(totals[0]?.unique ?? 0),
          empty: Number(totals[0]?.empty ?? 0),
        },
        volumeByDay: volumeByDay.map(r => ({ day: r.day, n: Number(r.n) })),
        clusters: clusters.map(r => ({ ...r, n: Number(r.n), sample: stripQuotes(r.sample) })),
      };
    },
    [runQuery, isReady, buildCommentsSource]
  );

  /**
   * Rulemaking lifecycles: per-docket Proposed→Rule pairing for /lab Panel 3.
   * Returns:
   *   - summary: per-agency percentile stats of completed rulemaking durations
   *   - completedSample: a bounded per-agency sample (fastest N + slowest N + N random middle) for the strip plot
   *   - stuck: the oldest Proposed Rules with no matching Rule across the requested agencies
   */
  const getRulemakingLifecycles = useCallback(
    async (
      agencyCodes: string[],
      samplePerAgency: number = 80,
      limitStuck: number = 20
    ): Promise<{
      summary: { agency_code: string; n: number; p10: number; p25: number; p50: number; p75: number; p90: number; min: number; max: number }[];
      completedSample: { docket_id: string; agency_code: string; title: string; proposed_date: string; final_date: string; days: number }[];
      stuck: { docket_id: string; agency_code: string; title: string; proposed_date: string; days_open: number }[];
    }> => {
      if (!isReady) throw new Error('DuckDB not ready');
      if (agencyCodes.length === 0) return { summary: [], completedSample: [], stuck: [] };

      const list = agencyCodes.map(a => `'${sqlStr(a.toUpperCase())}'`).join(',');

      const pairsCTE = `
        WITH props AS (
          SELECT docket_id, agency_code,
                 ANY_VALUE(title) AS title,
                 MIN(TRY_CAST(posted_date AS DATE)) AS proposed_date
          FROM ${parquetRef('documents' as RegulationsDataTypes)}
          WHERE document_type = 'Proposed Rule' AND agency_code IN (${list})
          GROUP BY 1, 2
        ),
        finals AS (
          SELECT docket_id, MIN(TRY_CAST(posted_date AS DATE)) AS final_date
          FROM ${parquetRef('documents' as RegulationsDataTypes)}
          WHERE document_type = 'Rule' AND agency_code IN (${list})
          GROUP BY 1
        ),
        pairs AS (
          SELECT p.docket_id, p.agency_code, p.title, p.proposed_date, f.final_date,
                 date_diff('day', p.proposed_date, f.final_date) AS days
          FROM props p
          JOIN finals f USING (docket_id)
          WHERE p.proposed_date IS NOT NULL
            AND f.final_date IS NOT NULL
            AND f.final_date >= p.proposed_date
            AND p.proposed_date >= DATE '2010-01-01'
        )
      `;

      const summary = await runQuery<{
        agency_code: string; n: number;
        p10: number; p25: number; p50: number; p75: number; p90: number;
        min: number; max: number;
      }>(`
        ${pairsCTE}
        SELECT agency_code,
               COUNT(*) AS n,
               quantile_cont(days, 0.10) AS p10,
               quantile_cont(days, 0.25) AS p25,
               quantile_cont(days, 0.50) AS p50,
               quantile_cont(days, 0.75) AS p75,
               quantile_cont(days, 0.90) AS p90,
               MIN(days) AS min,
               MAX(days) AS max
        FROM pairs
        GROUP BY agency_code
        ORDER BY n DESC
      `);

      const completedSample = await runQuery<{
        docket_id: string; agency_code: string; title: string;
        proposed_date: string; final_date: string; days: number;
      }>(`
        ${pairsCTE},
        ranked AS (
          SELECT *,
                 ROW_NUMBER() OVER (PARTITION BY agency_code ORDER BY days) AS r_low,
                 ROW_NUMBER() OVER (PARTITION BY agency_code ORDER BY days DESC) AS r_high,
                 (hash(docket_id) % 100) AS bucket
          FROM pairs
        )
        SELECT docket_id, agency_code, title,
               strftime(proposed_date, '%Y-%m-%d') AS proposed_date,
               strftime(final_date,    '%Y-%m-%d') AS final_date,
               days
        FROM ranked
        WHERE r_low <= ${samplePerAgency / 3}
           OR r_high <= ${samplePerAgency / 3}
           OR bucket < ${samplePerAgency / 3}
      `);

      // "Stuck" window: proposed at least 18 months ago (long enough that a
      // normal NPRM should have finalized) but not older than 8 years
      // (pre-2018 the parquet has thin / inconsistent Final Rule coverage
      // and pre-RIN-tracking cross-docket linkage; older "no matching Rule"
      // results are dominated by data artifacts rather than genuine
      // abandonments). Within that window we stratify by age tier so the
      // displayed sample spreads across years instead of clustering on the
      // exact boundary date.
      const stuckPerTier = Math.max(2, Math.floor(limitStuck / 3));
      const stuck = await runQuery<{
        docket_id: string; agency_code: string; title: string; proposed_date: string; days_open: number;
      }>(`
        WITH props AS (
          SELECT docket_id, agency_code,
                 ANY_VALUE(title) AS title,
                 MIN(TRY_CAST(posted_date AS DATE)) AS proposed_date
          FROM ${parquetRef('documents' as RegulationsDataTypes)}
          WHERE document_type = 'Proposed Rule' AND agency_code IN (${list})
          GROUP BY 1, 2
        ),
        finals AS (
          SELECT DISTINCT docket_id
          FROM ${parquetRef('documents' as RegulationsDataTypes)}
          WHERE document_type = 'Rule'
        ),
        candidates AS (
          SELECT p.docket_id, p.agency_code, p.title, p.proposed_date,
                 date_diff('day', p.proposed_date, CURRENT_DATE) AS days_open,
                 CASE
                   WHEN p.proposed_date >= CURRENT_DATE - INTERVAL '3 years' THEN 'recent'
                   WHEN p.proposed_date >= CURRENT_DATE - INTERVAL '5 years' THEN 'mid'
                   ELSE 'old'
                 END AS tier
          FROM props p
          LEFT JOIN finals f USING (docket_id)
          WHERE f.docket_id IS NULL
            AND p.proposed_date IS NOT NULL
            AND p.proposed_date <= CURRENT_DATE - INTERVAL '18 months'
            AND p.proposed_date >= CURRENT_DATE - INTERVAL '8 years'
        ),
        ranked AS (
          SELECT *,
                 ROW_NUMBER() OVER (PARTITION BY tier ORDER BY hash(docket_id)) AS rn
          FROM candidates
        )
        SELECT docket_id, agency_code, title,
               strftime(proposed_date, '%Y-%m-%d') AS proposed_date,
               days_open
        FROM ranked
        WHERE rn <= ${stuckPerTier}
        ORDER BY days_open DESC
      `);

      return {
        summary: summary.map(r => ({
          ...r,
          n: Number(r.n), p10: Number(r.p10), p25: Number(r.p25),
          p50: Number(r.p50), p75: Number(r.p75), p90: Number(r.p90),
          min: Number(r.min), max: Number(r.max),
        })),
        completedSample: completedSample.map(r => ({
          ...r, title: stripQuotes(r.title), days: Number(r.days),
        })),
        stuck: stuck.map(r => ({
          ...r, title: stripQuotes(r.title), days_open: Number(r.days_open),
        })),
      };
    },
    [runQuery, isReady]
  );

  return {
    getData,
    getDataCount,
    getAgencies,
    getDockets,
    getDocketById,
    getRecentDockets,
    getRecentDocketsWithCounts,
    getCommentsForDocket,
    getAllCommentsForDocket,
    getDocumentsForDocket,
    getCommentCounts,
    getAgencyStats,
    getPopularAgencies,
    getAllAgencyCounts,
    getRecentFederalRegister,
    getFRPublicationsForDocket,
    searchFederalRegister,
    getDocumentCountsByAgencyMonth,
    getCommentVolumeAndClusters,
    getRulemakingLifecycles,
    isReady,
  };
}
