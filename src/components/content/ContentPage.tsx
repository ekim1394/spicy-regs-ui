import type { ReactNode } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { SectionLabel } from '@/components/ui/SectionLabel';

export interface ContentPageProps {
  eyebrow?: string;
  title: string;
  lede?: string;
  children: ReactNode;
}

/**
 * Reusable editorial content-page template: a centered column (block-centered,
 * text left-aligned) with eyebrow + serif h1 + Inter lede, a rule, then stacked
 * sections. Rendered on the same PageShell as Agencies and Document so static
 * pages (About, methodology, guidelines, privacy) read as native product, not
 * bolted-on marketing.
 */
export function ContentPage({ eyebrow, title, lede, children }: ContentPageProps) {
  return (
    <PageShell maxWidth="4xl">
      {eyebrow && <SectionLabel label={eyebrow} />}
      <h1 className="font-serif text-4xl text-[var(--foreground)] leading-tight mt-1.5 mb-3">
        {title}
      </h1>
      {lede && (
        <p className="text-lg leading-relaxed text-[var(--muted)] max-w-[92%]">{lede}</p>
      )}
      <div className="border-t border-[var(--border)] my-7" />
      <div className="flex flex-col gap-9">{children}</div>
    </PageShell>
  );
}
