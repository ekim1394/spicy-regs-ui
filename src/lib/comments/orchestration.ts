/**
 * Shared orchestration arithmetic for comment clusters.
 *
 * A "form letter" is any non-placeholder cluster with two or more members; the
 * orchestrated share is the fraction of comments that belong to one. Callers
 * supply the placeholder predicate so the same maths backs both the docket
 * breakdown and the lab fidelity ladder.
 */

interface ClusterLike {
  /** Number of comments in the cluster. */
  n: number;
}

export interface OrchestrationStats<T extends ClusterLike> {
  /** Clusters left after dropping placeholders. */
  realClusters: T[];
  /** Real clusters with two or more members (the form-letter templates). */
  formLetters: T[];
  /** Total comments belonging to a form letter. */
  orchestratedCount: number;
  /** Total comments NOT belonging to a form letter. */
  uniqueCount: number;
  /** Unique share, 0–100. */
  uniquePct: number;
  /** Orchestrated share, 0–100. */
  orchestratedPct: number;
}

export function computeOrchestration<T extends ClusterLike>(
  clusters: T[],
  total: number,
  isPlaceholder: (cluster: T) => boolean,
): OrchestrationStats<T> {
  const realClusters = clusters.filter((c) => !isPlaceholder(c));
  const formLetters = realClusters.filter((c) => c.n >= 2);
  const orchestratedCount = formLetters.reduce((sum, c) => sum + c.n, 0);
  const uniqueCount = total - orchestratedCount;
  return {
    realClusters,
    formLetters,
    orchestratedCount,
    uniqueCount,
    uniquePct: total === 0 ? 0 : (uniqueCount / total) * 100,
    orchestratedPct: total === 0 ? 0 : (orchestratedCount / total) * 100,
  };
}
