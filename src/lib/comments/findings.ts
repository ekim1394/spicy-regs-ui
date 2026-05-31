/**
 * Per-block "findings" for the docket comment breakdown — the small editorial
 * callouts that tell a reader what's *notable* about each visualization rather
 * than making them infer it from the chart.
 *
 * Each detector is a pure function returning either a structured finding or
 * `null` (nothing remarkable → no callout). The component renders the prose;
 * this module owns only the math and the trigger thresholds, so the thresholds
 * are testable and tunable in one place.
 *
 * The prose these feed is deliberately FACTUAL — figures, dates, and counts,
 * not interpretation. A finding states what the data shows ("97% arrived in 2
 * days"); it does not tell the reader what to conclude from it ("a coordinated
 * push"). It also reports comment counts as a point-in-time snapshot: while the
 * comment period is open, shares can still move, so the copy says so.
 *
 * Thresholds below were calibrated against the live comment corpus (a spread of
 * 14 high-volume dockets across agencies). At a 2-day window, large organic
 * dockets concentrate 15–55% of their comments; only genuinely bursty filings
 * clear 80%. A single template exceeding 50% of analyzed comments likewise
 * marks a record carried by one campaign rather than many. The cut-offs are
 * exported so they can be re-tuned as the corpus grows.
 */
import type { TemplateFamily } from './templates';
import type { Stance, StanceResult } from '@/lib/text/stance';

const MS_DAY = 86_400_000;
const STANCE_ORDER: readonly Stance[] = ['support', 'oppose', 'mixed', 'unclear'];

function pct(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/** Whole-day gap between two day strings (b − a), rounded. 0 if unparseable. */
function dayDiff(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.round((db - da) / MS_DAY);
}

/** Inclusive calendar-day span, e.g. same day → 1, consecutive days → 2. */
export function daySpanInclusive(a: string, b: string): number {
  return Math.abs(dayDiff(a, b)) + 1;
}

/** Argmax stance with a stable tiebreak (support > oppose > mixed > unclear). */
function dominantStance(totals: Record<Stance, number>): Stance {
  let best: Stance = 'unclear';
  let bestN = -1;
  for (const s of STANCE_ORDER) {
    if (totals[s] > bestN) {
      bestN = totals[s];
      best = s;
    }
  }
  return best;
}

/* ─────────────────────────── Volume burst ─────────────────────────── */

export interface VolumeBurst {
  /** Share of all comments inside the peak window, 0–100. */
  pct: number;
  /** Comments inside the peak window. */
  count: number;
  /** All comments received so far. */
  total: number;
  /** Window width that was tested, in calendar days. */
  windowDays: number;
  /** First / last day of the peak window (ISO day strings). */
  startDay: string;
  endDay: string;
  /** Length of the official comment period in days, if known. */
  periodDays: number | null;
  /** Comment-period close date (ISO day), if known. */
  periodEndDay: string | null;
  /** True when the comment period is still open as of `now`. */
  periodOpen: boolean;
  /** Whole days left until the period closes, when open and known. */
  daysRemaining: number | null;
}

/**
 * ≥ this share of comments arriving within {@link BURST_WINDOW_DAYS} calendar
 * days marks a concentrated filing burst. Calibrated: large organic dockets sit
 * well below this at a 2-day window.
 */
export const BURST_SHARE_PCT = 80;
export const BURST_WINDOW_DAYS = 2;
/**
 * Don't flag concentration when the comment period itself was barely longer than
 * the burst window — "80% in 2 days" isn't notable if the docket was only open
 * for 2 days. Require the period to be at least this multiple of the window.
 */
export const BURST_MIN_PERIOD_MULTIPLE = 2;

/** Day string for a Date (UTC), for comparing against ISO day rows. */
function toDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Find the peak contiguous {@link windowDays}-day window and flag it when it
 * holds an outsized share of all comments received so far. Returns `null` when
 * nothing clears the bar — including when the comment period was too short for
 * concentration to be meaningful.
 *
 * `now` is injectable so the open/closed + days-remaining read is deterministic
 * in tests; in the app it defaults to the current date.
 */
export function computeVolumeBurst(
  volumeByDay: { day: string; n: number }[],
  total: number,
  commentStartDate: string | null,
  commentEndDate: string | null,
  now: Date = new Date(),
  shareThreshold: number = BURST_SHARE_PCT,
  windowDays: number = BURST_WINDOW_DAYS,
): VolumeBurst | null {
  if (total <= 0) return null;
  const rows = volumeByDay
    .filter(r => r.n > 0)
    .slice()
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  if (rows.length === 0) return null;

  // Slide a calendar-day window across the (sparse) day rows: for each start
  // row, sum the rows whose day is within (windowDays − 1) days of it.
  let best = { count: 0, start: 0, end: 0 };
  for (let i = 0; i < rows.length; i++) {
    let sum = 0;
    let j = i;
    while (j < rows.length && dayDiff(rows[i].day, rows[j].day) <= windowDays - 1) {
      sum += rows[j].n;
      j++;
    }
    if (sum > best.count) best = { count: sum, start: i, end: j - 1 };
  }

  const sharePct = pct(best.count, total);
  if (sharePct < shareThreshold) return null;

  const periodDays =
    commentStartDate && commentEndDate
      ? daySpanInclusive(commentStartDate, commentEndDate)
      : null;

  // Skip when the period was barely longer than the burst window.
  if (periodDays != null && periodDays < windowDays * BURST_MIN_PERIOD_MULTIPLE) {
    return null;
  }

  // Open/closed read, relative to `now`.
  let periodOpen = false;
  let daysRemaining: number | null = null;
  if (commentEndDate) {
    const remaining = dayDiff(toDayString(now), commentEndDate);
    if (remaining >= 0) {
      periodOpen = true;
      daysRemaining = remaining;
    }
  }

  return {
    pct: sharePct,
    count: best.count,
    total,
    windowDays,
    startDay: rows[best.start].day,
    endDay: rows[best.end].day,
    periodDays,
    periodEndDay: commentEndDate,
    periodOpen,
    daysRemaining,
  };
}

/* ─────────────────────────── Stance outlier ─────────────────────────── */

export type StanceFindingKind = 'concentrated' | 'flip' | 'lopsided' | 'split';

export interface StanceFinding {
  kind: StanceFindingKind;
  /** Leading stance for concentrated / flip / lopsided. */
  stance?: Stance;
  /** Leading stance's share of analyzed comments, 0–100. */
  pct: number;
  /** Number of templates the read covers. */
  templateCount?: number;
  /** concentrated/flip: the dominant template's share of analyzed comments. */
  topPct?: number;
  /** concentrated/flip: the dominant template's comment count. */
  topCount?: number;
  /** flip: the dominant stance among the comments OTHER than the top template. */
  remainderStance?: Stance;
  /** flip: that remainder stance's share of the remaining comments. */
  remainderPct?: number;
  /** flip: how many comments remain after removing the top template. */
  remainderCount?: number;
  /** split: the two leading shares. */
  supportPct?: number;
  opposePct?: number;
}

/** One template ≥ this share of analyzed comments "carries" the stance read. */
export const DOMINANT_TEMPLATE_PCT = 50;
/** A single stance ≥ this share of analyzed comments = a one-sided record. */
export const LOPSIDED_PCT = 80;
/** Both support AND oppose ≥ this share = a genuinely divided record. */
export const SPLIT_MIN_PCT = 25;

/**
 * Surface the most decision-relevant fact about the stance split, in priority
 * order. The stance bar below already shows the full support/oppose/mixed split,
 * so a finding only fires to add something the bar doesn't say:
 *
 *  1. flip — one template carries a directional lead, AND the comments without
 *     it lean the OTHER way. The high-value case: the headline reverses once the
 *     campaign is set aside. Both stances are named because they differ.
 *  2. concentrated — one template carries the lead, and the rest agree with it.
 *     We report only the concentration (not "X then X again"), since restating
 *     the same stance twice reads as circular.
 *  3. lopsided — an overwhelmingly one-sided record not driven by one template.
 *  4. split — support and oppose are both substantial.
 *
 * Returns `null` when the split is unremarkable.
 */
export function computeStanceFinding(
  stanced: { family: TemplateFamily; stance: StanceResult }[],
  totals: Record<Stance, number>,
  covered: number,
): StanceFinding | null {
  if (covered <= 0 || stanced.length === 0) return null;

  const plurality = dominantStance(totals);
  const pluralityPct = pct(totals[plurality], covered);
  const directional = plurality === 'support' || plurality === 'oppose';

  const top = stanced.slice().sort((a, b) => b.family.totalN - a.family.totalN)[0];
  const topPct = pct(top.family.totalN, covered);

  // 1/2 — a directional lead carried by one dominant template.
  if (
    directional &&
    top.stance.stance === plurality &&
    topPct >= DOMINANT_TEMPLATE_PCT &&
    stanced.length > 1
  ) {
    const remainder: Record<Stance, number> = { support: 0, oppose: 0, mixed: 0, unclear: 0 };
    let remCovered = 0;
    for (const item of stanced) {
      if (item === top) continue;
      remainder[item.stance.stance] += item.family.totalN;
      remCovered += item.family.totalN;
    }
    const remStance = remCovered > 0 ? dominantStance(remainder) : undefined;
    const remDirectional = remStance === 'support' || remStance === 'oppose';

    // flip: the remainder leans the OPPOSITE direction — the interesting case.
    if (remStance && remDirectional && remStance !== plurality) {
      return {
        kind: 'flip',
        stance: plurality,
        pct: pluralityPct,
        templateCount: stanced.length,
        topPct,
        topCount: top.family.totalN,
        remainderStance: remStance,
        remainderPct: pct(remainder[remStance], remCovered),
        remainderCount: remCovered,
      };
    }

    // concentrated: remainder agrees (or is non-directional) — report only the
    // concentration, no circular restatement of the same stance.
    return {
      kind: 'concentrated',
      stance: plurality,
      pct: pluralityPct,
      templateCount: stanced.length,
      topPct,
      topCount: top.family.totalN,
    };
  }

  // 3 — lopsided one-sided record, not driven by a single template.
  if (directional && pluralityPct >= LOPSIDED_PCT) {
    return { kind: 'lopsided', stance: plurality, pct: pluralityPct, templateCount: stanced.length };
  }

  // 4 — genuinely divided.
  const supportPct = pct(totals.support, covered);
  const opposePct = pct(totals.oppose, covered);
  if (supportPct >= SPLIT_MIN_PCT && opposePct >= SPLIT_MIN_PCT) {
    return {
      kind: 'split',
      pct: Math.max(supportPct, opposePct),
      supportPct,
      opposePct,
    };
  }

  return null;
}
