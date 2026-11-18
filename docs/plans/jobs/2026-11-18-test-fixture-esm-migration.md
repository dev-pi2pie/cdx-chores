---
title: "Test fixture ESM migration"
created-date: 2026-11-18
status: completed
agent: codex
---

Converted five standalone Node test fixtures to ESM and updated their launch paths and copied executable names. The test-runner process fixture now uses `fileURLToPath(import.meta.url)` to launch itself.

| Fixture | Before | After |
| --- | --- | --- |
| Benchmark app-server | `benchmark-app-server.cjs` | [benchmark-app-server.mjs](../../../test/codex-benchmark/fixtures/benchmark-app-server.mjs) |
| SDK retention | `sdk-retention-executable.cjs` | [sdk-retention-executable.mjs](../../../test/codex-benchmark/fixtures/sdk-retention-executable.mjs) |
| CLI streaming | `subject.cjs` | [subject.mjs](../../../test/cli-foundations/process/fixtures/subject.mjs) |
| Test-runner process | `process-subject.cjs` | [process-subject.mjs](../../../test/test-runner/fixtures/process-subject.mjs) |
| Video resolver | `probe.cjs` | [probe.mjs](../../../test/video/frames/fixtures/probe.mjs) |

The entire generated `dist/cjs/` tree, including `dist/cjs/index.cjs`, is outside the migration. The DOCX CommonJS consumer and test-runner `.cjs` discovery cases exercise that format deliberately. The [EOF preload](../../../test/codex-benchmark/fixtures/final-readback-eof-preload.cjs) uses CommonJS so Bun applies its built-in module patches before the CLI loads.

## Verification

- 179 focused Bun tests passed across benchmark and SDK retention, doctor, CLI streaming, test-runner process and discovery, and video resolver. The process tests exercised self-launch and child shutdown.
- The built Node CLI smoke test used the ESM app-server fixture and confirmed the EOF gate marker, exit status 1, and preservation of the completed measured trial.
- Type checking, lint, formatting, and `git diff --check` passed. Exact-range review of `10ef5757..e2e03bf1` found no actionable issues.
