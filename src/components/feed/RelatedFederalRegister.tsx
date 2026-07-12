'use client';

import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { MiniFRCard } from './MiniFRCard';

const RELATED_LIMIT = 5;

interface RelatedFederalRegisterProps {
  docketId: string;
}

/**
 * "Federal Register Publications" section on the docket detail page.
 *
 * Queries federal_register.parquet for any FR document whose docket_ids_json
 * contains this docketId. Fail-soft: renders nothing if DuckDB isn't ready or
 * there are no matches (or a query error — this is a supplementary section, so
 * it simply disappears rather than showing an error card).
 *
 * Mirrors RelatedDockets.tsx structurally but uses a DuckDB query instead of
 * the MiniSearch index — the FR dataset is too large for a client-side index.
 */
export function RelatedFederalRegister({ docketId }: RelatedFederalRegisterProps) {
  const { getFRPublicationsForDocket } = useDuckDBService();
  const { data: docs } = useAsyncData(
    () => getFRPublicationsForDocket(docketId, RELATED_LIMIT),
    [docketId],
    { enabled: !!docketId, placeholderData: [] },
  );

  if (!docs || docs.length === 0) return null;

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
