'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Group } from '@visx/group';
import { Bar, Line } from '@visx/shape';
import { scaleLinear, scaleBand } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { ParentSize } from '@visx/responsive';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { useDuckDB } from '@/lib/duckdb/context';
import { getAgencyInfo } from '@/lib/agencyMetadata';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { Card } from '@/components/ui/Card';
import { DemoPill } from '@/components/ui/DemoPill';

interface Summary {
  agency_code: string; n: number;
  p10: number; p25: number; p50: number; p75: number; p90: number;
  min: number; max: number;
}
interface Sample {
  docket_id: string; agency_code: string; title: string;
  proposed_date: string; final_date: string; days: number;
}
interface Stuck {
  docket_id: string; agency_code: string; title: string;
  proposed_date: string; days_open: number;
}
interface Benchmark {
  n: number; agencyCount: number;
  p10: number; p25: number; p50: number; p75: number; p90: number;
}

/**
 * Frame an agency's median duration against the all-agency median, choosing
 * the most readable form: "in line with" near parity, a percentage when the
 * gap is moderate, and a multiplier once the agency runs more than ~2× slow.
 */
function durationComparison(agencyP50: number, benchP50: number): string {
  if (!benchP50) return '';
  const ratio = agencyP50 / benchP50;
  const benchLabel = `the all-agency median of ${Math.round(benchP50)} days`;
  if (Math.abs(ratio - 1) < 0.05) return `roughly in line with ${benchLabel}`;
  if (ratio < 1) return `about ${Math.round((1 - ratio) * 100)}% faster than ${benchLabel}`;
  if (ratio < 2) return `about ${Math.round((ratio - 1) * 100)}% slower than ${benchLabel}`;
  return `about ${ratio.toFixed(1)}× ${benchLabel}`;
}

const TOP_N = 8;
const DIST_W = 860;
const ROW_H = 38;
const MARGIN = { top: 24, right: 110, bottom: 36, left: 64 };

interface LifecyclePanelProps {
  /**
   * When set, the panel covers a SINGLE agency (the profile's lifecycle box)
   * and skips the top-8 ranking pass. When unset, /lab behavior is preserved:
   * rank the top 8 rulemaking agencies and chart all of them.
   */
  agencyCode?: string;
}

export function LifecyclePanel({ agencyCode }: LifecyclePanelProps = {}) {
  const { runQuery } = useDuckDB();
  const { getRulemakingLifecycles, getRulemakingLifecycleBenchmark, isReady } = useDuckDBService();
  const single = !!agencyCode;

  const [topAgencies, setTopAgencies] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [completedSample, setCompletedSample] = useState<Sample[]>([]);
  const [stuck, setStuck] = useState<Stuck[]>([]);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // All-agency benchmark — government-wide, independent of which agency is in
  // view, so it loads once on the profile and contextualizes the median.
  useEffect(() => {
    if (!isReady || !single) return;
    let cancelled = false;
    getRulemakingLifecycleBenchmark()
      .then(b => { if (!cancelled) setBenchmark(b); })
      .catch(err => console.error('LifecyclePanel benchmark:', err));
    return () => { cancelled = true; };
  }, [isReady, single, getRulemakingLifecycleBenchmark]);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    const R2 = 'https://pub-5fc11ad134984edf8d9af452dd1849d6.r2.dev';

    // Single-agency (profile) path: no ranking pass.
    if (agencyCode) {
      setTopAgencies([agencyCode]);
      getRulemakingLifecycles([agencyCode], 30, 15)
        .then(res => {
          if (cancelled || !res) return;
          setSummary(res.summary);
          setCompletedSample(res.completedSample);
          setStuck(res.stuck);
          setLoading(false);
        })
        .catch(err => {
          if (cancelled) return;
          console.error('LifecyclePanel:', err);
          setError(String(err?.message ?? err));
          setLoading(false);
        });
      return () => { cancelled = true; };
    }

    runQuery<{ agency_code: string; n: number }>(`
      WITH props AS (
        SELECT docket_id, agency_code
        FROM read_parquet('${R2}/documents.parquet')
        WHERE document_type = 'Proposed Rule' AND agency_code IS NOT NULL
          AND TRY_CAST(posted_date AS DATE) >= DATE '2010-01-01'
      ),
      finals AS (
        SELECT docket_id
        FROM read_parquet('${R2}/documents.parquet')
        WHERE document_type = 'Rule'
      )
      SELECT p.agency_code, COUNT(*) AS n
      FROM props p JOIN finals f USING (docket_id)
      GROUP BY 1 ORDER BY n DESC LIMIT ${TOP_N}
    `)
      .then(top => {
        if (cancelled) return null;
        const codes = top.map(t => t.agency_code);
        setTopAgencies(codes);
        return getRulemakingLifecycles(codes, 30, 15);
      })
      .then(res => {
        if (cancelled || !res) return;
        setSummary(res.summary);
        setCompletedSample(res.completedSample);
        setStuck(res.stuck);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('LifecyclePanel:', err);
        setError(String(err?.message ?? err));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isReady, agencyCode, runQuery, getRulemakingLifecycles]);

  const orderedSummary = useMemo(() => {
    const order = new Map(topAgencies.map((c, i) => [c, i]));
    return [...summary].sort(
      (a, b) => (order.get(a.agency_code) ?? 99) - (order.get(b.agency_code) ?? 99)
    );
  }, [summary, topAgencies]);

  const sampleByAgency = useMemo(() => {
    const m = new Map<string, Sample[]>();
    for (const code of topAgencies) m.set(code, []);
    for (const s of completedSample) {
      const list = m.get(s.agency_code);
      if (list) list.push(s);
    }
    return m;
  }, [completedSample, topAgencies]);

  const headlineFinding = useMemo(() => {
    if (orderedSummary.length === 0) return null;
    const fastest = orderedSummary.reduce((a, b) => (a.p50 <= b.p50 ? a : b));
    const slowest = orderedSummary.reduce((a, b) => (a.p50 >= b.p50 ? a : b));
    return { fastest, slowest };
  }, [orderedSummary]);

  const caption = single ? (
    <>
<span className="font-mono-id">{agencyCode}</span>&rsquo;s distribution of completed
      rulemaking durations, in days from{' '}
      <span className="font-medium">Proposed Rule</span> to <span className="font-medium">Final
      Rule</span>, with the median marked. The amber line marks the all-agency median.
    </>
  ) : (
    <>
      A federal rule typically moves through a docket as a{' '}
      <span className="font-medium">Proposed Rule</span> → public comment period →{' '}
      <span className="font-medium">Final Rule</span>. The chart below shows how long that
      takes for each of the top eight rulemaking agencies. Each row is one agency&apos;s
      distribution of completed rulemakings (in days from proposal to final), with the
      median marked in solid color.
    </>
  );

  return (
    <section className="card card-lg p-6 mb-8">
      <PanelHeader
        label="Rulemaking duration"
        title="How long does it take to make a federal rule?"
        caption={caption}
        finding={
          single && orderedSummary.length > 0 ? (
            <>
              <span className="font-mono-id">{orderedSummary[0].agency_code}</span> median{' '}
              <strong>{Math.round(orderedSummary[0].p50)} days</strong> across{' '}
              {orderedSummary[0].n.toLocaleString()} completed rulemakings (p10–p90:{' '}
              {Math.round(orderedSummary[0].p10)}–{Math.round(orderedSummary[0].p90)} days).
              {benchmark && benchmark.p50 > 0 && (
                <> That&rsquo;s{' '}
                  <strong>{durationComparison(orderedSummary[0].p50, benchmark.p50)}</strong>.
                </>
              )}
            </>
          ) : headlineFinding ? (
            <>
              Fastest median: <span className="font-mono-id">{headlineFinding.fastest.agency_code}</span>{' '}
              at <strong>{Math.round(headlineFinding.fastest.p50)} days</strong> across{' '}
              {headlineFinding.fastest.n.toLocaleString()} completed rulemakings.{' '}
              Slowest median: <span className="font-mono-id">{headlineFinding.slowest.agency_code}</span>{' '}
              at <strong>{Math.round(headlineFinding.slowest.p50)} days</strong>.
            </>
          ) : null
        }
      />

      {loading && <div className="text-sm text-[var(--muted)] py-4">Loading lifecycle data…</div>}
      {error && <div className="text-sm text-[var(--accent-red)] py-2">Error: {error}</div>}

      {!loading && !error && orderedSummary.length > 0 && (
        <>
          {single ? (
            <ParentSize>
              {({ width }) => (
                <DistributionChart
                  summary={orderedSummary}
                  sampleByAgency={sampleByAgency}
                  width={Math.max(360, width - 24)}
                  benchmarkP50={benchmark?.p50}
                  bordered
                />
              )}
            </ParentSize>
          ) : (
            <DistributionChart
              summary={orderedSummary}
              sampleByAgency={sampleByAgency}
            />
          )}

          {/* "Suspicious pending" cases — an analytical lab feature; omitted on
              the agency profile, where Lifecycle is a quick how-long glance. */}
          {!single && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-base font-semibold font-serif">No Final Rule on file</h3>
              <DemoPill reason="The 'still pending' status is inferred from absence of a corresponding Final Rule document on the same docket. The upstream pipeline drops the regulations.gov 'withdrawn' flag and the RIN field, so we can't yet distinguish (a) abandoned, (b) withdrawn, (c) finalized under a sibling docket with a different ID, or (d) genuinely still open." />
            </div>
            <p className="text-xs text-[var(--muted)] mb-3 max-w-3xl leading-relaxed">
              Proposed Rules from these eight agencies, posted
              between 18 months and 8 years ago, that have <em>no Final Rule document</em> on the
              same docket. Some are genuinely pending. Many were withdrawn, abandoned, or finalized
              under a different docket ID that we can&apos;t link without the RIN field (currently
              dropped by the pipeline). Treat this as a list of <em>suspicious cases</em>, not
              confirmed ones.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {stuck.map(s => (
                <StuckCard key={s.docket_id} stuck={s} />
              ))}
            </div>
            {stuck.length === 0 && (
              <p className="text-sm text-[var(--muted)] italic">
                No Proposed Rules in the 18-month–8-year window without a matching Final Rule.
              </p>
            )}
          </div>
          )}
        </>
      )}
    </section>
  );
}

const DistributionChart = memo(function DistributionChart({
  summary,
  sampleByAgency,
  width = DIST_W,
  benchmarkP50,
  bordered = false,
}: {
  summary: Summary[];
  sampleByAgency: Map<string, Sample[]>;
  /** Total SVG width. Defaults to the fixed lab width; the single-agency
   *  profile passes its measured container width so the strip fits the column. */
  width?: number;
  /** All-agency median (days). When set, drawn as an amber reference line so
   *  the agency's distribution can be read against the government-wide norm. */
  benchmarkP50?: number;
  /** Wrap the chart in the same bordered surface box used by the agency
   *  activity panel, so both charts on the agency profile match. */
  bordered?: boolean;
}) {
  const height = MARGIN.top + MARGIN.bottom + summary.length * ROW_H;
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const xMax = useMemo(
    () => Math.max(365, benchmarkP50 ?? 0, ...summary.map(s => s.p90)),
    [summary, benchmarkP50]
  );

  const xScale = useMemo(
    () => scaleLinear({ domain: [0, xMax], range: [0, innerW], nice: true }),
    [xMax, innerW]
  );
  const yScale = useMemo(
    () => scaleBand({ domain: summary.map(s => s.agency_code), range: [0, innerH], padding: 0.25 }),
    [summary, innerH]
  );

  const rowH = yScale.bandwidth();

  return (
    <div className="overflow-x-auto">
      <div className={bordered ? 'card-static p-3' : undefined}>
      <svg width={width} height={height} role="img" aria-label="Rulemaking duration distribution by agency">
        <Group left={MARGIN.left} top={MARGIN.top}>
          {/* Reference: 1 year */}
          {[365, 730, 1095, 1460].filter(d => d <= xMax).map(d => (
            <line
              key={d}
              x1={xScale(d)} x2={xScale(d)}
              y1={0} y2={innerH}
              stroke="var(--border-subtle)" strokeDasharray="2 4"
            />
          ))}

          {/* All-agency median — the "vs. average" benchmark */}
          {benchmarkP50 != null && benchmarkP50 > 0 && (
            <>
              <Line
                from={{ x: xScale(benchmarkP50), y: 0 }}
                to={{ x: xScale(benchmarkP50), y: innerH }}
                stroke="var(--accent-amber)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <text
                x={xScale(benchmarkP50)}
                y={-7}
                fontSize={9}
                fill="var(--accent-amber)"
                textAnchor="middle"
              >
                all-agency median
              </text>
            </>
          )}

          {summary.map(s => {
            const y = (yScale(s.agency_code) ?? 0) + rowH / 2;
            const xMin = xScale(Math.max(0, s.p10));
            const xMax90 = xScale(s.p90);
            const x25 = xScale(s.p25);
            const x75 = xScale(s.p75);
            const x50 = xScale(s.p50);
            const samples = sampleByAgency.get(s.agency_code) ?? [];

            return (
              <Group key={s.agency_code} top={y - rowH / 2}>
                {/* whisker */}
                <Line
                  from={{ x: xMin, y: rowH / 2 }}
                  to={{ x: xMax90, y: rowH / 2 }}
                  stroke="var(--muted)"
                  strokeWidth={1}
                />
                {/* IQR box */}
                <Bar
                  x={x25}
                  y={rowH / 2 - 7}
                  width={Math.max(2, x75 - x25)}
                  height={14}
                  fill="var(--accent-primary)"
                  opacity={0.18}
                  stroke="var(--accent-primary)"
                  strokeOpacity={0.45}
                />
                {/* sample dots */}
                {samples.map(d => (
                  <circle
                    key={d.docket_id}
                    cx={xScale(Math.min(d.days, xMax))}
                    cy={rowH / 2}
                    r={2}
                    fill="var(--accent-primary)"
                    opacity={0.35}
                  >
                    <title>{`${d.docket_id} — ${d.days} days\n${d.title}`}</title>
                  </circle>
                ))}
                {/* median */}
                <Line
                  from={{ x: x50, y: rowH / 2 - 9 }}
                  to={{ x: x50, y: rowH / 2 + 9 }}
                  stroke="var(--accent-primary)"
                  strokeWidth={2.5}
                />
                {/* finding text right-aligned */}
                <text
                  x={innerW + 6}
                  y={rowH / 2 + 3}
                  fontSize={10}
                  fill="var(--muted)"
                >
                  n={s.n.toLocaleString()}, median {Math.round(s.p50)}d
                </text>
              </Group>
            );
          })}

          <AxisBottom
            top={innerH}
            scale={xScale}
            stroke="var(--border)"
            tickStroke="var(--muted)"
            label="Days from Proposed to Final Rule"
            labelProps={{ fill: 'var(--muted)', fontSize: 11, textAnchor: 'middle' }}
            tickLabelProps={() => ({ fill: 'var(--muted)', fontSize: 10, textAnchor: 'middle' })}
            numTicks={6}
          />
          <AxisLeft
            scale={yScale}
            stroke="var(--border)"
            hideTicks
            tickLabelProps={() => ({
              fill: 'var(--foreground)',
              fontSize: 11,
              textAnchor: 'end',
              dx: '-0.5em',
              dy: '0.32em',
              fontWeight: 600,
            })}
          />
        </Group>
      </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        <span>Light box = middle 50% (p25–p75) · thin line = p10–p90 · vertical mark = median</span>
        <span>Dots = sampled individual rulemakings (hover for title)</span>
        <span>Dashed verticals = 1, 2, 3, 4 years</span>
        {benchmarkP50 != null && benchmarkP50 > 0 && (
          <span className="text-[var(--accent-amber)]">Amber line = all-agency median</span>
        )}
      </div>
    </div>
  );
});

function StuckCard({ stuck }: { stuck: Stuck }) {
  const years = stuck.days_open / 365;
  const yearLabel = years >= 2 ? `${years.toFixed(1)} years` : `${Math.round(stuck.days_open / 30)} months`;
  const info = getAgencyInfo(stuck.agency_code);
  return (
    <Card interactive={false} className="p-3">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <Link
          href={`/sr/${stuck.agency_code}/${stuck.docket_id}`}
          className="font-mono-id text-[var(--accent-primary)] hover:underline"
        >
          {stuck.docket_id}
        </Link>
        <span className="text-xs text-[var(--accent-amber)] font-semibold whitespace-nowrap">
          {yearLabel} · no final rule
        </span>
      </div>
      <div className="text-sm text-[var(--foreground)] leading-snug mb-1 line-clamp-2"
           style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {stuck.title || '(untitled docket)'}
      </div>
      <div className="text-[10px] text-[var(--muted)]">
        {info.name} · proposed {stuck.proposed_date}
      </div>
    </Card>
  );
}
