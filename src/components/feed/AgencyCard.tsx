'use client';

import Link from 'next/link';
import { MessageSquare, FileText } from 'lucide-react';
import { getAgencyInfo, formatCount } from '@/lib/agencyMetadata';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';

interface AgencyCardProps {
  code: string;
  docketCount?: number;
  commentCount?: number;
}

export function AgencyCard({ code, docketCount = 0, commentCount = 0 }: AgencyCardProps) {
  const agency = getAgencyInfo(code);

  return (
    <Card
      asChild
      variant="gradient"
      className="p-5 h-full flex flex-col hover:border-[var(--accent-primary)] transition-all duration-200 group"
    >
      <Link href={`/sr/${code}`}>
        <div className="flex items-center gap-3 mb-3">
          <Avatar
            name={agency.name}
            src={agency.favicon}
            color={agency.color}
            fallback={agency.shortName}
            size="lg"
          />
          <div className="min-w-0">
            <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--accent-primary)] transition-colors truncate">
              {agency.name}
            </h3>
            <span className="text-sm text-[var(--muted)]">sr/{code}</span>
          </div>
        </div>

        <p className="text-sm text-[var(--muted)] line-clamp-2 mb-3 flex-1">
          {agency.description}
        </p>

        <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
          <span className="metadata-pill">
            <FileText size={12} />
            {formatCount(docketCount)} dockets
          </span>
          <span className="metadata-pill">
            <MessageSquare size={12} />
            {formatCount(commentCount)} comments
          </span>
        </div>
      </Link>
    </Card>
  );
}
