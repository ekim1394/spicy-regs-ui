import type { ReactNode } from 'react';

/** The ContentPage template's repeating unit: serif h2 + a body slot. */
export function ContentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-xl text-[var(--foreground)] mb-3">{title}</h2>
      {children}
    </section>
  );
}
