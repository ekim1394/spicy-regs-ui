import Link from 'next/link';
import { PageShell } from '@/components/ui/PageShell';

/**
 * Styled 404 for unmatched routes. The docket/document pages keep their own
 * inline "not found" states (they carry contextual back-links); this is the
 * catch-all for genuinely unknown URLs, offering the three top-level entry
 * points into the app.
 */
export default function NotFound() {
  return (
    <PageShell maxWidth="3xl" mainClassName="w-full max-w-3xl mx-auto px-4 py-24 text-center flex-1">
      <p className="text-xs uppercase tracking-wide text-[var(--accent-primary)] font-semibold">
        404
      </p>
      <h1 className="font-serif text-3xl text-[var(--foreground)] mt-2 mb-3">
        Page not found
      </h1>
      <p className="text-sm text-[var(--muted)] max-w-md mx-auto">
        We couldn&rsquo;t find the page you were looking for. It may have moved,
        or the link may be incomplete.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
        <Link href="/feed" className="text-[var(--accent-primary)] hover:underline">
          Browse the feed
        </Link>
        <Link href="/agencies" className="text-[var(--accent-primary)] hover:underline">
          Agencies
        </Link>
        <Link href="/search" className="text-[var(--accent-primary)] hover:underline">
          Search
        </Link>
      </div>
    </PageShell>
  );
}
