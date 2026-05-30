import * as React from 'react';
import { Header } from '@/components/Header';

/**
 * Standard page chrome: sticky Header, full-height tinted background, and
 * a centered max-width content column. Keeps the chrome consistent across
 * routes and gives one place to evolve it (e.g. adding a footer, a global
 * banner, or a dark-mode toggle).
 */
export type PageShellMaxWidth = '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';

export interface PageShellProps {
  children: React.ReactNode;
  /** Width of the content column. Defaults to `6xl` (the most common route). */
  maxWidth?: PageShellMaxWidth;
  /** Override the standard `py-6 px-4` padding on <main> entirely. */
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
  const mainCls = mainClassName ?? `${MAX_W_CLASS[maxWidth]} mx-auto px-4 py-6`;
  return (
    <div className={`min-h-screen bg-[var(--background)] ${className}`}>
      <Header maxWidthClass={MAX_W_CLASS[maxWidth]} />
      <main className={mainCls}>{children}</main>
    </div>
  );
}
