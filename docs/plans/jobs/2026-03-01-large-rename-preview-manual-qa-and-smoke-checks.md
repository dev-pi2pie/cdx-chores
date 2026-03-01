---
title: "Large rename preview manual QA and smoke checks"
created-date: 2026-03-01
status: completed
agent: codex
---

## Goal

Complete Phase 5 of the large rename preview plan by validating the new preview UX against small and large dry-run scenarios and recording the practical findings.

## Manual Smoke Checks

- Seeded `examples/playground/huge-logs/` with 1000 synthetic `.log` files using `node scripts/generate-huge-logs.mjs reset --count 1000`
- Ran small compact preview smoke check:
  - `bun src/bin.ts rename batch examples/playground/.tmp-tests/rename-preview-small --prefix smoke --dry-run`
- Ran detailed skipped-item smoke check:
  - `bun src/bin.ts rename batch examples/playground/.tmp-tests/rename-preview-detailed --prefix smoke --dry-run --recursive --preview-skips detailed`
- Ran large compact preview smoke check:
  - `bun src/bin.ts rename batch examples/playground/huge-logs --prefix smoke --dry-run`
- Ran single-file dry-run smoke check:
  - `bun src/bin.ts rename file examples/playground/huge-logs/app-00001.log --prefix smoke --dry-run`
- Verified replay/apply path using the small dry-run CSV:
  - `bun src/bin.ts rename apply <plan-csv> --auto-clean`

## Findings

- Small batch output remained simple and did not introduce unnecessary truncation.
- Large batch output showed:
  - summary counts first
  - bounded rename preview
  - explicit head/tail truncation messaging
  - plan CSV emphasis for full review
- Detailed skipped-item mode preserved the compact skipped summary and added a separate bounded skipped-details section.
- Single-file dry-run output remained clear and unchanged in spirit.
- Generated `rename-*.csv` remained valid as the replay/apply artifact.

## Cleanup

- Removed temporary smoke-test plan CSV files after verification.
- Removed temporary `.tmp-tests/rename-preview-*` directories after verification.
- Left `examples/playground/huge-logs/` populated as a reusable large-list smoke-test fixture.
