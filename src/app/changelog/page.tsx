import type { Metadata } from 'next';
import { ContentPage } from '@/components/content/ContentPage';
import { ContentSection } from '@/components/content/ContentSection';

const REPO_URL = 'https://github.com/ekim1394/spicy-regs-ui';

export const metadata: Metadata = {
  title: 'Changelog',
};

interface Entry {
  text: string;
  pr: number;
}

interface Group {
  label: string;
  entries: Entry[];
}

interface Release {
  version: string;
  date: string;
  summary: string;
  groups: Group[];
}

const RELEASES: Release[] = [
  {
    version: '2026.07.22',
    date: 'July 22, 2026',
    summary:
      'The explorer caught up to the ten new external datasets the pipeline began publishing — surfacing them both in a dedicated browser and in context on the pages people already use — alongside a load-time pass and a resilience layer. Everything still runs entirely in your browser via DuckDB-WASM, with no backend.',
    groups: [
      {
        label: 'Added',
        entries: [
          {
            text: 'Sources explorer — a /sources index plus a generic browser covering all ten new datasets, with full-text search, per-source filters, sort, and infinite scroll. Filter and sort state lives in the URL, so views are shareable.',
            pr: 10,
          },
          {
            text: 'Related-source panels in context — docket pages gain a “Planned rulemaking · Unified Agenda” panel and agency pages gain an “APA litigation” panel, each deep-linking into the sources browser.',
            pr: 11,
          },
          {
            text: 'Resilience layer — a shared useAsyncData hook, error boundaries, and SQL identifier hardening, replacing effects that silently swallowed query failures.',
            pr: 8,
          },
        ],
      },
      {
        label: 'Changed',
        entries: [
          {
            text: 'Performance — lazy DuckDB boot off the hydration path, preconnect hints, and caching of hot re-scans. First-load JS dropped on /about (240 → 197 KB) and /feed (324 → 282 KB).',
            pr: 9,
          },
        ],
      },
      {
        label: 'Fixed',
        entries: [
          {
            text: 'External-source UI follow-ups — resolve Unified Agenda RINs directly from fr_docket_links (dropping a ~120 MB browser scan), typed casts for freshness tiles, and icon-only primary nav on small screens.',
            pr: 12,
          },
        ],
      },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <ContentPage
      eyebrow="Changelog"
      title="What's new"
      lede="Notable changes to the Spicy Regs explorer. Each entry links to the pull request that shipped it."
    >
      {RELEASES.map((release) => (
        <ContentSection key={release.version} title={release.date}>
          <p className="text-sm text-[var(--muted)] leading-relaxed mb-5">{release.summary}</p>
          <div className="flex flex-col gap-5">
            {release.groups.map((group) => (
              <div key={group.label}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
                  {group.label}
                </h3>
                <ul className="flex flex-col gap-2">
                  {group.entries.map((entry) => (
                    <li
                      key={entry.pr}
                      className="text-sm text-[var(--foreground)] leading-relaxed"
                    >
                      {entry.text}{' '}
                      <a
                        href={`${REPO_URL}/pull/${entry.pr}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--accent-primary)] hover:underline whitespace-nowrap"
                      >
                        #{entry.pr}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ContentSection>
      ))}

      <ContentSection title="Full history">
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          The complete changelog lives in{' '}
          <a
            href={`${REPO_URL}/blob/main/CHANGELOG.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-primary)] hover:underline"
          >
            CHANGELOG.md
          </a>{' '}
          and on the{' '}
          <a
            href={`${REPO_URL}/releases`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-primary)] hover:underline"
          >
            GitHub Releases
          </a>{' '}
          page.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
