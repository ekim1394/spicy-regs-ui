/**
 * SQL escape for string literals interpolated into DuckDB queries: doubles
 * single quotes. Values are inlined (DuckDB-WASM queries here are not
 * parameter-bound), so every user/derived string must pass through this before
 * being wrapped in '...'.
 */
export function sqlStr(s: string): string {
  return s.replace(/'/g, "''");
}
