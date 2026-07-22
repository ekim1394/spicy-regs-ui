# Changelog

All notable changes to the Spicy Regs UI are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Entries link to the pull request that introduced the change.

## [2026.07.22]

This cycle the explorer caught up to the ten new external datasets the pipeline
began publishing — surfacing them both in a dedicated browser and in context on
the pages people already use — alongside a load-time pass and a resilience layer.
Everything still runs entirely in the browser via DuckDB-WASM, with no backend.

### Added

- **Sources explorer** — a config-driven `/sources` index plus a generic
  `/sources/[source]` browser covering all ten new datasets, with full-text
  search, per-source filters, sort, and infinite scroll. Filter/sort state lives
  in the URL, so views are shareable ([#10]).
- **Related-source panels in context** — docket pages gain a
  "Planned rulemaking · Unified Agenda" panel and agency pages gain an
  "APA litigation" panel, each deep-linking into the sources browser ([#11]).
- **Resilience layer** — a shared `useAsyncData` hook, error boundaries
  (`DuckDBInitError`, `QueryErrorCard`, global `error.tsx`, styled `not-found`),
  and `sqlStr` identifier hardening, replacing effects that silently swallowed
  query failures ([#8]).

### Changed

- **Performance** — lazy DuckDB boot (async chunk, off the hydration path),
  preconnect hints, and caching of hot re-scans. First-load JS: `/about`
  240 → 197 KB, `/feed` 324 → 282 KB ([#9]).

### Fixed

- External-source UI follow-ups: resolve Unified Agenda RINs directly from
  `fr_docket_links` (dropping a ~120 MB browser scan), typed date/timestamp
  casts for freshness tiles, and icon-only primary nav below the `sm`
  breakpoint ([#12]).

[2026.07.22]: https://github.com/ekim1394/spicy-regs-ui/releases/tag/v2026.07.22
[#8]: https://github.com/ekim1394/spicy-regs-ui/pull/8
[#9]: https://github.com/ekim1394/spicy-regs-ui/pull/9
[#10]: https://github.com/ekim1394/spicy-regs-ui/pull/10
[#11]: https://github.com/ekim1394/spicy-regs-ui/pull/11
[#12]: https://github.com/ekim1394/spicy-regs-ui/pull/12
