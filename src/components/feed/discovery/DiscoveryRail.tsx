'use client';

import { useEffect, useState } from 'react';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { SectionLabel } from '@/components/ui/SectionLabel';
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
 * to a different facet. New signal types plug into the registry (signals.ts)
 * without touching the feed river.
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
      <SectionLabel
        label="Notable activity"
        caption="comment surges, closing windows, and the most-discussed dockets · updated daily"
        className="mb-2.5"
      />
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        {signals.map((signal, i) => (
          <SignalCard key={`${signal.kind}-${i}`} signal={signal} />
        ))}
      </div>
    </section>
  );
}
