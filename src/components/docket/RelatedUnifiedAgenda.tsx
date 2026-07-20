'use client';

import { SectionLabel } from '@/components/ui/SectionLabel';
import { MiniSourceCard } from '@/components/sources/MiniSourceCard';
import { useSourceQueries } from '@/lib/duckdb/useSourceQueries';
import { useAsyncData } from '@/lib/hooks/useAsyncData';

const RELATED_LIMIT = 5;

interface RelatedUnifiedAgendaProps {
  docketId: string;
}

/**
 * "Planned rulemaking" section on the docket detail page: the docket's
 * Unified Agenda entries, reached through its Federal Register documents'
 * RINs (the only machine key between regulations.gov dockets and the agenda).
 *
 * Fail-soft like RelatedFederalRegister: most dockets have no RIN chain, so
 * the section simply doesn't render rather than showing an empty state.
 */
export function RelatedUnifiedAgenda({ docketId }: RelatedUnifiedAgendaProps) {
  const { getAgendaForDocket } = useSourceQueries();
  const { data: cards } = useAsyncData(
    () => getAgendaForDocket(docketId, RELATED_LIMIT),
    [docketId],
    { enabled: !!docketId, placeholderData: [] },
  );

  if (!cards || cards.length === 0) return null;

  return (
    <section>
      <SectionLabel
        label="Planned rulemaking"
        caption="Unified Agenda"
        className="mb-2"
      />
      <div className="flex flex-col gap-2">
        {cards.map((card) => (
          <MiniSourceCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}
