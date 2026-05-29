'use client';

import { useState, useEffect, useMemo } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { AgenciesTable } from '@/components/agencies/AgenciesTable';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { getAllKnownAgenciesByDept } from '@/lib/agencyMetadata';

export default function AgenciesPage() {
  const { getAllAgencyCounts, getAgencyMonthlyVolumeBatch, isReady } = useDuckDBService();

  // Department-grouped agency list comes from bundled JSON — instant, no DuckDB.
  const groups = useMemo(() => getAllKnownAgenciesByDept(), []);
  const allCodes = useMemo(
    () => groups.flatMap((g) => g.agencies.map((a) => a.code)),
    [groups],
  );

  const [counts, setCounts] = useState<Record<string, { dockets: number; comments: number }>>({});
  const [volume, setVolume] = useState<Map<string, { month: string; n: number }[]>>(new Map());

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    // Two queries total — counts (docket + comment GROUP BYs) and ONE batched
    // monthly-volume call for every agency's sparkline. No per-row fan-out.
    getAllAgencyCounts()
      .then((c) => { if (!cancelled) setCounts(c); })
      .catch((err) => console.error('agency counts:', err));
    getAgencyMonthlyVolumeBatch(allCodes, 12)
      .then((v) => { if (!cancelled) setVolume(v); })
      .catch((err) => console.error('agency volume:', err));
    return () => { cancelled = true; };
  }, [isReady, allCodes, getAllAgencyCounts, getAgencyMonthlyVolumeBatch]);

  return (
    <PageShell maxWidth="5xl" mainClassName="max-w-5xl mx-auto px-4 py-8">
      <SectionLabel label="Directory" />
      <h1 className="font-serif text-3xl text-[var(--foreground)] mt-1 mb-5">Agencies</h1>

      <AgenciesTable groups={groups} counts={counts} volume={volume} />
    </PageShell>
  );
}
