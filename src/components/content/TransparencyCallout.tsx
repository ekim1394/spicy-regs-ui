import { DemoPill } from '@/components/ui/DemoPill';

/**
 * The product's "radically transparent" value, as a reusable callout: every
 * synthesized figure wears a demo pill naming the ETL fields it stands in for.
 * Same dashed-amber treatment as the Document page's DemoCallout.
 */
export function TransparencyCallout() {
  return (
    <div
      className="rounded-xl border border-dashed p-4"
      style={{
        borderColor: 'color-mix(in srgb, var(--accent-amber) 40%, transparent)',
        background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)',
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <DemoPill />
        <span className="text-sm font-semibold" style={{ color: 'var(--accent-amber)' }}>
          Some values are simulated, and always labeled
        </span>
      </div>
      <p className="text-xs text-[var(--muted)] leading-relaxed">
        Where the data mirror drops a field, any synthesized figure wears a demo pill and a tooltip
        naming what it stands in for. Being honest about the data is part of the product.
      </p>
    </div>
  );
}
