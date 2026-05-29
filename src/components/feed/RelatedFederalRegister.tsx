'use client';

import { useEffect, useState } from 'react';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { MiniFRCard } from './MiniFRCard';
import type { FederalRegisterDoc } from '@/lib/fr/types';

const RELATED_LIMIT = 5;

interface RelatedFederalRegisterProps {
  docketId: string;
}

/**
 * "Federal Register Publications" section on the docket detail page.
 *
 * Queries federal_register.parquet for any FR document whose docket_ids_json
 * contains this docketId. Fail-soft: renders nothing if DuckDB isn't ready or
 * there are no matches.
 *
 * Mirrors RelatedDockets.tsx structurally but uses a DuckDB query instead of
 * the MiniSearch index — the FR dataset is too large for a client-side index.
 */
export function RelatedFederalRegister({ docketId }: RelatedFederalRegisterProps) {
  const { getFRPublicationsForDocket, isReady } = useDuckDBService();
  const [docs, setDocs] = useState<FederalRegisterDoc[]>([]);

  useEffect(() => {
    if (!isReady || !docketId) return;
    let cancelled = false;
    getFRPublicationsForDocket(docketId, RELATED_LIMIT)
      .then((rows) => {
        if (!cancelled) setDocs(rows);
      })
      .catch(() => {
        // Fail-soft: section just won't render.
        if (!cancelled) setDocs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isReady, docketId, getFRPublicationsForDocket]);

  if (docs.length === 0) return null;

  return (
    <section>
      <SectionLabel label="Federal Register publications" caption={docs.length} className="mb-2" />
      <div className="flex flex-col gap-2">
        {docs.map((d) => (
          <MiniFRCard key={d.documentNumber} doc={d} />
        ))}
      </div>
    </section>
  );
}
