import type { Metadata } from 'next';
import { getAgencyInfo } from '@/lib/agencyMetadata';

/**
 * Agency metadata comes from bundled JSON, so the agency name resolves on the
 * server with no DuckDB. This sets the SSR title for the agency profile and
 * serves as the base title for nested docket/document pages, which then upgrade
 * it client-side once their DuckDB-backed data loads.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const agencyCode = (code || '').toUpperCase();
  const agency = getAgencyInfo(agencyCode);
  return {
    title: agency.name ? `${agency.name} (${agencyCode})` : agencyCode,
  };
}

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
