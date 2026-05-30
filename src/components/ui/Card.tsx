'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils/cn';

/**
 * Generic card surface. `variant` selects the corner radius:
 *
 * - `default` — the plain `.card` (1.5px border, 12px radius, accent border
 *   + soft indigo shadow on hover).
 * - `gradient` / `post` — `.card .card-lg`, the same card bumped to a 16px
 *   radius for feed posts, identity cards, feature tiles, and Lab panels.
 *   The two names are interchangeable aliases for the large radius.
 *
 * `asChild` (via Radix Slot) lets you forward the card chrome to a child
 * element like a `<Link>` so the entire card is clickable without an
 * extra wrapping div. Matches the pattern in shadcn-style component
 * libraries.
 *
 * `interactive` (default `true`) selects the hover behaviour: the standard
 * `.card` lifts its border to the accent + a soft indigo shadow on hover —
 * right for clickable surfaces (feed posts, mini cards). Set `false` for
 * static content panels (summaries, timelines, the docket header, table
 * shells) so they get the same border/radius chrome WITHOUT an accent-border
 * hover that would falsely read as a click target (`.card-static`).
 *
 * Padding is intentionally NOT baked in — call sites use different
 * paddings (`p-3`, `p-4`, `p-5`) and a fixed default would force every
 * caller to either accept it or override. Pass it via `className`.
 */
export type CardVariant = 'default' | 'gradient' | 'post';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Hover lift on (default) for clickable surfaces; off for static panels. */
  interactive?: boolean;
  asChild?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', interactive = true, asChild = false, className = '', ...rest },
  ref,
) {
  const Comp = asChild ? Slot : 'div';
  const base = interactive ? 'card' : 'card-static';
  const radius = variant === 'default' ? '' : 'card-lg';
  return (
    <Comp
      ref={ref}
      className={cn(base, radius, className)}
      {...rest}
    />
  );
});
