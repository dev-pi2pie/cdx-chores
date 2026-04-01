---
title: "Refine doctor core format reporting"
created-date: 2026-03-10
status: completed
agent: codex
---

## Goal

Remove misleading extension-style `doctor` output for DuckDB core query formats.

## What Changed

- changed `doctor` so `csv`, `tsv`, and `parquet` are reported as built-in DuckDB support instead of showing extension-oriented `loadability` and `installability` fields
- kept extension-specific reporting unchanged for `sqlite` and `excel`, including loadability, installability, and detail messaging
- updated the JSON payload shape to distinguish core formats from extension-backed formats through a `kind` field
- added regression assertions covering both the machine-readable payload and the human-readable report

## Files

- `src/cli/actions/doctor.ts`
- `test/cli-actions-doctor-markdown-video-deferred.test.ts`

## Verification

- `bun test test/cli-actions-doctor-markdown-video-deferred.test.ts`

## Related Plans

- `docs/plans/archive/plan-2026-03-10-data-query-cli-implementation.md`
