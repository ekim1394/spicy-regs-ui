'use client';

import { PageShell } from '@/components/ui/PageShell';
import { FlaskConical, Info } from 'lucide-react';
import { AgencyActivityPanel } from '@/components/lab/AgencyActivityPanel';
import { CommentOrchestrationPanel } from '@/components/lab/CommentOrchestrationPanel';
import { CommentFidelityPanel } from '@/components/lab/CommentFidelityPanel';
import { LifecyclePanel } from '@/components/lab/LifecyclePanel';
import { DemoPill } from '@/components/ui/DemoPill';

export default function LabPage() {
  return (
    <PageShell maxWidth="4xl">
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-[var(--accent-amber)] mb-3 font-semibold">
          <FlaskConical size={13} />
          Experimental
        </div>
        <h1 className="text-4xl font-bold mb-2 font-serif">
          <span className="gradient-text">Lab</span>
        </h1>
        <div className="text-[var(--muted)] max-w-3xl">
          Three editorial chart prototypes built on top of the same{' '}
          <span className="font-mono-id">regulations.gov</span> data feed.{' '}
          <SimulatedTooltip />
        </div>
      </div>

      <AgencyActivityPanel />
      <CommentOrchestrationPanel />
      <CommentFidelityPanel />
      <LifecyclePanel />
    </PageShell>
  );
}

/** "Some data is simulated" — hover/focus reveals the exact list of synthesised fields. */
function SimulatedTooltip() {
  return (
    <span className="relative inline-block group focus-within:[&_.tooltip]:visible">
      <button
        type="button"
        className="inline-flex items-center gap-1 border-b border-dotted border-[var(--accent-amber)] text-[var(--accent-amber)] cursor-help bg-transparent p-0 m-0 font-inherit"
        aria-describedby="simulated-tooltip"
      >
        Some data is simulated
        <Info size={12} />
      </button>
      <span
        id="simulated-tooltip"
        role="tooltip"
        className="tooltip popover-surface invisible group-hover:visible absolute z-50 left-0 top-full mt-2 w-[min(28rem,90vw)] p-3.5 text-xs leading-relaxed text-left block"
        style={{ color: 'var(--foreground)' }}
      >
        <span className="block font-semibold mb-1.5 text-[var(--foreground)]">
          What&apos;s real and what&apos;s simulated
        </span>
        <span className="block text-[var(--muted)] mb-2">
          Every count, date, comment, and rule is queried live from parquet files
          mirrored on R2. These fields, however, are dropped at the ETL extract step
          and don&apos;t exist in the mirror — anywhere they affect a value you&apos;ll see a small{' '}
          <DemoPill className="align-baseline" />{' '}
          pill:
        </span>
        <span className="block mt-1 text-[var(--muted)]">
          <span className="block">
            • <code className="font-mono-id text-[var(--foreground)]">withdrawn</code> /{' '}
            <code className="font-mono-id text-[var(--foreground)]">reason_withdrawn</code> —
            kills the &ldquo;abandoned vs withdrawn vs pending&rdquo; distinction in the
            lifecycle panel.
          </span>
          <span className="block mt-1">
            • <code className="font-mono-id text-[var(--foreground)]">rin</code> /{' '}
            <code className="font-mono-id text-[var(--foreground)]">additional_rins</code> —
            blocks linking dockets that belong to the same multi-stage rulemaking.
          </span>
        </span>
      </span>
    </span>
  );
}
