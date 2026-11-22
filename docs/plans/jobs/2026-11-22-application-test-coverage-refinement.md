---
title: "Application test coverage and fixture performance"
created-date: 2026-11-22
status: completed
agent: codex
---

Consolidated 18 overlapping checks, reducing the Application suite from 2,754 to 2,736 cases.

## Coverage and fixtures

| Area | Change | Test and fixture references |
| --- | --- | --- |
| Codex tier classification | Reduced ten CLI cases to two representative outcomes. Unit tests cover all ten provider message variants. | [Benchmark runner](../../../test/codex-benchmark/benchmark-runner.app.test.ts) · [Tier rejection](../../../test/codex-benchmark/tier-rejection.unit.test.ts) |
| Codex turn recovery | Removed eight repeated Application cases across the benchmark and live check. Both callers retain representative invalid input and lifecycle cases. Unit tests cover wrong-code and unstructured refusals plus missing and numeric thread IDs. | [Turn recovery](../../../test/codex-benchmark/turn-recovery.app.test.ts) · [Turn start](../../../test/codex-benchmark/turn-start.unit.test.ts) |
| Codex fixtures | Ran independent CLI cases concurrently, reused Node caller bundles, and released late start replies when reconciliation begins. | [App server](../../../test/codex-benchmark/fixtures/benchmark-app-server.mjs) · [Runner](../../../test/codex-benchmark/fixtures/runner.ts) · [Recovery preload](../../../test/codex-benchmark/fixtures/turn-recovery-preload.mjs) |
| Video export | Removed two overlapping overwrite cases while retaining plain, case-folded, NFC-equivalent, and overwrite collision coverage. The WebP fixture waits for the first image to be published before sending the invalid frame. | [Export tests](../../../test/video/frames/export.app.test.ts) · [Driver](../../../test/video/frames/fixtures/export-driver.ts) · [Tool](../../../test/video/frames/fixtures/export-tool.ts) |

## Recorded verification

| Check | Result |
| --- | --- |
| Coverage consolidation | One Application run per revision measured 330.875 s for 2,754 baseline cases and 317.836 s for the consolidated 2,736 cases across 317 files. Focused checks passed 20 unit cases and all 140 Application cases on rerun after a WebP publication assertion failed. |
| Fixture timing | Three sequential runs per revision passed the same 2,736 Application cases. Median execution fell from 321.732 s to 307.902 s. Headroom on the slowest run rose from 32.108 s to 52.002 s. The WebP publication case passed in all six runs. |
| Full suite | `bun run test:all --keep-results` passed all 4,970 cases in 342.92 s. Application took 309.020 s. JUnit recorded zero assertions for the affected concurrent cases, and Bun reported eight additional assertions. |
| Review and static checks | Test review found no material coverage gaps. TypeScript, scoped lint, formatting, and whitespace checks passed. |
