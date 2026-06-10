'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { StatusTag } from '@/components/ui/StatusTag';
import { formatCount } from '@/lib/agencyMetadata';

export interface MiniDocketCardProps {
  docketId: string;
  agencyCode: string;
  title: string;
  /** 'deadline' shows a StatusTag from commentEndDate; 'count' shows comment volume. */
  variant: 'deadline' | 'count';
  commentEndDate?: string | null;
  commentCount?: number;
}

/**
 * Compact one-line docket row used by both OpenRulemakings (deadline variant)
 * and TopDockets (count variant) on the agency profile. Title + mono docket id
 * on the left, a deadline pill or comment count on the right.
 */
export function MiniDocketCard({
  docketId,
  agencyCode,
  title,
  variant,
  commentEndDate,
  commentCount,
}: MiniDocketCardProps) {
  return (
    <Link
      href={`/sr/${agencyCode}/${encodeURIComponent(docketId)}`}
      className="flex items-center gap-3 py-2.5 border-t border-[var(--border-subtle)] first:border-t-0 hover:bg-[var(--surface-elevated)] transition-colors px-1"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm text-[var(--foreground)] leading-snug truncate">
          {title || docketId}
        </div>
        <div className="font-mono-id text-[11px] text-[var(--muted)] truncate">{docketId}</div>
      </div>
      {variant === 'deadline' ? (
        <StatusTag commentEndDate={commentEndDate} className="flex-none" />
      ) : (
        <span className="flex-none inline-flex items-center gap-1 text-xs text-[var(--muted)]">
          <MessageSquare size={12} />
          {formatCount(commentCount ?? 0)}
        </span>
      )}
    </Link>
  );
}
