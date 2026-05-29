'use client';

import { useMemo } from 'react';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { TOPIC_OPTIONS, type TopicKey } from '@/lib/feedFilters';

interface TopicFilterProps {
  topic: TopicKey;
  onTopicChange: (topic: TopicKey) => void;
}

export function TopicFilter({ topic, onTopicChange }: TopicFilterProps) {
  const options = useMemo(
    () =>
      // Emoji topic taxonomy retired (clashed with the thin Lucide line-icon
      // system) — topic chips are now plain text. See design-system README.
      TOPIC_OPTIONS.map(o => ({
        value: o.key,
        label: o.label,
        // Default "All Topics" shows as the short "Topic" on the trigger so the
        // filter bar stays on one line; the menu keeps the full label.
        ...(o.key === '' ? { triggerLabel: 'Topic' } : {}),
      })),
    [],
  );

  return (
    <FilterSelect<TopicKey>
      value={topic}
      onValueChange={onTopicChange}
      options={options}
      ariaLabel="Filter by topic"
    />
  );
}
