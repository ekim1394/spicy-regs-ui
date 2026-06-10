"use client";

import * as duckdb from "@duckdb/duckdb-wasm";
import { get as idbGet, set as idbSet } from "idb-keyval";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";

const R2_BASE_URL = "https://pub-5fc11ad134984edf8d9af452dd1849d6.r2.dev";

/**
 * Number of DuckDB connections to open against the single WASM worker. Queries
 * round-robin across them so independent scans can overlap their HTTP range
 * requests to R2 (the real bottleneck) instead of serializing on one
 * connection. Kept small — the worker is shared, so this buys I/O overlap, not
 * CPU parallelism.
 */
const POOL_SIZE = 3;

/** Options for {@link DuckDBContextValue.runCachedQuery}. */
export interface CacheOpts {
  /** How long a cached result stays fresh, in ms. Defaults to 5 minutes. */
  ttlMs?: number;
  /**
   * Persist the result to IndexedDB so it survives a reload (and is shared
   * across tabs). Use for whole-dataset rollups that are identical for every
   * viewer. In-memory caching applies regardless.
   */
  persist?: boolean;
}

/**
 * Bump when the cached query shape or the underlying data contract changes, to
 * invalidate stale IndexedDB entries from older deploys.
 */
const QCACHE_VERSION = "v1";
const qKey = (sql: string) => `q:${QCACHE_VERSION}:${sql}`;

type CacheEntry = { expires: number; rows: unknown[] };

// Module-level so the cache survives component remounts and is shared across
// every hook consumer for the life of the page (the SPA never reloads the
// provider). Keyed by the exact SQL string, which encodes all parameters.
const memCache = new Map<string, CacheEntry>();
// De-dupes concurrent identical queries into a single in-flight request.
const inflight = new Map<string, Promise<unknown[]>>();

/**
 * Run a query through the two-tier cache: in-memory (always) + IndexedDB
 * (opt-in via `persist`), with in-flight de-duplication. Falls back to a live
 * query on any cache miss/error. `run` is the underlying (pooled) executor.
 */
async function cachedQuery<T>(
  sql: string,
  opts: CacheOpts | undefined,
  run: <R>(sql: string) => Promise<R[]>,
): Promise<T[]> {
  const ttlMs = opts?.ttlMs ?? 5 * 60_000;
  const persist = opts?.persist ?? false;

  const hit = memCache.get(sql);
  if (hit && hit.expires > Date.now()) return hit.rows as T[];

  const flying = inflight.get(sql);
  if (flying) return flying as Promise<T[]>;

  const p = (async (): Promise<unknown[]> => {
    if (persist) {
      try {
        const cached = await idbGet<CacheEntry>(qKey(sql));
        if (cached && cached.expires > Date.now()) {
          memCache.set(sql, cached);
          return cached.rows;
        }
      } catch {
        // IndexedDB unavailable (private mode, quota) — fall through to live.
      }
    }
    const rows = await run<unknown>(sql);
    const entry: CacheEntry = { expires: Date.now() + ttlMs, rows };
    memCache.set(sql, entry);
    if (persist) void idbSet(qKey(sql), entry).catch(() => {});
    return rows;
  })();

  inflight.set(sql, p);
  try {
    return (await p) as T[];
  } finally {
    inflight.delete(sql);
  }
}

interface DuckDBContextValue {
  db: duckdb.AsyncDuckDB | null;
  conn: duckdb.AsyncDuckDBConnection | null;
  isReady: boolean;
  error: Error | null;
  runQuery: <T = Record<string, unknown>>(sql: string) => Promise<T[]>;
  /** Like {@link runQuery} but served from cache when fresh. See {@link CacheOpts}. */
  runCachedQuery: <T = Record<string, unknown>>(
    sql: string,
    opts?: CacheOpts,
  ) => Promise<T[]>;
}

const DuckDBContext = createContext<DuckDBContextValue | null>(null);

async function initDuckDB(): Promise<{
  db: duckdb.AsyncDuckDB;
  conns: duckdb.AsyncDuckDBConnection[];
}> {
  // Use CDN bundles for reliability
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

  // Select the best bundle for this browser
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {
      type: "text/javascript",
    })
  );

  // Create the worker and logger
  const worker = new Worker(worker_url);
  const logger = new duckdb.ConsoleLogger();

  // Instantiate DuckDB
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  await db.open({
    path: ":memory:",
    query: {
      castBigIntToDouble: true,
    },
  });

  // Open a small pool of connections. httpfs is INSTALL'd once (idempotent,
  // cached in the WASM FS) and LOAD'd on every connection; s3_region is set per
  // connection so each can read the public R2 Parquet over range requests.
  const conns: duckdb.AsyncDuckDBConnection[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const c = await db.connect();
    await c.query("INSTALL httpfs; LOAD httpfs; SET s3_region='auto';");
    conns.push(c);
  }

  console.log(`[DuckDB-WASM] Initialized (${conns.length} connections)`);

  return { db, conns };
}

export function DuckDBProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<duckdb.AsyncDuckDB | null>(null);
  const [conns, setConns] = useState<duckdb.AsyncDuckDBConnection[] | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const initRef = useRef(false);
  // Round-robin cursor over the connection pool.
  const rrRef = useRef(0);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    initDuckDB()
      .then(({ db, conns }) => {
        setDb(db);
        setConns(conns);
        setIsReady(true);
      })
      .catch((err) => {
        console.error("[DuckDB-WASM] Initialization failed:", err);
        setError(err);
      });
  }, []);

  const runQuery = useCallback(
    async <T = Record<string, unknown>>(sql: string): Promise<T[]> => {
      if (!conns || conns.length === 0) {
        throw new Error("DuckDB connection not ready");
      }

      // Round-robin across the pool so independent queries overlap their I/O.
      const conn = conns[rrRef.current++ % conns.length];

      try {
        const result = await conn.query(sql);
        return result.toArray().map((row) => row.toJSON() as T);
      } catch (err) {
        console.error("[DuckDB-WASM] Query failed:", sql, err);
        throw err;
      }
    },
    [conns]
  );

  const runCachedQuery = useCallback(
    <T = Record<string, unknown>>(sql: string, opts?: CacheOpts): Promise<T[]> =>
      cachedQuery<T>(sql, opts, runQuery),
    [runQuery]
  );

  return (
    <DuckDBContext.Provider
      value={{
        db,
        conn: conns?.[0] ?? null,
        isReady,
        error,
        runQuery,
        runCachedQuery,
      }}
    >
      {children}
    </DuckDBContext.Provider>
  );
}

export function useDuckDB() {
  const context = useContext(DuckDBContext);
  if (!context) {
    throw new Error("useDuckDB must be used within a DuckDBProvider");
  }
  return context;
}

/**
 * Hook that returns the raw DuckDB instance and connection for advanced operations
 * like COPY TO parquet via virtual filesystem.
 */
export function useDuckDBRaw() {
  const { db, conn, isReady } = useDuckDB();
  return { db, conn, isReady };
}

// Export R2 URL for use in queries
export { R2_BASE_URL };
