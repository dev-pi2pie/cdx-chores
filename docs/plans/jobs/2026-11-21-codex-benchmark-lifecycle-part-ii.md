---
title: "Codex benchmark lifecycle corrections, Part II — Implementation record"
created-date: 2026-11-21
modified-date: 2026-11-21
status: completed
agent: codex
---

This record covers all five phases of the completed [Part II plan](../plan-2026-11-21-codex-benchmark-lifecycle-part-ii.md). Earlier results are in the [Part I job record](2026-11-20-codex-benchmark-lifecycle-corrections.md).

## Both Node callers received HUP during initialization

The four regression cases exercised the built benchmark CLI and maintainer live check with a TERM-resistant fixture leader and worker. The parent verified both POSIX process groups before sending HUP and sampled the app-server group at caller exit, before teardown. [Regression cases](../../../test/codex-benchmark/hangup.app.test.ts) · [Phase 1 checklist](../plan-2026-11-21-codex-benchmark-lifecycle-part-ii.md#phase-1-hangup-cleanup-in-both-node-callers)

| HUP policy, both callers | Before at `c482d937` | After at `39c4cca0` |
| --- | --- | --- |
| Default | Terminated by HUP with the leader and worker still live. | Terminated by HUP with zero live group members. |
| Installed handler sets exit 42 | Reached `initialize-fallback`, then exited 1 with zero live members. | Exited 42 with zero live group members. |

All four fixed cases observed group TERM followed by KILL, caller exit within 2.5 seconds of HUP, and no initialization fallback. After ordinary completion, both callers restored the original HUP listener count and terminated on a later default HUP.

| Checkpoint | Evidence |
| --- | --- |
| Implementation `75707fda` | Shared HUP cleanup starts at detached launch and uses the existing bounded group shutdown. |
| Review `c482d937..75707fda` | Mixed signals could overwrite the initiating outcome. Tests also needed to cover ordinary listener release and concurrent owners. |
| Correction `39c4cca0` | Both callers retained 42 for installed HUP followed by TERM and 143 for TERM followed by default HUP. TERM interrupted a known benchmark turn and preserved its partial report through HUP. Default TERM emptied both groups when the benchmark and doctor ran in one process. |
| Controls | 186 focused tests passed. The live check closed immediately on INT/TERM with exit 130/143. Doctor, SDK retention, denied and undelivered escalation, and direct and managed teardown after assertion failure passed. |
| Managed suites at `39c4cca0` | 2,687 Application and 39 Codex cases passed with zero failures, errors or skips. Application test-process execution took 346.115 seconds against the 360-second limit. Both runs verified shutdown without escalation and removed scratch and results. |
| Tooling | The Node build, packaged CLI help, TypeScript, lint, changed-file formatting and diff checks passed. |
| Re-review `c482d937..39c4cca0` | Code and test reviewers found no remaining material issues. |

## Launch receipts before and after child allocation

At `971dbbc4`, a successful `statSync(cwd)` identifying a non-directory rejects the launch before public `spawn`. The Node and Bun probes both observed `/dev/null` for `os.devNull` and a rejection cause matching native `ENOTDIR`. A probe counted zero public spawn calls for the device and one for a valid directory. [Phase 2 checklist](../plan-2026-11-21-codex-benchmark-lifecycle-part-ii.md#phase-2-working-directory-rejection-before-spawn)

| Case and tested revision | Launch evidence | Cleanup and scheduling |
| --- | --- | --- |
| Null device before the fix, `fc737957` | Direct and managed regressions failed. Both managed receipts remained pending without start records. | Direct and managed scratch remained. Application failed and Codex and Pandoc stayed unrun. |
| Null device after the fix, `971dbbc4` | The caller and app-server receipts both completed as `launch-rejected` with `stopped: true`, no PID, group ID or start record. | Direct and managed scratch were removed. Application still failed as injected, then Codex and Pandoc ran. |
| Public spawn threw after allocation, `971dbbc4` | The Node driver observed a live child, stopped it in teardown and verified an empty group. The runner had one pending receipt without a recorded PID, group ID or completion. | The runner retained scratch and left Codex and Pandoc unrun. The test inspected the receipt before removing the retained run. |

At `971dbbc4`, all 387 runner and shutdown-fixture tests passed, including the 100 focused cases. Regular-file, trailing-slash, child-component and valid-directory controls passed. A missing working directory still settled through the native child error with `ENOENT`. TypeScript, lint, changed-file formatting and diff checks passed. Code and test reviewers found no material issues in `fc737957..971dbbc4`. [Direct and managed device cases](../../../test/codex-benchmark/shared-shutdown-cleanup.app.test.ts) · [Post-allocation control](../../../test/test-runner/fixture-context.app.test.ts)

## Validation of both lifecycle corrections

Phase 3 validated the two corrections at `c025f088`. [Phase 3 checklist](../plan-2026-11-21-codex-benchmark-lifecycle-part-ii.md#phase-3-code-validation-and-review)

| Check | Result |
| --- | --- |
| Targeted lifecycle and runner tests | 531 cases passed across 33 files, including caller-exit snapshots, independent teardown, launch receipts and later-suite scheduling. |
| Managed `bun run test:all` | All 4,874 cases passed (2,141 Unit, 2,689 Application, 39 Codex, 5 Pandoc). Zero failures, errors or skips. Application test-process execution took 341.829 seconds against the 360-second limit. |
| Managed cleanup | All preflight and test processes stopped without escalation. After finalization, the observed run directory, scratch and results were absent. |
| Build and package | The Node build passed. The declared CLI entry in the extracted tarball reported version `0.2.2-canary.7` and displayed `codex-bench --help`. |
| Static checks | TypeScript, lint, formatting for all 16 changed TypeScript and JavaScript files, and the full-range diff check passed. |
| Review `c482d937..c025f088` | Maintainability and test reviewers found no material issues across the two phases. |

## Canary review found two additional lifecycle regressions

The independent review of `ba2d93c1..411674fe` confirmed the stalled-initialization HUP outcomes for both benchmark callers, the doctor and SDK retention controls, the device and regular-file path rejections, and scratch retention after child allocation. All 4,874 managed tests passed at `411674fe`. Separate probes reproduced two open P3s. [Phase 4 checklist](../plan-2026-11-21-codex-benchmark-lifecycle-part-ii.md#phase-4-corrections-from-the-canary-review)

| P3 at review | Canary (`ba2d93c1`) | Reviewed tip (`411674fe`) |
| --- | --- | --- |
| Live-check HUP after the first `turn/start` reply | The installed handler set exit code 42 and the caller exited 42, as it also did at `528fdd65`. | The group stopped and the next trial was skipped. The trial failure overwrote exit code 42 with 1. |
| Working directory with a symlink loop (`ELOOP`) or a 512-byte component (`ENAMETOOLONG`) | Scratch was removed and Codex and Pandoc ran. | In both cases the two receipts stayed pending, scratch was retained and neither later suite ran. |

## Active-turn hangup and launch-path failures

| Checkpoint | Evidence |
| --- | --- |
| Live-check HUP, `b7139c6a` | At `2cc9b07a`, the trial failure overwrote exit code 42 with 1 when HUP arrived after the first `turn/start` reply. The corrected caller exited 42 within 2.5 seconds, started one trial and had zero live group members at caller exit before teardown. An ordinary trial failure still exited 1. |
| Working directory, `bef25d53` | A symlink loop and an overlong component previously left two pending receipts. After the fix, Node and Bun matched native `ELOOP` and `ENAMETOOLONG` with zero calls to spawn the subject. Each managed case closed both receipts as `launch-rejected` with `stopped: true`, no PID, group ID or start record. Scratch was removed and Codex and Pandoc ran after the injected Application failure. |
| Review `ba2d93c1..bef25d53` | Both original P3s were resolved. All 4,881 managed tests passed. The review reproduced the same scheduling failure with a valid working directory and an explicit executable path that crossed a regular file, looped through a symlink or contained an overlong component. |
| Explicit executable, `f3bb3d7e` | All three common path cases produced the expected stopped receipts and resumed scheduling. Absolute and relative probes matched the native error in Node and Bun. PATH lookup and missing files still reached native spawn. |
| Review `ba2d93c1..f3bb3d7e` | The full managed suite passed. A long working-directory prefix masked the error for a relative executable. All three managed reproductions retained scratch, left two receipts pending and skipped both later suites. |
| Relative lookup, `08b028bc` | A bounded helper checks the relative path after changing directory. All three long-directory cases now close both receipts and resume scheduling. A valid near-limit command still ran, and an unavailable probe deferred to native spawn. |
| Post-allocation control | For each of `ENOTDIR`, `ELOOP` and `ENAMETOOLONG`, the driver independently observed and stopped a real child. The runner kept its receipt pending without a PID, group ID or start record, retained scratch and withheld Codex and Pandoc. |
| Validation at `08b028bc` | 297 focused tests passed across nine files. All 4,895 managed cases passed (2,141 Unit, 2,710 Application, 39 Codex, 5 Pandoc) with zero failures, errors or skips. Application took 351.968 seconds against the 360-second test-process limit. All managed preflight and test processes stopped without escalation and the observed run root, scratch and results were removed. |
| Build and static checks | The Node build, extracted package CLI version and `codex-bench --help`, TypeScript, lint, formatting and full-range diff checks passed at `08b028bc`. |
| Final review `ba2d93c1..08b028bc` | No actionable findings. All three P3s were resolved, including the long-directory cases. The review verified the earlier benchmark, doctor, SDK retention and runner controls. Helper throws, timeouts, nonzero exits and malformed output all deferred to native spawn. |

[Phase 4 checklist](../plan-2026-11-21-codex-benchmark-lifecycle-part-ii.md#phase-4-corrections-from-the-canary-review)

## Documentation validation and closeout

| Check | Result |
| --- | --- |
| Guide and research, `39183f61` | The guide documents POSIX hangup behavior for both callers. Part II records the verified before/after results, launch receipts and platform limits. The Part I design section matches `9f01bbba`. |
| Figures and references | All three Mermaid diagrams rendered. The exit snapshot precedes fixture teardown, and the launch diagram distinguishes proven rejection, native settlement and uncertain allocation. Repository-relative links, incoming links, heading anchors and research footnotes resolved. |
| Documentation review, `9f01bbba..39183f61` | The documentation reviewer checked the guide and research against the implementation and unified record and found no material gaps. The 4,895 passing managed tests are the Phase 4 results at `08b028bc`. |
| Closure | The reviewer verified all five checklists, the completed plan, research and job statuses, and the attribution of test evidence in the closeout diff against `39183f61`. [Phase 5 checklist](../plan-2026-11-21-codex-benchmark-lifecycle-part-ii.md#phase-5-documentation-validation-and-closeout) |
