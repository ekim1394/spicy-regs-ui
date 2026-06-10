import { Group } from '@visx/group';
import type { ScaleTime } from 'd3-scale';
import { ADMIN_ERAS, partyColor } from './adminTransitions';

interface AdminBandsProps {
  xScale: ScaleTime<number, number>;
  height: number;
}

/**
 * Renders translucent rectangles across the chart background for each
 * presidential era, plus dashed vertical lines at the transition dates.
 */
export function AdminBands({ xScale, height }: AdminBandsProps) {
  const domain = xScale.domain();
  const dMin = domain[0];
  const dMax = domain[1];

  return (
    <Group>
      {ADMIN_ERAS.map(era => {
        if (era.end < dMin || era.start > dMax) return null;
        const s = era.start < dMin ? dMin : era.start;
        const e = era.end > dMax ? dMax : era.end;
        const x = xScale(s);
        const w = Math.max(0, xScale(e) - x);
        return (
          <rect
            key={era.president}
            x={x}
            y={0}
            width={w}
            height={height}
            style={{ fill: partyColor(era.party) }}
            pointerEvents="none"
          />
        );
      })}
      {ADMIN_ERAS.map(era => {
        if (era.start < dMin || era.start > dMax) return null;
        const x = xScale(era.start);
        return (
          <line
            key={`line-${era.president}`}
            x1={x}
            x2={x}
            y1={0}
            y2={height}
            stroke="var(--muted)"
            strokeDasharray="3 3"
            strokeWidth={1}
            opacity={0.45}
            pointerEvents="none"
          />
        );
      })}
    </Group>
  );
}
