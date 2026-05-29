'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PageShell } from '@/components/ui/PageShell';
import { Tabs, TabsList, TabsTrigger, TabsContent, useTabParam } from '@/components/ui/Tabs';
import { DocketHeader } from '@/components/docket/DocketHeader';
import { LifecycleTimeline } from '@/components/docket/LifecycleTimeline';
import { CommentVolumeChart } from '@/components/docket/CommentVolumeChart';
import { OrchestrationIndicator } from '@/components/docket/OrchestrationIndicator';
import { DocumentList } from '@/components/feed/DocumentList';
import { ThreadedComments } from '@/components/feed/ThreadedComments';
import { RelatedDockets } from '@/components/feed/RelatedDockets';
import { RelatedFederalRegister } from '@/components/feed/RelatedFederalRegister';
import { AgencyIdentity } from '@/components/agency/AgencyIdentity';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { ExportButton } from '@/components/ExportButton';
import { Loader2 } from 'lucide-react';
import { stripQuotes } from '@/lib/utils/fieldFormat';

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

  // Comments-tab data (lazy: only fetched once that tab is opened).
  const [volume, setVolume] = useState<{ day: string; n: number }[] | null>(null);
  const [orchestration, setOrchestration] = useState<{ total: number; unique: number; empty: number } | null>(null);

  useEffect(() => {
    if (!isReady || !docketId) return;
    getDocketById(docketId)
      .then((result) => { setDocket(result); setLoading(false); })
      .catch((err) => { console.error('Failed to load docket:', err); setLoading(false); });
  }, [isReady, docketId, getDocketById]);

  useEffect(() => {
    if (!isReady || !docketId) return;
    setDocsLoading(true);
    getDocumentsForDocket(docketId)
      .then((docs) => { setDocuments(docs); setDocsLoading(false); })
      .catch((err) => { console.error('Failed to load documents:', err); setDocsLoading(false); });
  }, [isReady, docketId, getDocumentsForDocket]);

  useEffect(() => {
    if (!isReady || !docketId) return;
    getCommentCounts([docketId])
      .then((counts) => setCommentCount(counts[docketId.toUpperCase()] ?? 0))
      .catch((err) => console.error('Failed to load comment count:', err));
  }, [isReady, docketId, getCommentCounts]);

  // Reset the lazy comments-tab aggregates when the docket changes, so
  // navigating between dockets on this route segment can't show the previous
  // docket's volume chart / orchestration ratio (the lazy guard below keys off
  // `volume === null`).
  useEffect(() => {
    setVolume(null);
    setOrchestration(null);
  }, [docketId]);

  // Lazy-load the Comments-tab aggregates the first time that tab is opened.
  // One round-trip returns both the daily volume and the unique/total totals.
  useEffect(() => {
    if (!isReady || !docketId || tab !== 'comments' || volume !== null) return;
    let cancelled = false;
    getCommentVolumeAndClusters(docketId)
      .then((res) => {
        if (cancelled) return;
        setVolume(res.volumeByDay);
        setOrchestration(res.totals);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load comment analytics:', err);
        setVolume([]);
        setOrchestration({ total: 0, unique: 0, empty: 0 });
      });
    return () => { cancelled = true; };
  }, [isReady, docketId, tab, volume, getCommentVolumeAndClusters]);

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
      {/* Breadcrumb + export */}
      <div className="flex items-center justify-between mb-4">
        <nav className="text-xs text-[var(--muted)]">
          <Link href="/feed" className="hover:text-[var(--foreground)]">Feed</Link>
          {' → '}
          <Link href={`/sr/${agencyCode}`} className="hover:text-[var(--foreground)]">sr/{agencyCode}</Link>
          {' → '}
          <span className="text-[var(--foreground)]">Docket</span>
        </nav>
        <ExportButton docketId={docketId} agencyCode={agencyCode} docket={docket} documents={documents} />
      </div>

      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <DocketHeader
            agencyCode={agencyCode}
            docketId={docketId}
            title={title}
            docketType={docketType}
            commentStartDate={commentPeriod.start}
            commentEndDate={commentPeriod.end}
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
                  <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] mb-2">
                    Summary
                  </h2>
                  <p className="text-sm text-[var(--foreground)] leading-relaxed">{abstract}</p>
                </section>
              )}

              <LifecycleTimeline documents={documents} commentEndDate={commentPeriod.end} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <RelatedDockets docketId={docketId} title={title} />
                <RelatedFederalRegister docketId={docketId} />
              </div>
            </TabsContent>

            {/* Documents */}
            <TabsContent value="documents" className="pt-5">
              <DocumentList
                documents={documents}
                loading={docsLoading}
                agencyCode={agencyCode}
                docketId={docketId}
              />
            </TabsContent>

            {/* Comments */}
            <TabsContent value="comments" className="pt-5 flex flex-col gap-5">
              {volume === null ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-[var(--accent-primary)]" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div>
                    <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] mb-2">
                      Daily comment volume
                    </h3>
                    <CommentVolumeChart data={volume} />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] mb-2">
                      Orchestration
                    </h3>
                    {orchestration && <OrchestrationIndicator totals={orchestration} />}
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-2 leading-relaxed">
                      Unique vs. repeated comments (grouped by normalized text). A high
                      form-letter share signals an orchestrated campaign.
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-xl overflow-hidden border border-[var(--border)]">
                <ThreadedComments docketId={docketId} modifyDate={stripQuotes(docket.modify_date)} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sticky agency identity rail */}
        <div className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-20">
            <AgencyIdentity
              agencyCode={agencyCode}
              label="Agency"
              cta="View agency profile →"
              href={`/sr/${agencyCode}`}
            />
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
