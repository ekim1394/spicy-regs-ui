import { describe, it, expect } from 'vitest';
import { agglomerateTemplates, type TemplateCluster } from './templates';

function cluster(hash: string, n: number, tokens: string, day = '2024-01-01'): TemplateCluster {
  return { hash, n, sample: tokens, firstDay: day, lastDay: day, tokenset: tokens };
}

describe('agglomerateTemplates', () => {
  it('returns nothing for no clusters', () => {
    expect(agglomerateTemplates([], 100)).toEqual([]);
  });

  it('folds high-Jaccard wording variants into one family', () => {
    // Two clusters that share almost all tokens (one extra word each) collapse.
    const a = cluster('a', 60, 'agency must protect clean water rule public health');
    const b = cluster('b', 40, 'agency must protect clean water rule public health today');
    const families = agglomerateTemplates([a, b], 200);
    expect(families).toHaveLength(1);
    expect(families[0].totalN).toBe(100);
    expect(families[0].variantCount).toBe(2);
    expect(families[0].representative.hash).toBe('a'); // largest member
    expect(families[0].sharePct).toBeCloseTo(50);
  });

  it('keeps unrelated templates separate and sorts by size', () => {
    const a = cluster('a', 30, 'support the proposed rule strongly protect environment');
    const b = cluster('b', 70, 'oppose this regulation it harms small business jobs economy');
    const families = agglomerateTemplates([a, b], 100);
    expect(families).toHaveLength(2);
    expect(families[0].representative.hash).toBe('b'); // largest first
    expect(families[1].representative.hash).toBe('a');
  });

  it('single-links a chain of overlapping variants', () => {
    // a~b and b~c, but a and c share less — single linkage still merges all three.
    const a = cluster('a', 10, 'one two three four five six seven');
    const b = cluster('b', 10, 'two three four five six seven eight');
    const c = cluster('c', 10, 'three four five six seven eight nine');
    const families = agglomerateTemplates([a, b, c], 30, 0.6);
    expect(families).toHaveLength(1);
    expect(families[0].variantCount).toBe(3);
  });

  it('spans the widest date range across folded members', () => {
    const a: TemplateCluster = { hash: 'a', n: 5, sample: 'protect clean water rule public', firstDay: '2024-03-01', lastDay: '2024-03-10', tokenset: 'protect clean water rule public' };
    const b: TemplateCluster = { hash: 'b', n: 3, sample: 'protect clean water rule public health', firstDay: '2024-02-15', lastDay: '2024-03-20', tokenset: 'protect clean water rule public health' };
    const [fam] = agglomerateTemplates([a, b], 8);
    expect(fam.firstDay).toBe('2024-02-15');
    expect(fam.lastDay).toBe('2024-03-20');
  });

  it('falls back to deriving tokens from the sample when tokenset is absent', () => {
    const a = { hash: 'a', n: 5, sample: 'Please protect our clean water and public health!', firstDay: '2024-01-01', lastDay: '2024-01-01' };
    const b = { hash: 'b', n: 5, sample: 'Please protect our clean water and public health today.', firstDay: '2024-01-01', lastDay: '2024-01-01' };
    const families = agglomerateTemplates([a, b], 10);
    expect(families).toHaveLength(1);
    expect(families[0].totalN).toBe(10);
  });
});
