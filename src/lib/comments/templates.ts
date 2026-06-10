/**
 * Fold near-duplicate comment clusters into template *families*.
 *
 * The DuckDB clustering ('near' tier) already groups byte- and wording-close
 * comments, but a single advocacy campaign still splits into several clusters
 * whenever signatories lightly edit the boilerplate — so the docket breakdown
 * shows the same letter three or four times and the percentages never add up to
 * a clean "this template = X% of the docket."
 *
 * This is the cheap, in-browser stand-in for the SimHash/MinHash + LSH pass the
 * offline pipeline should eventually own (see docs/architecture.md §3): single-
 * linkage agglomeration over each cluster's content-token set (Jaccard
 * similarity). It only ever *merges* clusters, never splits them, so the
 * orchestration counts are untouched — families are just a coarser grouping of
 * the same form-letter clusters.
 */
import { toDisplay, toSkeleton, toTokenSet } from '@/lib/text/normalize';

/** A near-tier cluster as returned by getCommentVolumeAndClusters. */
export interface TemplateCluster {
  hash: string;
  n: number;
  sample: string;
  firstDay: string;
  lastDay: string;
  /** Space-joined sorted-distinct content tokens (the 'near' grouping key, pre-hash). */
  tokenset?: string;
}

export interface TemplateFamily {
  /** Stable id — the representative (largest) member's hash. */
  id: string;
  /** Member clusters, largest first. */
  members: TemplateCluster[];
  /** The largest member — its body stands in for the family. */
  representative: TemplateCluster;
  /** Comments across every folded variant. */
  totalN: number;
  /** Share of all docket comments, 0–100. */
  sharePct: number;
  /** How many near-clusters were folded together (1 = nothing merged). */
  variantCount: number;
  firstDay: string;
  lastDay: string;
}

/** Default Jaccard cut-off above which two clusters are one template. */
export const TEMPLATE_SIMILARITY = 0.8;
/** Below this token count a set is too small to trust at the normal threshold. */
const SHORT_SET = 4;
const SHORT_SIMILARITY = 0.95;

/** Tokens for a cluster: prefer the precomputed token-set, else derive from the sample. */
function tokensOf(c: TemplateCluster): Set<string> {
  const raw = c.tokenset && c.tokenset.trim().length > 0
    ? c.tokenset
    : toTokenSet(toSkeleton(toDisplay(c.sample)));
  return new Set(raw.split(' ').filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (large.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Should clusters i and j be in the same template family? */
function sameTemplate(a: Set<string>, b: Set<string>, threshold: number): boolean {
  const cut = a.size < SHORT_SET || b.size < SHORT_SET ? Math.max(threshold, SHORT_SIMILARITY) : threshold;
  return jaccard(a, b) >= cut;
}

/**
 * Single-linkage agglomeration of form-letter clusters into template families.
 * `clusters` is expected to be the form-letter set (n >= 2, placeholders already
 * dropped); `total` is the docket's full comment count for the share maths.
 */
export function agglomerateTemplates(
  clusters: TemplateCluster[],
  total: number,
  threshold: number = TEMPLATE_SIMILARITY,
): TemplateFamily[] {
  const n = clusters.length;
  if (n === 0) return [];

  const tokens = clusters.map(tokensOf);

  // Union-find: link any two clusters that clear the similarity bar.
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (x: number, y: number) => { parent[find(x)] = find(y); };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (sameTemplate(tokens[i], tokens[j], threshold)) union(i, j);
    }
  }

  // Gather members per root.
  const groups = new Map<number, TemplateCluster[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let members = groups.get(r);
    if (!members) {
      members = [];
      groups.set(r, members);
    }
    members.push(clusters[i]);
  }

  const families: TemplateFamily[] = [];
  for (const members of groups.values()) {
    members.sort((a, b) => b.n - a.n);
    const representative = members[0];
    const totalN = members.reduce((s, c) => s + c.n, 0);
    const firstDay = members.reduce((m, c) => (c.firstDay && c.firstDay < m ? c.firstDay : m), representative.firstDay);
    const lastDay = members.reduce((m, c) => (c.lastDay && c.lastDay > m ? c.lastDay : m), representative.lastDay);
    families.push({
      id: representative.hash,
      members,
      representative,
      totalN,
      sharePct: total > 0 ? (totalN / total) * 100 : 0,
      variantCount: members.length,
      firstDay,
      lastDay,
    });
  }

  families.sort((a, b) => b.totalN - a.totalN);
  return families;
}
