'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import { getAgencyInfo, getParentDept, formatCount } from '@/lib/agencyMetadata';

export interface AgencyMastheadProps {
  /** Agency code, e.g. "EPA". */
  agencyCode: string;
}

/**
 * Full-width identity masthead for the Agency Profile page (`/sr/:code`).
 *
 * This is the page's subject statement — name, sr/CODE handle, parent
 * department, mission, and scale (dockets / documents / comments) — so it
 * leads the page on every breakpoint, ahead of the actionable lists and the
 * interpretive lab viz below it. The compact vertical `AgencyIdentity` card
 * is still used for the *rail* treatment on the Docket page; the profile uses
 * this horizontal band instead of burying identity in a side rail.
 */
export function AgencyMasthead({ agencyCode }: AgencyMastheadProps) {
  const agency = useMemo(() => getAgencyInfo(agencyCode), [agencyCode]);
  const dept = useMemo(() => getParentDept(agencyCode), [agencyCode]);

  const { getAgencyStats } = useDuckDBService();
  // Stats degrade gracefully to "—" while loading or on error — the masthead is
  // an identity band, so a failed count shouldn't blow up the header layout.
  const { data: stats } = useAsyncData(
    () => getAgencyStats(agencyCode), [agencyCode], { enabled: !!agencyCode },
  );

  return (
    <Card variant="gradient" className="overflow-hidden mb-8">
      {/* Agency-tinted wash */}
      <div
        className="h-16"
        style={{ background: `linear-gradient(135deg, ${agency.color}33, ${agency.color}0f)` }}
      />

      <div className="px-6 pb-6 -mt-9">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <Avatar
            name={agency.name}
            src={agency.favicon}
            color={agency.color}
            fallback={agency.shortName}
            size="xl"
            className="border-2 border-[var(--surface)]"
          />

          <div className="flex-1 min-w-0 sm:pb-1">
            <h1 className="font-serif text-2xl text-[var(--foreground)] leading-tight"
                style={{ letterSpacing: '-0.01em' }}>
              {agency.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs">
              <span className="font-semibold text-[var(--accent-primary)]">
                sr/{agencyCode}
              </span>
              <span className="text-[var(--border)]">·</span>
              <span className="text-[var(--muted)]">{dept}</span>
            </div>
          </div>

          <Button asChild variant="primary" className="text-sm sm:self-end flex-none">
            <Link href={`/feed?agency=${agencyCode}`}>View all dockets →</Link>
          </Button>
        </div>

        <p className="text-sm text-[var(--muted)] leading-relaxed mt-4 max-w-3xl">
          {agency.description}
        </p>

        {/* Scale: dockets · documents · comments */}
        <div className="flex flex-wrap gap-x-8 gap-y-3 mt-5">
          <Stat label="dockets" value={stats?.docketCount} />
          <Stat label="documents" value={stats?.documentCount} />
          <Stat label="comments" value={stats?.commentCount} />
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <div className="text-xl font-bold text-[var(--foreground)] leading-none">
        {value === undefined ? '—' : formatCount(value)}
      </div>
      <div className="text-[10px] text-[var(--muted)] mt-1">{label}</div>
    </div>
  );
}
