'use client';

import { useState, useEffect, useMemo } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { AgenciesTable } from '@/components/agencies/AgenciesTable';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import { getAllKnownAgenciesByDept } from '@/lib/agencyMetadata';

export default function AgenciesPage() {
  const { getAllAgencyCounts, getAgencyMonthlyVolumeBatch, isReady } = useDuckDBService();

  // Department-grouped agency list comes from bundled JSON — instant, no DuckDB.
  const groups = useMemo(() => getAllKnownAgenciesByDept(), []);
  const allCodes = useMemo(
    () => groups.flatMap((g) => g.agencies.map((a) => a.code)),
    [groups],
  );

  // Counts (cheap: docket + comment-index GROUP BYs) drive the table rows and
  // paint first. Sparklines render flat until volume lands.
  const { data: countsData } = useAsyncData(() => getAllAgencyCounts(), []);
  const counts = countsData ?? {};

  // Sparklines stay custom: the one batched scan (full documents.parquet, ~57MB)
  // is deferred to idle so the directory is interactive before it runs. Cached
  // results make repeat visits instant regardless.
  const [volume, setVolume] = useState<Map<string, { month: string; n: number }[]>>(new Map());

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    const fire = () => {
      getAgencyMonthlyVolumeBatch(allCodes, 12)
        .then((v) => { if (!cancelled) setVolume(v); })
        .catch((err) => console.error('agency volume:', err));
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fire, { timeout: 2000 });
    } else {
      setTimeout(fire, 0);
    }
    return () => { cancelled = true; };
  }, [isReady, allCodes, getAgencyMonthlyVolumeBatch]);

  return (
    <PageShell maxWidth="4xl">
      <SectionLabel label="Directory" />
      <h1 className="font-serif text-3xl text-[var(--foreground)] mt-1 mb-5">Agencies</h1>

      <AgenciesTable groups={groups} counts={counts} volume={volume} />
    </PageShell>
  );
}
