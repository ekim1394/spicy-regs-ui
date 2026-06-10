import { describe, it, expect } from 'vitest';
import {
  computeVolumeBurst,
  computeStanceFinding,
  daySpanInclusive,
  BURST_SHARE_PCT,
} from './findings';
import type { TemplateFamily } from './templates';
import type { Stance, StanceResult } from '@/lib/text/stance';

describe('daySpanInclusive', () => {
  it('counts inclusively', () => {
    expect(daySpanInclusive('2026-05-27', '2026-05-27')).toBe(1);
    expect(daySpanInclusive('2026-05-27', '2026-05-28')).toBe(2);
    expect(daySpanInclusive('2026-05-01', '2026-05-31')).toBe(31);
  });
});

describe('computeVolumeBurst', () => {
  // A fixed "now" so open/closed + days-remaining is deterministic.
  const NOW = new Date('2026-05-31T12:00:00Z');

  it('flags a 2-day burst inside a still-open period and reports days left', () => {
    const vol = [
      { day: '2026-05-27', n: 10 },
      { day: '2026-05-28', n: 320 },
      { day: '2026-05-29', n: 90 },
      { day: '2026-06-15', n: 30 },
    ];
    const total = 450;
    const b = computeVolumeBurst(vol, total, '2026-05-27', '2026-06-27', NOW);
    expect(b).not.toBeNull();
    // Peak contiguous 2-day window is the 28th+29th = 410 = 91% (the 27th+28th
    // = 330 is smaller), so the detector picks the bigger pair.
    expect(b!.startDay).toBe('2026-05-28');
    expect(b!.endDay).toBe('2026-05-29');
    expect(Math.round(b!.pct)).toBe(91);
    expect(b!.count).toBe(410);
    expect(b!.total).toBe(450);
    expect(b!.periodDays).toBe(32);
    // Point-in-time: open through Jun 27, 27 days after May 31.
    expect(b!.periodOpen).toBe(true);
    expect(b!.daysRemaining).toBe(27);
  });

  it('marks the period closed when now is past the end date', () => {
    const vol = [
      { day: '2024-08-13', n: 10 },
      { day: '2024-08-14', n: 400 },
    ];
    const b = computeVolumeBurst(vol, 410, '2024-07-15', '2024-08-14', NOW);
    expect(b).not.toBeNull();
    expect(b!.periodOpen).toBe(false);
    expect(b!.daysRemaining).toBeNull();
    expect(b!.periodDays).toBe(31);
  });

  it('returns null when arrivals are spread out', () => {
    const vol = [
      { day: '2026-05-01', n: 100 },
      { day: '2026-05-10', n: 100 },
      { day: '2026-05-20', n: 100 },
      { day: '2026-05-30', n: 100 },
    ];
    expect(computeVolumeBurst(vol, 400, '2026-05-01', '2026-05-31', NOW)).toBeNull();
  });

  it('does not flag when the period was barely longer than the window', () => {
    // 100% in 2 days, but the docket was only open 2 days — unremarkable.
    const vol = [
      { day: '2026-05-27', n: 200 },
      { day: '2026-05-28', n: 200 },
    ];
    expect(computeVolumeBurst(vol, 400, '2026-05-27', '2026-05-28', NOW)).toBeNull();
  });

  it('honors a custom threshold', () => {
    const vol = [
      { day: '2026-05-27', n: 60 },
      { day: '2026-05-28', n: 10 },
      { day: '2026-06-20', n: 30 },
    ];
    // 70/100 in 2 days: below the 80% default, above a 60% override.
    expect(computeVolumeBurst(vol, 100, '2026-05-01', '2026-06-30', NOW)).toBeNull();
    expect(computeVolumeBurst(vol, 100, '2026-05-01', '2026-06-30', NOW, 60)).not.toBeNull();
  });

  it('uses the module default threshold constant', () => {
    expect(BURST_SHARE_PCT).toBe(80);
  });
});

// ---- stance fixtures --------------------------------------------------------

function fam(id: string, n: number): TemplateFamily {
  return {
    id,
    representative: { hash: id, n, sample: '', firstDay: '2026-01-01', lastDay: '2026-01-02' },
    members: [{ hash: id, n, sample: '', firstDay: '2026-01-01', lastDay: '2026-01-02' }],
    totalN: n,
    sharePct: 0,
    variantCount: 1,
    firstDay: '2026-01-01',
    lastDay: '2026-01-02',
  };
}
function res(stance: Stance): StanceResult {
  return { stance, support: stance === 'support' ? 1 : 0, oppose: stance === 'oppose' ? 1 : 0 };
}
function agg(items: { family: TemplateFamily; stance: StanceResult }[]) {
  const t: Record<Stance, number> = { support: 0, oppose: 0, mixed: 0, unclear: 0 };
  let covered = 0;
  for (const i of items) {
    t[i.stance.stance] += i.family.totalN;
    covered += i.family.totalN;
  }
  return { t, covered };
}

describe('computeStanceFinding', () => {
  it('reports concentration (not a circular restatement) when the remainder agrees', () => {
    // Mirrors the screenshot: a huge support template + a small unclear one.
    // Remainder is non-directional, so it's "concentrated", not "flip", and the
    // finding does not say "support … support".
    const stanced = [
      { family: fam('a', 229), stance: res('support') },
      { family: fam('b', 38), stance: res('unclear') },
    ];
    const { t, covered } = agg(stanced);
    const f = computeStanceFinding(stanced, t, covered);
    expect(f?.kind).toBe('concentrated');
    expect(f?.stance).toBe('support');
    expect(Math.round(f!.topPct!)).toBe(86); // 229 / 267
    expect(f?.topCount).toBe(229);
    expect(f?.templateCount).toBe(2);
    expect(f?.remainderStance).toBeUndefined();
  });

  it('flags a flip when the remainder leans the opposite way', () => {
    // Big support template, but the other comments genuinely oppose — the
    // headline reverses once the campaign is set aside.
    const stanced = [
      { family: fam('a', 200), stance: res('support') },
      { family: fam('b', 90), stance: res('oppose') },
      { family: fam('c', 20), stance: res('oppose') },
    ];
    const { t, covered } = agg(stanced);
    const f = computeStanceFinding(stanced, t, covered);
    expect(f?.kind).toBe('flip');
    expect(f?.stance).toBe('support');
    expect(f?.remainderStance).toBe('oppose');
    expect(f?.remainderCount).toBe(110);
    expect(Math.round(f!.remainderPct!)).toBe(100);
  });

  it('does not call it concentrated when no single template dominates', () => {
    const stanced = [
      { family: fam('a', 100), stance: res('support') },
      { family: fam('b', 95), stance: res('support') },
      { family: fam('c', 30), stance: res('oppose') },
    ];
    const { t, covered } = agg(stanced);
    const f = computeStanceFinding(stanced, t, covered);
    // support = 195/225 = 87% → lopsided, not concentrated (top is 44%).
    expect(f?.kind).toBe('lopsided');
    expect(f?.stance).toBe('support');
  });

  it('flags a divided record', () => {
    const stanced = [
      { family: fam('a', 50), stance: res('support') },
      { family: fam('b', 45), stance: res('oppose') },
      { family: fam('c', 20), stance: res('unclear') },
    ];
    const { t, covered } = agg(stanced);
    const f = computeStanceFinding(stanced, t, covered);
    expect(f?.kind).toBe('split');
    expect(Math.round(f!.supportPct!)).toBe(43); // 50/115
    expect(Math.round(f!.opposePct!)).toBe(39); // 45/115
  });

  it('returns null for an unremarkable split', () => {
    // Plurality unclear, no directional lean clears any bar.
    const stanced = [
      { family: fam('a', 60), stance: res('unclear') },
      { family: fam('b', 30), stance: res('support') },
      { family: fam('c', 10), stance: res('mixed') },
    ];
    const { t, covered } = agg(stanced);
    expect(computeStanceFinding(stanced, t, covered)).toBeNull();
  });

  it('returns null with no coverage', () => {
    expect(computeStanceFinding([], { support: 0, oppose: 0, mixed: 0, unclear: 0 }, 0)).toBeNull();
  });
});
