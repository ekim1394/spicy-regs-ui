'use client';

import Link from 'next/link';
import { Download } from 'lucide-react';
import { timeAgo } from '@/lib/agencyMetadata';
import { daysUntil, deadlineLevel, DEADLINE_COLOR_VAR } from '@/lib/deadline';
import { stripQuotes } from '@/lib/utils/fieldFormat';
import { Badge } from '@/components/ui/Badge';

interface DocumentListProps {
  documents: any[];
  loading?: boolean;
  /**
   * When provided, each document title links to its Document page at
   * /sr/{agencyCode}/{docketId}/{documentId}. Omit to render plain titles.
   */
  agencyCode?: string;
  docketId?: string;
}

export function DocumentList({ documents, loading = false, agencyCode, docketId }: DocumentListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-8 text-sm text-[var(--muted)]">
        Loading documents...
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)] py-4 text-center">
        No documents found for this docket.
      </p>
    );
  }

  return (
    <div className="space-y-2">
        {documents.map((doc, i) => {
          const docId = stripQuotes(doc.document_id);
          const title = stripQuotes(doc.title) || docId;
          const docType = stripQuotes(doc.document_type);
          const postedDate = stripQuotes(doc.posted_date);
          const commentEndDate = stripQuotes(doc.comment_end_date);
          const fileUrl = stripQuotes(doc.file_url);

          const isOpenForComment = commentEndDate
            ? new Date(commentEndDate) > new Date()
            : false;

          const daysLeft = daysUntil(commentEndDate || null) ?? 0;
          const urgencyColor = DEADLINE_COLOR_VAR[deadlineLevel(daysLeft)];

          return (
            <div key={docId || i} className="document-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Document ID and type */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono-id text-[var(--muted)] text-xs">{docId}</span>
                    {docType && <Badge variant="neutral" size="xs">{docType}</Badge>}
                  </div>

                  {/* Title */}
                  {agencyCode && docketId ? (
                    <Link
                      href={`/sr/${agencyCode}/${encodeURIComponent(docketId)}/${encodeURIComponent(docId)}`}
                      className="text-sm font-medium text-[var(--foreground)] leading-snug hover:text-[var(--accent-primary)] transition-colors"
                    >
                      {title}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-[var(--foreground)] leading-snug">
                      {title}
                    </p>
                  )}

                  {/* Comment period / posted date */}
                  <div className="flex items-center gap-2 mt-1.5">
                    {isOpenForComment && commentEndDate ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium"
                        style={{ color: urgencyColor }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: urgencyColor }}
                        />
                        Open for Comment · {daysLeft}d left · Closes{' '}
                        {new Date(commentEndDate).toLocaleDateString()}
                      </span>
                    ) : commentEndDate ? (
                      <span className="text-xs text-[var(--muted)]">
                        Comment Period Closed
                      </span>
                    ) : postedDate ? (
                      <span className="text-xs text-[var(--muted)]">
                        Posted {timeAgo(postedDate)}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* File link */}
                {fileUrl && (
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium
                      bg-[var(--surface-elevated)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]
                      hover:text-white transition-colors shrink-0"
                    title="Download document"
                  >
                    <Download size={12} />
                    PDF
                  </a>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
