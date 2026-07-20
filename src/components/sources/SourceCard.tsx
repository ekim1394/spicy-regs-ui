'use client';

import { ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { SourceCardModel } from '@/lib/sources/types';

interface SourceCardProps {
  card: SourceCardModel;
}

/**
 * The one row card every source browser renders. All per-source knowledge is
 * upstream in the registry's `toCard` mapping — this component only lays out
 * the `SourceCardModel` slots (chips → title → body → meta footer), matching
 * the FederalRegisterPost anatomy so external sources read like the rest of
 * the app.
 */
export function SourceCard({ card }: SourceCardProps) {
  const hasFooter = Boolean((card.href && card.linkLabel) || card.metaLeft || card.metaRight);

  return (
    <Card asChild className="p-4">
      <article>
        {card.chips.length > 0 && (
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {card.chips.map((chip, i) => (
              <Badge key={`${chip.label}-${i}`} variant={chip.variant ?? 'neutral'} size="xs">
                {chip.label}
              </Badge>
            ))}
          </div>
        )}

        <h3 className="text-sm font-semibold text-[var(--foreground)] leading-snug">
          {card.href ? (
            <a
              href={card.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--accent-primary)] transition-colors"
            >
              {card.title}
            </a>
          ) : (
            card.title
          )}
        </h3>

        {card.body && (
          <p className="text-xs text-[var(--muted)] leading-relaxed mt-1 line-clamp-3">
            {card.body}
          </p>
        )}

        {hasFooter && (
          <div className="flex items-center gap-3 text-xs text-[var(--muted)] mt-2 min-w-0">
            {card.href && card.linkLabel && (
              <a
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-[var(--accent-primary)] transition-colors whitespace-nowrap"
              >
                {card.linkLabel}
                <ExternalLink size={11} />
              </a>
            )}
            {card.metaLeft && <span className="truncate">{card.metaLeft}</span>}
            {card.metaRight && (
              <span className="ml-auto whitespace-nowrap text-[var(--muted-foreground)]">
                {card.metaRight}
              </span>
            )}
          </div>
        )}
      </article>
    </Card>
  );
}
