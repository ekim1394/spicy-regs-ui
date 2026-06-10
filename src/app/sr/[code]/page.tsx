'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PageShell } from '@/components/ui/PageShell';
import { AgencyActivityPanel } from '@/components/lab/AgencyActivityPanel';
import { LifecyclePanel } from '@/components/lab/LifecyclePanel';
import { OpenRulemakings } from '@/components/agency/OpenRulemakings';
import { TopDockets } from '@/components/agency/TopDockets';
import { AgencyMasthead } from '@/components/agency/AgencyMasthead';
import { RelatedAgencies } from '@/components/agency/RelatedAgencies';
import { ViewAllDocketsCard } from '@/components/agency/ViewAllDocketsCard';
import { InView } from '@/components/ui/InView';

export default function AgencyProfilePage() {
  const params = useParams();
  const agencyCode = ((params.code as string) || '').toUpperCase();

  return (
    <PageShell maxWidth="4xl">
      {/* Breadcrumb */}
      <nav className="text-xs text-[var(--muted)] mb-4">
        <Link href="/agencies" className="hover:text-[var(--foreground)]">Agencies</Link>
        {' → '}
        <span className="text-[var(--foreground)]">sr/{agencyCode}</span>
      </nav>

      {/* Hierarchy, top → bottom:
          1. Identity   — who the agency is + its scale (masthead, all breakpoints)
          2. Doing now  — open comment windows you can act on
          3. Footprint  — the dockets that have drawn the most public attention
          4. Interpretation — the lab viz, "showing through" once you're grounded */}

      {/* 1 — Identity */}
      <AgencyMasthead agencyCode={agencyCode} />

      {/* 2 + 3 — Current activity + footprint */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <OpenRulemakings agencyCode={agencyCode} />
        <TopDockets agencyCode={agencyCode} />
      </div>

      {/* 4 — Interpretive data viz. Deferred until scrolled near: each panel's
          mount fires a full documents.parquet scan, so the masthead + open/top
          dockets stay interactive and the scans only run if the user reads on. */}
      <InView minHeight={420}>
        <LifecyclePanel agencyCode={agencyCode} />
      </InView>
      <InView minHeight={420}>
        <AgencyActivityPanel agencyCode={agencyCode} />
      </InView>

      {/* 5 — Onward: sibling agencies + a full docket browse, so the page ends
          with somewhere to go rather than trailing off after the viz. */}
      <RelatedAgencies agencyCode={agencyCode} />
      <ViewAllDocketsCard agencyCode={agencyCode} />
    </PageShell>
  );
}
