'use client';

import { useMemo } from 'react';
import { Group } from '@visx/group';
import { AreaClosed, LinePath } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { ParentSize } from '@visx/responsive';

interface Point { day: string; n: number; }

const HEIGHT = 150;
const MARGIN = { top: 8, right: 12, bottom: 22, left: 34 };

/**
 * Daily comment-volume area chart for the Comments tab. Backed by
 * getCommentVolumeByDay(docketId). Reveals the *shape* of public response
 * (slow burn vs. a single-day orchestrated spike) before the threads below.
 */
export function CommentVolumeChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return (
      <div className="h-[120px] flex items-center justify-center text-xs text-[var(--muted)]">
        No dated comments to chart.
      </div>
    );
  }
  return (
    <ParentSize>
      {({ width }) => <Chart data={data} width={Math.max(240, width)} />}
    </ParentSize>
  );
}

function Chart({ data, width }: { data: Point[]; width: number }) {
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const points = useMemo(
    () => data.map((d) => ({ date: new Date(d.day + 'T00:00:00Z'), n: d.n })),
    [data],
  );

  const xScale = useMemo(() => {
    const dates = points.map((p) => p.date.getTime());
    return scaleTime({
      domain: [new Date(Math.min(...dates)), new Date(Math.max(...dates))],
      range: [0, innerW],
    });
  }, [points, innerW]);

  const yScale = useMemo(
    () => scaleLinear({ domain: [0, Math.max(1, ...points.map((p) => p.n))], range: [innerH, 0], nice: true }),
    [points, innerH],
  );

  return (
    <svg width={width} height={HEIGHT} role="img" aria-label="Daily comment volume">
      <Group left={MARGIN.left} top={MARGIN.top}>
        <AreaClosed
          data={points}
          x={(p) => xScale(p.date)}
          y={(p) => yScale(p.n)}
          yScale={yScale}
          fill="var(--accent-primary)"
          fillOpacity={0.15}
        />
        <LinePath
          data={points}
          x={(p) => xScale(p.date)}
          y={(p) => yScale(p.n)}
          stroke="var(--accent-primary)"
          strokeWidth={1.5}
        />
        <AxisBottom
          top={innerH}
          scale={xScale}
          numTicks={4}
          stroke="var(--border)"
          tickStroke="var(--border)"
          tickLabelProps={() => ({ fill: 'var(--muted)', fontSize: 9, textAnchor: 'middle' })}
        />
        <AxisLeft
          scale={yScale}
          numTicks={3}
          stroke="var(--border)"
          tickStroke="var(--border)"
          tickLabelProps={() => ({ fill: 'var(--muted)', fontSize: 9, textAnchor: 'end', dx: '-0.25em', dy: '0.25em' })}
        />
      </Group>
    </svg>
  );
}
