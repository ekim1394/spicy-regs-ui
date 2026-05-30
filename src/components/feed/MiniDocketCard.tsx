'use client';

import Link from 'next/link';
import { getAgencyInfo } from '@/lib/agencyMetadata';
import type { Docket } from '@/lib/search/types';

interface MiniDocketCardProps {
  docket: Docket;
}

/**
 * Quiet related-docket row for the docket-page rail: borderless, muted, and
 * secondary — a discovery aside, not a stack of cards competing with the
 * docket's own content. The title lifts to full foreground only on hover.
 */
export function MiniDocketCard({ docket }: MiniDocketCardProps) {
  const agency = getAgencyInfo(docket.agencyCode);
  const href = `/sr/${docket.agencyCode}/${encodeURIComponent(docket.docketId)}`;

  return (
    <Link
      href={href}
      className="group block min-w-0 -mx-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface-elevated)]"
    >
      <div className="flex items-center gap-1.5 text-[11px] mb-0.5">
        <span className="font-medium" style={{ color: agency.color }}>
          sr/{docket.agencyCode}
        </span>
        <span className="font-mono-id text-[var(--muted-foreground)] truncate">{docket.docketId}</span>
      </div>
      <p className="text-xs text-[var(--muted)] leading-snug line-clamp-2 transition-colors group-hover:text-[var(--foreground)]">
        {docket.title}
      </p>
    </Link>
  );
}
