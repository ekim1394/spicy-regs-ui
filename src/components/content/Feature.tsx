import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

/** A capability tile for feature grids on content pages. */
export function Feature({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <Card interactive={false} className="p-4">
      {icon && (
        <div
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg mb-2.5"
          style={{ background: 'var(--accent-primary-soft)', color: 'var(--accent-primary)' }}
        >
          {icon}
        </div>
      )}
      <div className="text-sm font-semibold text-[var(--foreground)] mb-1.5">{title}</div>
      {description && (
        <p className="text-xs text-[var(--muted)] leading-relaxed">{description}</p>
      )}
    </Card>
  );
}
