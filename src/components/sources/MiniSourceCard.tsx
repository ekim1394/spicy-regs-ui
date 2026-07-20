'use client';

import { ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { SourceCardModel } from '@/lib/sources/types';

interface MiniSourceCardProps {
  card: SourceCardModel;
  /** How many header chips to show (compact panels have little width). */
  maxChips?: number;
}

/**
 * Compact 3-line renderer for a `SourceCardModel` — the related-panel sibling
 * of the browser's full `SourceCard`, mirroring MiniFRCard's anatomy (chip
 * strip → clamped title → date line, whole card an external click target).
 */
export function MiniSourceCard({ card, maxChips = 2 }: MiniSourceCardProps) {
  const chips = card.chips.slice(0, maxChips);

  const body = (
    <>
      <div className="flex items-center gap-1.5 text-xs mb-1.5 min-w-0">
        {chips.map((chip, i) => (
          <Badge
            key={`${chip.label}-${i}`}
            variant={chip.variant ?? 'neutral'}
            size="xs"
            className="truncate max-w-[160px]"
          >
            {chip.label}
          </Badge>
        ))}
        {card.href && (
          <ExternalLink
            size={11}
            className="ml-auto flex-shrink-0 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity"
          />
        )}
      </div>
      <p className="text-sm font-medium text-[var(--foreground)] leading-snug line-clamp-2">
        {card.title}
      </p>
      {card.metaRight && (
        <p className="mt-1.5 text-xs text-[var(--muted)]">{card.metaRight}</p>
      )}
    </>
  );

  return (
    <Card
      asChild
      className="p-3 hover:border-[var(--accent-primary)] transition-colors min-w-0 group"
    >
      {card.href ? (
        <a href={card.href} target="_blank" rel="noopener noreferrer">
          {body}
        </a>
      ) : (
        <div>{body}</div>
      )}
    </Card>
  );
}
