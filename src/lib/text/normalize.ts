/**
 * Layered comment-text normalization — the shared spec for "what counts as the
 * same comment."
 *
 * Two parallel implementations of the SAME transforms live here:
 *   - TS functions (`toDisplay`/`toCanonical`/`toSkeleton`/…) for the browser
 *     demo and unit tests.
 *   - DuckDB SQL expression builders (`sql*`) so the identical logic runs inside
 *     the WASM engine on a live docket today, and — unchanged — inside the
 *     offline mirror pipeline tomorrow, where the results get baked into parquet
 *     columns (`canonical_hash`, `skeleton_hash`, `word_count`, …). The demo IS
 *     the production spec.
 *
 * Three representations, increasingly aggressive:
 *   - display   — HTML/entities stripped, whitespace collapsed. What a card shows.
 *   - canonical — display, lowercased, punctuation removed. Exact-text match key.
 *   - skeleton  — canonical with the high-variance bits a form letter leaves
 *                 blank removed: the submitter's own name/org, emails, URLs, and
 *                 all digits. The *template* match key — collapses "same letter,
 *                 different signature/city/ZIP" into one cluster.
 */
import { decodeHtml, stripQuotes } from '@/lib/utils/fieldFormat';

export interface SubmitterIdentity {
  firstName?: string;
  lastName?: string;
  organization?: string;
}

export interface NormalizedComment {
  display: string;
  canonical: string;
  skeleton: string;
  wordCount: number;
  linkCount: number;
  isPlaceholder: boolean;
  hasGreeting: boolean;
  hasSignature: boolean;
}

const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
const EMAIL_RE = /\S+@\S+\.\S+/gi;
const GREETING_RE = /^(?:dear\b|to whom it may concern|hello\b|hi\b|greetings\b)/i;
const SIGNOFF_RE = /\b(?:sincerely|respectfully|regards|best regards|thank you|thanks)\b[\s,]*$/i;

/** Tags → spaces (block tags become word breaks so "a</p><p>b" → "a b"). */
export function stripHtml(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

/** Raw parquet value → clean human-readable text. */
export function toDisplay(raw: unknown): string {
  const s = stripQuotes(raw);
  if (!s) return '';
  return decodeHtml(stripHtml(s)).replace(/\s+/g, ' ').trim();
}

/** display → exact-match key (lowercase, alphanumerics only). */
export function toCanonical(display: string): string {
  return display.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * display → template key. Removes the parts advocacy platforms personalize:
 * the submitter's own name/org (we have these columns — masking them out of the
 * body collapses signature variants for free), contact info, and every digit.
 * What's left is the boilerplate skeleton shared across a form-letter campaign.
 */
export function toSkeleton(display: string, identity?: SubmitterIdentity): string {
  let s = display.toLowerCase().replace(URL_RE, ' ').replace(EMAIL_RE, ' ');
  for (const name of [identity?.firstName, identity?.lastName, identity?.organization]) {
    const clean = stripQuotes(name).trim().toLowerCase();
    if (clean.length > 2) {
      s = s.replace(new RegExp(`\\b${escapeRegExp(clean)}\\b`, 'g'), ' ');
    }
  }
  // Keep letters only — drops digits (ZIPs, dates, counts) and punctuation.
  return s.replace(/[^a-z]+/g, ' ').trim();
}

/**
 * skeleton → order/edit-tolerant near-duplicate key: the sorted set of its
 * content tokens. Two letters that share their vocabulary but reorder or lightly
 * edit sentences collapse to the same key. This is a deliberately cheap, O(n),
 * single-pass stand-in for the production-grade near-dup method (SimHash/MinHash
 * LSH) recommended for the offline pipeline — it is coarser than `skeleton`, so
 * its clusters are always unions of skeleton clusters (loosening never splits).
 */
export function toTokenSet(skeleton: string): string {
  const toks = skeleton.split(' ').filter((t) => t.length > 2);
  return Array.from(new Set(toks)).sort().join(' ');
}

/**
 * Placeholder comments ("see attached", blank) aren't orchestration — their
 * substance lives in an attachment we don't ingest. Generalizes the test that
 * was inline in CommentOrchestrationPanel.
 */
export function isPlaceholder(display: string): boolean {
  const clean = display.trim().toLowerCase();
  if (clean.length < 20) return true;
  if (/^see attached( file(s)?)?\.?$/.test(clean)) return true;
  if (/^see attached/.test(clean) && clean.length < 40) return true;
  return false;
}

export function normalizeComment(raw: unknown, identity?: SubmitterIdentity): NormalizedComment {
  const display = toDisplay(raw);
  const canonical = toCanonical(display);
  const skeleton = toSkeleton(display, identity);
  const linkCount = (display.match(URL_RE)?.length ?? 0) + (display.match(EMAIL_RE)?.length ?? 0);
  return {
    display,
    canonical,
    skeleton,
    wordCount: canonical ? canonical.split(' ').filter(Boolean).length : 0,
    linkCount,
    isPlaceholder: isPlaceholder(display),
    hasGreeting: GREETING_RE.test(display.trim()),
    hasSignature: SIGNOFF_RE.test(display.trim()),
  };
}

/* ------------------------------------------------------------------ */
/* DuckDB SQL expression builders — the same transforms, server-side. */
/* Each takes the SQL expression for an input column and returns a new */
/* expression. Compose them in a CTE pipeline so intermediate results  */
/* are reused instead of recomputed (see getCommentClustersMultiTier). */
/* ------------------------------------------------------------------ */

/** Strip HTML tags + decode the handful of common entities + collapse whitespace. */
export function sqlDisplayClean(col: string): string {
  const noTags = `regexp_replace(${col}, '<[^>]+>', ' ', 'g')`;
  const ent =
    `replace(replace(replace(replace(replace(replace(${noTags}, ` +
    `'&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''), '&nbsp;', ' ')`;
  return `trim(regexp_replace(${ent}, '\\s+', ' ', 'g'))`;
}

/** Display expr → canonical (lowercase, alphanumerics only). */
export function sqlCanonical(dispCol: string): string {
  return `trim(regexp_replace(lower(${dispCol}), '[^a-z0-9]+', ' ', 'g'))`;
}

/** Lowercase + strip emails and URLs. First stage of the skeleton pipeline. */
export function sqlStripContacts(dispCol: string): string {
  return (
    `regexp_replace(regexp_replace(lower(${dispCol}), ` +
    `'\\S+@\\S+', ' ', 'g'), 'https?://\\S+|www\\.\\S+', ' ', 'g')`
  );
}

/**
 * Remove one submitter-identity token (first/last name or org) from the body by
 * literal, case-insensitive substring replace — guarded so short/empty values
 * don't nuke common words. Chain one per identity column across CTE stages.
 */
export function sqlStripName(inputCol: string, nameCol: string): string {
  return (
    `CASE WHEN ${nameCol} IS NOT NULL AND length(trim(${nameCol})) > 2 ` +
    `THEN replace(${inputCol}, lower(trim(${nameCol})), ' ') ELSE ${inputCol} END`
  );
}

/** Final skeleton stage: keep letters only + collapse. */
export function sqlSkeletonFinal(col: string): string {
  return `trim(regexp_replace(${col}, '[^a-z]+', ' ', 'g'))`;
}

/** Skeleton expr → sorted-distinct-token near-dup key (mirrors toTokenSet). */
export function sqlTokenSetKey(skelCol: string): string {
  return `array_to_string(list_sort(list_distinct(list_filter(string_split(${skelCol}, ' '), x -> length(x) > 2))), ' ')`;
}
