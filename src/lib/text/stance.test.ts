import { describe, it, expect } from 'vitest';
import { scoreStance, aggregateStance } from './stance';

describe('scoreStance', () => {
  it('detects support', () => {
    expect(scoreStance('We strongly support this rule and urge you to adopt it.').stance).toBe('support');
  });

  it('detects opposition', () => {
    expect(scoreStance('I strongly oppose this proposal and object to its scope.').stance).toBe('oppose');
  });

  it('marks both-sided text as mixed', () => {
    const r = scoreStance('Some support this rule, but I oppose this proposal.');
    expect(r.stance).toBe('mixed');
    expect(r.support).toBeGreaterThan(0);
    expect(r.oppose).toBeGreaterThan(0);
  });

  it('returns unclear when no cue phrases are present', () => {
    expect(scoreStance('The weather today is pleasant.').stance).toBe('unclear');
  });
});

describe('aggregateStance', () => {
  it('weights each template by its comment count', () => {
    const totals = aggregateStance([
      { stance: scoreStance('we strongly support'), weight: 100 },
      { stance: scoreStance('we strongly oppose'), weight: 5 },
    ]);
    expect(totals.support).toBe(100);
    expect(totals.oppose).toBe(5);
  });
});
