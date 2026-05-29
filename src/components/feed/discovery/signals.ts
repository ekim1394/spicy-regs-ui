/**
 * DiscoveryRail signal registry.
 *
 * The rail is no longer a single "trending" shelf — it's a pluggable set of
 * SIGNALS, each a different way the data gets interesting and each a doorway to
 * a different facet (a docket, an agency profile, the comment window). Adding a
 * new signal type later means: add a `SignalKind`, its `SIGNAL_META` entry, a
 * branch in `signalHref`, and a readout component in ./readouts — no churn to
 * the feed river itself.
 *
 * v1 ships four signals. Form-letter storm is deliberately omitted: detecting
 * it across all dockets is an expensive MD5-clustering scan, so it stays on the
 * Docket Comments tab where the query is scoped to one docket.
 *
 * The shapes below mirror what useDuckDBService.getDiscoverySignals() returns.
 */

export type SignalKind = 'surge' | 'closing' | 'spike' | 'discussed';

/** Wireframe order — the order signals appear in the rail. */
export const SIGNAL_ORDER: SignalKind[] = ['surge', 'closing', 'spike', 'discussed'];

export interface SurgeSignal {
  docketId: string;
  agencyCode: string;
  title: string;
  recentCount: number;
  prevCount: number;
  delta: number;
}

export interface ClosingSignal {
  docketId: string;
  agencyCode: string;
  title: string;
  commentEndDate: string;
  commentCount: number;
}

export interface SpikeSignal {
  agencyCode: string;
  recent30d: number;
  baselineMonthlyMean: number;
  ratio: number;
}

export interface DiscussedSignal {
  docketId: string;
  agencyCode: string;
  title: string;
  commentCount: number;
}

/** Raw result bundle from getDiscoverySignals(). */
export interface DiscoverySignalsResult {
  surge: SurgeSignal[];
  closing: ClosingSignal[];
  spike: SpikeSignal[];
  discussed: DiscussedSignal[];
}

/** A single rendered card: the kind tag + its typed data. */
export type DiscoverySignal =
  | { kind: 'surge'; data: SurgeSignal }
  | { kind: 'closing'; data: ClosingSignal }
  | { kind: 'spike'; data: SpikeSignal }
  | { kind: 'discussed'; data: DiscussedSignal };

/** Per-kind presentation metadata. `facet` is the "→ destination" footer. */
export const SIGNAL_META: Record<SignalKind, { eyebrow: string; facet: string }> = {
  surge: { eyebrow: 'Comment surge', facet: 'docket' },
  closing: { eyebrow: 'Closing soon', facet: 'comment window' },
  spike: { eyebrow: 'Output spike', facet: 'agency profile' },
  discussed: { eyebrow: 'Most discussed', facet: 'docket' },
};

/** The agency code a card belongs to (for the avatar + sr/ handle). */
export function signalAgencyCode(signal: DiscoverySignal): string {
  return signal.data.agencyCode;
}

/** Where a card links to when clicked. */
export function signalHref(signal: DiscoverySignal): string {
  switch (signal.kind) {
    case 'surge':
      return `/sr/${signal.data.agencyCode}/${signal.data.docketId}`;
    case 'closing':
      // Closing soon → the comment window, i.e. the docket's Comments tab.
      return `/sr/${signal.data.agencyCode}/${signal.data.docketId}?tab=comments`;
    case 'spike':
      return `/sr/${signal.data.agencyCode}`;
    case 'discussed':
      return `/sr/${signal.data.agencyCode}/${signal.data.docketId}`;
  }
}

/**
 * Flatten the per-kind result bundle into a single ordered card list.
 * Interleaves round-robin across kinds (in SIGNAL_ORDER) so the rail leads
 * with one of each kind before showing a kind's second/third card, rather
 * than four surge cards in a row.
 */
export function flattenSignals(result: DiscoverySignalsResult): DiscoverySignal[] {
  const byKind: Record<SignalKind, DiscoverySignal[]> = {
    surge: result.surge.map(data => ({ kind: 'surge', data })),
    closing: result.closing.map(data => ({ kind: 'closing', data })),
    spike: result.spike.map(data => ({ kind: 'spike', data })),
    discussed: result.discussed.map(data => ({ kind: 'discussed', data })),
  };

  const out: DiscoverySignal[] = [];
  const maxLen = Math.max(...SIGNAL_ORDER.map(k => byKind[k].length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const kind of SIGNAL_ORDER) {
      const card = byKind[kind][i];
      if (card) out.push(card);
    }
  }
  return out;
}
