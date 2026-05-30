'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { PanelHeader, FindingNote, DocketIdentity } from '@/components/ui/PanelHeader';
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
            cheap, transparent stand-ins for the production methods described below.
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
    <div role="tablist" aria-label="Example dockets" className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 gap-1">
      {DOCKETS.map(({ id, label }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              isActive ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function TierToggle({ active, onChange }: { active: Tier; onChange: (t: Tier) => void }) {
  return (
    <div role="group" aria-label="Match strictness" className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 gap-1">
      {TIERS.map(({ id, label }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              isActive ? 'bg-[var(--foreground)] text-[var(--background)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Generalizable architecture note: what aggregation the lab does client-side,
 * what belongs on a server / offline tier, and where to extend. Applies to the
 * whole lab, not just this panel.
 */
function FullStackNote() {
  return (
    <details className="mt-5 text-xs text-[var(--muted)]">
      <summary className="cursor-pointer font-semibold text-[var(--foreground)]">
        Architecture: client-side aggregation, and the path to a server tier
      </summary>
      <div className="mt-3 space-y-4 max-w-3xl leading-relaxed">
        <p>
          Every chart in the lab computes <em>on the client</em>: DuckDB-WASM reads column-pruned,
          predicate-pushed Parquet straight from R2 over HTTP range requests, so there is no backend to
          run. That keeps deploys instant and queries fully ad-hoc — but it also means every viewer
          re-runs the same scan, and per-row work over millions of rows (live hashing, fuzzy matching,
          embeddings) is slow or simply infeasible. The split below is where a server / offline tier earns
          its keep.
        </p>

        <div>
          <NoteHead>What the browser aggregates today</NoteHead>
          <NoteList>
            <li>
              <Lead>Counting &amp; distinct</Lead> — <Mono>COUNT</Mono>/<Mono>COUNT DISTINCT</Mono>/
              <Mono>SUM(row_count)</Mono>, mostly answered from the tiny <Mono>comments_index</Mono> and{' '}
              <Mono>feed_summary</Mono> so they never read the multi-GB comment files.
            </li>
            <li>
              <Lead>Time-bucketing</Lead> — <Mono>date_trunc</Mono> to day/month +{' '}
              <Mono>GROUP BY</Mono> (agency activity, comments-per-day, discovery surges).
            </li>
            <li>
              <Lead>Distributions</Lead> — <Mono>quantile_cont</Mono> percentiles, min/max, window-function
              ranked samples, and deterministic <Mono>hash()</Mono> bucketing (rulemaking lifecycles).
            </li>
            <li>
              <Lead>Text clustering</Lead> — <Mono>md5</Mono> over the shared{' '}
              <Mono>lib/text/normalize</Mono> skeleton (exact + template tiers).
            </li>
            <li>
              <Lead>Fuzzy near-dup</Lead> — a sorted token-set key (this panel&rsquo;s default), a cheap
              O(n) stand-in for the real thing.
            </li>
            <li>
              <Lead>Stance</Lead> — a phrase lexicon scored per template in JS, weighted by cluster size.
            </li>
            <li>
              <Lead>Search &amp; sampling</Lead> — <Mono>ILIKE</Mono>/JSON-array substring scans, and{' '}
              <Mono>ORDER BY random()</Mono> over the index. All results are <Mono>LIMIT</Mono>-bounded;
              caches are in-memory only (<Mono>useRef</Mono>/state).
            </li>
          </NoteList>
        </div>

        <div>
          <NoteHead>What moves to the offline mirror / server</NoteHead>
          <NoteList>
            <li>
              <Lead>Precompute derived columns at ETL</Lead> — <Mono>skeleton_hash</Mono>,{' '}
              <Mono>simhash</Mono>, <Mono>word_count</Mono>, <Mono>is_placeholder</Mono>, and a per-template{' '}
              <Mono>stance</Mono> + confidence keyed by <Mono>skeleton_hash</Mono>. Clustering then collapses
              to <Mono>GROUP BY skeleton_hash</Mono> — no live hashing of 370k strings.
            </li>
            <li>
              <Lead>Materialize rollups</Lead> — the way <Mono>feed_summary</Mono> already pre-bakes counts:
              per-docket cluster summaries, per-agency monthly volume, lifecycle percentiles, discovery
              signals. Each becomes a few-KB artifact the page reads instead of scanning{' '}
              <Mono>documents.parquet</Mono> (~57 MB) or the index on every load.
            </li>
            <li>
              <Lead>Heavy near-dup offline</Lead> — a 64-bit SimHash / MinHash + Hamming-band LSH per
              comment: still O(n), but robust to rewording in a way the token-set key isn&rsquo;t.
            </li>
            <li>
              <Lead>A real search index</Lead> — FTS/BM25 or an inverted index instead of full-scan{' '}
              <Mono>ILIKE</Mono> over ~793k Federal Register rows.
            </li>
            <li>
              <Lead>Recover dropped fields</Lead> — submitter name/org are stripped at ETL, so
              signature-masking (collapsing letters that differ only in who signed them) is only possible
              before that step.
            </li>
          </NoteList>
        </div>

        <div>
          <NoteHead>Where this can go next</NoteHead>
          <NoteList>
            <li>
              <Lead>Semantic dedupe &amp; topics</Lead> — embeddings + ANN to cluster by meaning, beyond
              lexical near-dup; argument mining / batch-LLM stance to separate distinct substantive points
              from boilerplate.
            </li>
            <li>
              <Lead>Cross-docket campaign detection</Lead> — <Mono>skeleton_hash</Mono> is global, so the
              same template reused across agencies is one <Mono>GROUP BY</Mono> away.
            </li>
            <li>
              <Lead>Outlier surfacing</Lead> — TF-IDF / embedding distance to find the genuinely unique,
              substantive comments buried inside a mass campaign.
            </li>
            <li>
              <Lead>Incremental + cached</Lead> — recompute only changed partitions and append to rollups;
              persist those rollups in IndexedDB / edge / CDN so repeat and shared views skip the scan
              entirely.
            </li>
          </NoteList>
        </div>
      </div>
    </details>
  );
}

function NoteHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground)] mb-1.5">
      {children}
    </div>
  );
}

function NoteList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-4 space-y-1.5 marker:text-[var(--border)]">{children}</ul>;
}

function Lead({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-[var(--foreground)]">{children}</span>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono-id text-[var(--foreground)]">{children}</span>;
}
