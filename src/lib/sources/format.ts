/**
 * Pure formatting/URL helpers for the external-source registry. Each encodes a
 * verified quirk of the live R2 data (API-endpoint url columns, sentinel
 * dates, code-prefixed labels), so they're unit-tested in format.test.ts.
 */

/**
 * Format an ISO-ish date string as "Jul 16, 2026". Returns null for
 * null/empty/unparseable input and for the Unified Agenda's year-2999+
 * "To Be Determined" sentinel dates.
 */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() >= 2999) return null;
  // ISO date-only strings parse as UTC midnight; format in UTC so the shown
  // day never shifts backward in western timezones.
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "Jul 2026" variant for freshness lines on the index page. */
export function formatMonthYear(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() >= 2999) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * Compact USD for chips: "$117.1B", "$30K". Input is a numeric VARCHAR from
 * the parquet; null/unparseable → null.
 */
export function formatUSDCompact(amount: string | null | undefined): string | null {
  if (!amount) return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
    // "$30K", not "$30.0K" (kept as "$117.1B" when the fraction is real).
    trailingZeroDisplay: 'stripIfInteger',
  }).format(n);
}

/** English ordinal: 119 → "119th", 111 → "111th", 122 → "122nd". */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** Congress.gov path segment + display label per bill type. */
const BILL_TYPE: Record<string, { path: string; label: string }> = {
  hr: { path: 'house-bill', label: 'H.R.' },
  s: { path: 'senate-bill', label: 'S.' },
  hjres: { path: 'house-joint-resolution', label: 'H.J.Res.' },
  sjres: { path: 'senate-joint-resolution', label: 'S.J.Res.' },
  hconres: { path: 'house-concurrent-resolution', label: 'H.Con.Res.' },
  sconres: { path: 'senate-concurrent-resolution', label: 'S.Con.Res.' },
  hres: { path: 'house-resolution', label: 'H.Res.' },
  sres: { path: 'senate-resolution', label: 'S.Res.' },
};

/**
 * Human congress.gov bill page. The table's `url` column is the
 * api.congress.gov JSON endpoint, so the reader link must be constructed.
 * Returns null when the type is unknown or parts are missing.
 */
export function congressBillUrl(
  congress: string | null,
  billType: string | null,
  billNumber: string | null,
): string | null {
  if (!congress || !billType || !billNumber) return null;
  const type = BILL_TYPE[billType.toLowerCase()];
  const n = Number(congress);
  if (!type || !Number.isInteger(n)) return null;
  return `https://www.congress.gov/bill/${ordinal(n)}-congress/${type.path}/${billNumber}`;
}

/** "H.R. 2573" display label; falls back to the raw type when unknown. */
export function billLabel(billType: string | null, billNumber: string | null): string | null {
  if (!billType || !billNumber) return null;
  const type = BILL_TYPE[billType.toLowerCase()];
  return `${type?.label ?? billType.toUpperCase()} ${billNumber}`;
}

/** Human congress.gov CRS product page (the `url` column is an API endpoint). */
export function crsReportUrl(reportId: string | null): string | null {
  return reportId ? `https://www.congress.gov/crs-product/${encodeURIComponent(reportId)}` : null;
}

/** fec.gov committee page (the table carries no url column). */
export function fecCommitteeUrl(committeeId: string | null): string | null {
  return committeeId
    ? `https://www.fec.gov/data/committee/${encodeURIComponent(committeeId)}/`
    : null;
}

/** usaspending.gov recipient profile (the table carries no url column). */
export function usaspendingRecipientUrl(recipientId: string | null): string | null {
  return recipientId
    ? `https://www.usaspending.gov/recipient/${encodeURIComponent(recipientId)}/latest`
    : null;
}

/**
 * CFR citation from the discrete columns. The compact `cfr_ref` column is null
 * on 81% of rows, so the citation is always rebuilt: `section` rows carry
 * "part-section" (e.g. "10-1" → "§ 10.1"), part-level rows carry `part`.
 */
export function cfrCitation(
  title: string | null,
  part: string | null,
  section: string | null,
): string | null {
  if (!title) return null;
  if (section) return `${title} CFR § ${section.replace('-', '.')}`;
  if (part) return `${title} CFR Part ${part}`;
  return `Title ${title} CFR`;
}

/** Strip GAO's boilerplate "What GAO Found" heading off an abstract teaser. */
export function trimGaoAbstract(abstract: string | null): string | null {
  if (!abstract) return null;
  return abstract.replace(/^\s*what gao found\s*/i, '').trim() || null;
}

/** "899 Other Statutes: …" → "Other Statutes: …" (drop the PACER code). */
export function stripNatureOfSuitCode(nos: string | null): string | null {
  if (!nos) return null;
  return nos.replace(/^\d+\s+/, '').trim() || null;
}

/** USASpending recipient_level codes → display labels. */
export function recipientLevelLabel(level: string | null): string | null {
  if (!level) return null;
  return { R: 'Recipient', P: 'Parent', C: 'Child' }[level.toUpperCase()] ?? level;
}

/** LDA filing_period values ("first_quarter") → "Q1" style labels. */
export function filingPeriodLabel(period: string | null): string | null {
  if (!period) return null;
  const map: Record<string, string> = {
    first_quarter: 'Q1',
    second_quarter: 'Q2',
    third_quarter: 'Q3',
    fourth_quarter: 'Q4',
    mid_year: 'Mid-year',
    year_end: 'Year-end',
  };
  return map[period] ?? period;
}

/** "202510" agenda edition → "Fall 2025"; unknown shapes pass through. */
export function agendaEditionLabel(edition: string | null): string | null {
  if (!edition) return null;
  const m = edition.match(/^(\d{4})(04|10)$/);
  if (!m) return edition;
  return `${m[2] === '04' ? 'Spring' : 'Fall'} ${m[1]}`;
}
