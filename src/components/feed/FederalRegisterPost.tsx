'use client';

import Link from 'next/link';
import { ExternalLink, FileText, Clock } from 'lucide-react';
import { timeAgo } from '@/lib/agencyMetadata';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { FederalRegisterDoc } from '@/lib/fr/types';

interface FederalRegisterPostProps {
  doc: FederalRegisterDoc;
  /**
   * Feed variant: dashed border + a leading "Federal Register" tag so an FR
   * entry reads as visually distinct when interleaved into the docket river
   * (per the wireframe). Off elsewhere (e.g. /federal-register, /search).
   */
  dashed?: boolean;
}

/**
 * Card representation of a Federal Register publication.
 *
 * Visually parallels DocketPost so /federal-register and /search read as
 * one unified product, but the data shape is different — agencies live in a
 * comma-joined slug list, the primary identifier is FR's document_number,
 * and the click target is external (federalregister.gov) rather than an
 * internal route.
 *
 * Linked dockets, when present, render as inline chips back to /sr/{...} —
 * that's the cross-link a Mirrulations user mostly cares about.
 */
export function FederalRegisterPost({ doc, dashed = false }: FederalRegisterPostProps) {
  const agencies = doc.agencySlugs
    ? doc.agencySlugs.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const publishedDisplay = doc.publicationDate
    ? new Date(doc.publicationDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  // Open-comment urgency colors mirror DocketPost.
  const closeMs = doc.commentsCloseOn ? new Date(doc.commentsCloseOn).getTime() : null;
  const isOpenForComment = closeMs !== null && closeMs > Date.now();
  const daysLeft = closeMs !== null
    ? Math.ceil((closeMs - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;
  const urgencyColor = (() => {
    if (daysLeft < 3) return 'var(--accent-red, #dc2626)';
    if (daysLeft < 14) return 'var(--accent-amber, #d97706)';
    return 'var(--accent-green)';
  })();

  // Presidential documents get a special second-line label.
  const presidentialLabel = doc.subtype && doc.documentType === 'Presidential Document'
    ? doc.executiveOrderNumber
      ? `${doc.subtype} ${doc.executiveOrderNumber}`
      : doc.subtype
    : null;

  return (
    <Card
      asChild
      className="p-4"
      style={dashed ? { borderStyle: 'dashed', background: 'var(--surface-elevated)' } : undefined}
    >
      <article>
      {/* Header strip: agencies · type · date */}
      <div className="flex items-center gap-2 mb-1.5 text-xs text-[var(--muted)] flex-wrap">
        {dashed && (
          <Badge variant="code" size="xs">
            Federal Register
          </Badge>
        )}
        {agencies.slice(0, 3).map((slug) => (
          <Badge key={slug} variant="code" size="xs" className="text-[var(--accent-primary)]">
            {slug}
          </Badge>
        ))}
        {agencies.length > 3 && (
          <span className="text-[var(--muted)]">+{agencies.length - 3}</span>
        )}
        {doc.documentType && <span>{doc.documentType}</span>}
        {publishedDisplay && (
          <>
            <span aria-hidden>·</span>
            <span>{publishedDisplay}</span>
          </>
        )}
        <span aria-hidden className="ml-auto">·</span>
        <span className="font-mono">{doc.documentNumber}</span>
      </div>

      {/* Title (external link to federalregister.gov) */}
      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1 leading-snug">
        <a
          href={doc.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[var(--accent-primary)] transition-colors"
        >
          {doc.title}
        </a>
      </h3>

      {presidentialLabel && (
        <div className="text-xs text-[var(--muted)] mb-1">{presidentialLabel}</div>
      )}

      {/* Abstract */}
      {doc.abstract && (
        <p className="text-xs text-[var(--muted)] leading-relaxed mb-2 line-clamp-3">
          {doc.abstract}
        </p>
      )}

      {/* Comment-close countdown */}
      {isOpenForComment && doc.commentsCloseOn && (
        <div
          className="inline-flex items-center gap-1 text-xs font-medium mb-2"
          style={{ color: urgencyColor }}
        >
          <Clock size={11} />
          Comment Period · {daysLeft}d left · Closes{' '}
          {new Date(doc.commentsCloseOn).toLocaleDateString()}
        </div>
      )}

      {/* Linked regulations.gov dockets — the cross-link */}
      {doc.docketIds.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className="text-xs text-[var(--muted)]">Linked dockets:</span>
          {doc.docketIds.slice(0, 4).map((d) => {
            const agency = d.split('-')[0] || '';
            return (
              <Badge key={d} variant="code" size="xs" className="text-[var(--accent-primary)] hover:underline cursor-pointer" asChild>
                <Link href={`/sr/${agency}/${encodeURIComponent(d)}`}>
                  {d}
                </Link>
              </Badge>
            );
          })}
          {doc.docketIds.length > 4 && (
            <span className="text-xs text-[var(--muted)]">
              +{doc.docketIds.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Footer links */}
      <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
        <a
          href={doc.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-[var(--accent-primary)] transition-colors"
        >
          federalregister.gov <ExternalLink size={11} />
        </a>
        {doc.pdfUrl && (
          <a
            href={doc.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-[var(--accent-primary)] transition-colors"
          >
            <FileText size={11} /> PDF
          </a>
        )}
        {doc.signingDate && (
          <span className="ml-auto">Signed {timeAgo(doc.signingDate)}</span>
        )}
      </div>
      </article>
    </Card>
  );
}
