import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

/**
 * Small inline pill for labelling/typing a piece of metadata.
 *
 * Variants encode the four shapes the codebase had been re-soldering
 * inline:
 *
 * - `neutral` — surface-elevated background, muted text. The default —
 *   docket types, document types, "recently closed" status.
 * - `accent` — accent-primary-soft background, accent-primary text.
 *   For "this is one of ours / featured" labelling like the Organization
 *   tag on comments.
 * - `code` — surface-raised background, monospace ID styling. For
 *   agency codes and docket IDs that read as identifiers, not labels.
 * - `urgent` — caller-provided color via `color` prop. For deadline
 *   countdowns where the color encodes time-remaining urgency
 *   (green / amber / red). Renders the colored dot too when `dot` is
 *   set, matching the existing pattern.
 */
export type BadgeVariant = 'neutral' | 'accent' | 'code' | 'urgent';
export type BadgeSize = 'xs' | 'sm';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Required when `variant="urgent"`; sets bg (15% alpha) + text + dot color. */
  color?: string;
  /** Show a small filled dot before the label (urgent-style). */
  dot?: boolean;
  /** Forward chrome to the child element (Link, anchor, button, etc.). */
  asChild?: boolean;
}

const VARIANT_CLASS: Record<Exclude<BadgeVariant, 'urgent'>, string> = {
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
  color,
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

  if (variant === 'urgent') {
    // Caller drives color; we just compose the chrome.
    const urgentStyle: React.CSSProperties = color
      ? { backgroundColor: `${color}26`, color, ...style }
      : (style ?? {});
    return (
      <Comp className={`${base} ${sized} ${className}`} style={urgentStyle} {...rest}>
        {dot && (
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
        )}
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      className={`${base} ${sized} ${VARIANT_CLASS[variant]} ${className}`}
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
