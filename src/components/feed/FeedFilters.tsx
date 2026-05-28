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
}: FeedFiltersProps) {
  const showTopics = topic !== undefined && onTopicChange !== undefined;

  // FilterSelect expects { value, label }; the feedFilters module emits
  // { key, label }. Adapt once, memoized, instead of inline at each call.
  const dateOptions = useMemo(
    () => DATE_OPTIONS.map(o => ({ value: o.key, label: o.label })),
    [],
  );
  const typeOptions = useMemo(
    () => DOCKET_TYPE_OPTIONS.map(o => ({ value: o.key, label: o.label })),
    [],
  );
  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map(o => ({ value: o.key, label: o.label })),
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: dropdowns */}
      <div className="flex items-center gap-3 flex-wrap">
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
      </div>

      {/* Row 2: Sort Chips — only New / Popular; status dropdown handles Open / Closed */}
      <div className="flex items-center gap-1.5">
        {SORT_CHIP_OPTIONS.map(opt => (
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
