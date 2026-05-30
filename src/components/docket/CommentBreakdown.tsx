'use client';

import { useMemo } from 'react';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { ParentSize } from '@visx/responsive';
import { FindingNote } from '../ui/PanelHeader';
import { Card } from '../ui/Card';
import { SectionLabel } from '../ui/SectionLabel';
import { scoreStance, aggregateStance } from '@/lib/text/stance';
import { computeOrchestration } from '@/lib/comments/orchestration';
import { StanceSplit, StanceChip } from '../lab/stanceViz';

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
export interface Cluster { hash: string; n: number; sample: string; firstDay: string; lastDay: string }
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

/** "2023-12-15" → "Dec 15, 2023". Safe against the noisy ISO strings DuckDB returns. */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
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
  const { formLetters: formLetterClusters, orchestratedCount, uniquePct, orchestratedPct } =
    computeOrchestration(clusters, totals.total, isPlaceholderCluster);

  // Stance, scored once per template and weighted by cluster size.
  const stanced = useMemo(
    () => formLetterClusters.map(c => ({ cluster: c, stance: scoreStance(c.sample) })),
    [formLetterClusters]
  );
  const stanceTotals = useMemo(
    () => aggregateStance(stanced.map(s => ({ stance: s.stance, weight: s.cluster.n }))),
    [stanced]
  );

  let finding: React.ReactNode;
  if (totals.total === 0) {
    finding = <>No comments found on this docket.</>;
  } else if (orchestratedPct < 5) {
    finding = (
      <>
        Virtually every comment is unique: <strong>{uniquePct.toFixed(1)}%</strong>{' '}
        ({(totals.total - orchestratedCount).toLocaleString()} distinct submissions). This is
        what a non-orchestrated comment period looks like: a small audience writing in their
        own words.
      </>
    );
  } else if (orchestratedPct < 50) {
    finding = (
      <>
        <strong>{orchestratedPct.toFixed(1)}%</strong> of comments are near-duplicate variants of{' '}
        {formLetterClusters.length} form letters; <strong>{uniquePct.toFixed(1)}%</strong> are
        unique substantive submissions. Coordinated activity is present but not dominant.
      </>
    );
  } else {
    finding = (
      <>
        Mass orchestration: <strong>{orchestratedPct.toFixed(1)}%</strong> of comments are
        near-duplicate variants of {formLetterClusters.length} form-letter templates. Only{' '}
        <strong>{uniquePct.toFixed(1)}%</strong> of submissions are unique substantive
        comments ({(totals.total - orchestratedCount).toLocaleString()} out of{' '}
        {totals.total.toLocaleString()}).
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <MetricCard
          big={totals.total.toLocaleString()}
          label="Total comments"
        />
        <MetricCard
          big={`${uniquePct.toFixed(1)}%`}
          label={`Unique (${(totals.total - orchestratedCount).toLocaleString()})`}
          dotColor="var(--accent-green)"
        />
        <MetricCard
          big={`${orchestratedPct.toFixed(1)}%`}
          label={
            formLetterClusters.length > 0
              ? `Orchestrated (${formLetterClusters.length} template${formLetterClusters.length === 1 ? '' : 's'})`
              : 'Orchestrated'
          }
          dotColor="var(--accent-amber)"
        />
      </div>

      <div className="mb-5">
        <FindingNote>{finding}</FindingNote>
      </div>

      {orchestratedCount > 0 && (
        <div className="mb-4">
          <StanceSplit totals={stanceTotals} covered={orchestratedCount} ofTotal={totals.total} />
        </div>
      )}

      <div className="space-y-5">
        <div>
          <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <SectionLabel label="Comments per day" />
            <ChartLegend
              commentStartDate={commentStartDate}
              commentEndDate={commentEndDate}
            />
          </div>
          <Card interactive={false} className="p-3">
            <VolumeChart
              data={volumeByDay}
              commentStartDate={commentStartDate}
              commentEndDate={commentEndDate}
            />
          </Card>
        </div>

        <div>
          <SectionLabel
            label={
              formLetterClusters.length > 0
                ? `Top form letters (${Math.min(6, formLetterClusters.length)} of ${formLetterClusters.length})`
                : 'Most repeated comments'
            }
            className="mb-2"
          />
          {formLetterClusters.length === 0 ? (
            <p className="text-xs text-[var(--muted)] italic">
              No comment text repeats more than once. Every submission appears to be
              independently written.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {stanced.slice(0, 6).map(({ cluster, stance }) => (
                <ClusterCard
                  key={cluster.hash}
                  cluster={cluster}
                  totalComments={totals.total}
                  badge={<StanceChip stance={stance.stance} />}
                />
              ))}
            </div>
          )}
        </div>
      </div>
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
    <span className="font-normal normal-case tracking-normal text-[var(--muted)] inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {hasWindow && (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block w-3 h-2 rounded-sm"
            style={{ background: 'var(--accent-primary)', opacity: 0.12, border: '1px solid var(--accent-primary)', borderColor: 'rgba(59, 40, 246, 0.35)' }}
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
  const pct = totalComments > 0 ? (cluster.n / totalComments) * 100 : 0;
  const cleanSample = cluster.sample.replace(/<br\s*\/?>(\s*<br\s*\/?>)*/gi, ' ').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, "'").slice(0, 220);
  return (
    <Card interactive={false} className="p-3">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="font-semibold text-sm inline-flex items-baseline gap-2">
          {cluster.n.toLocaleString()} {cluster.n === 1 ? 'comment' : 'comments'}
          {badge}
        </span>
        <span className="text-xs text-[var(--muted)]">{pct.toFixed(1)}%</span>
      </div>
      <div
        className="text-xs text-[var(--foreground)] leading-relaxed mb-1.5"
        style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        &ldquo;{cleanSample}&rdquo;
      </div>
      <div className="text-[10px] text-[var(--muted)]">
        {cluster.firstDay === cluster.lastDay
          ? `posted ${cluster.firstDay}`
          : `${cluster.firstDay} → ${cluster.lastDay}`}
      </div>
    </Card>
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
