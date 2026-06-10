'use client';

import { ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { FederalRegisterDoc } from '@/lib/fr/types';

interface MiniFRCardProps {
  doc: FederalRegisterDoc;
}

/**
 * Compact 3-line card for a Federal Register publication. The lead-agency
 * slug + document_type pair functions like the docket-side `sr/{agency} ·
 * {id}` header. Click target is external (federalregister.gov).
 */
export function MiniFRCard({ doc }: MiniFRCardProps) {
  const leadAgency = doc.agencySlugs.split(',')[0]?.trim() || '';
  const date = doc.publicationDate
    ? new Date(doc.publicationDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <Card
      asChild
      className="p-3 hover:border-[var(--accent-primary)] transition-colors min-w-0 group"
    >
      <a href={doc.htmlUrl} target="_blank" rel="noopener noreferrer">
        <div className="flex items-center gap-2 text-xs mb-1.5">
          {leadAgency && (
            <span className="font-mono-id text-[var(--accent-primary)] truncate max-w-[140px]">
              {leadAgency}
            </span>
          )}
          {doc.documentType && (
            <>
              <span className="text-[var(--muted)]">·</span>
              <span className="text-[var(--muted)]">{doc.documentType}</span>
            </>
          )}
          <ExternalLink
            size={11}
            className="ml-auto text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
        <p className="text-sm font-medium text-[var(--foreground)] leading-snug line-clamp-3">
          {doc.title}
        </p>
        {date && (
          <p className="mt-1.5 text-xs text-[var(--muted)]">{date}</p>
        )}
      </a>
    </Card>
  );
}
