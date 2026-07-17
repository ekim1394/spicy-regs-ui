"use client";

import type * as duckdb from "@duckdb/duckdb-wasm";
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys, delMany as idbDelMany } from "idb-keyval";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";

const R2_BASE_URL = "https://r2.spicy-regs.dev";

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

/**
 * Runtime shape check for a value read back from IndexedDB. An old deploy (or a
 * forgotten {@link QCACHE_VERSION} bump) can leave an entry whose shape no
 * longer matches {@link CacheEntry}; treating that as valid would feed malformed
 * rows into consumers. On mismatch we discard the entry and fall through to a
 * live query, so stale shapes self-heal instead of crashing a page.
 */
function isValidCacheEntry(v: unknown): v is CacheEntry {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as CacheEntry).expires === "number" &&
    Array.isArray((v as CacheEntry).rows)
  );
}

/**
 * Clear the query cache in every tier: the in-memory map, any in-flight
 * de-dupe entries, and every persisted `q:*` key in IndexedDB. Consumed by the
 * global error boundary's "Try again" so a poisoned cached row can't
 * immediately re-crash the re-rendered tree.
 */
export async function clearQueryCache(): Promise<void> {
  memCache.clear();
  inflight.clear();
  try {
    const all = await idbKeys();
    const stale = all.filter(
      (k): k is string => typeof k === "string" && k.startsWith("q:"),
    );
    if (stale.length > 0) await idbDelMany(stale);
  } catch {
    // IndexedDB unavailable — the in-memory clear above is the meaningful part.
  }
}

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
        const cached = await idbGet<unknown>(qKey(sql));
        if (cached !== undefined && !isValidCacheEntry(cached)) {
          // Shape from an older deploy (e.g. a missed QCACHE_VERSION bump) —
          // discard it and fall through to a live query so it self-heals.
          void idbDel(qKey(sql)).catch(() => {});
        } else if (cached && cached.expires > Date.now()) {
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
  /** Re-attempt DuckDB initialization after an init failure (e.g. jsDelivr down). */
  retryInit: () => void;
  /**
   * Kick off WASM init (idempotent). Called automatically by {@link useDuckDB}
   * on consumer mount — content routes with no DuckDB consumer never init.
   */
  start: () => void;
}

const DuckDBContext = createContext<DuckDBContextValue | null>(null);

async function initDuckDB(): Promise<{
  db: duckdb.AsyncDuckDB;
  conns: duckdb.AsyncDuckDBConnection[];
}> {
  // Loaded on demand: keeps the ~44KB (gzip) duckdb-wasm JS out of every
  // route's first-load bundle; only routes that mount a DuckDB consumer pay
  // for it (and for the multi-MB WASM fetch it triggers).
  const duckdb = await import("@duckdb/duckdb-wasm");

  // Use CDN bundles for reliability
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

  // Select the best bundle for this browser
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {
      type: "text/javascript",
    })
  );

  // Create the worker and logger. ConsoleLogger logs every worker event at
  // INFO on the main thread — dev-only.
  const worker = new Worker(worker_url);
  const logger =
    process.env.NODE_ENV === "development"
      ? new duckdb.ConsoleLogger()
      : new duckdb.VoidLogger();

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
  // Bumped by retryInit() to re-run the init effect after a failure.
  const [initAttempt, setInitAttempt] = useState(0);
  // Round-robin cursor over the connection pool.
  const rrRef = useRef(0);

  // Init is NOT started at provider mount (the provider wraps every route,
  // including static content pages like /about that never query). The first
  // useDuckDB() consumer to mount calls start() — for data routes that's
  // during initial hydration, the same moment the old eager effect fired.
  const start = useCallback(() => {
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
        setError(err instanceof Error ? err : new Error(String(err)));
      });
  }, [initAttempt]);

  /**
   * Re-attempt initialization after a failure. Resets the one-shot init guard
   * and clears the prior error so the effect above runs a fresh attempt. Safe to
   * ignore once ready — it no-ops if init already succeeded.
   */
  const retryInit = useCallback(() => {
    if (isReady) return;
    initRef.current = false;
    setError(null);
    setInitAttempt((n) => n + 1);
  }, [isReady]);

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
        retryInit,
        start,
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
  const { start } = context;
  useEffect(() => {
    start();
  }, [start]);
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
