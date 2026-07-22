---
description: Generate a changelog of merged PRs across the Spicy Regs repos for a time window (default: last 2 weeks)
argument-hint: "[time window, e.g. \"last 2 weeks\" or \"since 2026-07-08\"]"
allowed-tools: mcp__github__search_pull_requests, mcp__github__list_commits, Bash(date:*)
---

Generate a changelog for the Spicy Regs project covering **$ARGUMENTS**
(if no window was given, default to the **last 2 weeks** from today).

## Repos to cover

- `civictechdc/spicy-regs` — the data pipeline / ETL (Python). Group its changes
  under a **Pipeline** heading.
- `ekim1394/spicy-regs-ui` — the browser explorer (Next.js). Group its changes
  under a **UI** heading.

## Steps

1. Resolve the window's start date (run `date` if you need "today"). Two weeks =
   today minus 14 days.
2. For **each** repo, fetch merged PRs in the window with
   `mcp__github__search_pull_requests`, query:
   `repo:<owner>/<repo> is:pr is:merged merged:>=<START_DATE>`, `perPage: 100`.
   If a result is too large to read inline, it will be saved to a file — extract
   the fields you need with `jq` (`.items[] | {number, title, merged_at, body}`)
   rather than re-fetching.
3. Ignore merge-commit noise; the PR titles and bodies are the source of truth.
   Read each PR title (and body when the title is terse) to classify it.

## Output

Produce **two artifacts**:

### 1. Full changelog (Keep a Changelog format)

Per repo, a dated section grouping entries into **Added / Changed / Fixed**
(add **Removed / Security** only if relevant). Each entry is one line, plain
language, ending with its PR number linked to
`https://github.com/<owner>/<repo>/pull/<n>`. Lead each repo's section with a
one-sentence summary of the cycle's theme. This is what lands in each repo's
`CHANGELOG.md`, the `spicy-regs` docs site (`docs/changelog.md`), and the
GitHub Release notes.

### 2. Subscriber summary (Slack / email)

A short, friendly, non-technical digest — a 1-2 sentence intro plus 3-6 bullets
of the changes that matter to a *user of the site*, not an implementation log.
No PR numbers. Keep it skimmable. Offer it as both a Slack-flavored version
(mrkdwn, emoji section headers) and a plain-text email version.

Do not commit anything or send any messages unless explicitly asked — just
produce the text.
