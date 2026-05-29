'use client';

import { useMemo } from 'react';
import { scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';

export interface SparklineProps {
  /** Series values, oldest → newest. */
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
}

/**
 * Minimal Visx line sparkline. Used by the DiscoveryRail "output spike"
 * readout and the Agencies directory's 12-month volume column. Renders a flat
 * baseline for empty/degenerate series so it never throws.
 */
export function Sparkline({
  data,
  width = 90,
  height = 20,
  strokeWidth = 1.5,
  color = 'var(--accent-primary)',
  className = '',
}: SparklineProps) {
  const points = useMemo(() => data.map((d, i) => ({ i, d })), [data]);

  const xScale = useMemo(
    () => scaleLinear({ domain: [0, Math.max(1, data.length - 1)], range: [1, width - 1] }),
    [data.length, width],
  );
  const yScale = useMemo(
    () => scaleLinear({ domain: [0, Math.max(1, ...data)], range: [height - 1, 1] }),
    [data, height],
  );

  if (data.length < 2) {
    // Degenerate series → flat midline (still communicates "sparkline slot").
    const midY = height / 2;
    return (
      <svg width={width} height={height} className={className} aria-hidden>
        <line x1={1} y1={midY} x2={width - 1} y2={midY} stroke={color} strokeWidth={strokeWidth} opacity={0.5} />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <LinePath
        data={points}
        x={(p) => xScale(p.i)}
        y={(p) => yScale(p.d)}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
      />
    </svg>
  );
}
