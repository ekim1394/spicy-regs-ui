'use client';

import { useMemo, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PageShell } from '@/components/ui/PageShell';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { QueryErrorCard } from '@/components/ui/QueryErrorCard';
import { Tabs, TabsList, TabsTrigger, TabsContent, useTabParam } from '@/components/ui/Tabs';
import { DocketHeader } from '@/components/docket/DocketHeader';
import { LifecycleTimeline } from '@/components/docket/LifecycleTimeline';
import { CommentBreakdown } from '@/components/docket/CommentBreakdown';
import { DocumentList } from '@/components/feed/DocumentList';
import { ThreadedComments } from '@/components/feed/ThreadedComments';
import { RelatedDockets } from '@/components/feed/RelatedDockets';
import { RelatedFederalRegister } from '@/components/feed/RelatedFederalRegister';
import { AgencyIdentity } from '@/components/agency/AgencyIdentity';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import { Loader2, ExternalLink } from 'lucide-react';
import { stripQuotes } from '@/lib/utils/fieldFormat';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

type DocketTab = 'overview' | 'documents' | 'comments';
const isDocketTab = (raw: string): raw is DocketTab =>
  raw === 'overview' || raw === 'documents' || raw === 'comments';

// Stable empty array so the commentPeriod memo below doesn't recompute on every
// render while documents are still loading.
const NO_DOCUMENTS: any[] = [];

function DocketDetailInner() {
  const params = useParams();
  const agencyCode = ((params.code as string) || '').toUpperCase();
  const rawId = (params.id as string) || '';
  const docketId = decodeURIComponent(rawId).toUpperCase();

  const {
    getDocketById,
    getDocumentsForDocket,
    getCommentCounts,
    getCommentVolumeAndClusters,
  } = useDuckDBService();

  const [tab, setTab] = useTabParam<DocketTab>('overview', isDocketTab);

  const docketQ = useAsyncData(() => getDocketById(docketId), [docketId], { enabled: !!docketId });
  const docsQ = useAsyncData(() => getDocumentsForDocket(docketId), [docketId], { enabled: !!docketId });
  const countQ = useAsyncData(
    () => getCommentCounts([docketId]).then((c) => c[docketId.toUpperCase()] ?? 0),
    [docketId],
    { enabled: !!docketId },
  );
  // Lazy: only fetched once the page is on the Overview tab (the hook's own
  // stale guard replaces the old reset-on-docket-change effect).
  const aggregateQ = useAsyncData(
    () => getCommentVolumeAndClusters(docketId, 'near'),
    [docketId],
    { enabled: !!docketId && tab === 'overview' },
  );

  const docket = docketQ.data;
  const documents = docsQ.data ?? NO_DOCUMENTS;
  const commentCount = countQ.data;
  const aggregate = aggregateQ.data ?? null;

  // e.g. "Definition of an Investment Advice Fiduciary (Docket EBSA-2023-0014)".
  // Null while loading so the bare brand shows until the docket resolves.
  usePageTitle(
    docket ? `${stripQuotes(docket.title) || docketId} (Docket ${docketId})` : null,
  );

  const commentPeriod = useMemo(() => {
    let start: string | null = null;
    let end: string | null = null;
    for (const d of documents) {
      const s = stripQuotes(d.comment_start_date);
      const e = stripQuotes(d.comment_end_date);
      if (s && (!start || s < start)) start = s;
      if (e && (!end || e > end)) end = e;
    }
    return { start, end };
  }, [documents]);

  if (docketQ.error) {
    return (
      <PageShell maxWidth="4xl" mainClassName="w-full max-w-4xl mx-auto px-4 py-16">
        <QueryErrorCard message="Couldn't load this docket." error={docketQ.error} onRetry={docketQ.refetch} />
      </PageShell>
    );
  }

  // `undefined` = still resolving; `null` = resolved but no such docket.
  if (docketQ.isLoading || docket === undefined) {
    return (
      <PageShell mainClassName="flex justify-center py-24">
        <Loader2 size={32} className="animate-spin text-[var(--accent-primary)]" />
      </PageShell>
    );
  }

  if (!docket) {
    return (
      <PageShell maxWidth="4xl" mainClassName="w-full max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Docket not found</h1>
        <p className="text-[var(--muted)] mb-4">{docketId}</p>
        <Link href={`/sr/${agencyCode}`} className="text-[var(--accent-primary)] hover:underline">
          ← Back to sr/{agencyCode}
        </Link>
      </PageShell>
    );
  }

  const title = stripQuotes(docket.title) || docketId;
  const abstract = stripQuotes(docket.abstract);
  const docketType = stripQuotes(docket.docket_type);

  return (
    <PageShell maxWidth="4xl">
      {/* Breadcrumb */}
      <nav className="text-xs text-[var(--muted)] mb-4">
        <Link href="/feed" className="hover:text-[var(--foreground)]">Feed</Link>
        {' → '}
        <Link href={`/sr/${agencyCode}`} className="hover:text-[var(--foreground)]">sr/{agencyCode}</Link>
        {' → '}
        <span className="text-[var(--foreground)]">Docket</span>
      </nav>

      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <DocketHeader
            agencyCode={agencyCode}
            docketId={docketId}
            title={title}
            docketType={docketType}
            abstract={abstract || undefined}
          />

          <Tabs value={tab} onValueChange={(v) => setTab(v as DocketTab)}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="documents" count={documents.length || undefined}>Documents</TabsTrigger>
              <TabsTrigger value="comments" count={commentCount || undefined}>Comments</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="pt-5 flex flex-col gap-6">
              <section>
                <SectionLabel label="Timeline" className="mb-2" />
                <Card interactive={false} className="p-4">
                  <LifecycleTimeline
                    documents={documents}
                    commentStartDate={commentPeriod.start}
                    commentEndDate={commentPeriod.end}
                  />
                </Card>
              </section>

              {commentCount !== 0 && (
                <section>
                  {aggregateQ.error ? (
                    <QueryErrorCard
                      message="Couldn't load the comment breakdown."
                      error={aggregateQ.error}
                      onRetry={aggregateQ.refetch}
                    />
                  ) : aggregate === null ? (
                    <Card interactive={false} className="flex justify-center py-8">
                      <Loader2 size={20} className="animate-spin text-[var(--accent-primary)]" />
                    </Card>
                  ) : (
                    <CommentBreakdown data={aggregate} />
                  )}
                </section>
              )}

              {/* Canonical source link — lives here on the docket page rather than
                  on every feed card. Only the destination is hyperlinked; the
                  surrounding text is plain context. */}
              <section>
                <SectionLabel label="View on regulations.gov" className="mb-2" />
                <p className="text-sm text-[var(--muted)]">
                  View the full{' '}
                  <a
                    href={`https://www.regulations.gov/docket/${docketId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[var(--accent-primary)] hover:underline"
                  >
                    &ldquo;{title}&rdquo;
                    <ExternalLink size={13} className="ml-1 inline-block shrink-0 align-baseline" />
                  </a>{' '}
                  docket on regulations.gov
                </p>
              </section>

              <RelatedFederalRegister docketId={docketId} />
            </TabsContent>

            {/* Documents — the tab itself is the heading, so the panel carries
                no redundant section label (unlike Overview's multi-section stack). */}
            <TabsContent value="documents" className="pt-5">
              {docsQ.error ? (
                <QueryErrorCard
                  message="Couldn't load documents for this docket."
                  error={docsQ.error}
                  onRetry={docsQ.refetch}
                />
              ) : (
                <Card interactive={false} className="p-4">
                  <DocumentList
                    documents={documents}
                    loading={docsQ.isLoading || docsQ.data === undefined}
                    agencyCode={agencyCode}
                    docketId={docketId}
                  />
                </Card>
              )}
            </TabsContent>

            {/* Comments */}
            <TabsContent value="comments" className="pt-5">
              <Card interactive={false} className="p-4">
                <ThreadedComments docketId={docketId} modifyDate={stripQuotes(docket.modify_date)} />
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sticky agency identity rail */}
        <div className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-20 flex flex-col gap-6">
            <AgencyIdentity
              agencyCode={agencyCode}
              label="Agency"
              cta="View agency profile →"
              href={`/sr/${agencyCode}`}
            />
            <RelatedDockets docketId={docketId} title={title} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export default function DocketDetailPage() {
  return (
    <Suspense
      fallback={
        <PageShell mainClassName="flex justify-center py-24">
          <Loader2 size={32} className="animate-spin text-[var(--accent-primary)]" />
        </PageShell>
      }
    >
      <DocketDetailInner />
    </Suspense>
  );
}
