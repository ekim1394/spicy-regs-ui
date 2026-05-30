'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PageShell } from '@/components/ui/PageShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { DocumentDetail } from '@/components/document/DocumentDetail';
import { AttachmentsTable, type Attachment } from '@/components/document/AttachmentsTable';
import { DemoCallout } from '@/components/document/DemoCallout';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { Loader2 } from 'lucide-react';
import { stripQuotes } from '@/lib/utils/fieldFormat';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

export default function DocumentPage() {
  const params = useParams();
  const agencyCode = ((params.code as string) || '').toUpperCase();
  const docketIdParam = decodeURIComponent((params.id as string) || '').toUpperCase();
  const docId = decodeURIComponent((params.docId as string) || '');

  const { getDocumentById, isReady } = useDuckDBService();
  const [doc, setDoc] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  // Null while loading so the bare brand shows until the document resolves.
  usePageTitle(doc ? stripQuotes(doc.title) || docId : null);

  useEffect(() => {
    if (!isReady || !docId) return;
    // Clear stale state so navigating between documents shows the loading
    // spinner instead of the previous document.
    setLoading(true);
    setDoc(null);
    getDocumentById(docId)
      .then((result) => { setDoc(result); setLoading(false); })
      .catch((err) => { console.error('Failed to load document:', err); setLoading(false); });
  }, [isReady, docId, getDocumentById]);

  const attachments = useMemo<Attachment[]>(() => {
    const url = stripQuotes(doc?.file_url);
    if (!url) return [];
    const name = url.split('/').pop() || 'Document';
    const type = name.includes('.') ? name.split('.').pop()!.toUpperCase() : 'FILE';
    return [{ name, type, url }];
  }, [doc]);

  if (loading) {
    return (
      <PageShell mainClassName="flex justify-center py-24">
        <Loader2 size={32} className="animate-spin text-[var(--accent-primary)]" />
      </PageShell>
    );
  }

  if (!doc) {
    return (
      <PageShell maxWidth="3xl" mainClassName="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Document not found</h1>
        <p className="text-[var(--muted)] mb-4 font-mono-id">{docId}</p>
        <Link href={`/sr/${agencyCode}/${encodeURIComponent(docketIdParam)}`} className="text-[var(--accent-primary)] hover:underline">
          ← Back to docket
        </Link>
      </PageShell>
    );
  }

  const docketId = stripQuotes(doc.docket_id) || docketIdParam;
  const title = stripQuotes(doc.title) || docId;
  const documentType = stripQuotes(doc.document_type);

  return (
    <PageShell maxWidth="2xl" mainClassName="max-w-2xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-[var(--muted)] mb-5">
        <Link href="/feed" className="hover:text-[var(--foreground)]">Feed</Link>
        {' → '}
        <Link href={`/sr/${agencyCode}`} className="hover:text-[var(--foreground)]">sr/{agencyCode}</Link>
        {' → '}
        <Link href={`/sr/${agencyCode}/${encodeURIComponent(docketId)}`} className="hover:text-[var(--foreground)]">Docket</Link>
        {' → '}
        <span className="text-[var(--foreground)]">Document</span>
      </nav>

      <div className="flex flex-col gap-5">
        {/* Header */}
        <div>
          {documentType && <Badge variant="neutral" size="sm">{documentType}</Badge>}
          <h1 className="font-serif text-2xl text-[var(--foreground)] leading-snug mt-3 mb-1.5">
            {title}
          </h1>
          <Link
            href={`/sr/${agencyCode}/${encodeURIComponent(docketId)}`}
            className="text-xs text-[var(--muted)] hover:text-[var(--accent-primary)]"
          >
            In docket <span className="font-mono-id">{docketId}</span>
          </Link>
        </div>

        {/* Detail */}
        <Card interactive={false} className="p-4">
          <SectionLabel label="Document detail" className="mb-2" />
          <DocumentDetail
            agencyCode={agencyCode}
            documentType={documentType}
            postedDate={stripQuotes(doc.posted_date)}
            commentStartDate={stripQuotes(doc.comment_start_date)}
            commentEndDate={stripQuotes(doc.comment_end_date)}
          />
        </Card>

        {/* Attachments */}
        <Card interactive={false} className="p-4">
          <SectionLabel label="Attachments" className="mb-2" />
          <AttachmentsTable attachments={attachments} />
        </Card>

        {/* Honest-by-design gap */}
        <DemoCallout agencyCode={agencyCode} docketId={docketId} />
      </div>
    </PageShell>
  );
}
