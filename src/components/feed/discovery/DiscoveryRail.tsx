'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
 *
 * A soft gradient on the right edge hints that the shelf scrolls; it fades out
 * once you reach the end, and a matching left fade appears once you've scrolled
 * away from the start — so the affordance is only shown when it's actually true.
 */
export function DiscoveryRail({ filtersActive = false }: DiscoveryRailProps) {
  const { getDiscoverySignals, isReady } = useDuckDBService();
  const [signals, setSignals] = useState<DiscoverySignal[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  useEffect(() => {
    if (!isReady || filtersActive) return;
    let cancelled = false;
    getDiscoverySignals()
      .then((result) => { if (!cancelled) setSignals(flattenSignals(result)); })
      .catch((err) => console.error('DiscoveryRail:', err));
    return () => { cancelled = true; };
  }, [isReady, filtersActive, getDiscoverySignals]);

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowStart(scrollLeft > 1);
    setShowEnd(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateEdges();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      window.removeEventListener('resize', updateEdges);
    };
  }, [updateEdges, signals.length]);

  if (filtersActive || signals.length === 0) return null;

  return (
    <section className="mb-4">
      <SectionLabel
        label="Notable activity"
        caption="comment surges, closing windows, and the most-discussed dockets · updated daily"
        className="mb-2.5"
      />
      {/* The -mx-1/px-1 trick lives on this wrapper (not the scroller) so the
          edge fades, pinned to its left-0/right-0, line up with the true scroll
          edge instead of sitting 4px short of it. */}
      <div className="relative -mx-1">
        <div
          ref={scrollerRef}
          className="flex gap-2.5 overflow-x-auto pb-1 px-1"
        >
          {signals.map((signal, i) => (
            <SignalCard key={`${signal.kind}-${i}`} signal={signal} />
          ))}
        </div>

        {/* Edge fades — purely decorative, never intercept scroll/clicks. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[var(--background)] to-transparent transition-opacity duration-200 ${
            showStart ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--background)] to-transparent transition-opacity duration-200 ${
            showEnd ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    </section>
  );
}
