'use client';

import { FileText, Download } from 'lucide-react';

export interface Attachment {
  name: string;
  type: string;
  url: string;
}

/**
 * Attachments for a document. The data mirror carries a single `file_url` per
 * document row (often null) — no file size and no MIME type beyond the URL's
 * extension — so the table is File / Type / Download, with no size column.
 */
export function AttachmentsTable({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) {
    return (
      <div className="text-xs text-[var(--muted)] py-2">
        No downloadable files attached to this document.
      </div>
    );
  }

  return (
    <div>
      <div
        className="grid items-center pb-2 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--muted)]"
        style={{ gridTemplateColumns: '2.5fr 1fr 0.6fr' }}
      >
        <div>File</div>
        <div>Type</div>
        <div className="text-right">↓</div>
      </div>
      {attachments.map((att, i) => (
        <a
          key={i}
          href={att.url}
          target="_blank"
          rel="noopener noreferrer"
          className="grid items-center py-2.5 border-t border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] transition-colors rounded-md"
          style={{ gridTemplateColumns: '2.5fr 1fr 0.6fr' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={15} className="text-[var(--accent-primary)] flex-none" />
            <span className="text-sm text-[var(--foreground)] truncate">{att.name}</span>
          </div>
          <div className="text-xs text-[var(--muted)] uppercase">{att.type}</div>
          <div className="text-right">
            <Download size={14} className="inline text-[var(--accent-primary)]" />
          </div>
        </a>
      ))}
    </div>
  );
}
