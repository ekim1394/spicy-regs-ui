'use client';

import { useMemo } from 'react';
import { X } from 'lucide-react';
import { FilterSelect } from '@/components/ui/FilterSelect';
import type {
  FRDateRange,
  FRDocumentTypeFilter,
  FRSort,
} from '@/lib/fr/types';

interface FRFeedFiltersProps {
  documentType: FRDocumentTypeFilter;
  onDocumentTypeChange: (t: FRDocumentTypeFilter) => void;
  dateRange: FRDateRange;
  onDateRangeChange: (r: FRDateRange) => void;
  sortBy: FRSort;
  onSortChange: (s: FRSort) => void;
  agencySlug: string;
  onAgencySlugChange: (s: string) => void;
}

const DOC_TYPE_OPTIONS: { value: FRDocumentTypeFilter; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'Rule', label: 'Rule' },
  { value: 'Proposed Rule', label: 'Proposed Rule' },
  { value: 'Notice', label: 'Notice' },
  { value: 'Presidential Document', label: 'Presidential' },
];

const DATE_OPTIONS: { value: FRDateRange; label: string }[] = [
  { value: '', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '365d', label: 'Last year' },
];

const SORT_CHIPS: { key: FRSort; label: string }[] = [
  { key: 'recent', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'comment-deadline', label: 'Comment deadline' },
];

/**
 * Filter bar for /federal-register. FR-specific dimensions: document_type,
 * date range, agency slug (free-text — FR has hundreds of slugs and no
 * curated list), and sort. The FR data is too large to enumerate agencies
 * client-side, so users type a slug substring.
 */
export function FRFeedFilters({
  documentType,
  onDocumentTypeChange,
  dateRange,
  onDateRangeChange,
  sortBy,
  onSortChange,
  agencySlug,
  onAgencySlugChange,
}: FRFeedFiltersProps) {
  // Options are static, but useMemo keeps the reference stable so the
  // Radix-backed FilterSelect doesn't see a fresh array each render.
  const docTypeOptions = useMemo(() => DOC_TYPE_OPTIONS, []);
  const dateOptions = useMemo(() => DATE_OPTIONS, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: dropdowns + agency text input */}
      <div className="flex items-center gap-3 flex-wrap">
        <FilterSelect<FRDocumentTypeFilter>
          value={documentType}
          onValueChange={onDocumentTypeChange}
          options={docTypeOptions}
          ariaLabel="Filter by document type"
        />

        <FilterSelect<FRDateRange>
          value={dateRange}
          onValueChange={onDateRangeChange}
          options={dateOptions}
          ariaLabel="Filter by date range"
        />

        {/* Agency slug text input — FR has hundreds of slugs and no curated
            list, so a select doesn't fit; users type a substring. */}
        <div className="relative flex items-center">
          <input
            type="text"
            value={agencySlug}
            placeholder="Agency slug (e.g. environmental-protection-agency)"
            onChange={(e) => onAgencySlugChange(e.target.value)}
            className="filter-chip bg-[var(--surface)] text-[var(--foreground)] border-none focus:outline-none placeholder:text-[var(--muted)] min-w-[280px]"
          />
          {agencySlug && (
            <button
              onClick={() => onAgencySlugChange('')}
              className="absolute right-2 text-[var(--muted)] hover:text-[var(--foreground)]"
              aria-label="Clear agency filter"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Sort chips */}
      <div className="flex items-center gap-1.5">
        {SORT_CHIPS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onSortChange(opt.key)}
            className={`filter-chip ${sortBy === opt.key ? 'filter-chip-active' : ''}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
