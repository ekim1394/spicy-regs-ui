'use client';

import { useEffect, useState } from 'react';
import { Sparkline } from '@/components/ui/Sparkline';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import type { SpikeSignal } from '../signals';

/**
 * Output-spike readout: a tiny monthly document-volume sparkline + the ratio
 * of the last 30 days to the agency's prior-year monthly mean. Only a handful
 * of spike cards render, so each fetching its own 12-month series is cheap.
 */
export function Spike({ data }: { data: SpikeSignal }) {
  const { getAgencyMonthlyVolume, isReady } = useDuckDBService();
  const [series, setSeries] = useState<number[]>([]);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    getAgencyMonthlyVolume(data.agencyCode, 12)
      .then((rows) => { if (!cancelled) setSeries(rows.map((r) => r.n)); })
      .catch((err) => console.error('Spike readout:', err));
    return () => { cancelled = true; };
  }, [isReady, data.agencyCode, getAgencyMonthlyVolume]);

  return (
    <div className="flex items-center gap-2">
      <Sparkline data={series} width={52} height={18} />
      <span className="text-[11px] font-bold" style={{ color: 'var(--accent-primary)' }}>
        {data.ratio.toFixed(1)}× rate
      </span>
    </div>
  );
}
