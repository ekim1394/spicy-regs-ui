'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { CoveragePill } from '@/components/sources/CoveragePill';
import { PageShell } from '@/components/ui/PageShell';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useSourceQueries } from '@/lib/duckdb/useSourceQueries';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  FEDERAL_REGISTER_ENTRY,
  SOURCES,
} from '@/lib/sources/registry';
import { formatMonthYear } from '@/lib/sources/format';
import type { SourceCategory, SourceStats } from '@/lib/sources/types';

/** One index tile's display inputs — the union of registry defs + FR entry. */
interface IndexEntry {
  key: string;
  table: string;
  label: string;
  description: string;
  category: SourceCategory;
  provider: string;
  caveat?: string;
  icon: LucideIcon;
  href: string;
  formatRecency?: (raw: string) => string;
}

const ENTRIES: IndexEntry[] = [
  { ...FEDERAL_REGISTER_ENTRY, href: FEDERAL_REGISTER_ENTRY.href },
  ...SOURCES.map((s) => ({ ...s, href: `/sources/${s.key}` })),
];

function SourceTile({ entry, stats }: { entry: IndexEntry; stats?: SourceStats }) {
  const Icon = entry.icon;
  const freshness = stats?.latest
    ? (entry.formatRecency ?? formatMonthYear)(stats.latest)
    : null;

  return (
    <Card asChild className="p-4 h-full">
      <Link href={entry.href} className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] flex-shrink-0">
            <Icon size={16} />
          </span>
          <span className="text-sm font-semibold text-[var(--foreground)] leading-snug">
            {entry.label}
          </span>
          {entry.caveat && (
            <CoveragePill reason={entry.caveat} className="ml-auto flex-shrink-0" />
          )}
        </div>

        <p className="text-xs text-[var(--muted)] leading-relaxed line-clamp-2">
          {entry.description}
        </p>

        <div className="flex items-center gap-2 text-[10.5px] text-[var(--muted-foreground)] mt-auto pt-1 min-w-0">
          <span className="whitespace-nowrap">
            {stats ? `${stats.count.toLocaleString()} records` : '— records'}
          </span>
          {freshness && (
            <>
              <span aria-hidden>·</span>
              <span className="whitespace-nowrap">through {freshness}</span>
            </>
          )}
          <span className="ml-auto truncate">{entry.provider}</span>
        </div>
      </Link>
    </Card>
  );
}

export default function SourcesIndexPage() {
  const { getSourceStats } = useSourceQueries();

  // Stats enrich the tiles but never gate them — if the one UNION query fails
  // (e.g. a parquet mid-republish), the directory still renders.
  const { data: stats } = useAsyncData(() => getSourceStats(), []);

  return (
    <PageShell maxWidth="4xl">
      <SectionLabel label="Datasets" />
      <h1 className="font-serif text-3xl text-[var(--foreground)] mt-1 mb-2">Sources</h1>
      <p className="text-sm text-[var(--muted)] mb-8 max-w-2xl">
        The federal datasets that surround the regulations.gov corpus — what agencies plan,
        who shows up to influence rulemakings, and what happens after the rules land. All
        queried live from the public Spicy&nbsp;Regs mirror, right in your browser.
      </p>

      <div className="flex flex-col gap-8">
        {CATEGORY_ORDER.map((category) => {
          const entries = ENTRIES.filter((e) => e.category === category);
          if (entries.length === 0) return null;
          const meta = CATEGORY_META[category];
          return (
            <section key={category}>
              <SectionLabel label={meta.label} caption={meta.blurb} className="mb-3" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {entries.map((entry) => (
                  <SourceTile key={entry.key} entry={entry} stats={stats?.[entry.table]} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
