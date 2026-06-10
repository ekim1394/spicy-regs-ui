'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { PanelHeader, DocketIdentity } from '@/components/ui/PanelHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CommentBreakdown, type Cluster } from '@/components/docket/CommentBreakdown';
import { cn } from '@/lib/utils/cn';

// Re-exported for the fidelity panel, which shares these primitives.
export { MetricCard, ClusterCard } from '@/components/docket/CommentBreakdown';
export type { Cluster } from '@/components/docket/CommentBreakdown';

/**
 * Two dockets to compare:
 *   1. HUD-2026-0529 — a small recent docket on HUD's Equal Access Rule
 *      revisions. ~600 comments, virtually all unique. The "what does a
 *      clean, organic comment period look like" case.
 *   2. ATF-2023-0002 — a high-profile recent ATF rulemaking on forced reset
 *      triggers / bump-stock-type devices. ~370K comments in the mirror, a
 *      domain known for gun-rights advocacy mass-comment campaigns. The
 *      "what does orchestration look like" case.
 */
interface DocketTab { id: string; label: string }

/**
 * The curated pair anchors the comparison; a couple of randomly-sampled dockets
 * are appended at runtime (see CommentOrchestrationPanel) so the reader can see
 * how the near-duplicate clustering behaves on arbitrary, uncurated dockets.
 */
const PRESET_DOCKETS: DocketTab[] = [
  { id: 'HUD-2026-0529', label: 'Organic' },
  { id: 'ATF-2023-0002', label: 'Orchestrated' },
];

interface VolumeRow { day: string; n: number }
interface Totals { total: number; unique: number; empty: number }
interface DocketData {
  docketId: string;
  docketTitle: string;
  docketAbstract: string;
  commentStartDate: string | null;
  commentEndDate: string | null;
  totals: Totals;
  volumeByDay: VolumeRow[];
  clusters: Cluster[];
}

export function CommentOrchestrationPanel() {
  const { getCommentVolumeAndClusters, getRandomDocketsWithComments, isReady } = useDuckDBService();
  const [results, setResults] = useState<Record<string, DocketData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dockets, setDockets] = useState<DocketTab[]>(PRESET_DOCKETS);
  const [activeId, setActiveId] = useState<string>(PRESET_DOCKETS[0].id);
  const requested = useRef<Set<string>>(new Set());
  const randomsLoaded = useRef(false);

  // Append exactly two randomly-sampled dockets after the curated pair, once.
  // (random() returns fresh ids each call, so this MUST be one-shot — otherwise
  // every effect re-run / StrictMode double-invoke appends another pair.)
  useEffect(() => {
    if (!isReady || randomsLoaded.current) return;
    randomsLoaded.current = true;
    let cancelled = false;
    getRandomDocketsWithComments(2, 200, 50000)
      .then(rows => {
        if (cancelled) return;
        setDockets(prev => {
          const seen = new Set(prev.map(d => d.id));
          const extra = rows
            .map((r, i) => ({ id: r.docket_id.toUpperCase(), label: `Random ${i + 1}` }))
            .filter(d => !seen.has(d.id));
          return [...prev, ...extra];
        });
      })
      .catch(err => {
        randomsLoaded.current = false; // allow a retry on transient failure
        console.error('CommentOrchestrationPanel random dockets:', err);
      });
    return () => { cancelled = true; };
  }, [isReady, getRandomDocketsWithComments]);

  // Lazily load near-duplicate clustering for every docket tab (curated + random).
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    dockets.forEach(({ id }) => {
      if (requested.current.has(id)) return;
      requested.current.add(id);
      getCommentVolumeAndClusters(id, 'near')
        .then(res => {
          if (cancelled) return;
          setResults(prev => ({ ...prev, [id]: { docketId: id, ...res } }));
        })
        .catch(err => {
          if (cancelled) return;
          console.error(`CommentOrchestrationPanel ${id}:`, err);
          setErrors(prev => ({ ...prev, [id]: String(err?.message ?? err) }));
        });
    });
    return () => { cancelled = true; };
  }, [isReady, dockets, getCommentVolumeAndClusters]);

  return (
    <section className="card card-lg p-6 mb-8">
      <PanelHeader
        label="Comment uniqueness"
        title="Organic comments or orchestrated campaign?"
        caption={
          <>
            Mass comment campaigns, where thousands of identical or near-identical letters
            arrive through advocacy platforms, are now routine in federal rulemaking. For each
            docket below, we group{' '}
            <span
              title="A comment that closely matches at least one other submission once formatting, names, numbers, and word order are normalized away"
              className="underline decoration-dotted underline-offset-2 cursor-help"
            >
              near-identical comments
            </span>{' '}
            (looking past formatting, names, numbers, and word order) to separate form letters
            from genuinely unique submissions.
          </>
        }
      />

      <DocketTabs
        active={activeId}
        onChange={setActiveId}
        results={results}
        dockets={dockets}
      />

      <div className="mt-5">
        <DocketSubsection
          key={activeId}
          docketId={activeId}
          data={results[activeId]}
          error={errors[activeId]}
        />
      </div>
    </section>
  );
}

function DocketTabs({
  active,
  onChange,
  results,
  dockets,
}: {
  active: string;
  onChange: (id: string) => void;
  results: Record<string, DocketData>;
  dockets: DocketTab[];
}) {
  return (
    <SegmentedControl
      ariaLabel="Example dockets"
      wrap
      value={active}
      onValueChange={onChange}
      options={dockets.map(({ id, label }) => ({
        value: id,
        label: (isActive: boolean) => (
          <>
            <span>{label}</span>
            <span
              className={cn(
                'font-mono-id text-[10px]',
                isActive ? 'text-white/80' : 'text-[var(--muted-foreground)]',
              )}
            >
              {results[id] ? id : '…'}
            </span>
          </>
        ),
      }))}
    />
  );
}

function DocketSubsection({
  docketId,
  data,
  error,
}: {
  docketId: string;
  data?: DocketData;
  error?: string;
}) {
  const loading = !data && !error;
  return (
    <div>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <DocketIdentity
          docketId={docketId}
          title={data?.docketTitle}
          href={`/sr/${docketId.split('-')[0]}/${docketId}`}
        />
        {data && (
          <Link
            href={`/sr/${docketId.split('-')[0]}/${docketId}`}
            className="text-xs text-[var(--accent-primary)] hover:underline whitespace-nowrap shrink-0 mt-1"
          >
            View docket →
          </Link>
        )}
      </div>

      {data?.docketAbstract && (
        <p className="text-xs text-[var(--muted)] mb-3 max-w-4xl leading-relaxed line-clamp-2"
           style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {data.docketAbstract.replace(/<[^>]+>/g, ' ')}
        </p>
      )}

      {loading && (
        <div className="text-sm text-[var(--muted)] py-4">Loading comments and computing clusters…</div>
      )}
      {error && (
        <div className="text-sm text-[var(--accent-red)] py-2">Error: {error}</div>
      )}

      {data && <CommentBreakdown data={data} />}
    </div>
  );
}
