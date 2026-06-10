'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { getRelatedAgencies } from '@/lib/agencyMetadata';

/**
 * "Related agencies" grid at the bottom of the agency profile: curated
 * cross-department peers when they exist, otherwise parent-department siblings
 * (see getRelatedAgencies). Each card links to that agency's profile, so the
 * profile pages form a browsable graph rather than dead ends.
 */
export function RelatedAgencies({ agencyCode }: { agencyCode: string }) {
  const related = useMemo(() => getRelatedAgencies(agencyCode, 6), [agencyCode]);
  if (related.length === 0) return null;

  return (
    <section className="mb-8">
      <SectionLabel label="Related agencies" className="mb-2" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {related.map((a) => (
          <Card key={a.code} asChild className="p-3 flex items-center gap-3 min-w-0">
            <Link href={`/sr/${a.code}`}>
              <Avatar
                name={a.name}
                src={a.favicon}
                color={a.color}
                fallback={a.shortName}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[var(--accent-primary)] truncate">
                  sr/{a.code}
                </div>
                <div className="text-xs text-[var(--muted)] truncate">{a.name}</div>
              </div>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}
