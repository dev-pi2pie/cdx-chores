---
title: "Draft v0.1.1 stable release notes and refresh stable wording"
created-date: 2026-04-11
status: completed
agent: codex
---

## Goal

Draft the first manual stable release-note body for `v0.1.1` and refresh current-guide wording that still referred to `v0.1.0` as the active stable version.

## What Changed

- added `CHANGELOGS/v0.1.1.md` as the first manual stable release-note body
- curated the `v0.1.1` release summary around final shipped behavior rather than raw commit titles:
  - GIF quality modes and profiles
  - improved GIF look tuning
  - `Esc`-based interactive command-menu exit behavior
  - alpha-preservation fix for quality GIF output
- updated `README.md` so the stable release scope now refers to `v0.1.1`
- refreshed current-guide stable-version references in:
  - `docs/guides/data-preview-usage.md`
  - `docs/guides/data-duckdb-usage.md`
  - `docs/guides/data-query-codex-usage.md`
  - `docs/guides/data-query-usage.md`
  - `docs/guides/data-schema-and-mapping-usage.md`
  - `docs/guides/data-source-shape-usage.md`
  - `docs/guides/rename-timestamp-format-matrix.md`

## Verification

- no automated tests run; this pass added release-note and wording updates only

## Related Documents

- `CHANGELOGS/v0.1.1.md`
- `RELEASE_NOTES_POLICY.md`
- `docs/plans/jobs/2026-04-11-stable-release-notes-manual-override-implementation.md`
