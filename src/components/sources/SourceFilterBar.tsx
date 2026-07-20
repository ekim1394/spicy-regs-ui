'use client';

import { useMemo } from 'react';
import { X } from 'lucide-react';

import { FilterSelect } from '@/components/ui/FilterSelect';
import type { SourceDef } from '@/lib/sources/types';

interface SourceFilterBarProps {
  def: SourceDef;
  search: string;
  onSearchChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  filterValues: Record<string, string>;
  onFilterChange: (param: string, value: string) => void;
}

/**
 * Registry-driven filter bar for a source browser: free-text search, one
 * FilterSelect per declared filter, and sort chips (hidden when the source
 * has a single sort). Mirrors the FRFeedFilters control vocabulary.
 */
export function SourceFilterBar({
  def,
  search,
  onSearchChange,
  sort,
  onSortChange,
  filterValues,
  onFilterChange,
}: SourceFilterBarProps) {
  // Registry options are module constants, but FilterSelect is Radix-backed —
  // keep the mapped arrays reference-stable across renders.
  const selectOptions = useMemo(
    () =>
      def.filters.map((filter) =>
        filter.options.map((o) => ({
          value: o.value,
          label: o.label,
          // Compact trigger for the "All …" default, e.g. "Stage".
          ...(o.value === '' ? { triggerLabel: filter.label } : {}),
        })),
      ),
    [def],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex items-center">
          <input
            type="text"
            value={search}
            placeholder={`Search ${def.label.toLowerCase()}…`}
            onChange={(e) => onSearchChange(e.target.value)}
            className="filter-chip bg-[var(--surface)] text-[var(--foreground)] border-none focus:outline-none placeholder:text-[var(--muted)] min-w-[240px]"
            aria-label={`Search ${def.label}`}
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 text-[var(--muted)] hover:text-[var(--foreground)]"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {def.filters.map((filter, i) => (
          <FilterSelect
            key={filter.param}
            value={filterValues[filter.param] ?? ''}
            onValueChange={(value) => onFilterChange(filter.param, value)}
            options={selectOptions[i]}
            ariaLabel={`Filter by ${filter.label.toLowerCase()}`}
          />
        ))}
      </div>

      {def.sortOptions.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {def.sortOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onSortChange(opt.key)}
              className={`filter-chip ${sort === opt.key ? 'filter-chip-active' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
