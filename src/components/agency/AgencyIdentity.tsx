'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { getAgencyInfo, getParentDept, formatCount } from '@/lib/agencyMetadata';

interface AgencyStats {
  docketCount: number;
  documentCount: number;
  commentCount: number;
}

export interface AgencyIdentityProps {
  /** Agency code, e.g. "EPA". */
  agencyCode: string;
  /** Small label on the card frame ("Agency" on the docket page, "About" on the profile). */
  label?: string;
  /** CTA text, e.g. "View agency profile →". */
  cta: string;
  /** CTA destination. Defaults to the agency profile (`/sr/CODE`). */
  href?: string;
  /** Render the CTA as a primary (filled) button rather than a bordered one. */
  pri?: boolean;
  /**
   * Pre-fetched stats. When omitted, the card fetches its own via
   * getAgencyStats — so a caller that already has stats can avoid the extra
   * round-trip, but the common case stays a one-liner.
   */
  stats?: AgencyStats;
}

/**
 * Unified agency identity card — the single "who is this agency" treatment
 * shared by the right rail of the Docket page and the Agency Profile page.
 * Agency-tinted wash + avatar + serif name + sr/CODE handle + parent
 * department + blurb + (dockets, comments) stat pair + CTA.
 *
 * Only `label`, `cta`, `href`, and `pri` vary by context — the body is
 * identical on both pages so the rail never jumps treatment between them.
 */
export function AgencyIdentity({
  agencyCode,
  label,
  cta,
  href,
  pri = false,
  stats: statsProp,
}: AgencyIdentityProps) {
  const agency = useMemo(() => getAgencyInfo(agencyCode), [agencyCode]);
  const dept = useMemo(() => getParentDept(agencyCode), [agencyCode]);
  const ctaHref = href ?? `/sr/${agencyCode}`;

  // Some agencies ARE their own parent department (e.g. EPA → "Environmental
  // Protection Agency"), so the dept line would just echo the name. Suppress it
  // in that case rather than printing the agency name twice.
  const showDept = dept && dept !== agency.name;

  const { getAgencyStats, isReady } = useDuckDBService();
  const [fetched, setFetched] = useState<AgencyStats | undefined>();
  const stats = statsProp ?? fetched;

  useEffect(() => {
    if (statsProp || !isReady || !agencyCode) return;
    let cancelled = false;
    getAgencyStats(agencyCode)
      .then((s) => { if (!cancelled) setFetched(s); })
      .catch((err) => console.error('AgencyIdentity stats:', err));
    return () => { cancelled = true; };
  }, [statsProp, isReady, agencyCode, getAgencyStats]);

  return (
    <Card variant="gradient" className="relative overflow-hidden">
      {/* Agency-tinted wash banner — the avatar below overlaps its lower edge.
          The optional label sits over the banner as a corner caption rather
          than stacked above it, so the docket page reads identically to the
          profile page instead of opening a faint empty band above the badge. */}
      <div
        className="h-14"
        style={{ background: `linear-gradient(135deg, ${agency.color}33, ${agency.color}0f)` }}
      />
      {label && (
        <SectionLabel label={label} className="absolute top-0 left-0 px-4 pt-3" />
      )}

      <div className="px-4 pb-4 -mt-6">
        <Avatar
          name={agency.name}
          src={agency.favicon}
          color={agency.color}
          fallback={agency.shortName}
          size="lg"
          className="border-2 border-[var(--surface)]"
        />

        <h3 className="text-base font-semibold text-[var(--foreground)] mt-2 leading-snug">
          {agency.name}
        </h3>
        <div className="text-xs font-semibold text-[var(--accent-primary)]">
          sr/{agencyCode}
        </div>
        {showDept && <div className="text-[11px] text-[var(--muted)] mt-1">{dept}</div>}

        <p className="text-xs text-[var(--muted)] leading-relaxed mt-3 mb-4 line-clamp-3"
           style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {agency.description}
        </p>

        {/* (dockets, comments) stat pair */}
        <div className="flex gap-5 mb-4">
          <div>
            <div className="text-base font-bold text-[var(--foreground)]">
              {stats ? formatCount(stats.docketCount) : '—'}
            </div>
            <div className="text-[10px] text-[var(--muted)]">dockets</div>
          </div>
          <div>
            <div className="text-base font-bold text-[var(--foreground)]">
              {stats ? formatCount(stats.commentCount) : '—'}
            </div>
            <div className="text-[10px] text-[var(--muted)]">comments</div>
          </div>
        </div>

        <Button asChild variant={pri ? 'primary' : 'secondary'} className="w-full text-sm">
          <Link href={ctaHref}>{cta}</Link>
        </Button>
      </div>
    </Card>
  );
}
