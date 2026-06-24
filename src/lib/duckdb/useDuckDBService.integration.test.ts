/**
 * Integration tests for useDuckDBService.
 *
 * Runs actual SQL queries against the remote Parquet files on R2 using
 * @duckdb/node-api (native Node.js DuckDB). Validates that:
 *   - SQL syntax is correct
 *   - Parquet schemas match query expectations
 *   - Results have the expected shape
 *
 * These hit the network (~5-15s total). Run with:
 *   npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DuckDBInstance } from '@duckdb/node-api';

const R2 = 'https://r2.spicy-regs.dev';

let instance: InstanceType<typeof DuckDBInstance>;
let conn: Awaited<ReturnType<InstanceType<typeof DuckDBInstance>['connect']>>;

async function runQuery<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const reader = await conn.runAndReadAll(sql);
  const cols = reader.columnNames();
  return reader.getRows().map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col: string, i: number) => (obj[col] = row[i]));
    return obj as T;
  });
}

beforeAll(async () => {
  instance = await DuckDBInstance.create(':memory:');
  conn = await instance.connect();
  await conn.run('INSTALL httpfs; LOAD httpfs;');
  await conn.run("SET s3_region='auto';");
}, 30000);

afterAll(async () => {
  // @duckdb/node-api cleans up on GC; no explicit close needed
});

// Helpers matching the service's query construction
const parquetRef = (type: string) => `read_parquet('${R2}/${type}.parquet')`;
const commentsForAgency = (code: string) =>
  `read_parquet('${R2}/comments/agency/agency_code=${code}/part-0.parquet')`;
const feedSummaryRef = () => `read_parquet('${R2}/feed_summary.parquet')`;
const commentsIndexRef = () => `read_parquet('${R2}/comments_index.parquet')`;
const documentsRef = () => `read_parquet('${R2}/documents.parquet')`;

describe('dockets.parquet schema', () => {
  it('has required columns', async () => {
    const rows = await runQuery(`SELECT * FROM ${parquetRef('dockets')} LIMIT 1`);
    expect(rows.length).toBe(1);
    const row = rows[0] as Record<string, unknown>;
    expect(row).toHaveProperty('docket_id');
    expect(row).toHaveProperty('agency_code');
    expect(row).toHaveProperty('title');
    expect(row).toHaveProperty('modify_date');
  });
});

describe('documents.parquet schema', () => {
  it('has required columns', async () => {
    const rows = await runQuery(`SELECT * FROM ${parquetRef('documents')} LIMIT 1`);
    expect(rows.length).toBe(1);
    const row = rows[0] as Record<string, unknown>;
    expect(row).toHaveProperty('document_id');
    expect(row).toHaveProperty('title');
    expect(row).toHaveProperty('docket_id');
    expect(row).toHaveProperty('agency_code');
    expect(row).toHaveProperty('posted_date');
  });
});

describe('comments partition schema', () => {
  it('has required columns for EPA partition', async () => {
    const rows = await runQuery(`SELECT * FROM ${commentsForAgency('EPA')} LIMIT 1`);
    expect(rows.length).toBe(1);
    const row = rows[0] as Record<string, unknown>;
    expect(row).toHaveProperty('comment_id');
    expect(row).toHaveProperty('docket_id');
    expect(row).toHaveProperty('posted_date');
  });
});

describe('feed_summary.parquet schema', () => {
  it('has required columns', async () => {
    const rows = await runQuery(`SELECT * FROM ${feedSummaryRef()} LIMIT 1`);
    expect(rows.length).toBe(1);
    const row = rows[0] as Record<string, unknown>;
    expect(row).toHaveProperty('docket_id');
    expect(row).toHaveProperty('agency_code');
    expect(row).toHaveProperty('title');
    expect(row).toHaveProperty('modify_date');
    expect(row).toHaveProperty('comment_count');
    expect(row).toHaveProperty('comment_end_date');
  });

  it('has non-negative comment counts', async () => {
    const rows = await runQuery<{ comment_count: number }>(
      `SELECT comment_count FROM ${feedSummaryRef()} WHERE comment_count < 0 LIMIT 1`
    );
    expect(rows.length).toBe(0);
  });
});

describe('getData queries', () => {
  it('filters dockets by agency', async () => {
    const rows = await runQuery(
      `SELECT * FROM ${parquetRef('dockets')} WHERE agency_code = 'EPA' LIMIT 5`
    );
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row: any) => {
      expect(String(row.agency_code).replace(/^"|"$/g, '')).toBe('EPA');
    });
  });

  it('uses agency partition for comments', async () => {
    const rows = await runQuery(
      `SELECT * FROM ${commentsForAgency('EPA')} WHERE agency_code = 'EPA' LIMIT 5`
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('uses flat parquet for comments without agency', async () => {
    const rows = await runQuery(
      `SELECT * FROM ${parquetRef('comments')} LIMIT 3`
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('getDataCount query', () => {
  it('returns a count', async () => {
    const result = await runQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${parquetRef('dockets')} WHERE agency_code = 'EPA'`
    );
    expect(Number(result[0].count)).toBeGreaterThan(0);
  });
});

describe('searchResources query', () => {
  it('executes valid UNION ALL across resource types', async () => {
    const search = 'water';
    const tables = ['dockets', 'documents', 'comments'] as const;
    const unionQueries = tables.map((table) => {
      const source = table === 'comments' ? commentsForAgency('EPA') : parquetRef(table);
      const where = table === 'comments'
        ? `title ILIKE '%${search}%' AND agency_code = 'EPA'`
        : `title ILIKE '%${search}%'`;
      return `SELECT '${table}' as type, title, docket_id, agency_code FROM ${source} WHERE ${where}`;
    });
    const sql = unionQueries.join(' UNION ALL ') + ' LIMIT 10';
    const rows = await runQuery(sql);
    expect(Array.isArray(rows)).toBe(true);
  });
});

describe('getDocketById query', () => {
  it('fetches a single docket', async () => {
    const [sample] = await runQuery<{ docket_id: string }>(
      `SELECT docket_id FROM ${parquetRef('dockets')} LIMIT 1`
    );
    const docketId = String(sample.docket_id).replace(/^"|"$/g, '');
    const rows = await runQuery(
      `SELECT * FROM ${parquetRef('dockets')} WHERE docket_id = '${docketId}' LIMIT 1`
    );
    expect(rows.length).toBe(1);
  });
});

describe('getRecentDocketsWithCounts query (feed_summary)', () => {
  it('queries feed summary with ORDER BY and LIMIT', async () => {
    const rows = await runQuery(`
      SELECT docket_id, agency_code, title, abstract, docket_type, modify_date,
             comment_count, comment_end_date
      FROM ${feedSummaryRef()}
      ORDER BY modify_date DESC
      LIMIT 5 OFFSET 0
    `);
    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0] as Record<string, unknown>;
    expect(row).toHaveProperty('comment_count');
    expect(row).toHaveProperty('comment_end_date');
  });

  it('filters by agency', async () => {
    const rows = await runQuery(`
      SELECT docket_id, agency_code, title, comment_count
      FROM ${feedSummaryRef()}
      WHERE agency_code = 'EPA'
      ORDER BY modify_date DESC
      LIMIT 5
    `);
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row: any) => {
      expect(String(row.agency_code).replace(/^"|"$/g, '')).toBe('EPA');
    });
  });

  it('sorts by popular (comment_count DESC)', async () => {
    const rows = await runQuery<{ comment_count: number }>(`
      SELECT comment_count
      FROM ${feedSummaryRef()}
      ORDER BY comment_count DESC
      LIMIT 5
    `);
    for (let i = 1; i < rows.length; i++) {
      expect(Number(rows[i - 1].comment_count)).toBeGreaterThanOrEqual(Number(rows[i].comment_count));
    }
  });

  it('filters open comment periods', async () => {
    const rows = await runQuery(`
      SELECT docket_id, comment_end_date
      FROM ${feedSummaryRef()}
      WHERE TRY_CAST(comment_end_date AS TIMESTAMP) > CAST(NOW() AS TIMESTAMP)
      ORDER BY comment_end_date ASC
      LIMIT 5
    `);
    // May be empty if no dockets currently have open comment periods
    expect(Array.isArray(rows)).toBe(true);
  });
});

describe('getCommentsForDocket query', () => {
  it('queries comments by docket_id with sort', async () => {
    const [sample] = await runQuery<{ docket_id: string }>(
      `SELECT docket_id FROM ${commentsForAgency('EPA')} LIMIT 1`
    );
    const docketId = String(sample.docket_id).replace(/^"|"$/g, '');

    const rows = await runQuery(
      `SELECT * FROM ${commentsForAgency('EPA')} WHERE docket_id = '${docketId}' ORDER BY posted_date DESC LIMIT 10 OFFSET 0`
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('getAllCommentsForDocket query (export)', () => {
  it('fetches comments with 50k limit', async () => {
    const [sample] = await runQuery<{ docket_id: string }>(
      `SELECT docket_id FROM ${commentsForAgency('EPA')} LIMIT 1`
    );
    const docketId = String(sample.docket_id).replace(/^"|"$/g, '');

    const rows = await runQuery(
      `SELECT * FROM ${commentsForAgency('EPA')} WHERE docket_id = '${docketId}' ORDER BY posted_date DESC LIMIT 50000`
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('getDocumentsForDocket query', () => {
  it('selects specific document columns', async () => {
    // Sample a document with a non-null docket_id
    const [sample] = await runQuery<{ docket_id: string }>(
      `SELECT docket_id FROM ${parquetRef('documents')} WHERE docket_id IS NOT NULL LIMIT 1`
    );
    const docketId = String(sample.docket_id).replace(/^"|"$/g, '');

    const rows = await runQuery(`
      SELECT document_id, title, document_type, posted_date,
             comment_start_date, comment_end_date, file_url
      FROM ${parquetRef('documents')}
      WHERE docket_id = '${docketId}'
      ORDER BY posted_date DESC
      LIMIT 50
    `);
    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0] as Record<string, unknown>;
    expect(row).toHaveProperty('document_id');
    expect(row).toHaveProperty('title');
  });
});

describe('getAgencyStats query', () => {
  it('counts dockets and documents for an agency', async () => {
    const [docketResult] = await runQuery<{ docket_count: number }>(`
      SELECT COUNT(*) as docket_count
      FROM ${parquetRef('dockets')}
      WHERE agency_code = 'EPA'
    `);
    expect(Number(docketResult.docket_count)).toBeGreaterThan(0);

    const [docResult] = await runQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${parquetRef('documents')} WHERE agency_code = 'EPA'`
    );
    expect(Number(docResult.count)).toBeGreaterThan(0);
  });
});

describe('getPopularAgencies query', () => {
  it('groups and orders by docket count', async () => {
    const rows = await runQuery<{ agency_code: string; docket_count: number }>(
      `SELECT agency_code, COUNT(*) as docket_count FROM ${parquetRef('dockets')} GROUP BY agency_code ORDER BY docket_count DESC LIMIT 4`
    );
    expect(rows.length).toBe(4);
    for (let i = 1; i < rows.length; i++) {
      expect(Number(rows[i - 1].docket_count)).toBeGreaterThanOrEqual(Number(rows[i].docket_count));
    }
  });
});

describe('COPY TO parquet (export)', () => {
  it('exports query results to local parquet file', async () => {
    const [sample] = await runQuery<{ docket_id: string }>(
      `SELECT docket_id FROM ${commentsForAgency('EPA')} LIMIT 1`
    );
    const docketId = String(sample.docket_id).replace(/^"|"$/g, '');

    const exportPath = '/tmp/spicy_regs_test_export.parquet';
    await conn.run(`
      COPY (
        SELECT * FROM ${commentsForAgency('EPA')}
        WHERE docket_id = '${docketId}'
        ORDER BY posted_date DESC
        LIMIT 10
      ) TO '${exportPath}' (FORMAT PARQUET)
    `);

    // Verify the exported parquet is readable
    const verifyRows = await runQuery(`SELECT COUNT(*) as cnt FROM read_parquet('${exportPath}')`);
    expect(Number((verifyRows[0] as any).cnt)).toBeGreaterThan(0);

    // Clean up
    const fs = await import('fs');
    fs.unlinkSync(exportPath);
  });
});

// ── IA recast (Phase 0) — new service-method queries ──────────────────────
// These mirror the SQL in useDuckDBService for the recast. The hook itself
// can't run under node (React), so — as elsewhere in this file — we assert the
// queries parse, hit the live schema, and return the expected shape.

describe('getDiscoverySignals — closing soon', () => {
  it('returns dockets with a comment window closing within 3 days', async () => {
    const rows = await runQuery<{ docket_id: string; comment_end_date: string }>(`
      SELECT docket_id, agency_code, title, comment_end_date, comment_count
      FROM ${feedSummaryRef()}
      WHERE TRY_CAST(comment_end_date AS TIMESTAMP)
            BETWEEN CAST(NOW() AS TIMESTAMP) AND CAST(NOW() AS TIMESTAMP) + INTERVAL '3' DAY
      ORDER BY comment_end_date ASC
      LIMIT 3
    `);
    expect(rows.length).toBeGreaterThanOrEqual(0);
    expect(rows.length).toBeLessThanOrEqual(3);
  });
});

describe('getDiscoverySignals — most discussed', () => {
  it('orders by comment_count descending', async () => {
    const rows = await runQuery<{ comment_count: number }>(`
      SELECT docket_id, agency_code, title, comment_count
      FROM ${feedSummaryRef()}
      ORDER BY comment_count DESC
      LIMIT 3
    `);
    expect(rows.length).toBe(3);
    for (let i = 1; i < rows.length; i++) {
      expect(Number(rows[i - 1].comment_count)).toBeGreaterThanOrEqual(Number(rows[i].comment_count));
    }
  });
});

describe('getDiscoverySignals — surge (comments_index recent-month delta)', () => {
  it('computes a recent-vs-prior month delta per docket', async () => {
    const rows = await runQuery<{ docket_id: string; recent_n: number; prev_n: number; delta: number }>(`
      WITH mx AS (SELECT MAX(year*12+(month-1)) AS m FROM ${commentsIndexRef()}),
      agg AS (
        SELECT docket_id, agency_code,
          CAST(SUM(row_count) FILTER (WHERE year*12+(month-1) = (SELECT m FROM mx)) AS BIGINT) AS recent_n,
          CAST(SUM(row_count) FILTER (WHERE year*12+(month-1) = (SELECT m FROM mx)-1) AS BIGINT) AS prev_n
        FROM ${commentsIndexRef()}
        WHERE year*12+(month-1) >= (SELECT m FROM mx)-1
        GROUP BY 1, 2
      )
      SELECT a.docket_id, a.agency_code, fs.title,
             a.recent_n, COALESCE(a.prev_n, 0) AS prev_n,
             (a.recent_n - COALESCE(a.prev_n, 0)) AS delta
      FROM agg a LEFT JOIN ${feedSummaryRef()} fs USING (docket_id)
      WHERE a.recent_n > 0
      ORDER BY delta DESC
      LIMIT 3
    `);
    expect(rows.length).toBeGreaterThan(0);
    expect(Number(rows[0].recent_n)).toBeGreaterThan(0);
  });
});

describe('getDiscoverySignals — output spike (documents 30d vs baseline)', () => {
  it('parses the ratio query against documents', async () => {
    const rows = await runQuery<{ agency_code: string; ratio: number }>(`
      WITH per AS (
        SELECT agency_code,
          COUNT(*) FILTER (WHERE TRY_CAST(posted_date AS TIMESTAMP) >= CAST(NOW() AS TIMESTAMP) - INTERVAL '30' DAY) AS recent_30d,
          COUNT(*) FILTER (WHERE TRY_CAST(posted_date AS TIMESTAMP) >= CAST(NOW() AS TIMESTAMP) - INTERVAL '13' MONTH
                            AND TRY_CAST(posted_date AS TIMESTAMP) < CAST(NOW() AS TIMESTAMP) - INTERVAL '1' MONTH) AS prior_yr
        FROM ${documentsRef()}
        WHERE TRY_CAST(posted_date AS TIMESTAMP) >= CAST(NOW() AS TIMESTAMP) - INTERVAL '13' MONTH AND agency_code IS NOT NULL
        GROUP BY 1
      )
      SELECT agency_code, (recent_30d / NULLIF(prior_yr / 12.0, 0)) AS ratio
      FROM per
      WHERE prior_yr >= 24 AND (recent_30d / NULLIF(prior_yr / 12.0, 0)) >= 2.0
      ORDER BY ratio DESC
      LIMIT 3
    `);
    for (const r of rows) expect(Number(r.ratio)).toBeGreaterThanOrEqual(2.0);
  });
});

describe('getDocumentById query', () => {
  it('returns a single document row with the expected columns', async () => {
    const [seed] = await runQuery<{ document_id: string }>(
      `SELECT document_id FROM ${documentsRef()} WHERE agency_code = 'EPA' LIMIT 1`
    );
    const rows = await runQuery<Record<string, unknown>>(`
      SELECT document_id, docket_id, agency_code, title, document_type,
             posted_date, modify_date, comment_start_date, comment_end_date, file_url
      FROM ${documentsRef()}
      WHERE document_id = '${String(seed.document_id).replace(/'/g, "''")}'
      LIMIT 1
    `);
    expect(rows.length).toBe(1);
    expect(rows[0]).toHaveProperty('file_url');
    expect(rows[0]).toHaveProperty('document_type');
  });
});

describe('getOpenRulemakings query', () => {
  it('returns only open windows, soonest deadline first', async () => {
    const rows = await runQuery<{ comment_end_date: string }>(`
      SELECT docket_id, agency_code, title, comment_count, comment_end_date
      FROM ${feedSummaryRef()}
      WHERE agency_code = 'EPA' AND TRY_CAST(comment_end_date AS TIMESTAMP) > CAST(NOW() AS TIMESTAMP)
      ORDER BY comment_end_date ASC
      LIMIT 20
    `);
    for (let i = 1; i < rows.length; i++) {
      expect(new Date(rows[i - 1].comment_end_date).getTime())
        .toBeLessThanOrEqual(new Date(rows[i].comment_end_date).getTime());
    }
  });
});

describe('getAgencyMonthlyVolumeBatch query', () => {
  it('returns monthly document counts for multiple agencies in one query', async () => {
    const rows = await runQuery<{ agency_code: string; month: string; n: number }>(`
      SELECT agency_code,
             strftime(date_trunc('month', TRY_CAST(posted_date AS DATE)), '%Y-%m') AS month,
             COUNT(*) AS n
      FROM ${documentsRef()}
      WHERE agency_code IN ('EPA','FDA')
        AND TRY_CAST(posted_date AS DATE) >= date_trunc('month', CURRENT_DATE) - INTERVAL '11' MONTH
      GROUP BY 1, 2
      ORDER BY 1, 2
    `);
    expect(rows.length).toBeGreaterThan(0);
    const codes = new Set(rows.map(r => String(r.agency_code).replace(/^"|"$/g, '')));
    expect(codes.has('EPA') || codes.has('FDA')).toBe(true);
  });
});

describe('getAllAgencyCounts — comment totals per agency', () => {
  it('sums row_count per agency from the comments index', async () => {
    const rows = await runQuery<{ agency_code: string; comment_cnt: number }>(`
      SELECT agency_code, CAST(SUM(row_count) AS BIGINT) AS comment_cnt
      FROM ${commentsIndexRef()}
      GROUP BY agency_code
      ORDER BY comment_cnt DESC
      LIMIT 5
    `);
    expect(rows.length).toBe(5);
    expect(Number(rows[0].comment_cnt)).toBeGreaterThan(0);
    for (let i = 1; i < rows.length; i++) {
      expect(Number(rows[i - 1].comment_cnt)).toBeGreaterThanOrEqual(Number(rows[i].comment_cnt));
    }
  });
});
