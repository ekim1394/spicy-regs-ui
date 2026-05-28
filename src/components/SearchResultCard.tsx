"use client";

import Link from "next/link";

import { renderHighlighted, buildSnippet } from "@/lib/search/highlight";
import type { SearchResult } from "@/lib/search/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function SearchResultCard({ result }: { result: SearchResult }) {
  const { docket, matchedTerms } = result;
  const docketUrl = `/sr/${docket.agencyCode}/${docket.docketId}`;
  const regsUrl = `https://www.regulations.gov/docket/${docket.docketId}`;

  const modifyDateDisplay = docket.modifyDate
    ? new Date(docket.modifyDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const snippet = docket.abstract
    ? buildSnippet(docket.abstract, matchedTerms, 240)
    : "";

  return (
    <Card asChild className="p-4 hover:border-[var(--accent-primary)]/40 transition-colors">
      <article>
        <div className="flex items-center gap-2 mb-1.5 text-xs text-[var(--muted)]">
          <Badge variant="code" size="xs">{docket.agencyCode}</Badge>
          {docket.docketType && <span>{docket.docketType}</span>}
          {modifyDateDisplay && (
            <>
              <span aria-hidden>·</span>
              <span>{modifyDateDisplay}</span>
            </>
          )}
          <span aria-hidden className="ml-auto">·</span>
          <span className="font-mono">{docket.docketId}</span>
        </div>

        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1 leading-snug">
          <Link
            href={docketUrl}
            className="hover:text-[var(--accent-primary)] transition-colors"
          >
            {renderHighlighted(docket.title, matchedTerms)}
          </Link>
        </h3>

        {snippet && (
          <p className="text-xs text-[var(--muted)] leading-relaxed mb-2 line-clamp-3">
            {renderHighlighted(snippet, matchedTerms)}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <Link
            href={docketUrl}
            className="hover:text-[var(--accent-primary)] transition-colors"
          >
            View docket
          </Link>
          <a
            href={regsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--accent-primary)] transition-colors"
          >
            regulations.gov ↗
          </a>
        </div>
      </article>
    </Card>
  );
}

export function SearchResultCardSkeleton() {
  return (
    <Card className="p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="h-4 w-12 rounded bg-[var(--surface-raised)]" />
        <div className="h-4 w-20 rounded bg-[var(--surface-raised)]" />
      </div>
      <div className="h-4 w-3/4 rounded bg-[var(--surface-raised)] mb-2" />
      <div className="h-3 w-full rounded bg-[var(--surface-raised)] mb-1" />
      <div className="h-3 w-5/6 rounded bg-[var(--surface-raised)]" />
    </Card>
  );
}
