'use client';

import { formatCount } from '@/lib/agencyMetadata';
import type { SurgeSignal } from '../signals';

/**
 * Comment-surge readout: the recent-vs-prior month jump in comment volume.
 * (The data mirror is a snapshot, so the finest real "recent" grain is the
 * monthly partition count, not a literal 7-day window.)
 */
export function Surge({ data }: { data: SurgeSignal }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: 'var(--accent-green)' }}>
      ▲ +{formatCount(data.delta)} · this month
    </span>
  );
}
