'use client';

import { useMemo, useState } from 'react';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { ParentSize } from '@visx/responsive';
import { Maximize2 } from 'lucide-react';
import { FindingNote } from '../ui/PanelHeader';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { SectionLabel } from '../ui/SectionLabel';
import { toDisplay } from '@/lib/text/normalize';
import { scoreStance, aggregateStance, type Stance } from '@/lib/text/stance';
import { computeOrchestration } from '@/lib/comments/orchestration';
import { agglomerateTemplates, type TemplateFamily } from '@/lib/comments/templates';
import {
  computeVolumeBurst,
  computeStanceFinding,
  type StanceFinding,
  type VolumeBurst,
} from '@/lib/comments/findings';
import { StanceSplit, StanceChip, STANCE_META, stanceCoveragePct } from '../lab/stanceViz';

/**
 * Comment-aggregate breakdown for a single docket: a "what is this comment
 * period made of" view that separates form letters from genuinely unique
 * submissions, charts daily volume against the comment window, and samples the
 * top form-letter templates with a heuristic stance read.
 *
 * This is the shared rendering used by both the docket Overview tab and the
 * Lab uniqueness/fidelity panels — see CommentOrchestrationPanel, which
 * supplies the same `getCommentVolumeAndClusters(id, 'near')` payload.
 */
export interface Cluster { hash: string; n: number; sample: string; firstDay: string; lastDay: string; tokenset?: string }
interface VolumeRow { day: string; n: number }
interface Totals { total: number; unique: number; empty: number }
export interface CommentBreakdownData {
  totals: Totals;
  volumeByDay: VolumeRow[];
  clusters: Cluster[];
  commentStartDate: string | null;
  commentEndDate: string | null;
}

const CHART_H = 220;
const MARGIN = { top: 18, right: 16, bottom: 28, left: 56 };

/**
 * Floor for calling a template a "form letter": a campaign must gather at least
 * this many near-duplicate responses. Below it, a handful of coincidentally
 * similar comments isn't orchestration, so those responses stay in the unique
 * pool rather than inflating the form-letter share.
 */
const MIN_FORM_LETTER_SIZE = 10;

/** "2023-12-15" → "Dec 15, 2023". Safe against the noisy ISO strings DuckDB returns. */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Humanized day span for a card, collapsing the parts the endpoints share so a
 * tight campaign window reads as one phrase instead of two repeated ISO dates:
 *   same day   → "May 27, 2026"
 *   same month → "May 27–29, 2026"
 *   same year  → "May 27 – Jun 2, 2026"
 *   else       → "Dec 30, 2026 – Jan 2, 2027"
 */
export function formatDayRange(firstIso: string, lastIso: string): string {
  if (firstIso === lastIso) return formatShortDate(firstIso);
  const a = new Date(firstIso);
  const b = new Date(lastIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return `${firstIso} → ${lastIso}`;
  const opts = { timeZone: 'UTC' as const };
  const mon = (d: Date) => d.toLocaleDateString('en-US', { ...opts, month: 'short' });
  const day = (d: Date) => d.toLocaleDateString('en-US', { ...opts, day: 'numeric' });
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  if (sameYear && a.getUTCMonth() === b.getUTCMonth()) {
    return `${mon(a)} ${day(a)}–${day(b)}, ${b.getUTCFullYear()}`;
  }
  if (sameYear) {
    return `${mon(a)} ${day(a)} – ${mon(b)} ${day(b)}, ${b.getUTCFullYear()}`;
  }
  return `${formatShortDate(firstIso)} – ${formatShortDate(lastIso)}`;
}

/**
 * Clusters whose body is just "see attached file(s)" / blank placeholder
 * text aren't orchestration — they're an artifact of comments where the
 * substance lives in an attachment we don't ingest. Strip them from the
 * displayed list AND the orchestration totals so the percentages match
 * what the reader sees.
 */
export function isPlaceholderCluster(c: Cluster): boolean {
  const clean = c.sample
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (clean.length < 20) return true;
  if (/^see attached( file(s)?)?\.?$/.test(clean)) return true;
  if (/^see attached/.test(clean) && clean.length < 40) return true;
  return false;
}

export function CommentBreakdown({ data }: { data: CommentBreakdownData }) {
  const { totals, clusters, volumeByDay, commentStartDate, commentEndDate } = data;

  // Fold the near-duplicate clusters into template families so small wording
  // variants of one campaign collapse into a single row (and a single % share)
  // instead of showing up as several near-identical cards. Then apply the
  // form-letter floor: a family must gather at least MIN_FORM_LETTER_SIZE
  // near-duplicate responses before it counts as a form letter.
  const { formLetters: formLetterClusters } = computeOrchestration(
    clusters, totals.total, isPlaceholderCluster,
  );
  const families = useMemo(
    () =>
      agglomerateTemplates(formLetterClusters, totals.total)
        .filter(f => f.totalN >= MIN_FORM_LETTER_SIZE),
    [formLetterClusters, totals.total]
  );

  // Orchestration share, recomputed from the floored families so the finding,
  // the coverage bar, and the cards all agree on what counts as a form letter.
  const orchestratedCount = useMemo(() => families.reduce((s, f) => s + f.totalN, 0), [families]);
  const orchestratedPct = totals.total > 0 ? (orchestratedCount / totals.total) * 100 : 0;
  const uniquePct = totals.total > 0 ? ((totals.total - orchestratedCount) / totals.total) * 100 : 0;

  // Stance, scored once per template family on its representative body and
  // weighted by the family's full comment count.
  const stanced = useMemo(
    () => families.map(f => ({ family: f, stance: scoreStance(f.representative.sample) })),
    [families]
  );
  const stanceTotals = useMemo(
    () => aggregateStance(stanced.map(s => ({ stance: s.stance, weight: s.family.totalN }))),
    [stanced]
  );

  // Per-block findings. Each is computed from the same floored families, and is
  // null when nothing about that block is remarkable (so the callout is shown
  // only when it earns its place).
  const burst = useMemo(
    () => computeVolumeBurst(volumeByDay, totals.total, commentStartDate, commentEndDate),
    [volumeByDay, totals.total, commentStartDate, commentEndDate],
  );
  const stanceFinding = useMemo(
    () => computeStanceFinding(stanced, stanceTotals, orchestratedCount),
    [stanced, stanceTotals, orchestratedCount],
  );

  // Form-letter (orchestration) finding — the share of the docket that's
  // near-duplicate variants of a handful of templates.
  let orchestrationFinding: React.ReactNode = null;
  if (totals.total === 0) {
    orchestrationFinding = <>No comments found on this docket.</>;
  } else if (orchestratedPct < 5) {
    orchestrationFinding = (
      <>
        <strong>{uniquePct.toFixed(0)}%</strong> of comments are unique{' '}
        ({(totals.total - orchestratedCount).toLocaleString()} distinct submissions).
        Fewer than 5% are near-duplicate variants of form letters.
      </>
    );
  } else if (orchestratedPct < 50) {
    orchestrationFinding = (
      <>
        <strong>{orchestratedPct.toFixed(0)}%</strong> of comments are near-duplicate variants of{' '}
        {families.length} {families.length === 1 ? 'form letter' : 'form letters'};{' '}
        <strong>{uniquePct.toFixed(0)}%</strong> are unique submissions.
      </>
    );
  } else {
    orchestrationFinding = (
      <>
        <strong>{orchestratedPct.toFixed(0)}%</strong> of comments are near-duplicate variants of{' '}
        {families.length} {families.length === 1 ? 'form-letter template' : 'form-letter templates'};{' '}
        <strong>{uniquePct.toFixed(0)}%</strong> are unique ({(totals.total - orchestratedCount).toLocaleString()} of{' '}
        {totals.total.toLocaleString()}).
      </>
    );
  }

  return (
    <>
      {/* 1 — Comments per day: the volume shape, with a burst callout when the
          arrivals are concentrated enough to read as a coordinated push. */}
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <SectionLabel label="Comments per day" />
          <ChartLegend
            commentStartDate={commentStartDate}
            commentEndDate={commentEndDate}
          />
        </div>
        {burst && (
          <div className="mb-3">
            <FindingNote>{renderVolumeBurst(burst)}</FindingNote>
          </div>
        )}
        <Card interactive={false} className="p-3">
          <VolumeChart
            data={volumeByDay}
            commentStartDate={commentStartDate}
            commentEndDate={commentEndDate}
          />
        </Card>
      </div>

      {/* 2 — Form-letter templates: the coverage bar + the template cards, led
          by the orchestration finding. */}
      <div className="mb-6">
        <SectionLabel
          label={
            families.length > 0
              ? `Form-letter templates (${Math.min(6, families.length)} of ${families.length})`
              : 'Most repeated comments'
          }
          className="mb-2"
        />
        {orchestrationFinding && (
          <div className="mb-3">
            <FindingNote>{orchestrationFinding}</FindingNote>
          </div>
        )}
        {families.length === 0 ? (
          <p className="text-xs text-[var(--muted)] italic">
            No template reached {MIN_FORM_LETTER_SIZE} or more near-duplicate submissions,
            so every comment is counted as unique.
          </p>
        ) : (
          <Card interactive={false} className="p-3.5">
            <div className="mb-3">
              <TemplateCoverageBar families={families} total={totals.total} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {stanced.slice(0, 6).map(({ family, stance }, i) => (
                <TemplateCard
                  key={family.id}
                  family={family}
                  rank={i + 1}
                  badge={<StanceChip stance={stance.stance} />}
                />
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* 3 — Template stances: the support/oppose split, with an outlier callout
          when one campaign is manufacturing the majority (or the record is
          strikingly one-sided / divided). */}
      {orchestratedCount > 0 && (
        <div>
          <SectionLabel
            label="Template stances"
            caption={`heuristic — covers ≈${stanceCoveragePct(orchestratedCount, totals.total).toFixed(0)}% of all comments`}
            className="mb-2"
          />
          {stanceFinding && (
            <div className="mb-3">
              <FindingNote>{renderStanceFinding(stanceFinding)}</FindingNote>
            </div>
          )}
          <Card interactive={false} className="p-3.5">
            <StanceSplit totals={stanceTotals} covered={orchestratedCount} ofTotal={totals.total} bare />
          </Card>
        </div>
      )}
    </>
  );
}

/** Stance-label lookup for finding prose (lowercase, e.g. "support"). */
function stanceWord(s: Stance): string {
  return STANCE_META[s].label.toLowerCase();
}

/**
 * Render a {@link VolumeBurst} as factual callout prose — figures and dates, no
 * interpretation, and a point-in-time caveat while the period is still open.
 */
function renderVolumeBurst(b: VolumeBurst): React.ReactNode {
  const windowPhrase = b.windowDays === 1 ? 'a single day' : `${b.windowDays} days`;
  return (
    <>
      <strong>{b.pct.toFixed(0)}%</strong> of comments ({b.count.toLocaleString()} of{' '}
      {b.total.toLocaleString()}) arrived within {windowPhrase}{' '}
      ({formatDayRange(b.startDay, b.endDay)}).{' '}
      {b.periodOpen && b.periodEndDay ? (
        <>
          The comment period is open through {formatShortDate(b.periodEndDay)}
          {b.daysRemaining != null && (
            <> ({b.daysRemaining === 0
              ? 'closes today'
              : `${b.daysRemaining.toLocaleString()} ${b.daysRemaining === 1 ? 'day' : 'days'} left`})</>
          )}
          , so this is a snapshot of comments received so far.
        </>
      ) : b.periodDays != null ? (
        <>The comment period ran {b.periodDays.toLocaleString()} days.</>
      ) : null}
    </>
  );
}

/** Render a {@link StanceFinding} as factual callout prose. */
function renderStanceFinding(f: StanceFinding): React.ReactNode {
  if (f.kind === 'flip') {
    // The valuable case: the headline reverses once the campaign is removed.
    // Both stances are named because they genuinely differ.
    return (
      <>
        One template is <strong>{f.topPct!.toFixed(0)}%</strong> of analyzed comments
        ({f.topCount!.toLocaleString()}) and reads {stanceWord(f.stance!)}. The other{' '}
        {f.remainderCount!.toLocaleString()} lean <strong>{stanceWord(f.remainderStance!)}</strong>{' '}
        ({f.remainderPct!.toFixed(0)}%).
      </>
    );
  }
  if (f.kind === 'concentrated') {
    // Remainder agrees with the lead — report only the concentration, no
    // circular "support … support" restatement.
    return (
      <>
        The {stanceWord(f.stance!)} reading is concentrated in one template:{' '}
        <strong>{f.topPct!.toFixed(0)}%</strong> of analyzed comments
        ({f.topCount!.toLocaleString()}) are a single form letter, the rest spread across{' '}
        {(f.templateCount! - 1).toLocaleString()} other{f.templateCount! - 1 === 1 ? '' : 's'}.
      </>
    );
  }
  if (f.kind === 'lopsided') {
    return (
      <>
        Analyzed comments run <strong>{f.pct.toFixed(0)}% {stanceWord(f.stance!)}</strong>{' '}
        across {f.templateCount!.toLocaleString()} templates.
      </>
    );
  }
  return (
    <>
      Analyzed comments are divided: <strong>{f.supportPct!.toFixed(0)}%</strong> support vs{' '}
      <strong>{f.opposePct!.toFixed(0)}%</strong> oppose.
    </>
  );
}

function ChartLegend({
  commentStartDate,
  commentEndDate,
}: {
  commentStartDate: string | null;
  commentEndDate: string | null;
}) {
  const hasWindow = commentStartDate || commentEndDate;
  return (
    <span className="text-[10.5px] font-normal normal-case tracking-normal text-[var(--muted)] inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {hasWindow && (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block w-3 h-2 rounded-sm"
            style={{ background: 'var(--accent-primary)', opacity: 0.12, border: '1px solid var(--accent-primary)', borderColor: 'color-mix(in srgb, var(--accent-primary) 35%, transparent)' }}
          />
          <span>
            Comment window
            {commentStartDate && commentEndDate
              ? ` (${formatShortDate(commentStartDate)} – ${formatShortDate(commentEndDate)})`
              : commentEndDate
                ? ` (closed ${formatShortDate(commentEndDate)})`
                : ''}
          </span>
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block w-px h-3 bg-[var(--foreground)]"
          style={{ outline: '1px dashed var(--foreground)', outlineOffset: 0 }}
        />
        <span>Today</span>
      </span>
    </span>
  );
}

export function MetricCard({
  big,
  label,
  dotColor,
}: {
  big: string;
  label: string;
  /** Small accent dot beside the label — keeps semantics without coloring the headline number. */
  dotColor?: string;
}) {
  return (
    <Card interactive={false} className="p-3.5">
      <div className="text-2xl sm:text-3xl font-semibold leading-none mb-1.5 text-[var(--foreground)] tabular-nums">
        {big}
      </div>
      <div className="text-[11px] text-[var(--muted)] leading-tight flex items-center gap-1.5">
        {dotColor && (
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: dotColor }}
          />
        )}
        <span>{label}</span>
      </div>
    </Card>
  );
}

/** Cluster/template body → clean, length-capped excerpt for a card. */
export function cleanExcerpt(sample: string, max = 220): string {
  return sample
    .replace(/<br\s*\/?>(\s*<br\s*\/?>)*/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/gi, "'")
    .slice(0, max);
}

/** Sequential accent shades for stacked template segments (largest = strongest). */
const TEMPLATE_SHADES = [0.92, 0.74, 0.58, 0.44, 0.34, 0.26];
function templateShade(i: number): string {
  const pct = Math.round((TEMPLATE_SHADES[i] ?? 0.2) * 100);
  return `color-mix(in srgb, var(--accent-primary) ${pct}%, var(--surface))`;
}

/**
 * A 100%-of-comments stacked bar: one segment per top template family, a folded
 * "other templates" segment for the tail, and a muted remainder for unique /
 * one-off submissions. Makes "what % conforms to which template" legible at a
 * glance, the way the old per-cluster cards couldn't.
 */
export function TemplateCoverageBar({
  families,
  total,
  cap = 6,
}: {
  families: TemplateFamily[];
  total: number;
  cap?: number;
}) {
  if (total <= 0) return null;
  const shown = families.slice(0, cap);
  const tailN = families.slice(cap).reduce((s, f) => s + f.totalN, 0);
  const familiesN = families.reduce((s, f) => s + f.totalN, 0);
  const uniqueN = Math.max(0, total - familiesN);

  const segments = [
    ...shown.map((f, i) => ({
      key: f.id,
      label: `Template ${i + 1}`,
      n: f.totalN,
      color: templateShade(i),
    })),
    ...(tailN > 0
      ? [{ key: 'other', label: `Other templates (${families.length - shown.length})`, n: tailN, color: 'var(--muted)' }]
      : []),
    { key: 'unique', label: 'Unique / one-off', n: uniqueN, color: 'color-mix(in srgb, var(--muted) 22%, var(--surface))' },
  ].filter(s => s.n > 0);

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full border border-[var(--border)]">
        {segments.map(s => {
          const w = (s.n / total) * 100;
          return (
            <div
              key={s.key}
              style={{ width: `${w}%`, background: s.color }}
              title={`${s.label}: ${s.n.toLocaleString()} (${w.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      {/* Slim legend: the per-template blocks are explained by the cards below
          (rank swatch = bar color), so the legend only names the two segments
          that DON'T have a card — the folded tail and the unique remainder. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
        <span>Each colored block is a template below</span>
        {segments
          .filter(s => s.key === 'other' || s.key === 'unique')
          .map(s => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block w-2 h-2 rounded-sm" style={{ background: s.color }} />
              {s.label} {((s.n / total) * 100).toFixed(0)}%
            </span>
          ))}
      </div>
    </div>
  );
}

/**
 * One template family: its share of the docket, how many wording variants were
 * folded into it, a representative body, and the date span it spans.
 */
export function TemplateCard({
  family,
  rank,
  badge,
}: {
  family: TemplateFamily;
  /** 1-based position in the ranked list, shown as a small tag. */
  rank: number;
  /** Optional chip (e.g. a stance label). */
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const excerpt = cleanExcerpt(family.representative.sample);
  const swatch = templateShade(rank - 1);
  const countLabel = `${family.totalN.toLocaleString()} ${family.totalN === 1 ? 'comment' : 'comments'}`;
  const dateRange = formatDayRange(family.firstDay, family.lastDay);

  return (
    <>
      <Card asChild interactive className="p-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-left"
          aria-label={`Read full text of template #${rank}`}
        >
          {/* Headline: the share leads. The color swatch (not a "#N") ties this
              card to its segment in the coverage bar above, so the top line
              carries one idea — "this slice = N% of comments" — plus the stance. */}
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <span className="inline-flex items-baseline gap-2 min-w-0">
              <span
                aria-hidden
                className="self-center inline-block w-2.5 h-2.5 rounded-sm shrink-0 ring-1 ring-[var(--border)]"
                style={{ background: swatch }}
              />
              <span className="text-lg font-semibold tabular-nums text-[var(--foreground)] leading-none">
                {family.sharePct.toFixed(1)}%
              </span>
              <span className="text-[11px] text-[var(--muted)]">of comments</span>
            </span>
            {badge}
          </div>
          <div
            className="text-xs text-[var(--foreground)] leading-relaxed mb-2"
            style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            &ldquo;{excerpt}&rdquo;
          </div>
          {/* Footer: metadata on the left, the action on the right — two clear
              groups instead of one dot-joined run. Variant-fold detail moves to
              the modal so this line stays a simple "count, when". */}
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[10px] text-[var(--muted)]">
              <span className="text-[var(--foreground)]">{countLabel}</span>
              <span className="mx-1.5 text-[var(--border)]">·</span>
              {dateRange}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--accent-primary)] shrink-0">
              <Maximize2 className="h-3 w-3" aria-hidden />
              Read full text
            </span>
          </div>
        </button>
      </Card>

      <TemplateTextModal
        open={open}
        onClose={() => setOpen(false)}
        title={`Form-letter template #${rank}`}
        swatch={swatch}
        sample={family.representative.sample}
        countLabel={`${family.sharePct.toFixed(1)}% of docket · ${countLabel}`}
        dateLine={dateRange}
        variantsLine={family.variantCount > 1 ? `folds ${family.variantCount} wording variants` : null}
        badge={badge}
      />
    </>
  );
}

/**
 * Full, untruncated body of a form-letter template / repeated comment. Uses
 * `toDisplay` (not the card's `cleanExcerpt`) so paragraph breaks survive, and
 * renders with `whitespace-pre-wrap` to keep the letter's original line shape.
 */
function TemplateTextModal({
  open,
  onClose,
  title,
  swatch,
  sample,
  countLabel,
  dateLine,
  variantsLine,
  badge,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional rank color, echoing the card's coverage-bar swatch. */
  swatch?: string;
  sample: string;
  countLabel: string;
  dateLine: string;
  variantsLine: string | null;
  badge?: React.ReactNode;
}) {
  const fullText = toDisplay(sample);
  const titleNode = swatch ? (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block w-2.5 h-2.5 rounded-sm shrink-0 ring-1 ring-[var(--border)]"
        style={{ background: swatch }}
      />
      {title}
    </span>
  ) : (
    title
  );
  const subtitle = (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>{countLabel}</span>
      {badge}
    </span>
  );
  return (
    <Modal open={open} onClose={onClose} title={titleNode} subtitle={subtitle}>
      <div className="max-h-[68vh] overflow-y-auto px-5 py-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
          {fullText}
        </p>
      </div>
      <div className="border-t border-[var(--border)] px-5 py-3 text-[11px] text-[var(--muted)]">
        {dateLine}
        {variantsLine && ` · ${variantsLine} — shown text is the most common variant`}
      </div>
    </Modal>
  );
}

export function ClusterCard({
  cluster,
  totalComments,
  badge,
}: {
  cluster: Cluster;
  totalComments: number;
  /** Optional chip rendered next to the comment count (e.g. a stance label). */
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pct = totalComments > 0 ? (cluster.n / totalComments) * 100 : 0;
  const cleanSample = cleanExcerpt(cluster.sample);
  const countLabel = `${cluster.n.toLocaleString()} ${cluster.n === 1 ? 'comment' : 'comments'}`;
  const dateRange = formatDayRange(cluster.firstDay, cluster.lastDay);

  return (
    <>
      <Card asChild interactive className="p-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-left"
          aria-label="Read full text of this comment"
        >
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <span className="inline-flex items-baseline gap-2 min-w-0">
              <span className="text-lg font-semibold tabular-nums text-[var(--foreground)] leading-none">
                {pct.toFixed(1)}%
              </span>
              <span className="text-[11px] text-[var(--muted)]">of comments</span>
            </span>
            {badge}
          </div>
          <div
            className="text-xs text-[var(--foreground)] leading-relaxed mb-2"
            style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            &ldquo;{cleanSample}&rdquo;
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[10px] text-[var(--muted)]">
              <span className="text-[var(--foreground)]">{countLabel}</span>
              <span className="mx-1.5 text-[var(--border)]">·</span>
              {dateRange}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--accent-primary)] shrink-0">
              <Maximize2 className="h-3 w-3" aria-hidden />
              Read full text
            </span>
          </div>
        </button>
      </Card>

      <TemplateTextModal
        open={open}
        onClose={() => setOpen(false)}
        title="Most repeated comment"
        sample={cluster.sample}
        countLabel={`${pct.toFixed(1)}% of docket · ${countLabel}`}
        dateLine={dateRange}
        variantsLine={null}
        badge={badge}
      />
    </>
  );
}

interface VolumeChartProps {
  data: VolumeRow[];
  commentStartDate: string | null;
  commentEndDate: string | null;
}

/**
 * Responsive wrapper: measures the available width and renders the chart at
 * that exact pixel width so the SVG never stretches. (The viewBox tracks the
 * measured width 1:1, so bars and axis labels keep their true proportions in
 * both the narrow docket Overview column and the wider Lab panel.)
 */
function VolumeChart(props: VolumeChartProps) {
  return (
    <ParentSize debounceTime={20}>
      {({ width }) => <VolumeChartInner {...props} width={Math.max(280, width)} />}
    </ParentSize>
  );
}

function VolumeChartInner({
  data,
  commentStartDate,
  commentEndDate,
  width,
}: VolumeChartProps & { width: number }) {
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = CHART_H - MARGIN.top - MARGIN.bottom;

  const today = useMemo(() => new Date(), []);

  const [domainStart, domainEnd] = useMemo(() => {
    const parse = (s: string | null) => {
      if (!s) return null;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const winStart = parse(commentStartDate);
    const winEnd = parse(commentEndDate);
    const dataStart = data.length > 0 ? new Date(data[0].day) : null;
    const dataEnd = data.length > 0 ? new Date(data[data.length - 1].day) : null;

    // Start: prefer official window start; fall back to first comment.
    // If comments arrived before the official open (rare but happens),
    // pick the earlier of the two so no bars get clipped.
    let start = winStart ?? dataStart;
    if (start && dataStart && dataStart < start) start = dataStart;

    // End: prefer official window close. If "today" is later AND the window
    // is still open, extend to today so the Today marker sits inside the
    // domain. Trailing paper-submission stragglers far past the close are
    // ignored.
    let end = winEnd ?? dataEnd;
    if (winEnd && today > winEnd && dataEnd && dataEnd > winEnd) {
      // Window closed; allow a little post-window data but cap at 30 days past close.
      const cap = new Date(winEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
      end = dataEnd < cap ? dataEnd : cap;
    }
    if (winEnd && today <= winEnd && today > (end ?? today)) end = today;

    if (!start || !end) {
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return [monthAgo, now];
    }
    // Small horizontal breathing room so bars/markers don't hug the axes.
    const pad = Math.max(1, (end.getTime() - start.getTime()) * 0.02);
    return [new Date(start.getTime() - pad), new Date(end.getTime() + pad)];
  }, [data, commentStartDate, commentEndDate, today]);

  const yMax = useMemo(() => {
    const inside = data.filter(d => {
      const t = new Date(d.day).getTime();
      return t >= domainStart.getTime() && t <= domainEnd.getTime();
    });
    return Math.max(1, ...inside.map(d => d.n));
  }, [data, domainStart, domainEnd]);

  const xScale = useMemo(
    () => scaleTime({ domain: [domainStart, domainEnd], range: [0, innerW] }),
    [domainStart, domainEnd, innerW]
  );
  const yScale = useMemo(
    () => scaleLinear({ domain: [0, yMax], range: [innerH, 0], nice: true }),
    [innerH, yMax]
  );

  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, (domainEnd.getTime() - domainStart.getTime()) / dayMs);
  const barWidth = Math.max(1.5, innerW / totalDays - 1);

  // Comment-window band geometry.
  const windowStart = commentStartDate ? new Date(commentStartDate) : null;
  const windowEnd = commentEndDate ? new Date(commentEndDate) : null;
  const windowBand = useMemo(() => {
    if (!windowStart && !windowEnd) return null;
    const start = windowStart ?? domainStart;
    const end = windowEnd ?? domainEnd;
    const x1 = Math.max(0, xScale(start));
    const x2 = Math.min(innerW, xScale(end));
    if (x2 <= x1) return null;
    return { x: x1, w: x2 - x1 };
  }, [windowStart, windowEnd, xScale, innerW, domainStart, domainEnd]);

  const todayInDomain =
    today >= domainStart && today <= domainEnd;
  const todayX = todayInDomain ? xScale(today) : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${CHART_H}`}
      width={width}
      height={CHART_H}
      role="img"
      aria-label="Comments per day"
      style={{ display: 'block' }}
    >
      <Group left={MARGIN.left} top={MARGIN.top}>
        {/* Comment-window band */}
        {windowBand && (
          <>
            <rect
              x={windowBand.x}
              y={0}
              width={windowBand.w}
              height={innerH}
              fill="var(--accent-primary)"
              opacity={0.06}
              pointerEvents="none"
            />
            {windowStart && xScale(windowStart) >= 0 && xScale(windowStart) <= innerW && (
              <line
                x1={xScale(windowStart)}
                x2={xScale(windowStart)}
                y1={0}
                y2={innerH}
                stroke="var(--accent-primary)"
                strokeWidth={1}
                opacity={0.3}
                pointerEvents="none"
              />
            )}
            {windowEnd && xScale(windowEnd) >= 0 && xScale(windowEnd) <= innerW && (
              <line
                x1={xScale(windowEnd)}
                x2={xScale(windowEnd)}
                y1={0}
                y2={innerH}
                stroke="var(--accent-primary)"
                strokeWidth={1}
                opacity={0.3}
                pointerEvents="none"
              />
            )}
          </>
        )}

        {/* Bars */}
        {data.map(d => {
          const t = new Date(d.day).getTime();
          if (t < domainStart.getTime() || t > domainEnd.getTime()) return null;
          const x = xScale(new Date(d.day));
          const y = yScale(d.n);
          return (
            <Bar
              key={d.day}
              x={x - barWidth / 2}
              y={y}
              width={barWidth}
              height={innerH - y}
              fill="var(--accent-primary)"
            >
              <title>{`${d.day}: ${d.n.toLocaleString()} comment${d.n === 1 ? '' : 's'}`}</title>
            </Bar>
          );
        })}

        {/* Today marker (drawn over bars so it reads as a foreground annotation) */}
        {todayX !== null && (
          <>
            <line
              x1={todayX}
              x2={todayX}
              y1={-MARGIN.top + 6}
              y2={innerH}
              stroke="var(--foreground)"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.7}
              pointerEvents="none"
            />
            <text
              x={todayX}
              y={-MARGIN.top + 13}
              textAnchor="middle"
              fontSize={10}
              fill="var(--foreground)"
              style={{ pointerEvents: 'none', fontWeight: 600 }}
            >
              Today
            </text>
          </>
        )}

        <AxisBottom
          top={innerH}
          scale={xScale}
          numTicks={8}
          stroke="var(--border)"
          tickStroke="var(--muted)"
          tickLabelProps={() => ({ fill: 'var(--muted)', fontSize: 11, textAnchor: 'middle' })}
        />
        <AxisLeft
          scale={yScale}
          numTicks={4}
          stroke="var(--border)"
          tickStroke="var(--muted)"
          tickLabelProps={() => ({ fill: 'var(--muted)', fontSize: 11, textAnchor: 'end', dx: '-0.25em', dy: '0.25em' })}
        />
      </Group>
    </svg>
  );
}
