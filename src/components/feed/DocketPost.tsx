'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  FileText,
  Paperclip,
  Download,
} from 'lucide-react';
import { getAgencyInfo, timeAgo, formatCount } from '@/lib/agencyMetadata';
import { stripQuotes, decodeHtml, parseRawJson } from '@/lib/utils/fieldFormat';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatusTag } from '@/components/ui/StatusTag';

interface DocketPostProps {
  item: Record<string, any>;
  commentCount?: number;
  documentCount?: number;
}

export function DocketPost({
  item,
  commentCount = 0,
  documentCount = 0,
}: DocketPostProps) {
  const [expanded, setExpanded] = useState(false);

  const attrs = useMemo(() => parseRawJson(item.raw_json), [item]);

  const docketId = stripQuotes(item.docket_id) || '';
  const agencyCode = stripQuotes(item.agency_code) || docketId.split('-')[0] || '';
  const agency = getAgencyInfo(agencyCode);

  const title = decodeHtml(stripQuotes(item.title) || attrs.title || docketId);
  const abstract = decodeHtml(stripQuotes(item.abstract) || attrs.abstract || '');
  const docketType = stripQuotes(item.docket_type) || attrs.docketType || '';
  const modifyDate = stripQuotes(item.modify_date) || attrs.modifyDate;
  const dateCreated = stripQuotes(item.date_created);

  // Comment period — use enriched docket data directly
  const commentEndDate = stripQuotes(item.comment_end_date);
  const commentEndMs = commentEndDate ? new Date(commentEndDate).getTime() : null;
  const isOpenForComment = commentEndMs !== null && commentEndMs > Date.now();

  // "Recently closed" = closed within the last 30 days
  const RECENTLY_CLOSED_DAYS = 30;
  const daysSinceClosed = commentEndMs !== null
    ? Math.floor((Date.now() - commentEndMs) / (1000 * 60 * 60 * 24))
    : null;
  const isRecentlyClosed =
    daysSinceClosed !== null && daysSinceClosed >= 0 && daysSinceClosed <= RECENTLY_CLOSED_DAYS;

  // Attachments from documents
  const attachments = useMemo(() => {
    const fileUrl = stripQuotes(item.file_url);
    if (!fileUrl) return [];

    const fileName = fileUrl.split('/').pop() || 'Document';
    const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE';

    return [{ name: fileName, url: fileUrl, type: ext }];
  }, [item]);

  return (
    <Card asChild variant="post">
      <article>
      <div className="p-5 pb-4">
        {/* Header: Agency + Title */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {/* Metadata line — one consistent treatment (sans, text-xs, muted);
                the agency's brand color is the only differentiator since it's
                the link/anchor. Docket type sits here too: it's categorical
                metadata, not a time-sensitive signal. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mb-1">
              <Link
                href={`/sr/${agencyCode}`}
                className="font-medium hover:underline"
                style={{ color: agency.color }}
              >
                sr/{agencyCode}
              </Link>
              <span className="text-[var(--muted)]">·</span>
              <span className="text-[var(--muted)]">{docketId}</span>
              {docketType && (
                <>
                  <span className="text-[var(--muted)]">·</span>
                  <span className="text-[var(--muted)]">{docketType}</span>
                </>
              )}
              {(dateCreated || modifyDate) && (
                <>
                  <span className="text-[var(--muted)]">·</span>
                  <span className="text-[var(--muted)]">
                    {dateCreated ? timeAgo(dateCreated) : timeAgo(modifyDate)}
                  </span>
                </>
              )}
            </div>

            <Link
              href={`/sr/${agencyCode}/${encodeURIComponent(docketId)}`}
              className="text-lg font-semibold text-[var(--foreground)] leading-snug hover:text-[var(--accent-primary)] transition-colors block"
            >
              {title}
            </Link>
          </div>
        </div>

        {/* Abstract */}
        {abstract && (
          <div className="mt-3 text-sm text-[var(--muted)] leading-relaxed">
            {expanded || abstract.length <= 280
              ? abstract
              : `${abstract.slice(0, 280)}...`}
            {abstract.length > 280 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="ml-1 text-[var(--accent-primary)] hover:underline text-xs font-medium"
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
              <Paperclip size={12} />
              Attachments
            </div>
            {attachments.map((att, i) => (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="attachment-link"
              >
                <FileText size={14} className="text-[var(--accent-primary)]" />
                <span className="flex-1 truncate">{att.name}</span>
                <span className="text-xs text-[var(--muted)]">{att.type}</span>
                <Download size={14} className="text-[var(--muted)]" />
              </a>
            ))}
          </div>
        )}

        {/* Footer — engagement on the left (icon sits flush with the title and
            abstract above it), current lifecycle state on the right. All the
            identity metadata lives in the single line at the top, so this row
            carries only state + engagement: no second metadata block wedged
            against the title. */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[var(--border)]">
          <Link
            href={`/sr/${agencyCode}/${encodeURIComponent(docketId)}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--accent-primary)] transition-colors"
          >
            <MessageSquare size={15} />
            {commentCount > 0 ? `${formatCount(commentCount)} comments` : 'Comments'}
          </Link>

          {documentCount > 0 && (
            <span className="metadata-pill">
              <FileText size={12} />
              {formatCount(documentCount)} docs
            </span>
          )}

          {isOpenForComment && commentEndDate ? (
            <span className="ml-auto inline-flex items-center gap-1.5">
              <span className="text-xs font-medium text-[var(--muted)]">Open for Comment ·</span>
              <StatusTag commentEndDate={commentEndDate} />
            </span>
          ) : isRecentlyClosed && daysSinceClosed !== null ? (
            <span className="ml-auto">
              <Badge dot>
                Recently Closed · {daysSinceClosed === 0 ? 'today' : `${daysSinceClosed}d ago`}
              </Badge>
            </span>
          ) : null}
        </div>
      </div>
      </article>
    </Card>
  );
}
