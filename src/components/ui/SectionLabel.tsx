import type { ReactNode } from 'react';

interface SectionLabelProps {
  /** The uppercase section label (e.g. "Comment activity"). */
  label: ReactNode;
  /**
   * Optional muted companion shown after a "·" separator (e.g. a count or a
   * one-line description) — the same label + caption pairing the feed uses for
   * "All rulemaking · 274,956 dockets".
   */
  caption?: ReactNode;
  className?: string;
}

/**
 * The single section-header treatment used across the app: a small uppercase
 * label with an optional muted "· caption" companion, so section headers read
 * identically wherever they appear.
 */
export function SectionLabel({ label, caption, className = '' }: SectionLabelProps) {
  return (
    <div className={`flex items-baseline gap-2 min-w-0 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] truncate">
        {label}
      </span>
      {caption != null && caption !== false && (
        <span className="text-[10.5px] text-[var(--muted-foreground)] whitespace-nowrap">
          · {caption}
        </span>
      )}
    </div>
  );
}
