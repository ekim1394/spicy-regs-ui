'use client';

import { useMemo } from 'react';
import { FilterSelect } from '@/components/ui/FilterSelect';
import {
  DATE_OPTIONS,
  DOCKET_TYPE_OPTIONS,
  SORT_CHIP_OPTIONS,
  STATUS_OPTIONS,
  type DateRange,
  type DocketType,
  type SortOption,
  type StatusOption,
  type TopicKey,
} from '@/lib/feedFilters';
import { TopicFilter } from './TopicFilter';

/**
 * Map UI Status selection to the underlying SortOption.
 * 'all' returns the chip-driven sort; 'open'/'closed' override it with the
 * status-specific ordering (deadline-asc / closed-desc respectively).
 */
function statusToSort(status: StatusOption, chipSort: SortOption): SortOption {
  if (status === 'open' || status === 'closed') return status;
  // When status is 'all', fall back to whatever sort chip is active —
  // but never to 'open'/'closed', since those mean "status is set."
  return chipSort === 'open' || chipSort === 'closed' ? 'recent' : chipSort;
}

function sortToStatus(sort: SortOption): StatusOption {
  return sort === 'open' || sort === 'closed' ? sort : 'all';
}

interface FeedFiltersProps {
  selectedAgency: string;
  onAgencyChange: (agency: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  docketType: DocketType;
  onDocketTypeChange: (type: DocketType) => void;
  topic?: TopicKey;
  onTopicChange?: (topic: TopicKey) => void;
  /** Federal Register inline toggle. Omit to hide it (e.g. agency profile). */
  includeFR?: boolean;
  onIncludeFRChange?: (next: boolean) => void;
}

export function FeedFilters({
  sortBy,
  onSortChange,
  dateRange,
  onDateRangeChange,
  docketType,
  onDocketTypeChange,
  topic,
  onTopicChange,
  includeFR,
  onIncludeFRChange,
}: FeedFiltersProps) {
  const showTopics = topic !== undefined && onTopicChange !== undefined;
  const showFRToggle = includeFR !== undefined && onIncludeFRChange !== undefined;

  // FilterSelect expects { value, label }; the feedFilters module emits
  // { key, label }. Adapt once, memoized, instead of inline at each call.
  // The default ("All …") option shows a short dimension name on the trigger
  // (e.g. "Date"), so the resting filter bar fits on one line; the menu keeps
  // the descriptive "All Time" label.
  const dateOptions = useMemo(
    () => DATE_OPTIONS.map(o => ({
      value: o.key, label: o.label, ...(o.key === '' ? { triggerLabel: 'Date' } : {}),
    })),
    [],
  );
  const typeOptions = useMemo(
    () => DOCKET_TYPE_OPTIONS.map(o => ({
      value: o.key, label: o.label, ...(o.key === '' ? { triggerLabel: 'Type' } : {}),
    })),
    [],
  );
  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map(o => ({
      value: o.key, label: o.label, ...(o.key === 'all' ? { triggerLabel: 'Status' } : {}),
    })),
    [],
  );

  return (
    // One row: sort chips · (divider) · filter dropdowns · FR toggle chip.
    // Collapsing the old two-row split removes the "which row does what?"
    // ambiguity; the divider keeps sort visually distinct from the filters.
    <div className="flex items-center gap-2 flex-wrap">
      {/* Sort — New / Popular; the Status dropdown owns Open / Closed */}
      {SORT_CHIP_OPTIONS.map(opt => (
        <button
          key={opt.key}
          onClick={() => onSortChange(opt.key)}
          className={`filter-chip ${sortBy === opt.key ? 'filter-chip-active' : ''}`}
        >
          {opt.label}
        </button>
      ))}

      <span aria-hidden className="self-stretch w-px bg-[var(--border)] mx-1 my-0.5" />

      {showTopics && <TopicFilter topic={topic} onTopicChange={onTopicChange} />}

      <FilterSelect<DateRange>
        value={dateRange}
        onValueChange={onDateRangeChange}
        options={dateOptions}
        ariaLabel="Filter by date range"
      />

      <FilterSelect<DocketType>
        value={docketType}
        onValueChange={onDocketTypeChange}
        options={typeOptions}
        ariaLabel="Filter by docket type"
      />

      <FilterSelect<StatusOption>
        value={sortToStatus(sortBy)}
        onValueChange={(s) => onSortChange(statusToSort(s, sortBy))}
        options={statusOptions}
        ariaLabel="Filter by comment period status"
      />

      {/* Federal Register: a standard toggle chip (active = included), not a
          bespoke switch — keeps one control vocabulary across the bar. */}
      {showFRToggle && (
        <button
          type="button"
          role="switch"
          aria-checked={includeFR}
          onClick={() => onIncludeFRChange!(!includeFR)}
          className={`filter-chip ${includeFR ? 'filter-chip-active' : ''}`}
        >
          Federal Register
        </button>
      )}
    </div>
  );
}
