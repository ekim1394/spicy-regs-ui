'use client';

import Link from 'next/link';
import { DemoPill } from '@/components/ui/DemoPill';

interface DemoCalloutProps {
  agencyCode: string;
  docketId: string;
}

/**
 * Honest-by-design callout for the one place the data mirror falls shortest:
 * comments don't link to specific documents, so the Document page can't show
 * "the N comments on this proposed rule." The dashed amber region owns that gap
 * instead of hiding it, and routes the reader to the docket-level comments.
 */
export function DemoCallout({ agencyCode, docketId }: DemoCalloutProps) {
  return (
    <div
      className="rounded-md border border-dashed p-4"
      style={{
        borderColor: 'color-mix(in srgb, var(--accent-amber) 40%, transparent)',
        background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)',
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <DemoPill />
        <span className="text-sm font-semibold text-[var(--accent-amber)]">
          Per-document comment filtering pending
        </span>
      </div>
      <p className="text-xs text-[var(--muted)] mb-2.5 leading-relaxed">
        Comments don&apos;t link to specific documents in the data mirror yet, so this page can&apos;t
        show &ldquo;the comments on this proposed rule.&rdquo;
      </p>
      <Link
        href={`/sr/${agencyCode}/${encodeURIComponent(docketId)}?tab=comments`}
        className="text-xs font-semibold text-[var(--accent-primary)]"
      >
        See all comments on the parent docket →
      </Link>
    </div>
  );
}
