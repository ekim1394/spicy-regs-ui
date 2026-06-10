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

  it('matches inflected forms of stance verbs', () => {
    expect(scoreStance('We are opposing this rule as written.').stance).toBe('oppose');
    expect(scoreStance('Our members fully supported the proposed changes.').stance).toBe('support');
    expect(scoreStance('The undersigned objects to the scope of this rule.').stance).toBe('oppose');
  });

  it('respects word boundaries (commend does not fire inside recommend)', () => {
    expect(scoreStance('We recommend further study before any decision.').stance).toBe('unclear');
    expect(scoreStance('We commend the agency for this effort.').stance).toBe('support');
  });

  it('catches noun-frame support phrasing', () => {
    expect(
      scoreStance(
        'I offer support of the actions of the Service to open or expand waterfowl hunting opportunities.'
      ).stance
    ).toBe('support');
    expect(scoreStance('We are supportive of the proposed approach.').stance).toBe('support');
  });

  it('catches noun-frame opposition phrasing', () => {
    expect(scoreStance('We voice our opposition to the proposed changes.').stance).toBe('oppose');
    expect(scoreStance('Our organization is opposed to this approach.').stance).toBe('oppose');
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
