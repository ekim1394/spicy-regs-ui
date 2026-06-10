'use client';

import { StatusTag } from '@/components/ui/StatusTag';
import type { ClosingSignal } from '../signals';

/**
 * Closing-soon readout: the same deadline pill (unified green/amber/red scale)
 * used on feed posts and the docket header.
 */
export function Closing({ data }: { data: ClosingSignal }) {
  return <StatusTag commentEndDate={data.commentEndDate} size="compact" />;
}
