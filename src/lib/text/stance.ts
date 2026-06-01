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
 * and is fooled by negation ("I do not oppose") and sarcasm, so it is surfaced
 * labeled as approximate. Its output shape (`stance` + a confidence score)
 * matches what a precomputed per-template column would carry, so a higher-fidelity
 * classifier keyed by `skeleton_hash` can replace it without call-site changes.
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
 * Curated cue phrases, lowercased. Each is compiled to a whole-word
 * (`\b`-anchored) regex and matched against lowercased comment text — so
 * `commend` no longer fires inside `recommend`. A trailing `*` on a word marks
 * it as a stance verb and widens the match to its inflectional forms:
 * `oppose*` matches oppose/opposes/opposed/opposing, `support*` matches
 * support/supports/supported/supporting. Mark only the verb, never the object
 * ("reject* this", not "reject this*"). Words without `*` match literally.
 * Ordered roughly strongest-signal first for readability; order does not affect
 * scoring.
 */
export const SUPPORT_PHRASES: readonly string[] = [
  'strongly support*',
  'fully support*',
  'i support*',
  'we support*',
  'support* this rule',
  'support* the proposed',
  'support* this proposal',
  'in favor of',
  'in support of',
  'offer* support',
  'voice* support',
  'supportive of',
  'support of',
  'support for',
  'urge* you to adopt*',
  'urge* you to finalize*',
  'urge* the adoption',
  'please finalize*',
  'please adopt*',
  'applaud*',
  'commend*',
  'a step in the right direction',
];

export const OPPOSE_PHRASES: readonly string[] = [
  'strongly oppose*',
  'i oppose*',
  'we oppose*',
  'oppose* this rule',
  'oppose* the proposed',
  'oppose* this proposal',
  'do not support*',
  'does not support*',
  'object* to',
  'we object*',
  'i object*',
  'voice* opposition',
  'express* opposition',
  'opposition to',
  'opposed to',
  'withdraw* this rule',
  'withdraw* the proposed',
  'rescind*',
  'urge* you to reject*',
  'urge* you to withdraw*',
  'reject* this',
  'against this rule',
  'do not finalize*',
  'should not be adopt*',
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile one cue word to a regex fragment. A trailing `*` widens the word to
 * its inflectional forms; a final `e` is dropped so the suffix set reads
 * cleanly (oppose -> oppos + e/es/ed/ing). Plain words match literally.
 */
function wordPattern(word: string): string {
  if (!word.endsWith('*')) return escapeRegExp(word);
  const stem = word.slice(0, -1);
  return stem.endsWith('e')
    ? `${escapeRegExp(stem.slice(0, -1))}(?:e|es|ed|ing)`
    : `${escapeRegExp(stem)}(?:s|es|ed|ing)?`;
}

/** Compile a cue phrase to a whole-word, inflection-tolerant matcher. */
function phraseToRegex(phrase: string): RegExp {
  const body = phrase.split(' ').map(wordPattern).join('\\s+');
  return new RegExp(`\\b${body}\\b`, 'g');
}

const SUPPORT_RES: readonly RegExp[] = SUPPORT_PHRASES.map(phraseToRegex);
const OPPOSE_RES: readonly RegExp[] = OPPOSE_PHRASES.map(phraseToRegex);

/** Count non-overlapping matches of a precompiled (global) regex in `text`. */
function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0;
  let count = 0;
  while (re.exec(text) !== null) count++;
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
  for (const re of SUPPORT_RES) support += countMatches(t, re);
  for (const re of OPPOSE_RES) oppose += countMatches(t, re);

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
