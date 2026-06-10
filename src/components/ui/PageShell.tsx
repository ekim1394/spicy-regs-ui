import * as React from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

/**
 * Standard page chrome: sticky Header, full-height tinted background, a centered
 * max-width content column, and a short global Footer pinned to the bottom.
 * Keeps the chrome consistent across routes and gives one place to evolve it.
 * The Header/Footer use a fixed inner width (see `APP_FRAME`) so they never
 * reflow as the content `maxWidth` changes between routes.
 */
export type PageShellMaxWidth = '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';

export interface PageShellProps {
  children: React.ReactNode;
  /** Width of the content column. Defaults to `6xl` (the most common route). */
  maxWidth?: PageShellMaxWidth;
  /** Replace the standard `max-w-* mx-auto px-4 py-6` on <main> (flex-1 is kept). */
  mainClassName?: string;
  /** Extra classes on the outer wrapper. */
  className?: string;
}

const MAX_W_CLASS: Record<PageShellMaxWidth, string> = {
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
};

export function PageShell({
  children,
  maxWidth = '6xl',
  mainClassName,
  className = '',
}: PageShellProps) {
  // `flex-1` lets <main> grow so the footer is pushed to the bottom on short
  // pages (loaders, not-found). `w-full` is essential: <main> is a flex item
  // with `mx-auto`, and auto cross-axis margins disable the default `stretch`,
  // so without an explicit width <main> shrinks to fit its content — making the
  // column (and everything centered in it) jump narrower whenever a route's
  // content is narrow (e.g. an empty filter result). Callers' mainClassName
  // overrides still apply, and should include `w-full` themselves if centered.
  const mainCls = `flex-1 ${mainClassName ?? `w-full ${MAX_W_CLASS[maxWidth]} mx-auto px-4 py-6`}`;
  return (
    <div className={`min-h-screen flex flex-col bg-[var(--background)] ${className}`}>
      <Header />
      <main className={mainCls}>{children}</main>
      <Footer />
    </div>
  );
}
