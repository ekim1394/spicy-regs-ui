'use client';

import { useEffect, useState } from 'react';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { flattenSignals, type DiscoverySignal } from './signals';
import { SignalCard } from './SignalCard';

interface DiscoveryRailProps {
  /**
   * When true the rail is suppressed — signals describe the whole dataset, so
   * they're noise once the user has narrowed the feed with a filter.
   */
  filtersActive?: boolean;
}

/**
 * "Worth a look" — a horizontally-scrolling shelf of registered signals
 * (comment surge, closing soon, output spike, most discussed), each a doorway
 * to a different facet. Generalises the old trending shelf: new signal types
 * plug into the registry (signals.ts) without touching the feed river.
 *
 * Hides entirely when a filter is active, while loading, or if no signals fire.
 */
export function DiscoveryRail({ filtersActive = false }: DiscoveryRailProps) {
  const { getDiscoverySignals, isReady } = useDuckDBService();
  const [signals, setSignals] = useState<DiscoverySignal[]>([]);

  useEffect(() => {
    if (!isReady || filtersActive) return;
    let cancelled = false;
    getDiscoverySignals()
      .then((result) => { if (!cancelled) setSignals(flattenSignals(result)); })
      .catch((err) => console.error('DiscoveryRail:', err));
    return () => { cancelled = true; };
  }, [isReady, filtersActive, getDiscoverySignals]);

  if (filtersActive || signals.length === 0) return null;

  return (
    <section className="mb-4">
      <div className="flex items-baseline gap-2.5 mb-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Worth a look
        </span>
        <span className="text-[10.5px] text-[var(--muted-foreground)]">
          signals across the data · refreshed daily
        </span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        {signals.map((signal, i) => (
          <SignalCard key={`${signal.kind}-${i}`} signal={signal} />
        ))}
      </div>
    </section>
  );
}
