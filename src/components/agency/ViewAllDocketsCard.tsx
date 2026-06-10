'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { getAgencyInfo } from '@/lib/agencyMetadata';

/**
 * Full-width CTA at the bottom of the agency profile that opens the feed
 * filtered to this agency (`/feed?agency=CODE`) — the same destination as the
 * masthead's "View all dockets" button, repeated as an end-cap so the reader
 * has a next step after scrolling the page.
 */
export function ViewAllDocketsCard({ agencyCode }: { agencyCode: string }) {
  const agency = useMemo(() => getAgencyInfo(agencyCode), [agencyCode]);

  return (
    <Card asChild className="p-5 flex items-center gap-4 mb-8">
      <Link href={`/feed?agency=${agencyCode}`}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--foreground)]">View all dockets</div>
          <div className="text-xs text-[var(--muted)] mt-0.5">
            Browse every docket from {agency.name} in the feed.
          </div>
        </div>
        <span className="flex-none inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-primary)]">
          Open feed →
        </span>
      </Link>
    </Card>
  );
}
