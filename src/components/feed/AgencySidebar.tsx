'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ExternalLink, Scale, BookOpen } from 'lucide-react';
import { getAgencyInfo, formatCount } from '@/lib/agencyMetadata';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';

interface AgencySidebarProps {
  agencyCode: string;
  stats?: {
    docketCount: number;
    documentCount: number;
    commentCount: number;
  };
}

export function AgencySidebar({ agencyCode, stats }: AgencySidebarProps) {
  const agency = useMemo(() => getAgencyInfo(agencyCode), [agencyCode]);

  return (
    <div className="space-y-4">
      {/* About Card */}
      <Card variant="gradient" className="overflow-hidden">
        {/* Header */}
        <div
          className="h-8 relative"
          style={{
            background: `linear-gradient(135deg, ${agency.color}33, ${agency.color}11)`,
          }}
        />

        <div className="p-4 -mt-6">
          <div className="flex items-center gap-3 mb-3">
            <Avatar
              name={agency.name}
              src={agency.favicon}
              color={agency.color}
              fallback={agency.shortName}
              size="lg"
              className="border-2 border-[var(--surface)]"
            />
            <div>
              <h3 className="font-semibold text-sm text-[var(--foreground)]">
                About sr/{agencyCode}
              </h3>
              <span className="text-xs text-[var(--muted)]">{agency.name}</span>
            </div>
          </div>

          <p className="text-sm text-[var(--muted)] mb-4 leading-relaxed">
            {agency.description}
          </p>

          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center p-2 bg-[var(--background)] rounded-lg">
                <div className="text-lg font-bold text-[var(--foreground)]">
                  {formatCount(stats.docketCount)}
                </div>
                <div className="text-[10px] text-[var(--muted)]">Dockets</div>
              </div>
              <div className="text-center p-2 bg-[var(--background)] rounded-lg">
                <div className="text-lg font-bold text-[var(--foreground)]">
                  {formatCount(stats.documentCount)}
                </div>
                <div className="text-[10px] text-[var(--muted)]">Docs</div>
              </div>
              <div className="text-center p-2 bg-[var(--background)] rounded-lg">
                <div className="text-lg font-bold text-[var(--foreground)]">
                  {formatCount(stats.commentCount)}
                </div>
                <div className="text-[10px] text-[var(--muted)]">Comments</div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Guidelines */}
      <Card variant="gradient" className="p-4">
        <h4 className="font-semibold text-sm text-[var(--foreground)] mb-2 flex items-center gap-1.5">
          <Scale size={14} />
          Guidelines
        </h4>
        <ul className="space-y-1.5 text-xs text-[var(--muted)]">
          <li className="flex items-start gap-1.5">
            <span className="text-[var(--accent-green)] mt-0.5">✓</span>
            Review docket information before commenting
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-[var(--accent-green)] mt-0.5">✓</span>
            Focus on substantive policy issues
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-[var(--accent-green)] mt-0.5">✓</span>
            Submit official comments at regulations.gov
          </li>
        </ul>
      </Card>

      {/* Related Agencies */}
      {agency.relatedAgencies.length > 0 && (
        <Card variant="gradient" className="p-4">
          <h4 className="font-semibold text-sm text-[var(--foreground)] mb-2 flex items-center gap-1.5">
            <BookOpen size={14} />
            Related Agencies
          </h4>
          <div className="space-y-2">
            {agency.relatedAgencies.map(code => {
              const related = getAgencyInfo(code);
              return (
                <Link
                  key={code}
                  href={`/sr/${code}`}
                  className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <Avatar
                    name={related.name}
                    color={related.color}
                    fallback={code.slice(0, 2)}
                    size="xs"
                  />
                  {related.name}
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {/* Useful Links */}
      <Card variant="gradient" className="p-4">
        <h4 className="font-semibold text-sm text-[var(--foreground)] mb-2 flex items-center gap-1.5">
          <ExternalLink size={14} />
          Useful Links
        </h4>
        <div className="space-y-1.5">
          {agency.links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-[var(--accent-primary)] hover:underline"
            >
              <ExternalLink size={12} />
              {link.label}
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
