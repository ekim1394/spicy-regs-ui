'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { ParentSize } from '@visx/responsive';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { useDuckDB } from '@/lib/duckdb/context';
import { getAgencyInfo } from '@/lib/agencyMetadata';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { Card } from '@/components/ui/Card';
import { AdminBands } from './AdminBands';

interface MonthRow {
  agency_code: string;
  document_type: string;
  month: string;
  n: number;
}

/** Earliest month the chart ever shows: capped at exactly 10 years before
 *  today, month-aligned. The era backdrop and bars never reach further back
 *  than a decade, so older administrations drop off the left edge over time. */
function tenYearsAgoMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - 10, now.getUTCMonth(), 1));
}
const DOMAIN_START = tenYearsAgoMonthStart();
const DOMAIN_START_ISO = `${DOMAIN_START.getUTCFullYear()}-${String(DOMAIN_START.getUTCMonth() + 1).padStart(2, '0')}-01`;
const FALLBACK_END = new Date('2026-12-31');

const MULTIPLE_H = 160;
const MULTIPLE_MIN_W = 240;
const MARGIN = { top: 18, right: 12, bottom: 26, left: 32 };

interface AgencyFinding {
  midnightCount: number;
  baselineRate: number;
  ratio: number;
}

function biden60dayTail(): [Date, Date] {
  const end = new Date('2025-01-20');
  const start = new Date('2024-11-21');
  return [start, end];
}

function computeFinding(monthRows: MonthRow[]): AgencyFinding {
  const [tailStart, tailEnd] = biden60dayTail();
  let midnightCount = 0;
  let baselineTotal = 0;
  let baselineMonths = 0;
  const baselineStart = new Date('2023-11-01');
  const baselineEnd = new Date('2024-10-31');

  for (const r of monthRows) {
    const d = new Date(r.month + 'T00:00:00Z');
    if (d >= tailStart && d <= tailEnd) {
      midnightCount += r.n;
    }
    if (d >= baselineStart && d <= baselineEnd) {
      baselineTotal += r.n;
      baselineMonths += 1;
    }
  }
  const baselineRate = baselineMonths > 0 ? (baselineTotal / baselineMonths) * 2 : 0;
  return {
    midnightCount,
    baselineRate,
    ratio: baselineRate > 0 ? midnightCount / baselineRate : 0,
  };
}

/** Number of agencies rendered as small multiples. */
const RENDER_TOP_N = 6;
/** Wider pool searched for the finding callout — lets us claim "highest ratio
 *  across the busiest agencies" without paying for an unbounded scan. */
const FINDING_POOL_N = 20;

interface AgencyActivityPanelProps {
  /**
   * When set, the panel renders a SINGLE agency's monthly Final-Rule output
   * (the agency-profile headline) and skips the top-20 ranking pass entirely.
   * When unset, it keeps the original /lab behavior: rank the 20 highest-volume
   * agencies and render the top 6 by midnight-window ratio as small multiples.
   */
  agencyCode?: string;
}

export function AgencyActivityPanel({ agencyCode }: AgencyActivityPanelProps = {}) {
  const { runQuery } = useDuckDB();
  const { getDocumentCountsByAgencyMonth, isReady } = useDuckDBService();
  const single = !!agencyCode;
  const [poolAgencies, setPoolAgencies] = useState<string[]>([]);
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    const R2 = 'https://pub-5fc11ad134984edf8d9af452dd1849d6.r2.dev';

    // Single-agency (profile) path: no ranking pass, just this agency's months.
    if (agencyCode) {
      setPoolAgencies([agencyCode]);
      getDocumentCountsByAgencyMonth(['Rule'], DOMAIN_START_ISO, [agencyCode])
        .then(data => { if (!cancelled) { setRows(data); setLoading(false); } })
        .catch(err => {
          if (cancelled) return;
          console.error('AgencyActivityPanel:', err);
          setError(String(err?.message ?? err));
          setLoading(false);
        });
      return () => { cancelled = true; };
    }

    runQuery<{ agency_code: string; n: number }>(`
      SELECT agency_code, COUNT(*) AS n
      FROM read_parquet('${R2}/documents.parquet')
      WHERE document_type = 'Rule'
        AND TRY_CAST(posted_date AS DATE) >= DATE '${DOMAIN_START_ISO}'
        AND agency_code IS NOT NULL
      GROUP BY 1 ORDER BY n DESC LIMIT ${FINDING_POOL_N}
    `)
      .then(top => {
        if (cancelled) return [];
        const codes = top.map(t => t.agency_code);
        setPoolAgencies(codes);
        return getDocumentCountsByAgencyMonth(['Rule'], DOMAIN_START_ISO, codes);
      })
      .then(data => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('AgencyActivityPanel:', err);
        setError(String(err?.message ?? err));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isReady, agencyCode, runQuery, getDocumentCountsByAgencyMonth]);

  const byAgency = useMemo(() => {
    const map = new Map<string, MonthRow[]>();
    for (const code of poolAgencies) map.set(code, []);
    for (const r of rows) {
      const list = map.get(r.agency_code);
      if (list) list.push(r);
    }
    return map;
  }, [rows, poolAgencies]);

  /** Pool sorted by midnight-window ratio descending. Agencies with no rules
   *  in the window sink to the bottom — ratio is meaningless for them. */
  const rankedByRatio = useMemo(() => {
    return [...poolAgencies].sort((a, b) => {
      const fa = computeFinding(byAgency.get(a) ?? []);
      const fb = computeFinding(byAgency.get(b) ?? []);
      const ra = fa.midnightCount > 0 ? fa.ratio : -1;
      const rb = fb.midnightCount > 0 ? fb.ratio : -1;
      return rb - ra;
    });
  }, [poolAgencies, byAgency]);

  /** Top N by ratio — the panel renders these in that order. */
  const orderedAgencies = useMemo(
    () => rankedByRatio.slice(0, RENDER_TOP_N),
    [rankedByRatio]
  );

  const sharedYMax = useMemo(() => {
    let max = 0;
    for (const code of orderedAgencies) {
      const list = byAgency.get(code) ?? [];
      for (const r of list) if (r.n > max) max = r.n;
    }
    return Math.max(1, max);
  }, [byAgency, orderedAgencies]);

  /** Right edge of the time scale: the first day of the month *after* the most
   *  recent month with data. Combined with left-aligned monthly bars (width =
   *  one month) this makes the rightmost bar's right edge sit exactly on the
   *  right axis, so the admin background can't extend past the data. Falls
   *  back to the end of 2026 if no data has loaded yet. */
  const domainEnd = useMemo(() => {
    let max = '';
    for (const r of rows) if (r.month > max) max = r.month;
    if (!max) return FALLBACK_END;
    const d = new Date(max + 'T00:00:00Z');
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  }, [rows]);

  /** Finding callout = the top-ranked agency (highest ratio in the pool). */
  const finding = useMemo(() => {
    const code = rankedByRatio[0];
    if (!code) return null;
    const f = computeFinding(byAgency.get(code) ?? []);
    return f.midnightCount > 0 && f.baselineRate > 0 ? { code, f } : null;
  }, [rankedByRatio, byAgency]);

  const caption = single ? (
    <>
      <span className="font-medium">Final Rule</span> documents per month at{' '}
      <span className="font-mono-id">{agencyCode}</span>. Blue marks Democratic administrations, red
      Republican; dashed lines mark each January 20 handoff.
    </>
  ) : (
    <>
      Outgoing presidents tend to push a backlog of finalized rules out the door in their final
      weeks. It&rsquo;s known as the &ldquo;midnight regulations&rdquo; surge. Each panel below
      tracks <span className="font-medium">Final Rule</span> documents per month at six agencies
      whose late-Biden output ran furthest above their prior-year baseline, drawn from the 20
      highest-volume agencies of the past decade. Blue marks Democratic administrations, red
      Republican; dashed lines mark each January 20 handoff.
    </>
  );

  return (
    <section className="card card-lg p-6 mb-8">
      <PanelHeader
        label={single ? 'Regulatory output · monthly' : 'Regulatory output by agency'}
        title={single ? 'Final Rule output' : 'The midnight regulation surge'}
        caption={caption}
        finding={
          finding ? (
            <>
              <span className="font-mono-id">{finding.code}</span> finalized{' '}
              <strong>{finding.f.midnightCount}</strong> rules in the last 60 days of the Biden
              administration, about <strong>{finding.f.ratio.toFixed(1)}×</strong> its
              prior-year rate of {finding.f.baselineRate.toFixed(1)} per 60 days.
            </>
          ) : null
        }
      />

      {loading && <div className="text-sm text-[var(--muted)] py-4">Loading agency activity…</div>}
      {error && <div className="text-sm text-[var(--accent-red)] py-2">Error: {error}</div>}

      {!loading && !error && (
        single ? (
          <SmallMultiple
            agencyCode={agencyCode!}
            rows={byAgency.get(agencyCode!) ?? []}
            yMax={sharedYMax}
            domainEnd={domainEnd}
            height={240}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {orderedAgencies.map(code => (
              <SmallMultiple
                key={code}
                agencyCode={code}
                rows={byAgency.get(code) ?? []}
                yMax={sharedYMax}
                domainEnd={domainEnd}
              />
            ))}
          </div>
        )
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        <LegendSwatch color="rgb(var(--party-gop) / 0.12)" label="Republican administration" />
        <LegendSwatch color="rgb(var(--party-dem) / 0.12)" label="Democratic administration" />
        <span>Bar height = Final Rules posted that month. Shared Y-axis across panels.</span>
      </div>
    </section>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-3 h-3 rounded-sm border border-[var(--border)]" style={{ background: color }} />
      {label}
    </span>
  );
}

interface SmallMultipleProps {
  agencyCode: string;
  rows: MonthRow[];
  yMax: number;
  domainEnd: Date;
  /** Chart height. Defaults to the small-multiple height; the single-agency
   *  profile headline passes a taller value. */
  height?: number;
}

const SmallMultiple = memo(function SmallMultiple({ agencyCode, rows, yMax, domainEnd, height = MULTIPLE_H }: SmallMultipleProps) {
  const info = getAgencyInfo(agencyCode);
  const finding = useMemo(() => computeFinding(rows), [rows]);

  return (
    <Card interactive={false} className="p-3">
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="font-mono-id" style={{ color: 'var(--accent-primary)' }}>{agencyCode}</div>
          <div className="text-xs text-[var(--muted)] truncate max-w-[220px]" title={info.name}>
            {info.name}
          </div>
        </div>
        <div className="text-right text-[10px] text-[var(--muted)] leading-tight">
          {finding.midnightCount > 0 ? (
            <>
              <div className="text-[var(--foreground)] font-semibold">
                {finding.midnightCount} rules
              </div>
              <div>last 60d of Biden</div>
              {finding.ratio > 0 && finding.baselineRate > 0 && (
                <div className="text-[var(--accent-amber)] font-medium mt-0.5">
                  {finding.ratio.toFixed(1)}× baseline
                </div>
              )}
            </>
          ) : (
            <div>no rules in window</div>
          )}
        </div>
      </div>

      <ParentSize>
        {({ width }) => {
          const w = Math.max(MULTIPLE_MIN_W, width);
          return (
            <SmallMultipleChart
              agencyCode={agencyCode}
              rows={rows}
              yMax={yMax}
              domainEnd={domainEnd}
              height={height}
              width={w}
            />
          );
        }}
      </ParentSize>
    </Card>
  );
});

interface SmallMultipleChartProps extends SmallMultipleProps {
  width: number;
}

function SmallMultipleChart({ agencyCode, rows, yMax, domainEnd, width, height = MULTIPLE_H }: SmallMultipleChartProps) {
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const xScale = useMemo(
    () => scaleTime({ domain: [DOMAIN_START, domainEnd], range: [0, innerW] }),
    [innerW, domainEnd]
  );
  const yScale = useMemo(
    () => scaleLinear({ domain: [0, yMax], range: [innerH, 0], nice: true }),
    [innerH, yMax]
  );

  // Months span: bars are positioned with their left edge at the month start
  // and width equal to the pixel distance between consecutive months. This
  // makes the rightmost bar align flush with the right axis so the admin
  // background can't visually extend past the data.
  const totalMonths = Math.max(
    1,
    (domainEnd.getUTCFullYear() - DOMAIN_START.getUTCFullYear()) * 12 +
      (domainEnd.getUTCMonth() - DOMAIN_START.getUTCMonth())
  );
  const barSlot = innerW / totalMonths;
  const barWidth = Math.max(1, barSlot - 0.5);

  return (
    <svg width={width} height={height} role="img" aria-label={`${agencyCode} final rules per month`}>
      <Group left={MARGIN.left} top={MARGIN.top}>
        <AdminBands xScale={xScale} height={innerH} />
        {rows.map(r => {
          const d = new Date(r.month + 'T00:00:00Z');
          const x = xScale(d);
          const y = yScale(r.n);
          const h = innerH - y;
          return (
            <Bar
              key={r.month}
              x={x}
              y={y}
              width={barWidth}
              height={h}
              fill="var(--accent-primary)"
            >
              <title>{`${r.month.slice(0, 7)}: ${r.n} rules`}</title>
            </Bar>
          );
        })}
        <AxisBottom
          top={innerH}
          scale={xScale}
          numTicks={4}
          tickStroke="var(--muted)"
          stroke="var(--border)"
          tickLabelProps={() => ({
            fill: 'var(--muted)',
            fontSize: 9,
            textAnchor: 'middle',
          })}
        />
        <AxisLeft
          scale={yScale}
          numTicks={3}
          tickStroke="var(--muted)"
          stroke="var(--border)"
          tickLabelProps={() => ({
            fill: 'var(--muted)',
            fontSize: 9,
            textAnchor: 'end',
            dx: '-0.25em',
            dy: '0.25em',
          })}
        />
      </Group>
    </svg>
  );
}
