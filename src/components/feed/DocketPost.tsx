'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  MessageSquare,
  FileText,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Download,
  Clock,
} from 'lucide-react';
import { getAgencyInfo, timeAgo, formatCount } from '@/lib/agencyMetadata';
import { stripQuotes, decodeHtml, parseRawJson } from '@/lib/utils/fieldFormat';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface DocketPostProps {
  item: Record<string, any>;
  commentCount?: number;
  documentCount?: number;
  /** If true, we're on the detail page — don't render title as link */
  isDetailView?: boolean;
  showComments?: boolean;
}

export function DocketPost({
  item,
  commentCount = 0,
  documentCount = 0,
  isDetailView = false,
  showComments = false,
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

  // Urgency color for comment deadline
  const getDeadlineUrgency = (endDate: string) => {
    const daysLeft = Math.ceil(
      (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysLeft < 3) return { color: 'var(--accent-red, #dc2626)', label: `${daysLeft}d left` };
    if (daysLeft < 14) return { color: 'var(--accent-amber, #d97706)', label: `${daysLeft}d left` };
    return { color: 'var(--accent-green)', label: `${daysLeft}d left` };
  };

  // Attachments from documents
  const attachments = useMemo(() => {
    const fileUrl = stripQuotes(item.file_url);
    if (!fileUrl) return [];

    const fileName = fileUrl.split('/').pop() || 'Document';
    const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE';

    return [{ name: fileName, url: fileUrl, type: ext }];
  }, [item]);

  const regsDotGovUrl = `https://www.regulations.gov/docket/${docketId}`;

  return (
    <Card asChild variant="post">
      <article>
      <div className="p-5">
        {/* Header: Agency + Title */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm mb-1">
              <Link
                href={`/sr/${agencyCode}`}
                className="font-semibold hover:underline"
                style={{ color: agency.color }}
              >
                sr/{agencyCode}
              </Link>
              <span className="text-[var(--muted)]">·</span>
              <span className="font-mono-id text-[var(--muted)]">{docketId}</span>
              {(dateCreated || modifyDate) && (
                <>
                  <span className="text-[var(--muted)]">·</span>
                  <span className="text-[var(--muted)] text-xs">
                    {dateCreated ? timeAgo(dateCreated) : timeAgo(modifyDate)}
                  </span>
                </>
              )}
            </div>

            {isDetailView ? (
              <h3 className="text-lg font-semibold text-[var(--foreground)] leading-snug">
                {title}
              </h3>
            ) : (
              <Link
                href={`/sr/${agencyCode}/${encodeURIComponent(docketId)}`}
                className="text-lg font-semibold text-[var(--foreground)] leading-snug hover:text-[var(--accent-primary)] transition-colors block"
              >
                {title}
              </Link>
            )}

            {/* Badges */}
            <div className="flex items-center gap-2 mt-1.5">
              {docketType && <Badge>{docketType}</Badge>}
              {isOpenForComment && commentEndDate && (() => {
                const urgency = getDeadlineUrgency(commentEndDate);
                return (
                  <Badge variant="urgent" color={urgency.color} dot>
                    Open for Comment · {urgency.label}
                  </Badge>
                );
              })()}
              {!isOpenForComment && isRecentlyClosed && daysSinceClosed !== null && (
                <Badge dot>
                  Recently Closed · {daysSinceClosed === 0 ? 'today' : `${daysSinceClosed}d ago`}
                </Badge>
              )}
            </div>
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

        {/* Metadata Row */}
        <div className="flex items-center gap-4 mt-4 text-xs text-[var(--muted)]">
          {documentCount > 0 && (
            <span className="metadata-pill">
              <FileText size={12} />
              {formatCount(documentCount)} docs
            </span>
          )}
          {commentCount > 0 && (
            <span className="metadata-pill">
              <MessageSquare size={12} />
              {formatCount(commentCount)} comments
            </span>
          )}
          {dateCreated && (
            <span className="metadata-pill">
              <Clock size={12} />
              Created {timeAgo(dateCreated)}
            </span>
          )}
          {modifyDate && (
            <span className="metadata-pill">
              <Clock size={12} />
              Modified {timeAgo(modifyDate)}
            </span>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-[var(--border)]">
          {!isDetailView && (
            <Link
              href={`/sr/${agencyCode}/${encodeURIComponent(docketId)}`}
              className="action-btn"
            >
              <MessageSquare size={16} />
              {commentCount > 0 ? `${formatCount(commentCount)} Comments` : 'Comments'}
            </Link>
          )}

          <a
            href={regsDotGovUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="action-btn ml-auto"
          >
            <ExternalLink size={14} />
            regulations.gov
          </a>
        </div>
      </div>
      </article>
    </Card>
  );
}
