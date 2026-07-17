# Front-end compute: what the pipeline could take back

Each page runs SQL in DuckDB-WASM against the Parquet mirror on R2, in the browser. There's
no server, so every viewer re-runs every scan and nothing's cached between sessions. Two
things cost real time: the queries that fall through to the big files (`documents.parquet`
~80 MB, the multi-GB comment partitions, `federal_register.parquet` ~793K rows / ~140 MB) on every
load, and the per-row text work the browser does live because the derived columns don't
exist yet. Each item below names the method in
[`useDuckDBService`](../src/lib/duckdb/useDuckDBService.ts) that runs it.

---

## 1. ETL gaps that block features (recover at source, not fixable downstream)

These columns are dropped or never extracted. They cap what the UI can show, and several
have logic already wired and sitting inert. Downstream materialization can't recover them,
so they come first.

| Field | Currently | Unblocks | Status in code |
|---|---|---|---|
| comment `first_name` / `last_name` / `organization` | dropped at ingest from **both** the comment partitions **and** the flat `comments.parquet` (confirmed 2026-05-30 via `DESCRIBE`; both carry only `comment_id, docket_id, agency_code, title, comment, document_type, posted_date, modify_date, receive_date, attachments_json`) | signature-masking (form letters identical but for who signed collapse into one cluster) **and** the individual-vs-organization split + org leaderboard | `sqlStripName` stage is **wired but inert** in `getCommentClustersMultiTier`; `toSkeleton` mirrors it in TS. `ThreadedComments` reads `organization` → always `undefined`, so its `isOrg`/"Organization" badge is **dead code** until the column lands |
| comment `category` (submitter type) | absent | the individual / organization / govt classification directly, without heuristics over title+body | not rendered; would replace any keyword-based org/individual guesser |
| `withdrawn` / `reason_withdrawn` | absent | the abandoned vs. withdrawn vs. pending distinction in the lifecycle view | rendered as `DemoPill`; lifecycle "stuck" logic is a heuristic age-window workaround |
| `rin` / `additional_rins` | absent | linking dockets in one multi-stage rulemaking, and cross-docket campaign joins | `DemoPill` |
| document attachments | one nullable `file_url` per doc row | a real attachment list, size, MIME, FR document number | Document page degrades to 0-or-1 attachment, drops the Size column |

Start with the submitter-name gap. It's the difference between the current near-dup
heuristic and correct campaign attribution, the pipeline already has the transform spec
(`lib/text/normalize.ts`), and the SQL stage is in place waiting for the columns. The same
ingest pass that recovers `organization`/`category` is the **only** path to systematic
org-name aggregates: there is no client-side fallback, because the columns are absent from
the flat file too and a keyword heuristic over `title`+`comment` can't run over the largest
dockets (>1M comments) in the browser. Recovering these also lights up two inert features
for free — the dead `isOrg` badge, and the `sqlStripName` masking that sharpens the
form-letter clustering below.

---

## 2. Hot scans → materialized views (the offload targets)

These queries hit a big file on **every** load. Each is a candidate for a pre-baked
artifact the page reads instead of scanning. Ordered by scan frequency and file size.

| Query (method) | Page | Scans today | Grain it needs | Proposed MV |
|---|---|---|---|---|
| `getDiscoverySignals` → **spike** | feed (every load) | `documents.parquet` full | per-agency 30d vs prior-year monthly mean | `discovery_signals` (all 4 kinds, refreshed at ETL; the other 3 already ride `feed_summary`/`comments_index`) |
| `getAgencyMonthlyVolumeBatch` | agencies dir (every load) | `documents.parquet` full | per-agency monthly doc count | `agency_monthly_volume` (also feeds profile activity panel) |
| `getRulemakingLifecycles` | agency profile | `documents.parquet`, multi-CTE + self-join | per-agency Proposed→Rule percentiles + sampled completed/stuck | `rulemaking_lifecycles` (summary + sample) |
| `getDocumentCountsByAgencyMonth` | agency profile | `documents.parquet` filtered by type | monthly counts by doc type | same `agency_monthly_volume`, typed |
| `getAgencyStats` / `getAllAgencyCounts` | profile + dir | `dockets` + `documents` counts | per-agency dockets/docs/comments | `agency_stats` dimension |
| `getCommentVolumeAndClusters` / `getCommentClustersMultiTier` | docket Comments tab | comment partitions, **live per-row hashing** | per-docket cluster summary | see §3 |
| `getCommentVolumeByDay` | docket | comment partitions | per-docket daily series | bake alongside cluster summary |
| `getFRPublicationsForDocket` | docket (every load) | `federal_register` `LIKE '%"id"%'` over 793K | docket→FR edges | `fr_docket_links(docket_id, document_number)` (explode `docket_ids_json`) |
| `searchFederalRegister` / `getRecentFederalRegister` | search / FR | `federal_register` full-scan `ILIKE` | inverted index | FTS/BM25; normalize `agency_slugs` out of the comma-joined string |

`feed_summary` carries no comment time-series, so `getDiscoverySignals`→surge can only use
the monthly partition delta from `comments_index`, the finest real "recent" grain available.
A per-docket daily/weekly comment series would let surge use a true rolling window, and it's
cheap to materialize.

---

## 3. Comment-text clustering (the heaviest live work)

The docket Comments tab and the orchestration/fidelity panels cluster form letters live, in
the browser: clean → strip contacts → skeleton → `md5` → `GROUP BY key`, with a sorted-token
near-dup tier on top. Cost scales O(rows); a high-volume docket hashes every comment on the
main thread on every view.

On top of that, the docket breakdown now runs a **second, client-side agglomeration pass**
([`lib/comments/templates.ts`](../src/lib/comments/templates.ts) `agglomerateTemplates`):
single-linkage merge of the near-dup clusters by token-set Jaccard (≥0.8) so the small
wording variants one campaign produces collapse into a single *template family* with one
share figure (`getCommentVolumeAndClusters` returns each cluster's pre-hash token-set string
for this). It only merges, never splits, so orchestration counts are unchanged. This is a
deliberately cheap stand-in for the SimHash/MinHash + LSH below — precomputing those at ETL
would make this client agglomeration unnecessary (the families would fall out of a single
`GROUP BY` on a baked near-dup band).

The transform spec lives in [`lib/text/normalize.ts`](../src/lib/text/normalize.ts) as two
parallel implementations of the same logic (TS for the browser, DuckDB SQL builders for
in-WASM execution). That duality is deliberate: a precomputed column
(`skeleton_hash`, etc.) can be swapped in without changing clustering behaviour, because the
pipeline runs byte-for-byte the same normalization the client does.

Precompute at ETL, on the comment rows:

- `skeleton_hash` (template tier), `simhash`/`minhash` (near-dup), `word_count`,
  `is_placeholder`: clustering collapses from live O(rows) hashing to `GROUP BY skeleton_hash`.
- per-template `stance` + `confidence` keyed by `skeleton_hash`: today stance is a JS
  phrase-lexicon re-scored per view.
- the heavy near-dup the client only approximates: a 64-bit SimHash/MinHash + Hamming-band
  LSH, which holds up to rewording in a way the current sorted-token key doesn't.

`skeleton_hash` is global, so once it's a column, cross-docket campaign detection (same
template across agencies) and per-docket cluster rollups are both one `GROUP BY` away.

---

## 4. Architectural considerations for the offload

- **Follow the index-file model.** `feed_summary` (pre-joined counts, no joins
  client-side) and `comments_index` (`SUM(row_count)` for every count, plus a partition
  locator) are why the cheap paths never touch big files. New rollups should follow the
  same shape: small, denormalized, read whole.
- **Keep the partition pruning.** Comment partitions are Hive-partitioned
  `agency/docket/year/month`, and `buildCommentsSource` reads only the matching
  `part-0.parquet` files via `union_by_name`. Keep derived comment columns inside those
  partitions so the pruning still applies; don't centralize them into one flat file the
  client must scan.
- **Cache rollups at the edge.** The rollups are tiny and identical across all viewers (the
  client cache is in-memory only and dies on reload). IndexedDB, CDN, or edge KV makes
  repeat and shared views skip the scan entirely. It's the one change that removes the
  re-run-per-viewer cost.
- **Link tables over substring matches.** `fr_docket_links` (from `docket_ids_json`) and a
  normalized `agency_slugs` table replace `LIKE '%"id"%'` and `LIKE '%slug%'` scans with
  index lookups. The same move sets up the cross-stage `rin` linkage once that field lands.
- **The membership-clause contract.** `buildFeedWhereClause` is shared between the feed list
  and its count so they can't drift. If filtering moves server-side, preserve that single
  source of truth; a baked topic-tag column would also drop the per-load `ILIKE` topic scan.

---

## 5. Beyond rollups

- **Semantic dedupe and topics:** embeddings + ANN to cluster by meaning beyond lexical
  near-dup; argument mining or batch-LLM stance to separate substantive points from boilerplate.
- **Outlier surfacing:** TF-IDF or embedding distance to find the genuinely unique comment
  buried inside a mass campaign.

Both presuppose the §3 precompute and an offline tier with the GPU/batch budget the browser
doesn't have.
