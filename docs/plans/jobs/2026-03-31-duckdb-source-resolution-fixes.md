---
title: "DuckDB source resolution fixes"
created-date: 2026-03-31
status: completed
agent: Codex
---

## Goal

Fix DuckDB source resolution regressions introduced by the new `.duckdb` query support.

## What Changed

- allowed implicit source selection when a DuckDB file exposes exactly one queryable relation
- made DuckDB source selectors quote non-simple identifiers so dotted table names do not collide with schema-qualified selectors
- added regression coverage for `data query`, `data query codex`, and `data extract`

## Verification

- `bun test test/cli-actions-data-query.test.ts test/cli-actions-data-query-codex.test.ts test/cli-actions-data-extract.test.ts`
