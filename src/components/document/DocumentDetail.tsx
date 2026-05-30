'use client';

import Link from 'next/link';
import { DemoPill } from '@/components/ui/DemoPill';

export interface DocumentDetailProps {
  agencyCode: string;
  documentType?: string;
  postedDate?: string | null;
  commentStartDate?: string | null;
  commentEndDate?: string | null;
  /** FR document number — not in the data mirror, so it wears a DemoPill. */
  frDocumentNumber?: string | null;
}

function fmt(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-2.5 border-t border-[var(--border-subtle)] first:border-t-0">
      <div className="w-36 flex-none text-xs font-semibold text-[var(--muted)]">{label}</div>
      <div className="text-sm text-[var(--foreground)] min-w-0">{children}</div>
    </div>
  );
}

/**
 * Bibliographic meta block for a document. Renders the fields the mirror has
 * (type, posted, comment period, agency) and owns the one it lacks — the FR
 * document number — with a DemoPill rather than hiding the row.
 */
export function DocumentDetail({
  agencyCode,
  documentType,
  postedDate,
  commentStartDate,
  commentEndDate,
  frDocumentNumber,
}: DocumentDetailProps) {
  const posted = fmt(postedDate);
  const cStart = fmt(commentStartDate);
  const cEnd = fmt(commentEndDate);
  const period = cStart && cEnd ? `${cStart} – ${cEnd}` : cEnd ? `Closes ${cEnd}` : null;

  return (
    <div>
      {documentType && <MetaRow label="Document type">{documentType}</MetaRow>}
      {posted && <MetaRow label="Posted">{posted}</MetaRow>}
      {period && <MetaRow label="Comment period">{period}</MetaRow>}
      <MetaRow label="Agency">
        <Link href={`/sr/${agencyCode}`} className="hover:underline" style={{ color: 'var(--accent-primary)' }}>
          sr/{agencyCode}
        </Link>
      </MetaRow>
      <MetaRow label="FR document no.">
        {frDocumentNumber ? (
          <span className="font-mono-id">{frDocumentNumber}</span>
        ) : (
          <span className="inline-flex items-center gap-2 text-[var(--muted)]">
            <span>—</span>
            <DemoPill reason="The Federal Register document number isn't carried in the documents data mirror; it lives on the FR dataset, which links to dockets (not individual documents)." />
          </span>
        )}
      </MetaRow>
    </div>
  );
}
