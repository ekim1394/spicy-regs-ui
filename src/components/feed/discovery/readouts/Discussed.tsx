'use client';

import { MessageSquare } from 'lucide-react';
import { formatCount } from '@/lib/agencyMetadata';
import type { DiscussedSignal } from '../signals';

/** Most-discussed readout: the all-time comment count. */
export function Discussed({ data }: { data: DiscussedSignal }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--muted)]">
      <MessageSquare size={11} />
      {formatCount(data.commentCount)} comments
    </span>
  );
}
