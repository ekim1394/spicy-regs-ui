'use client';

import { formatCount } from '@/lib/agencyMetadata';

interface Totals { total: number; unique: number; empty: number; }

/**
 * Unique-vs-form-letter ratio for a docket's comments. "Unique" = distinct
 * comment texts; the remainder are duplicates that belong to form-letter
 * clusters. A high form-letter share signals an orchestrated campaign rather
 * than organic response. (Backed by getCommentVolumeAndClusters' totals; finer
 * normalization — stripping signatures so "same letter, different signer"
 * collapses — is available via getCommentClustersMultiTier once comment
 * partitions carry the submitter name/org columns.)
 */
export function OrchestrationIndicator({ totals }: { totals: Totals }) {
  const { total, unique } = totals;
  if (total === 0) {
    return (
      <div className="text-xs text-[var(--muted)]">No comments to analyze.</div>
    );
  }

  const uniquePct = Math.round((unique / total) * 100);
  const formPct = Math.max(0, 100 - uniquePct);

  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden rounded-md border border-[var(--border)]">
        <div
          className="flex items-center justify-center text-[10px] font-semibold text-white"
          style={{ width: `${uniquePct}%`, background: 'var(--accent-primary)' }}
        >
          {uniquePct >= 14 ? `${uniquePct}%` : ''}
        </div>
        <div
          className="flex items-center justify-center text-[10px] font-semibold text-[var(--muted)]"
          style={{ width: `${formPct}%`, background: 'var(--surface-raised)' }}
        >
          {formPct >= 14 ? `${formPct}%` : ''}
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 text-[11px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm" style={{ background: 'var(--accent-primary)' }} />
          {formatCount(unique)} unique
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm" style={{ background: 'var(--surface-raised)' }} />
          {formatCount(total - unique)} form-letter
        </span>
      </div>
    </div>
  );
}
