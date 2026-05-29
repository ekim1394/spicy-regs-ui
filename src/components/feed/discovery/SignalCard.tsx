'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { getAgencyInfo } from '@/lib/agencyMetadata';
import {
  type DiscoverySignal,
  SIGNAL_META,
  signalHref,
} from './signals';
import { Surge } from './readouts/Surge';
import { Closing } from './readouts/Closing';
import { Spike } from './readouts/Spike';
import { Discussed } from './readouts/Discussed';

/** The kind-specific readout — the one bit of colour/shape that varies per card. */
function SignalReadout({ signal }: { signal: DiscoverySignal }) {
  switch (signal.kind) {
    case 'surge': return <Surge data={signal.data} />;
    case 'closing': return <Closing data={signal.data} />;
    case 'spike': return <Spike data={signal.data} />;
    case 'discussed': return <Discussed data={signal.data} />;
  }
}

/** Title line for a card — docket title for docket-scoped kinds, agency name for spike. */
function signalTitle(signal: DiscoverySignal): string {
  if (signal.kind === 'spike') return getAgencyInfo(signal.data.agencyCode).name;
  return signal.data.title || getAgencyInfo(signal.data.agencyCode).name;
}

export function SignalCard({ signal }: { signal: DiscoverySignal }) {
  const meta = SIGNAL_META[signal.kind];
  const agencyCode = signal.data.agencyCode;
  const agency = getAgencyInfo(agencyCode);
  const title = signalTitle(signal);

  return (
    <Link
      href={signalHref(signal)}
      className="group flex-none w-[180px] flex flex-col gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 hover:border-[var(--accent-primary)] transition-colors"
    >
      <div className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {meta.eyebrow}
      </div>

      <div className="flex items-center gap-1.5">
        <Avatar name={agency.name} src={agency.favicon} color={agency.color} fallback={agency.shortName} size="xs" />
        <span className="text-[11px] font-semibold" style={{ color: 'var(--accent-primary)' }}>
          sr/{agencyCode}
        </span>
      </div>

      <div
        className="text-xs font-medium text-[var(--foreground)] leading-snug line-clamp-2"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {title}
      </div>

      <SignalReadout signal={signal} />

      <div className="mt-auto pt-0.5 text-[9.5px] text-[var(--muted-foreground)] group-hover:text-[var(--accent-primary)] transition-colors">
        → {meta.facet}
      </div>
    </Link>
  );
}
