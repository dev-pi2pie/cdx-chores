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

## Follow-up

At `7d336945`, the lifecycle spike still sent `appServerVersion: "0.171.0"` after the synthetic fixture switched to `appServerUserAgent`. The fixture fell back to `cdx_chores/0.170.0`. Both callers reported `0.170.0` in all eight observations, and the comparison exited 0. The repository search found one caller using the retired field.

At `2a077b99`, the spike sends `cdx_chores/<installed SDK version>` and requires that version in `run.codexVersion` for the built benchmark and `codexVersion` for the live check. The documented build and comparison ran on macOS with Node.js 24.22.3 and Bun 1.4.5. All eight reports identified `0.171.0` and the comparison exited 0. The caller reports, exit statuses, and protocol traces agreed with the accepted outcomes. [Comparison guide](../../../scripts/spikes/codex-turn-lifecycle/README.md) · [Phase 2 outcomes](2026-11-20-codex-turn-reporting-and-app-server-shutdown.md#phase-2-turn-recovery-and-scheduling)

| Scenario            | Turn, archive, and Fast start                                   | Benchmark interrupt | Live check interrupt | Both caller exits |
| ------------------- | --------------------------------------------------------------- | ------------------- | -------------------- | ----------------- |
| Normal              | Matching Standard completion, then archive, then Fast           | None                | None                 | 0                 |
| No reply + terminal | Recovered matching Standard completion, then archive, then Fast | None                | None                 | 0                 |
| No reply + active   | No matching completion, archive skipped, Fast did not start     | Acknowledged        | None                 | 1                 |
| Reply + ack only    | No matching completion, archive skipped, Fast did not start     | Acknowledged        | None                 | 1                 |

Two negative controls used a temporary copy of the runner with an altered fixture user agent. With `cdx_chores/0.170.0`, both reports contained the wrong version. With an unversioned token, the benchmark reported null and the live check omitted the field. Each control rejected all eight observations, named each caller and scenario, and exited 1.

The 20 focused turn-recovery tests, build, TypeScript check, lint, and changed-file formatting passed. Repository-wide formatting still flagged the benchmark help test recorded above. Regression coverage and maintainability reviews covered `7d336945b809c1aa080a738647688bf8b1f6d84e..2a077b99804ea2b670c1a061c05eadafc4b92262`. The unversioned control resolved the coverage finding. Documentation review checked the evidence and wording, and no actionable findings remain.

## Second follow-up

At `29a58737`, bundled Codex 0.171.0 echoed the originator literally in the native `initialize` response. The table records packaged doctor and provider discovery against native Codex. Doctor exited 0 in all four cases. The packaged benchmark and Bun live check used a synthetic workload that replayed each verbatim native `userAgent`.

| Originator override | Native user-agent prefix | Baseline doctor status and version | Baseline provider discovery | Baseline benchmark version | Baseline live check version |
| ------------------- | ------------------------ | ---------------------------------- | --------------------------- | -------------------------- | --------------------------- |
| Unset               | `cdx_chores/0.171.0`     | `met`, `0.171.0`                   | Exit 0                      | `0.171.0`                  | `0.171.0`                   |
| `codex_exec`        | `codex_exec/0.171.0`     | `met`, `0.171.0`                   | Exit 0                      | `0.171.0`                  | `0.171.0`                   |
| `Codex Exec`        | `Codex Exec/0.171.0`     | `unverified`, null                 | Exit 1, invalid CLI version | `0.171.0`                  | `Exec`                      |
| `codex/exec`        | `codex/exec/0.171.0`     | `unverified`, null                 | Exit 1, invalid CLI version | `exec/0.171.0`             | `exec`                      |

At `66b3891a`, the four callers use one extractor with the environment passed to their app-server process. It recognizes the configured originator as a literal prefix or reads an ordinary leading `name/version` token. It validates the version immediately after the prefix. Doctor applies its `0.170.0` minimum and prerelease policy. For malformed input, doctor reports `unverified` with a null version, discovery fails, the benchmark reports a null version, and the live check omits the version.

The macOS arm64 packaged matrix used Node.js 26.13.1, isolated homes, and bundled Codex 0.171.0. For all four overrides, doctor exited 0 with `met` and `0.171.0`, and provider discovery exited 0 with `0.171.0` and the configured synthetic provider. The packaged benchmark and Bun live check each reported `0.171.0` in all four native-user-agent replays.

The separate eight-case lifecycle comparison ran the built benchmark under Node.js 24.22.3 and the Bun 1.4.5 live check against a fully synthetic app-server. All eight reports identified `0.171.0`. Caller exits and protocol traces matched the first follow-up. Both callers archived Standard before Fast in the two success scenarios, and both skipped archive and stopped before Fast in the two fault scenarios. Open coverage includes authenticated native turns and other platforms or Codex versions.

The 15 focused extractor tests and 30 focused caller cases passed. Managed validation passed 2,138 unit tests, 2,538 application tests, and 30 Codex integration tests. The build, TypeScript check, lint, and changed-file formatting passed. Repository-wide formatting still flagged the earlier benchmark help test.

Regression coverage and maintainability reviews covered `29a5873722deae9eccddf8e36374a1efffaac2df..66b3891a938f2cd19c776f59491a841fc59a3921`. Documentation review checked the evidence and wording. No actionable findings remain.
