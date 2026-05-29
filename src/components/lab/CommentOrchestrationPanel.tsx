'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { PanelHeader, FindingNote, DocketIdentity } from './PanelHeader';
import { scoreStance, aggregateStance } from '@/lib/text/stance';
import { StanceSplit, StanceChip } from './stanceViz';

/**
 * Two dockets to compare:
 *   1. HUD-2026-0529 — a small recent docket on HUD's Equal Access Rule
 *      revisions. ~600 comments, virtually all unique. The "what does a
 *      clean, organic comment period look like" case.
 *   2. ATF-2023-0002 — a high-profile recent ATF rulemaking on forced reset
 *      triggers / bump-stock-type devices. ~370K comments in the mirror, a
 *      domain known for gun-rights advocacy mass-comment campaigns. The
 *      "what does orchestration look like" case.
 */
interface DocketTab { id: string; label: string }

/**
 * The curated pair anchors the comparison; a couple of randomly-sampled dockets
 * are appended at runtime (see CommentOrchestrationPanel) so the reader can see
 * how the near-duplicate clustering behaves on arbitrary, uncurated dockets.
 */
const PRESET_DOCKETS: DocketTab[] = [
  { id: 'HUD-2026-0529', label: 'Organic' },
  { id: 'ATF-2023-0002', label: 'Orchestrated' },
];

interface VolumeRow { day: string; n: number }
export interface Cluster { hash: string; n: number; sample: string; firstDay: string; lastDay: string }
interface Totals { total: number; unique: number; empty: number }
interface DocketData {
  docketId: string;
  docketTitle: string;
  docketAbstract: string;
  commentStartDate: string | null;
  commentEndDate: string | null;
  totals: Totals;
  volumeByDay: VolumeRow[];
  clusters: Cluster[];
}

const CHART_H = 220;
const MARGIN = { top: 18, right: 16, bottom: 28, left: 56 };

/** "2023-12-15" → "Dec 15, 2023". Safe against the noisy ISO strings DuckDB returns. */
function formatShortDate(iso: string): string {
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
function isPlaceholderCluster(c: Cluster): boolean {
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

export function CommentOrchestrationPanel() {
  const { getCommentVolumeAndClusters, getRandomDocketsWithComments, isReady } = useDuckDBService();
  const [results, setResults] = useState<Record<string, DocketData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dockets, setDockets] = useState<DocketTab[]>(PRESET_DOCKETS);
  const [activeId, setActiveId] = useState<string>(PRESET_DOCKETS[0].id);
  const requested = useRef<Set<string>>(new Set());
  const randomsLoaded = useRef(false);

  // Append exactly two randomly-sampled dockets after the curated pair, once.
  // (random() returns fresh ids each call, so this MUST be one-shot — otherwise
  // every effect re-run / StrictMode double-invoke appends another pair.)
  useEffect(() => {
    if (!isReady || randomsLoaded.current) return;
    randomsLoaded.current = true;
    let cancelled = false;
    getRandomDocketsWithComments(2, 200, 50000)
      .then(rows => {
        if (cancelled) return;
        setDockets(prev => {
          const seen = new Set(prev.map(d => d.id));
          const extra = rows
            .map((r, i) => ({ id: r.docket_id.toUpperCase(), label: `Random ${i + 1}` }))
            .filter(d => !seen.has(d.id));
          return [...prev, ...extra];
        });
      })
      .catch(err => {
        randomsLoaded.current = false; // allow a retry on transient failure
        console.error('CommentOrchestrationPanel random dockets:', err);
      });
    return () => { cancelled = true; };
  }, [isReady, getRandomDocketsWithComments]);

  // Lazily load near-duplicate clustering for every docket tab (curated + random).
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    dockets.forEach(({ id }) => {
      if (requested.current.has(id)) return;
      requested.current.add(id);
      getCommentVolumeAndClusters(id, 'near')
        .then(res => {
          if (cancelled) return;
          setResults(prev => ({ ...prev, [id]: { docketId: id, ...res } }));
        })
        .catch(err => {
          if (cancelled) return;
          console.error(`CommentOrchestrationPanel ${id}:`, err);
          setErrors(prev => ({ ...prev, [id]: String(err?.message ?? err) }));
        });
    });
    return () => { cancelled = true; };
  }, [isReady, dockets, getCommentVolumeAndClusters]);

  return (
    <section className="card-gradient p-6 mb-8">
      <PanelHeader
        label="Comment uniqueness"
        title="Organic comments or orchestrated campaign?"
        caption={
          <>
            Mass comment campaigns, where thousands of identical or near-identical letters
            arrive through advocacy platforms, are now routine in federal rulemaking. For each
            docket below, we group{' '}
            <span
              title="A comment that closely matches at least one other submission once formatting, names, numbers, and word order are normalized away"
              className="underline decoration-dotted underline-offset-2 cursor-help"
            >
              near-identical comments
            </span>{' '}
            — looking past formatting, names, numbers, and word order — to separate form letters
            from genuinely unique submissions.
          </>
        }
      />

      <DocketTabs
        active={activeId}
        onChange={setActiveId}
        results={results}
        dockets={dockets}
      />

      <div className="mt-5">
        <DocketSubsection
          key={activeId}
          docketId={activeId}
          data={results[activeId]}
          error={errors[activeId]}
        />
      </div>
    </section>
  );
}

function DocketTabs({
  active,
  onChange,
  results,
  dockets,
}: {
  active: string;
  onChange: (id: string) => void;
  results: Record<string, DocketData>;
  dockets: DocketTab[];
}) {
  return (
    <div
      role="tablist"
      aria-label="Example dockets"
      className="inline-flex flex-wrap rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 gap-1"
    >
      {dockets.map(({ id, label }) => {
        const isActive = id === active;
        const data = results[id];
        return (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-baseline gap-2 ${
              isActive
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <span>{label}</span>
            <span
              className={`font-mono-id text-[10px] ${
                isActive ? 'text-white/80' : 'text-[var(--muted-foreground)]'
              }`}
            >
              {data ? id : '…'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DocketSubsection({
  docketId,
  data,
  error,
}: {
  docketId: string;
  data?: DocketData;
  error?: string;
}) {
  const loading = !data && !error;
  return (
    <div>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <DocketIdentity
          docketId={docketId}
          title={data?.docketTitle}
          href={`/sr/${docketId.split('-')[0]}/${docketId}`}
        />
        {data && (
          <Link
            href={`/sr/${docketId.split('-')[0]}/${docketId}`}
            className="text-xs text-[var(--accent-primary)] hover:underline whitespace-nowrap shrink-0 mt-1"
          >
            View docket →
          </Link>
        )}
      </div>

      {data?.docketAbstract && (
        <p className="text-xs text-[var(--muted)] mb-3 max-w-4xl leading-relaxed line-clamp-2"
           style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {data.docketAbstract.replace(/<[^>]+>/g, ' ')}
        </p>
      )}

      {loading && (
        <div className="text-sm text-[var(--muted)] py-4">Loading comments and computing clusters…</div>
      )}
      {error && (
        <div className="text-sm text-[var(--accent-red)] py-2">Error: {error}</div>
      )}

      {data && <DocketBody data={data} />}
    </div>
  );
}

function DocketBody({ data }: { data: DocketData }) {
  const { totals, clusters, volumeByDay, commentStartDate, commentEndDate } = data;
  const realClusters = clusters.filter(c => !isPlaceholderCluster(c));
  const formLetterClusters = realClusters.filter(c => c.n >= 2);
  const orchestratedCount = formLetterClusters.reduce((s, c) => s + c.n, 0);
  const uniquePct = totals.total === 0 ? 0 : ((totals.total - orchestratedCount) / totals.total) * 100;
  const orchestratedPct = totals.total === 0 ? 0 : (orchestratedCount / totals.total) * 100;

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
        Virtually every comment is unique &mdash; <strong>{uniquePct.toFixed(1)}%</strong>{' '}
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
      <FindingNote>{finding}</FindingNote>

      <div className="grid grid-cols-3 gap-3 my-4">
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

      {orchestratedCount > 0 && (
        <div className="mb-4">
          <StanceSplit totals={stanceTotals} covered={orchestratedCount} ofTotal={totals.total} />
        </div>
      )}

      <div className="space-y-5">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span>Comments per day</span>
            <ChartLegend
              commentStartDate={commentStartDate}
              commentEndDate={commentEndDate}
            />
          </h4>
          <VolumeChart
            data={volumeByDay}
            commentStartDate={commentStartDate}
            commentEndDate={commentEndDate}
          />
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
            {formLetterClusters.length > 0
              ? `Top form letters (${Math.min(6, formLetterClusters.length)} of ${formLetterClusters.length})`
              : 'Most repeated comments'}
          </h4>
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
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
      <div
        className="text-2xl sm:text-3xl font-semibold leading-none mb-1.5 text-[var(--foreground)]"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
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
    </div>
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
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
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
    </div>
  );
}

function VolumeChart({
  data,
  commentStartDate,
  commentEndDate,
}: {
  data: VolumeRow[];
  commentStartDate: string | null;
  commentEndDate: string | null;
}) {
  const VIEWBOX_W = 960;
  const innerW = VIEWBOX_W - MARGIN.left - MARGIN.right;
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
      viewBox={`0 0 ${VIEWBOX_W} ${CHART_H}`}
      width="100%"
      height={CHART_H}
      preserveAspectRatio="none"
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
