'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { PanelHeader, FindingNote, DocketIdentity } from '@/components/ui/PanelHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { MetricCard, ClusterCard, type Cluster } from './CommentOrchestrationPanel';
import { isPlaceholder } from '@/lib/text/normalize';
import { computeOrchestration } from '@/lib/comments/orchestration';
import { scoreStance, aggregateStance } from '@/lib/text/stance';
import { StanceSplit, StanceChip } from './stanceViz';

/**
 * Comment fidelity demo. Same two dockets as the orchestration panel — one
 * organic, one mass-orchestrated — but here the reader can dial the match
 * strictness and watch how much "uniqueness" exact-text matching was inventing,
 * plus a per-template stance read. Everything runs live in DuckDB-WASM via the
 * portable SQL in lib/text/normalize.ts; the heavy/high-fidelity versions are
 * called out for the offline pipeline.
 */
const DOCKETS = [
  { id: 'HUD-2026-0529', label: 'Organic' },
  { id: 'ATF-2023-0002', label: 'Orchestrated' },
] as const;

type Tier = 'exact' | 'template' | 'near';
const TIERS: { id: Tier; label: string; blurb: string }[] = [
  { id: 'exact', label: 'Exact', blurb: 'Byte-identical text only.' },
  { id: 'template', label: 'Template', blurb: 'Strips HTML, contacts, digits, case and punctuation, collapsing form letters that differ only in formatting or filled-in numbers/ZIPs.' },
  { id: 'near', label: 'Near-dup', blurb: 'Order/edit-tolerant: matches on the shared vocabulary set. A cheap stand-in for SimHash/MinHash.' },
];

interface TierData {
  totals: { total: number; unique: number; empty: number };
  clusters: Cluster[];
}

export function CommentFidelityPanel() {
  const { getCommentClustersMultiTier, isReady } = useDuckDBService();
  const [activeId, setActiveId] = useState<string>(DOCKETS[0].id);
  const [activeTier, setActiveTier] = useState<Tier>('exact');
  const [cache, setCache] = useState<Record<string, TierData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Always keep the exact-match baseline for the active docket loaded so the
  // finding can quantify the delta against the looser tier.
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    const wanted: [string, Tier][] = [
      [activeId, 'exact'],
      [activeId, activeTier],
    ];
    for (const [id, tier] of wanted) {
      const key = `${id}:${tier}`;
      if (cache[key] || errors[key]) continue;
      getCommentClustersMultiTier(id, tier)
        .then(res => {
          if (cancelled) return;
          setCache(prev => ({ ...prev, [key]: res }));
        })
        .catch(err => {
          if (cancelled) return;
          console.error(`CommentFidelityPanel ${key}:`, err);
          setErrors(prev => ({ ...prev, [key]: String(err?.message ?? err) }));
        });
    }
    return () => { cancelled = true; };
  }, [isReady, activeId, activeTier, getCommentClustersMultiTier, cache, errors]);

  const data = cache[`${activeId}:${activeTier}`];
  const exact = cache[`${activeId}:exact`];
  const error = errors[`${activeId}:${activeTier}`];

  return (
    <section className="card card-lg p-6 mb-8">
      <PanelHeader
        label="Fidelity ladder · pathway to production"
        title="What each matching step recovers"
        caption={
          <>
            The panel above ships the top of this ladder (the{' '}
            <strong>near-duplicate</strong> tier) by default. This guide steps through
            the rungs so you can see what each normalization step buys: start at{' '}
            <strong>exact</strong> match (a single form letter signed by thousands counts
            as thousands of &ldquo;unique&rdquo; submissions), then loosen to{' '}
            <strong>template</strong> and <strong>near-duplicate</strong> and watch the
            uniqueness collapse. All three run live in the browser; the looser ones are
            cheap, transparent stand-ins for the offline/server methods outlined below.
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <DocketToggle active={activeId} onChange={setActiveId} />
        <TierToggle active={activeTier} onChange={setActiveTier} />
      </div>

      <p className="text-xs text-[var(--muted)] mb-4 max-w-3xl">
        {TIERS.find(t => t.id === activeTier)?.blurb}
      </p>

      <DocketIdentity
        docketId={activeId}
        title={undefined}
        href={`/sr/${activeId.split('-')[0]}/${activeId}`}
      />

      <div className="mt-4">
        {error && <div className="text-sm text-[var(--accent-red)] py-2">Error: {error}</div>}
        {!data && !error && (
          <div className="text-sm text-[var(--muted)] py-4">Clustering comments ({activeTier})…</div>
        )}
        {data && <FidelityBody data={data} exact={exact} tier={activeTier} />}
      </div>

      <FullStackNote />
    </section>
  );
}

function FidelityBody({ data, exact, tier }: { data: TierData; exact?: TierData; tier: Tier }) {
  const { totals, clusters } = data;
  const { formLetters, orchestratedCount, uniquePct, orchestratedPct } = useMemo(
    () => computeOrchestration(clusters, totals.total, c => isPlaceholder(c.sample)),
    [clusters, totals.total],
  );

  // Per-template stance, propagated by cluster size (label templates, not comments).
  const stanced = useMemo(
    () => formLetters.map(c => ({ cluster: c, stance: scoreStance(c.sample) })),
    [formLetters]
  );
  const stanceTotals = useMemo(
    () => aggregateStance(stanced.map(s => ({ stance: s.stance, weight: s.cluster.n }))),
    [stanced]
  );
  const stanceCovered = orchestratedCount;

  // Delta vs exact baseline for the headline finding.
  const exactUniquePct = useMemo(() => {
    if (!exact || exact.totals.total === 0) return null;
    return computeOrchestration(exact.clusters, exact.totals.total, c => isPlaceholder(c.sample)).uniquePct;
  }, [exact]);

  return (
    <>
      <FindingNote>
        {totals.total === 0 ? (
          <>No comments found on this docket.</>
        ) : tier === 'exact' || exactUniquePct === null ? (
          <>
            <strong>{uniquePct.toFixed(1)}%</strong> of comments are unique;{' '}
            <strong>{orchestratedPct.toFixed(1)}%</strong> are copies of {formLetters.length}{' '}
            repeated {formLetters.length === 1 ? 'template' : 'templates'}.
          </>
        ) : (
          <>
            Exact-text matching calls <strong>{exactUniquePct.toFixed(1)}%</strong> of these
            comments unique. The <strong>{tier}</strong> tier reveals the real figure is closer to{' '}
            <strong>{uniquePct.toFixed(1)}%</strong>; the rest are{' '}
            {formLetters.length} {formLetters.length === 1 ? 'template' : 'templates'} with the
            personalized bits swapped out.
          </>
        )}
      </FindingNote>

      <div className="grid grid-cols-3 gap-3 my-4">
        <MetricCard big={totals.total.toLocaleString()} label="Total comments" />
        <MetricCard
          big={`${uniquePct.toFixed(1)}%`}
          label={`Unique (${(totals.total - orchestratedCount).toLocaleString()})`}
          dotColor="var(--accent-green)"
        />
        <MetricCard
          big={`${orchestratedPct.toFixed(1)}%`}
          label={formLetters.length > 0 ? `Orchestrated (${formLetters.length} templates)` : 'Orchestrated'}
          dotColor="var(--accent-amber)"
        />
      </div>

      {stanceCovered > 0 && (
        <StanceSplit totals={stanceTotals} covered={stanceCovered} ofTotal={totals.total} />
      )}

      <div className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
          {formLetters.length > 0
            ? `Top templates (${Math.min(6, formLetters.length)} of ${formLetters.length})`
            : 'Most repeated comments'}
        </h4>
        {formLetters.length === 0 ? (
          <p className="text-xs text-[var(--muted)] italic">
            No comment text repeats more than once at this strictness. Every submission appears
            independently written.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {stanced.slice(0, 6).map(({ cluster, stance }) => (
              <ClusterCard
                key={cluster.hash}
                cluster={cluster}
                totalComments={data.totals.total}
                badge={<StanceChip stance={stance.stance} />}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function DocketToggle({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <SegmentedControl
      ariaLabel="Example dockets"
      value={active}
      onValueChange={onChange}
      options={DOCKETS.map(({ id, label }) => ({ value: id, label }))}
    />
  );
}

function TierToggle({ active, onChange }: { active: Tier; onChange: (t: Tier) => void }) {
  return (
    <SegmentedControl
      ariaLabel="Match strictness"
      variant="group"
      tone="inverse"
      value={active}
      onValueChange={onChange}
      options={TIERS.map(({ id, label }) => ({ value: id, label }))}
    />
  );
}

/**
 * Short pointer to the full architecture writeup. The lab's client-side
 * aggregation and the offline/server tier it implies are documented in
 * docs/architecture.md; this panel links there instead of duplicating it.
 */
function FullStackNote() {
  return (
    <details className="mt-5 text-xs text-[var(--muted)]">
      <summary className="cursor-pointer font-semibold text-[var(--foreground)]">
        Architecture: client-side aggregation, and the path to a server tier
      </summary>
      <div className="mt-3 space-y-3 max-w-3xl leading-relaxed">
        <p>
          Every chart in the lab computes <em>on the client</em>: DuckDB-WASM reads
          column-pruned, predicate-pushed Parquet straight from R2 over HTTP range requests,
          so there is no backend to run. That keeps deploys instant and queries ad-hoc, but
          every viewer re-runs the same scan, and per-row work over millions of rows (live
          hashing, fuzzy matching, embeddings) is slow or infeasible. The looser tiers above
          are cheap stand-ins for methods that belong on an offline/server tier.
        </p>
        <p>
          Which aggregations move to materialized views, which fields dropped at ETL block
          features, and where this can go next (SimHash/LSH, a real search index, semantic
          dedupe) are written up in{' '}
          <a
            href="https://github.com/civictechdc/spicy-regs/blob/main/docs/architecture.md"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--foreground)]"
          >
            docs/architecture.md
          </a>
          .
        </p>
      </div>
    </details>
  );
}
