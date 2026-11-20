---
title: "Codex app-server version parsing"
created-date: 2026-11-20
status: completed
agent: Codex
---

## Change

Doctor and discovery now read the app-server version from the leading `originator/version` token. Doctor applies its existing `0.170.0` minimum and reports `unverified` with a null version for malformed tokens. Discovery reports `Codex discovery did not report a valid CLI version.` for malformed tokens.

## Packaged Node verification

Built baseline `99e8238e` and fix `a5509371` and packed each with `bun pm pack`. Ran the packaged CLI entry point under Node.js 26.13.1 on macOS arm64 with bundled Codex 0.171.0 from the frozen lockfile. Each invocation used a fresh `HOME` and `CODEX_HOME` configured with the synthetic `probe_proxy` provider. Direct `initialize` requests confirmed the leading user-agent tokens.

| Revision   | `CODEX_INTERNAL_ORIGINATOR_OVERRIDE` | Leading token        | `doctor --json`                    | `codex-info providers --json`     |
| ---------- | ------------------------------------ | -------------------- | ---------------------------------- | --------------------------------- |
| `99e8238e` | Absent                               | `cdx_chores/0.171.0` | Exit 0, `met`, `0.171.0`           | Exit 0, valid provider report     |
| `99e8238e` | `codex_exec`                         | `codex_exec/0.171.0` | Exit 0, `unverified`, null version | Exit 1, invalid CLI version error |
| `a5509371` | Absent                               | `cdx_chores/0.171.0` | Exit 0, `met`, `0.171.0`           | Exit 0, valid provider report     |
| `a5509371` | `codex_exec`                         | `codex_exec/0.171.0` | Exit 0, `met`, `0.171.0`           | Exit 0, valid provider report     |

Each successful provider report contained version `0.171.0`, `probe_proxy` as the configured and listed provider, and null `models` and `catalogSource`.

## Checks and review

- The user-agent checks produced four alternate-originator failures against baseline production code. The other 15 cases passed. The two affected application test files passed all 52 tests with the fix.
- `bun run test:integration:app` passed 2,527 tests across 312 files. `bun run test:integration:codex` passed 30 tests across six files. Both managed runs validated results and fixture outputs and completed cleanup.
- `bun run build`, `node_modules/.bin/tsc --noEmit`, `bun run lint`, `git diff --check`, and formatting checks on the changed source and test files passed. Repository-wide `bun run format:check` reported one pre-existing issue in the [benchmark help test](../../../test/codex-benchmark/help.app.test.ts).
- Regression coverage and maintainability review covered `99e8238edf42d6bcad9a2ea63e2dbdf24b4feabf..a550937133fcbf395cc5b917969dccb4802907cf` with no actionable findings.
- Documentation review checked the evidence and wording in this record and found no actionable issues.
