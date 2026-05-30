'use client';

import * as React from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

/**
 * Thin styled wrapper on @radix-ui/react-tabs.
 *
 * Radix gives us roving-focus keyboard nav, correct aria roles, and
 * controlled/uncontrolled value handling. We layer on the app's underline
 * tab chrome (active = accent border + foreground text) and an optional
 * count badge slot via <TabsTrigger count="12">.
 *
 * For URL-driven tabs, pair with `useTabParam` (below) so the active tab
 * lives in `?tab=` — shareable, back/forward-able, and absent from the URL
 * when it equals the default.
 *
 *   const [tab, setTab] = useTabParam('overview', isDocketTab);
 *   <Tabs value={tab} onValueChange={setTab}>
 *     <TabsList>
 *       <TabsTrigger value="overview">Overview</TabsTrigger>
 *       <TabsTrigger value="documents" count="12">Documents</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="overview">…</TabsContent>
 *   </Tabs>
 */
export const Tabs = RadixTabs.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof RadixTabs.List>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.List>
>(function TabsList({ className = '', ...rest }, ref) {
  return (
    <RadixTabs.List
      ref={ref}
      className={cn('flex items-center gap-1 border-b border-[var(--border)]', className)}
      {...rest}
    />
  );
});

export interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger> {
  /** Optional count badge rendered after the label (e.g. document count). */
  count?: React.ReactNode;
}

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Trigger>,
  TabsTriggerProps
>(function TabsTrigger({ className = '', count, children, ...rest }, ref) {
  return (
    <RadixTabs.Trigger
      ref={ref}
      className={cn('relative -mb-px inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 border-transparent text-[var(--muted)] transition-colors cursor-pointer hover:text-[var(--foreground)] data-[state=active]:border-[var(--accent-primary)] data-[state=active]:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40 rounded-t-md', className)}
      {...rest}
    >
      {children}
      {count != null && (
        <span className="inline-flex items-center justify-center rounded-full bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
          {count}
        </span>
      )}
    </RadixTabs.Trigger>
  );
});

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(function TabsContent({ className = '', ...rest }, ref) {
  return (
    <RadixTabs.Content
      ref={ref}
      className={cn('focus-visible:outline-none', className)}
      {...rest}
    />
  );
});

/**
 * URL-only tab state bound to a query param (default `tab`).
 *
 * Unlike `useFilterState`, this deliberately does NOT touch localStorage:
 * a tab choice is page-scoped (each docket should open on its default tab),
 * not a sticky cross-page preference. The param is removed from the URL when
 * it equals `defaultValue`, so the default tab yields a clean URL.
 *
 * Invalid `?tab=` values fall back to the default at read time.
 */
export function useTabParam<T extends string>(
  defaultValue: T,
  isValid: (raw: string) => raw is T,
  paramKey = 'tab',
): [T, (next: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fromUrl = searchParams.get(paramKey);
  const value = fromUrl != null && isValid(fromUrl) ? fromUrl : defaultValue;

  const setValue = React.useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === defaultValue) params.delete(paramKey);
      else params.set(paramKey, next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, defaultValue, paramKey, pathname, router],
  );

  return [value, setValue];
}
