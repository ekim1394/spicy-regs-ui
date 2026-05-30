'use client';

import * as React from 'react';
import * as RadixDropdown from '@radix-ui/react-dropdown-menu';

/**
 * Thin styled wrapper on @radix-ui/react-dropdown-menu. Radix handles the
 * outside-click / escape / focus management; this layer only adds styling.
 *
 * Usage:
 *   <DropdownMenu>
 *     <DropdownMenuTrigger asChild>
 *       <button>Export ▾</button>
 *     </DropdownMenuTrigger>
 *     <DropdownMenuContent align="end">
 *       <DropdownMenuItem onSelect={exportCSV}>CSV</DropdownMenuItem>
 *       <DropdownMenuItem onSelect={exportJSON}>JSON</DropdownMenuItem>
 *     </DropdownMenuContent>
 *   </DropdownMenu>
 *
 * Radix gives us free: outside-click close, escape close, focus
 * trapping, arrow-key navigation, type-ahead, and correct aria roles.
 */
export const DropdownMenu = RadixDropdown.Root;
export const DropdownMenuTrigger = RadixDropdown.Trigger;

/**
 * Styled content surface. Matches the popover chrome of the current
 * ExportButton menu (rounded, border, surface-elevated, shadow).
 */
export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof RadixDropdown.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Content>
>(function DropdownMenuContent({ className = '', sideOffset = 4, ...rest }, ref) {
  return (
    <RadixDropdown.Portal>
      <RadixDropdown.Content
        ref={ref}
        sideOffset={sideOffset}
        className={`z-50 min-w-[12rem] rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg overflow-hidden p-1 ${className}`}
        {...rest}
      />
    </RadixDropdown.Portal>
  );
});

/** Single selectable row inside a DropdownMenuContent. */
export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdown.Item>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Item>
>(function DropdownMenuItem({ className = '', ...rest }, ref) {
  return (
    <RadixDropdown.Item
      ref={ref}
      className={`relative flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer text-[var(--foreground)] data-[highlighted]:bg-[var(--surface-raised)] data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed focus:outline-none ${className}`}
      {...rest}
    />
  );
});
