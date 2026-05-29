import Link from 'next/link';
import { Rss, Building2, MessageSquare, Search } from 'lucide-react';
import { ContentPage } from '@/components/content/ContentPage';
import { ContentSection } from '@/components/content/ContentSection';
import { Feature } from '@/components/content/Feature';
import { TransparencyCallout } from '@/components/content/TransparencyCallout';

const GITHUB_URL = 'https://github.com/civictechdc/spicy-regs';

export default function AboutPage() {
  return (
    <ContentPage
      eyebrow="About"
      title="Federal rulemaking, made legible"
      lede="An open-source civic tech platform that makes federal regulations accessible, searchable, and explorable for everyone — running entirely in your browser."
    >
      <ContentSection title="What you can do">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Feature
            icon={<Rss size={16} />}
            title="Browse the feed"
            description="Scroll federal dockets as posts — filter by agency, topic, or comment-period status, and fold in Federal Register entries."
          />
          <Feature
            icon={<Building2 size={16} />}
            title="Agencies as communities"
            description="Each agency has a profile: regulatory output over time, rulemaking durations, open comment periods, and its most-discussed dockets."
          />
          <Feature
            icon={<MessageSquare size={16} />}
            title="Read the public's comments"
            description="See daily comment volume and how much of a docket's response is unique vs. orchestrated form-letter campaigns."
          />
          <Feature
            icon={<Search size={16} />}
            title="Search everything"
            description="Full-text search across dockets, documents, and the Federal Register — all queried in your browser."
          />
        </div>
      </ContentSection>

      <ContentSection title="Built in your browser">
        <p className="text-sm text-[var(--muted)] leading-relaxed mb-3">
          Spicy Regs runs a full analytical database in your browser with{' '}
          <strong className="text-[var(--foreground)]">DuckDB-WASM</strong>, querying compressed
          Parquet files on Cloudflare R2 over HTTP range requests. No backend, no API keys, no
          tracking — the data comes straight to your tab.
        </p>
        <TransparencyCallout />
      </ContentSection>

      <ContentSection title="Open source">
        <p className="text-sm text-[var(--muted)] leading-relaxed mb-4">
          Built on regulations.gov and Federal Register data with Next.js, DuckDB-WASM, and
          Cloudflare R2. Fork it, extend it, or contribute back.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex items-center text-sm"
          >
            View on GitHub →
          </a>
          <a
            href={`${GITHUB_URL}#readme`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 rounded-[10px] text-sm font-medium border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent-primary)] hover:bg-[var(--surface-elevated)] transition-colors"
          >
            Read the methodology
          </a>
        </div>
      </ContentSection>
    </ContentPage>
  );
}
