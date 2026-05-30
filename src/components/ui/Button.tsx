import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils/cn';

/**
 * The two button treatments:
 *
 * - `primary` — filled electric-indigo CTA (`.btn-primary`). The single
 *   high-emphasis action: "View all dockets", "Browse the feed".
 * - `secondary` — bordered, neutral-fill companion (`.btn-secondary`) whose
 *   border lifts to the accent on hover, the same gesture as `.card`. For the
 *   quieter of two adjacent actions (e.g. the agency-rail CTA).
 *
 * `asChild` (via Radix Slot) forwards the chrome to a child — almost always a
 * Next `<Link>` — so a navigational button stays a real anchor:
 *
 *   <Button asChild variant="primary" className="w-full">
 *     <Link href="/feed">Browse the feed →</Link>
 *   </Button>
 *
 * Layout (width, alignment, text size) stays at the call site via `className`;
 * the variant owns only color, padding, radius, and hover.
 */
export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  asChild?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
};

const BASE =
  'inline-flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', asChild = false, className = '', ...rest },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(BASE, VARIANT_CLASS[variant], className)}
      {...rest}
    />
  );
});
