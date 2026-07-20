import type { LucideIcon } from 'lucide-react';

/**
 * The three shelves the Sources index groups external datasets under, mirroring
 * how the spicy-regs pipeline documents them: the rulemaking lifecycle sources,
 * the organizations-and-influence sources, and the oversight/outcomes sources.
 */
export type SourceCategory = 'lifecycle' | 'influence' | 'oversight';

/** A raw row from a source parquet after normalization (all-VARCHAR corpus). */
export type SourceRow = Record<string, string | null>;

/** One selectable sort for a source browser. */
export interface SourceSortOption {
  /** Stable key used in the URL (?sort=). */
  key: string;
  label: string;
  /** SQL ORDER BY expression (config-authored, never user input). */
  orderBy: string;
  /**
   * Extra WHERE predicate applied while this sort is active — e.g. clamping
   * the Unified Agenda's year-3000 "TBD" sentinel dates out of a
   * next-action sort.
   */
  where?: string;
}

/** One option of a select filter. `value: ''` is the implicit "All" default. */
export interface SourceFilterOption {
  value: string;
  label: string;
  /**
   * SQL predicate override for this option. Defaults to
   * `field = 'value'` — an override expresses derived filters like
   * "pending litigation" = `date_terminated IS NULL`.
   */
  where?: string;
}

/** A select (exact-match) filter on a source browser. */
export interface SourceSelectFilter {
  /** URL query-param key, unique within the source. */
  param: string;
  /** Short label shown inside the trigger, e.g. "Stage". */
  label: string;
  /** Column the default equality predicate targets. */
  field: string;
  options: SourceFilterOption[];
}

/** A small typed chip rendered in a source card's header strip. */
export interface SourceChip {
  label: string;
  /** Badge variant; `code` for identifiers, `accent` for emphasis. */
  variant?: 'neutral' | 'accent' | 'code';
}

/**
 * The display model one source row maps to. `SourceCard` renders this shape
 * for every source; all per-source knowledge lives in the registry's `toCard`.
 */
export interface SourceCardModel {
  /** Stable React key (the row's primary key). */
  id: string;
  chips: SourceChip[];
  title: string;
  /** External (human-viewable) link for the title; null renders plain text. */
  href: string | null;
  /** Optional description/body, clamped to three lines. */
  body?: string | null;
  /** Optional muted footer-left text (e.g. "via Registrant LLC"). */
  metaLeft?: string | null;
  /** Optional muted footer-right text (e.g. "Filed Jul 16, 2026"). */
  metaRight?: string | null;
  /** Domain label for the external link, e.g. "reginfo.gov". */
  linkLabel?: string | null;
}

/** Everything the generic browser + index need to know about one dataset. */
export interface SourceDef {
  /** Route segment under /sources/, e.g. "congress-bills". */
  key: string;
  /** Parquet/table name on R2, e.g. "congress_bills". */
  table: string;
  label: string;
  /** One–two sentences shown on the index card and the browser header. */
  description: string;
  category: SourceCategory;
  /** Upstream attribution, e.g. "Congress.gov". */
  provider: string;
  /**
   * Honest coverage note (sampling bound, rolling window, snapshot edition…)
   * surfaced as an amber marker pill. Omit when coverage is effectively full.
   */
  caveat?: string;
  icon: LucideIcon;
  /** SQL projection for the browser query (may alias JSON extractions). */
  selectCols: string;
  /** Columns OR-joined into the ILIKE search predicate. */
  searchFields: string[];
  /** Key of the default entry in `sortOptions`. */
  defaultSort: string;
  sortOptions: SourceSortOption[];
  /**
   * Unique-key ORDER BY fragment appended after every sort (e.g.
   * `'bill_id ASC'`). Offset pagination runs each page as an independent
   * Top-N query, so without a total order, rows tied on the sort column can
   * duplicate or drop across page boundaries.
   */
  tiebreak: string;
  filters: SourceSelectFilter[];
  /**
   * SQL aggregate expression for the index page's freshness line (usually
   * `MAX(<date col>)`). Null for tables with no meaningful recency (e.g. the
   * USASpending leaderboard).
   */
  recencyExpr: string | null;
  /** Formats the raw recency value for display; defaults to a date format. */
  formatRecency?: (raw: string) => string;
  /** Maps a normalized row to its display model. */
  toCard: (row: SourceRow) => SourceCardModel;
}

/** Row-count + freshness stats for one source, from the index stats query. */
export interface SourceStats {
  count: number;
  /** Raw MAX() of the source's recency expression; null when none. */
  latest: string | null;
}
