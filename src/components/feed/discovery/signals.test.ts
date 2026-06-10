import { describe, it, expect } from 'vitest';
import {
  flattenSignals,
  signalHref,
  type DiscoverySignalsResult,
} from './signals';

const sample: DiscoverySignalsResult = {
  surge: [
    { docketId: 'EPA-1', agencyCode: 'EPA', title: 'a', recentCount: 10, prevCount: 2, delta: 8 },
    { docketId: 'EPA-2', agencyCode: 'EPA', title: 'b', recentCount: 5, prevCount: 1, delta: 4 },
  ],
  closing: [
    { docketId: 'DOT-1', agencyCode: 'DOT', title: 'c', commentEndDate: '2026-06-01', commentCount: 3 },
  ],
  spike: [
    { agencyCode: 'FEMA', recent30d: 137, baselineMonthlyMean: 16.8, ratio: 8.1 },
  ],
  discussed: [
    { docketId: 'HHS-1', agencyCode: 'HHS', title: 'd', commentCount: 1_200_000 },
  ],
};

describe('flattenSignals', () => {
  it('interleaves round-robin in SIGNAL_ORDER (surge, closing, spike, discussed)', () => {
    const flat = flattenSignals(sample);
    // Round 0: one of each kind that has an item, then round 1 (only surge has 2).
    expect(flat.map(s => s.kind)).toEqual([
      'surge', 'closing', 'spike', 'discussed', 'surge',
    ]);
  });

  it('returns an empty list when no signals fire', () => {
    expect(flattenSignals({ surge: [], closing: [], spike: [], discussed: [] })).toEqual([]);
  });
});

describe('signalHref', () => {
  it('routes each kind to the correct facet', () => {
    expect(signalHref({ kind: 'surge', data: sample.surge[0] })).toBe('/sr/EPA/EPA-1');
    expect(signalHref({ kind: 'closing', data: sample.closing[0] })).toBe('/sr/DOT/DOT-1?tab=comments');
    expect(signalHref({ kind: 'spike', data: sample.spike[0] })).toBe('/sr/FEMA');
    expect(signalHref({ kind: 'discussed', data: sample.discussed[0] })).toBe('/sr/HHS/HHS-1');
  });
});
