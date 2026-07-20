'use client';

import Link from 'next/link';

import { SectionLabel } from '@/components/ui/SectionLabel';
import { MiniSourceCard } from '@/components/sources/MiniSourceCard';
import { useSourceQueries } from '@/lib/duckdb/useSourceQueries';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import { getAgencyInfo } from '@/lib/agencyMetadata';

const RELATED_LIMIT = 4;

interface AgencyLitigationProps {
  agencyCode: string;
}

/**
 * "APA litigation" section on the agency profile: recent court dockets (from
 * the CourtListener nature-of-suit-899 corpus) whose case name mentions the
 * agency's full name.
 *
 * Court dockets carry no agency code, so this is a full-name substring match
 * — and it only runs when a real full name is known. A bare code fallback
 * ("EPA") would substring-match unrelated words ("D-epa-rtment"), so unknown
 * agencies render nothing. Fail-soft like the other related panels.
 */
export function AgencyLitigation({ agencyCode }: AgencyLitigationProps) {
  const info = getAgencyInfo(agencyCode);
  // getAgencyInfo falls back to name === code for unknown agencies.
  const fullName = info.name !== info.code && info.name.length >= 8 ? info.name : null;

  const { getLitigationForAgency } = useSourceQueries();
  const { data: cards } = useAsyncData(
    () => getLitigationForAgency(fullName!, RELATED_LIMIT),
    [fullName],
    { enabled: !!fullName, placeholderData: [] },
  );

  if (!fullName || !cards || cards.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-2">
        <SectionLabel label="APA litigation" caption={cards.length} />
        <Link
          href={`/sources/court-dockets?q=${encodeURIComponent(fullName)}`}
          className="text-xs text-[var(--accent-primary)] hover:underline whitespace-nowrap"
        >
          View all →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cards.map((card) => (
          <MiniSourceCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}
