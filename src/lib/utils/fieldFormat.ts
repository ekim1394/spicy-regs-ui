/**
 * Canonical field-format helpers for raw rows coming out of Parquet/DuckDB.
 *
 * These were previously duplicated across DocketPost, ThreadedComments,
 * DocumentList, ExportButton, and three page files. Always import from
 * here — do not re-implement.
 */

/**
 * Strip wrapping double-quotes from a Parquet string value.
 *
 * Parquet string columns often come back as `"value"` (with literal quote
 * characters at both ends). This unwraps them and coerces non-strings to a
 * string. Returns '' for null/undefined.
 */
export function stripQuotes(s: unknown): string {
  if (s == null) return '';
  return String(s).replace(/^"|"$/g, '');
}

/**
 * Decode HTML entities in a string (e.g. `&amp;` → `&`).
 *
 * Uses DOMParser, so it's a no-op during SSR — the original string is
 * returned unchanged. That's fine for our usage: the only callers render
 * client-side after hydration.
 */
export function decodeHtml(s: string): string {
  if (!s) return '';
  const doc = typeof document !== 'undefined'
    ? new DOMParser().parseFromString(s, 'text/html')
    : null;
  return doc?.documentElement.textContent || s;
}

/**
 * Parse a `raw_json` Parquet column into its JSON:API-ish shape.
 *
 * Accepts either a string (will be JSON.parsed) or an already-parsed
 * object. Returns an empty object on any failure so call sites can safely
 * destructure without try/catch boilerplate.
 *
 * Returns the `data.attributes` block when present (the common
 * regulations.gov shape), or falls back to `data` or the root object.
 */
// The raw_json columns are dynamically shaped regulations.gov payloads —
// the call sites do `attrs.title || ''`-style soft access. `any` is the
// pragmatic typing here; tightening would require a generated schema.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseRawJson(raw: unknown): Record<string, any> {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return {};
    const obj = parsed as Record<string, any>;
    return obj.data?.attributes ?? obj.data ?? obj;
  } catch {
    return {};
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
