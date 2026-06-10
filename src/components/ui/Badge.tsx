import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils/cn';

/**
 * Small inline pill for labelling/typing a piece of metadata.
 *
 * - `neutral` — surface-elevated background, muted text. The default —
 *   docket types, document types, "recently closed" status.
 * - `accent` — accent-primary-soft background, accent-primary text.
 *   For "this is one of ours / featured" labelling like the Organization
 *   tag on comments.
 * - `code` — surface-raised background, monospace ID styling. For
 *   agency codes and docket IDs that read as identifiers, not labels.
 *
 * Deadline-urgency pills (the green/amber/red countdowns) are owned by
 * `StatusTag`, not Badge.
 */
export type BadgeVariant = 'neutral' | 'accent' | 'code';
export type BadgeSize = 'xs' | 'sm';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Show a small filled dot before the label. */
  dot?: boolean;
  /** Forward chrome to the child element (Link, anchor, button, etc.). */
  asChild?: boolean;
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  neutral: 'bg-[var(--surface-elevated)] text-[var(--muted)]',
  accent: 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]',
  code: 'bg-[var(--surface-raised)] text-[var(--muted)] font-mono-id',
};

const SIZE_CLASS: Record<BadgeSize, string> = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-xs',
};

export function Badge({
  variant = 'neutral',
  size = 'sm',
  dot,
  asChild = false,
  className = '',
  children,
  style,
  ...rest
}: BadgeProps) {
  const base = 'inline-flex items-center gap-1 rounded font-medium whitespace-nowrap';
  const sized = SIZE_CLASS[size];
  const Comp = asChild ? Slot : 'span';

  return (
    <Comp
      className={cn(base, sized, VARIANT_CLASS[variant], className)}
      style={style}
      {...rest}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden />
      )}
      {children}
    </Comp>
  );
}
