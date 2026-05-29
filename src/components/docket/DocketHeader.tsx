'use client';

import Link from 'next/link';
import { StatusTag } from '@/components/ui/StatusTag';

export interface DocketHeaderProps {
  agencyCode: string;
  docketId: string;
  title: string;
  docketType?: string;
  commentStartDate?: string | null;
  commentEndDate?: string | null;
}

function fmt(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Persistent docket identity, sitting ABOVE the tabs and constant on every tab:
 * the docket's home (sr/CODE), type, status, id, and comment-period dates.
 *
 * Deliberately lean to avoid echoing what's shown elsewhere on the page: the
 * agency face + stats live once in the right-rail AgencyIdentity card, the
 * abstract lives once in the Overview tab's Summary, and the comment count
 * lives on the Comments tab label + the rail stat. This header doesn't repeat
 * any of them.
 *
 * No RIN row — the data mirror drops the RIN field, and the docket ID already
 * identifies the rulemaking, so there's no DemoPill to apologise for either.
 */
export function DocketHeader({
  agencyCode,
  docketId,
  title,
  docketType,
  commentStartDate,
  commentEndDate,
}: DocketHeaderProps) {
  const startStr = fmt(commentStartDate);
  const endStr = fmt(commentEndDate);
  const periodLabel =
    startStr && endStr ? `${startStr} – ${endStr}` : endStr ? `Closes ${endStr}` : null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
        <Link
          href={`/sr/${agencyCode}`}
          className="text-sm font-semibold hover:underline"
          style={{ color: 'var(--accent-primary)' }}
        >
          sr/{agencyCode}
        </Link>
        {docketType && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--surface-elevated)] text-[var(--muted)]">
            {docketType}
          </span>
        )}
        <span className="ml-auto">
          <StatusTag commentEndDate={commentEndDate} />
        </span>
      </div>

      <h1 className="font-serif text-xl text-[var(--foreground)] leading-snug mb-2">
        {title}
      </h1>

      <div className="flex items-center gap-4 flex-wrap text-xs text-[var(--muted)]">
        <span className="font-mono-id">{docketId}</span>
        {periodLabel && <span>Comment period · {periodLabel}</span>}
      </div>
    </div>
  );
}
