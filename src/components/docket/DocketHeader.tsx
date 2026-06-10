'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { DocketSummary } from '@/components/docket/DocketSummary';

export interface DocketHeaderProps {
  agencyCode: string;
  docketId: string;
  title: string;
  docketType?: string;
  /** Docket abstract, rendered (clamped, with a Read more toggle) below the title. */
  abstract?: string;
}

/**
 * Persistent docket identity, sitting ABOVE the tabs and constant on every tab.
 * Read top-to-bottom by importance: a faint metadata line (agency · type · id),
 * then the title. Deliberately lean — the lifecycle rail lives in its own
 * "Timeline" section in the Overview tab, the agency face + stats live once in
 * the right-rail AgencyIdentity card, and the abstract lives once in Overview's
 * Summary. This header doesn't repeat any of them.
 *
 * No RIN row — the data mirror drops the RIN field, and the docket ID already
 * identifies the rulemaking.
 */
export function DocketHeader({
  agencyCode,
  docketId,
  title,
  docketType,
  abstract,
}: DocketHeaderProps) {
  return (
    <Card variant="gradient" interactive={false} className="p-5">
      {/* Identity, demoted to a single faint metadata line: agency (link) · type · id */}
      <div className="flex items-center gap-1.5 mb-1.5 text-xs text-[var(--muted)]">
        <Link
          href={`/sr/${agencyCode}`}
          className="font-semibold hover:underline text-[var(--accent-primary)]"
        >
          sr/{agencyCode}
        </Link>
        {docketType && (
          <>
            <span className="text-[var(--border)]">·</span>
            <span>{docketType}</span>
          </>
        )}
        <span className="text-[var(--border)]">·</span>
        <span className="font-mono-id">{docketId}</span>
      </div>

      <h1 className="font-serif text-xl text-[var(--foreground)] leading-snug">
        {title}
      </h1>

      {/* Abstract lives in the same panel as the title, split off by a divider. */}
      {abstract && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <DocketSummary key={docketId} abstract={abstract} />
        </div>
      )}
    </Card>
  );
}
