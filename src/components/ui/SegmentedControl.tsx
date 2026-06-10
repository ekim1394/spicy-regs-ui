'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * The single segmented-toggle treatment: a bordered surface track holding a row
 * of pill buttons, one selected. Used for the Lab's docket switchers and the
 * match-strictness toggle — anywhere a small set of mutually-exclusive choices
 * sits inline.
 *
 * `tone` picks the active-segment fill:
 *  - `accent` (default) — brand-blue selection, for primary choices (which docket).
 *  - `inverse` — high-contrast foreground/background fill, for secondary toggles
 *    (match strictness) so the two don't compete.
 *
 * `variant` picks the semantics: `tablist` (default) renders role=tab +
 * aria-selected for choices that swap a panel; `group` renders aria-pressed for
 * in-place toggles.
 *
 * An option's `label` may be a render function `(active) => node` when the inner
 * content needs the active state (e.g. a mono id that dims when unselected).
 */
export type SegmentedTone = 'accent' | 'inverse';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode | ((active: boolean) => React.ReactNode);
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** Accessible name for the track. */
  ariaLabel: string;
  tone?: SegmentedTone;
  variant?: 'tablist' | 'group';
  /** Let segments wrap to multiple rows. */
  wrap?: boolean;
  className?: string;
}

const ACTIVE_TONE: Record<SegmentedTone, string> = {
  accent: 'bg-[var(--accent-primary)] text-white',
  inverse: 'bg-[var(--foreground)] text-[var(--background)]',
};

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  tone = 'accent',
  variant = 'tablist',
  wrap = false,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      role={variant}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 gap-1',
        wrap && 'flex-wrap',
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role={variant === 'tablist' ? 'tab' : undefined}
            aria-selected={variant === 'tablist' ? isActive : undefined}
            aria-pressed={variant === 'group' ? isActive : undefined}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              'inline-flex items-baseline gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              isActive ? ACTIVE_TONE[tone] : 'text-[var(--muted)] hover:text-[var(--foreground)]',
            )}
          >
            {typeof opt.label === 'function' ? opt.label(isActive) : opt.label}
          </button>
        );
      })}
    </div>
  );
}
