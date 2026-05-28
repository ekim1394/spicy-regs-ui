import type { ReactNode } from 'react';

interface PanelHeaderProps {
  /** Small uppercase function-of-block label, e.g. "Comment uniqueness" */
  label: string;
  /** Main editorial title for the panel */
  title: string;
  /** 1–2 sentence explanation of the panel */
  caption: ReactNode;
  /** Optional headline finding */
  finding?: ReactNode;
}

export function PanelHeader({ label, title, caption, finding }: PanelHeaderProps) {
  return (
    <header className="mb-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-primary)] mb-1.5">
        {label}
      </div>
      <h2
        className="text-2xl font-serif font-semibold mb-2 leading-tight"
        style={{ letterSpacing: '-0.01em' }}
      >
        {title}
      </h2>
      <p className="text-sm text-[var(--muted)] leading-relaxed max-w-3xl">{caption}</p>
      {finding && <FindingNote>{finding}</FindingNote>}
    </header>
  );
}

/** Inline finding callout. No left-border treatment — uses a tinted background + small uppercase label. */
export function FindingNote({ children }: { children: ReactNode }) {
  return (
    <div
      className="mt-3 rounded-lg px-3.5 py-2.5 max-w-3xl text-sm leading-snug"
      style={{
        background: 'rgba(59, 40, 246, 0.06)',
        color: 'var(--foreground)',
      }}
    >
      <span className="font-semibold uppercase tracking-wider text-[10px] mr-2 text-[var(--accent-primary)]">
        Finding
      </span>
      {children}
    </div>
  );
}

interface DocketIdentityProps {
  docketId: string;
  /** Full title from the docket; may itself contain an FR docket prefix */
  title?: string;
  /** Optional hyperlink target for the docket */
  href?: string;
}

/**
 * Consistent docket display: docket number on its own line in monospace, title
 * below in serif. Use anywhere a docket is the subject of a section or card.
 */
export function DocketIdentity({ docketId, title, href }: DocketIdentityProps) {
  const idEl = (
    <span className="font-mono-id text-[var(--accent-primary)] hover:underline">
      {docketId}
    </span>
  );
  return (
    <div>
      <div className="mb-0.5">
        {href ? <a href={href} className="no-underline">{idEl}</a> : idEl}
      </div>
      {title && (
        <div
          className="font-serif font-semibold text-lg leading-snug"
          style={{ letterSpacing: '-0.005em' }}
        >
          {title}
        </div>
      )}
    </div>
  );
}
