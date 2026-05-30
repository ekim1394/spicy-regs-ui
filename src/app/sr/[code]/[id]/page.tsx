'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PageShell } from '@/components/ui/PageShell';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Tabs, TabsList, TabsTrigger, TabsContent, useTabParam } from '@/components/ui/Tabs';
import { DocketHeader } from '@/components/docket/DocketHeader';
import { LifecycleTimeline } from '@/components/docket/LifecycleTimeline';
import { CommentBreakdown, type CommentBreakdownData } from '@/components/docket/CommentBreakdown';
import { DocumentList } from '@/components/feed/DocumentList';
import { ThreadedComments } from '@/components/feed/ThreadedComments';
import { RelatedDockets } from '@/components/feed/RelatedDockets';
import { RelatedFederalRegister } from '@/components/feed/RelatedFederalRegister';
import { AgencyIdentity } from '@/components/agency/AgencyIdentity';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { Loader2 } from 'lucide-react';
import { stripQuotes } from '@/lib/utils/fieldFormat';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

type DocketTab = 'overview' | 'documents' | 'comments';
const isDocketTab = (raw: string): raw is DocketTab =>
  raw === 'overview' || raw === 'documents' || raw === 'comments';

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
    isReady,
  } = useDuckDBService();

  const [tab, setTab] = useTabParam<DocketTab>('overview', isDocketTab);

  const [docket, setDocket] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [commentCount, setCommentCount] = useState<number | undefined>();

  // Overview comment aggregate (lazy: computed the first time the page lands on
  // the Overview tab). Near-duplicate clustering powers the breakdown.
  const [aggregate, setAggregate] = useState<CommentBreakdownData | null>(null);

  useEffect(() => {
    if (!isReady || !docketId) return;
    // Clear stale state so navigating between dockets on this route segment
    // shows the loading spinner instead of the previous docket's content.
    setLoading(true);
    setDocket(null);
    getDocketById(docketId)
      .then((result) => { setDocket(result); setLoading(false); })
      .catch((err) => { console.error('Failed to load docket:', err); setLoading(false); });
  }, [isReady, docketId, getDocketById]);

  useEffect(() => {
    if (!isReady || !docketId) return;
    setDocsLoading(true);
    setDocuments([]);
    getDocumentsForDocket(docketId)
      .then((docs) => { setDocuments(docs); setDocsLoading(false); })
      .catch((err) => { console.error('Failed to load documents:', err); setDocsLoading(false); });
  }, [isReady, docketId, getDocumentsForDocket]);

  useEffect(() => {
    if (!isReady || !docketId) return;
    setCommentCount(undefined);
    getCommentCounts([docketId])
      .then((counts) => setCommentCount(counts[docketId.toUpperCase()] ?? 0))
      .catch((err) => console.error('Failed to load comment count:', err));
  }, [isReady, docketId, getCommentCounts]);

  // Reset the lazy aggregate when the docket changes, so navigating between
  // dockets on this route segment can't show the previous docket's breakdown
  // (the lazy guard below keys off `aggregate === null`).
  useEffect(() => {
    setAggregate(null);
  }, [docketId]);

  // Lazy-load the Overview comment breakdown the first time that tab is shown.
  // One round-trip returns the daily volume, totals, and near-duplicate
  // clusters that drive the orchestration read.
  useEffect(() => {
    if (!isReady || !docketId || tab !== 'overview' || aggregate !== null) return;
    let cancelled = false;
    getCommentVolumeAndClusters(docketId, 'near')
      .then((res) => {
        if (cancelled) return;
        setAggregate(res);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load comment analytics:', err);
        setAggregate({
          totals: { total: 0, unique: 0, empty: 0 },
          volumeByDay: [],
          clusters: [],
          commentStartDate: null,
          commentEndDate: null,
        });
      });
    return () => { cancelled = true; };
  }, [isReady, docketId, tab, aggregate, getCommentVolumeAndClusters]);

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

  if (loading) {
    return (
      <PageShell mainClassName="flex justify-center py-24">
        <Loader2 size={32} className="animate-spin text-[var(--accent-primary)]" />
      </PageShell>
    );
  }

  if (!docket) {
    return (
      <PageShell maxWidth="3xl" mainClassName="max-w-3xl mx-auto px-4 py-16 text-center">
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
    <PageShell maxWidth="5xl">
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
          />

          <Tabs value={tab} onValueChange={(v) => setTab(v as DocketTab)}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="documents" count={documents.length || undefined}>Documents</TabsTrigger>
              <TabsTrigger value="comments" count={commentCount || undefined}>Comments</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="pt-5 flex flex-col gap-6">
              {abstract && (
                <section>
                  <SectionLabel label="Summary" className="mb-2" />
                  <Card interactive={false} className="p-4">
                    <p className="text-sm text-[var(--foreground)] leading-relaxed">{abstract}</p>
                  </Card>
                </section>
              )}

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
                  <SectionLabel
                    label="Comment activity"
                    caption={
                      commentCount != null
                        ? `${commentCount.toLocaleString()} ${commentCount === 1 ? 'comment' : 'comments'}`
                        : undefined
                    }
                    className="mb-3"
                  />
                  {aggregate === null ? (
                    <Card interactive={false} className="flex justify-center py-8">
                      <Loader2 size={20} className="animate-spin text-[var(--accent-primary)]" />
                    </Card>
                  ) : (
                    <CommentBreakdown data={aggregate} />
                  )}
                </section>
              )}

              <RelatedFederalRegister docketId={docketId} />
            </TabsContent>

            {/* Documents — the tab itself is the heading, so the panel carries
                no redundant section label (unlike Overview's multi-section stack). */}
            <TabsContent value="documents" className="pt-5">
              <Card interactive={false} className="p-4">
                <DocumentList
                  documents={documents}
                  loading={docsLoading}
                  agencyCode={agencyCode}
                  docketId={docketId}
                />
              </Card>
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
