'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Sparkline } from '@/components/ui/Sparkline';
import { formatCount, type AgencyInfo } from '@/lib/agencyMetadata';

type SortKey = 'az' | 'active' | 'comments';

interface AgencyCounts { dockets: number; comments: number; }

interface AgenciesTableProps {
  groups: { dept: string; agencies: AgencyInfo[] }[];
  counts: Record<string, AgencyCounts>;
  /** Per-agency monthly document volume (sparse, ascending) keyed by code. */
  volume: Map<string, { month: string; n: number }[]>;
}

const GRID = '2.4fr 1fr 1fr 1.4fr 0.5fr';
/** Stable empty series so a sparkline-less row keeps a constant prop reference. */
const EMPTY_SERIES: number[] = [];
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'az', label: 'A–Z' },
  { key: 'active', label: 'Most active' },
  { key: 'comments', label: 'Most comments' },
];

/** Last `n` 'YYYY-MM' keys, oldest → newest, ending this month. */
function recentMonths(n = 12): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function densify(series: { month: string; n: number }[], months: string[]): number[] {
  const map = new Map(series.map((s) => [s.month, s.n]));
  return months.map((m) => map.get(m) ?? 0);
}

/**
 * Dense, department-grouped comparison table for /agencies. The avatar + serif
 * name keep each row reading as a community rather than a spreadsheet line,
 * while the right-aligned numeric columns + sparkline make "most active across
 * departments" scannable at a glance.
 */
export function AgenciesTable({ groups, counts, volume }: AgenciesTableProps) {
  const [query, setQuery] = useState('');
  // Debounced copy that actually drives filtering, so a 194-row filter+sort
  // (and its sparkline rows) doesn't recompute on every keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('active');
  const months = useMemo(() => recentMonths(12), []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(id);
  }, [query]);

  // Densify every agency's series once per volume/months change, so each row
  // gets a STABLE array reference. Combined with the memoized Sparkline, this
  // keeps the 194 sparklines from re-rendering on filter/sort changes.
  const densified = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const g of groups) {
      for (const a of g.agencies) {
        m.set(a.code, densify(volume.get(a.code) ?? [], months));
      }
    }
    return m;
  }, [groups, volume, months]);

  const visibleGroups = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const cmp = (a: AgencyInfo, b: AgencyInfo) => {
      if (sort === 'az') return a.name.localeCompare(b.name);
      if (sort === 'comments') return (counts[b.code]?.comments ?? 0) - (counts[a.code]?.comments ?? 0);
      return (counts[b.code]?.dockets ?? 0) - (counts[a.code]?.dockets ?? 0);
    };
    return groups
      .map(({ dept, agencies }) => ({
        dept,
        agencies: agencies
          .filter((a) => !q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
          .sort(cmp),
      }))
      .filter((g) => g.agencies.length > 0);
  }, [groups, counts, sort, debouncedQuery]);

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-[280px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name or code…"
            className="w-full h-9 pl-9 pr-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">Sort</span>
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`filter-chip ${sort === s.key ? 'filter-chip-active' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {visibleGroups.length === 0 && (
        <div className="text-center py-12 text-[var(--muted)]">
          No agencies match &quot;{query}&quot;.
        </div>
      )}

      {visibleGroups.map(({ dept, agencies }) => (
        <div key={dept} className="mb-6">
          <SectionLabel label={dept} className="mb-2" />
          <Card interactive={false} className="px-4">
            {/* Header row */}
            <div
              className="grid items-center py-2 border-b border-[var(--border)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]"
              style={{ gridTemplateColumns: GRID }}
            >
              <div>Agency</div>
              <div className="text-right">Dockets</div>
              <div className="text-right">Comments</div>
              <div className="text-right">12-mo volume</div>
              <div />
            </div>

            {agencies.map((a) => {
              const c = counts[a.code];
              return (
                <Link
                  key={a.code}
                  href={`/sr/${a.code}`}
                  className="grid items-center py-2.5 border-t border-[var(--border-subtle)] first:border-t-0 hover:bg-[var(--surface-elevated)] transition-colors"
                  style={{ gridTemplateColumns: GRID }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={a.name} src={a.favicon} color={a.color} fallback={a.shortName} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate text-[var(--accent-primary)]">
                        sr/{a.code}
                      </div>
                      <div className="text-xs text-[var(--muted)] truncate">{a.name}</div>
                    </div>
                  </div>
                  <div className="text-right text-sm font-semibold tabular-nums">
                    {c ? formatCount(c.dockets) : '—'}
                  </div>
                  <div className="text-right text-sm font-semibold tabular-nums">
                    {c ? formatCount(c.comments) : '—'}
                  </div>
                  <div className="flex justify-end">
                    <Sparkline data={densified.get(a.code) ?? EMPTY_SERIES} width={90} height={20} />
                  </div>
                  <div className="text-right text-sm text-[var(--accent-primary)]">
                    →
                  </div>
                </Link>
              );
            })}
          </Card>
        </div>
      ))}
    </div>
  );
}
