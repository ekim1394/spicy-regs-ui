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
  /**
   * Accessible label describing the trend. When set the chart is exposed as
   * `role="img"`; when omitted it's decorative (`aria-hidden`) on the assumption
   * the surrounding row already states the underlying numbers.
   */
  ariaLabel?: string;
}

/**
 * Minimal Visx line sparkline. Renders a flat baseline for empty/degenerate
 * series so it never throws.
 */
export function Sparkline({
  data,
  width = 90,
  height = 20,
  strokeWidth = 1.5,
  color = 'var(--accent-primary)',
  className = '',
  ariaLabel,
}: SparklineProps) {
  const a11y = ariaLabel ? { role: 'img' as const, 'aria-label': ariaLabel } : { 'aria-hidden': true };
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
      <svg width={width} height={height} className={className} {...a11y}>
        <line x1={1} y1={midY} x2={width - 1} y2={midY} stroke={color} strokeWidth={strokeWidth} opacity={0.5} />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} className={className} {...a11y}>
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
