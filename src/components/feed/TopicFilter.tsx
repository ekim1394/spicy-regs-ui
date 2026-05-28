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
      TOPIC_OPTIONS.map(o => ({
        value: o.key,
        label: (
          <>
            {o.emoji} {o.label}
          </>
        ),
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
