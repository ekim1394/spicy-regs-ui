/**
 * Phrase-based stance detection for public comments.
 *
 * Why stance, not sentiment: for rulemaking, *emotional* sentiment ("angry" vs
 * "happy") is low-value and low-fidelity. What matters is **stance** — does this
 * comment support or oppose the rule. That is both more useful and cheaper to
 * approximate with a transparent phrase lexicon than emotion is with a
 * black-box model.
 *
 * This is a heuristic — a SIGNAL, NOT A VERDICT. It keys off explicit phrases
 * and is fooled by negation ("I do not oppose") and sarcasm. Surface it labeled
 * as approximate. The high-fidelity production version belongs offline: run a
 * real classifier / batch-LLM label ONCE PER TEMPLATE (clustering collapses
 * hundreds of thousands of comments to a few dozen templates) and store
 * `stance` + `stance_confidence` columns keyed by `skeleton_hash`. This module
 * mimics that output shape so swapping it for the precomputed column is a
 * drop-in.
 */

export type Stance = 'support' | 'oppose' | 'mixed' | 'unclear';

export interface StanceResult {
  stance: Stance;
  /** Number of support-phrase hits. */
  support: number;
  /** Number of oppose-phrase hits. */
  oppose: number;
}

/**
 * Curated cue phrases. Lowercased; matched as substrings against lowercased
 * comment text. Ordered roughly strongest-signal first for readability; order
 * does not affect scoring.
 */
export const SUPPORT_PHRASES: readonly string[] = [
  'strongly support',
  'fully support',
  'i support',
  'we support',
  'support this rule',
  'support the proposed',
  'support this proposal',
  'in favor of',
  'in support of',
  'urge you to adopt',
  'urge you to finalize',
  'urge the adoption',
  'please finalize',
  'please adopt',
  'applaud',
  'commend',
  'a step in the right direction',
];

export const OPPOSE_PHRASES: readonly string[] = [
  'strongly oppose',
  'i oppose',
  'we oppose',
  'oppose this rule',
  'oppose the proposed',
  'oppose this proposal',
  'do not support',
  'does not support',
  'object to',
  'we object',
  'i object',
  'withdraw this rule',
  'withdraw the proposed',
  'rescind',
  'urge you to reject',
  'urge you to withdraw',
  'reject this',
  'against this rule',
  'do not finalize',
  'should not be adopted',
];

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

/**
 * Score a single piece of comment text. Pass a representative sample (e.g. a
 * cluster's template body) — in the demo, stance is computed per template and
 * propagated by cluster size, never per individual comment.
 */
export function scoreStance(text: string): StanceResult {
  const t = (text || '').toLowerCase();
  let support = 0;
  let oppose = 0;
  for (const p of SUPPORT_PHRASES) support += countOccurrences(t, p);
  for (const p of OPPOSE_PHRASES) oppose += countOccurrences(t, p);

  let stance: Stance;
  if (support === 0 && oppose === 0) stance = 'unclear';
  else if (support > 0 && oppose > 0) stance = 'mixed';
  else if (support > oppose) stance = 'support';
  else stance = 'oppose';

  return { stance, support, oppose };
}

/**
 * Roll per-template stances up to a docket-level split, weighting each template
 * by how many comments it represents. Demonstrates "label templates, propagate
 * by membership." Counts are comment-weighted, not template-weighted.
 */
export function aggregateStance(
  items: { stance: StanceResult; weight: number }[]
): Record<Stance, number> {
  const totals: Record<Stance, number> = { support: 0, oppose: 0, mixed: 0, unclear: 0 };
  for (const { stance, weight } of items) {
    totals[stance.stance] += weight;
  }
  return totals;
}
