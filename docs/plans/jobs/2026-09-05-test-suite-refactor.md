---
title: "Test Suite Refactor Implementation Record"
created-date: 2026-09-05
modified-date: 2026-09-05
status: in-progress
agent: codex
---

## Scope and References

Execute the [implementation plan](../plan-2026-09-05-multi-test-commands.md)
against the [research contracts](../../researches/research-2026-09-05-multi-test-commands.md).
Phase 1 established bounded process ownership. Phase 2 completed suite
classification, migration, and final discovery. Phase 3 implements the managed
runner; Phase 4 remains pending.

## Phase 1: Process Lifecycle

Status: completed.

Fixed review base: `a67aa95255150ba785605e942a8395d7537fe7e0`.

Environment: macOS 26.6.2, Node 26.5.0, Bun 1.4.1, Codex CLI 0.153.4.
The initial tracked worktree was clean.

### Implementation and Evidence

The current transport and independent probe await their immediate child.
The installed Codex entry point starts a native child, so verification must
distinguish launcher exit, stream closure, and remaining owned processes.
The test-only owner uses a detached process group, direct-child exit/stream close,
and bounded `ps` state observations. Zombie-only groups are not live work. It
signals only its allocated group and retires that signal target once observed
without live members. Children must inherit the group; arbitrary daemonizing
workloads are outside this mechanism's containment contract.

`scripts/testing/preflight.ts` gates an actual second command on successful probe
completion. Synchronous probe work runs in a child; failed or cancelled preflight
does not launch the following command. Production discovery code is unchanged.

| Checkpoint attempt                          | Outcome                                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Initial focused run                         | 4 pass, 11 fail: process observation was denied by the execution sandbox; no completion claim made |
| Process observation permitted               | 12 pass, 3 fail: fractional remaining milliseconds reached Node's integer timeout option           |
| Timeout conversion corrected                | 15 pass, 0 fail; 71 assertions                                                                     |
| Real sequencing/cancellation coverage added | 17 pass, 0 fail; 86 assertions; 4.80 seconds                                                       |

The deadline and unresolved-descendant regressions subsequently passed: 19 tests,
97 assertions, 5.44 seconds.

After the full-range ownership review, focused verification passed 20 tests and
120 assertions in 5.72 seconds. TypeScript, repository lint, and formatting passed.

Command: `bun test ./test/test-runner/process-table.unit.test.ts ./test/test-runner/process.app.test.ts`.
Fixture limits are 2,500 ms execution, 250 ms
grace, and 1,500 ms total termination; timeout fixtures use shorter explicit
execution deadlines. The installed-tool checkpoint verification passed 19 tests and 98 assertions
in 4.93 seconds, including safe cleanup for a launch failure with no spawned PID.
`tsc --noEmit`, repository lint, and repository format checks passed.

The first checkpoint is `2605651c`. A subsequent review tightened signal ordering:
no termination attempt may begin after the cleanup budget expires. Observation
loss after launcher exit returns `stopped: false` and the owned group identity;
callers retain scratch and stop scheduling. Recovery requires fresh ownership
evidence, rather than an unverified post-completion force-kill API. Both boundaries
have dedicated regressions, including verified fixture-only recovery. These fixes
were checkpointed in `04361b29`.

### Installed Codex and Node Evidence

Installed-tool protocol, fixed before execution: three sequential attempts for
each of the independent protocol client and production transport, first with
captured output and then in a terminal (12 probe runs total). Each attempt uses
a fresh isolated home/project and three bounded metadata requests. Verified
limits: 5 seconds for the version probe, 30 seconds for execution, 1 second for
normal/graceful shutdown, and 3 seconds total termination. Failed attempts remain
recorded below; each corrected series used the same fixed repetition count.

Command: `node scripts/testing/verify-codex-lifecycle.ts --attempts 3`.

| Series                                        | Protocol attempt durations (ms) | Transport attempt durations (ms) | Outcome                                                                                   |
| --------------------------------------------- | ------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| Initial captured series                       | 112, 114, 114                   | 113, 113, 114                    | Six startup failures; configured Codex home directory was missing; cleanup verified       |
| Diagnostic pair                               | 111                             | 110                              | Same startup failure; sanitized diagnostics captured                                      |
| Home corrected, original name check, captured | 861, 813, 772                   | 747, 787, 757                    | Requests/cleanup passed all six; native-name check passed only protocol 1 and transport 2 |
| Home corrected, original name check, terminal | 796, 748, 784                   | 770, 777, 744                    | Requests/cleanup passed all six; native-name check passed only protocol 3                 |
| Kernel name correction, captured              | 1085, 730, 724                  | 861, 746, 753                    | All six passed; native child observed; no escalation                                      |
| Kernel name correction, terminal              | 755, 848, 732                   | 739, 743, 760                    | All six passed; native child observed; no escalation                                      |

The name-check failures came from macOS `comm` fallback values such as `(codex)`.
The observer now requests `ucomm`, the kernel accounting name described by `ps(1)`;
names remain diagnostic, while numeric process-group ownership controls signals.
The fixture creates its configured home and sets a Git discovery ceiling so the
isolated project does not inherit the enclosing checkout's Git configuration.

Two additional diagnostic pairs (`--attempts 1`) measured direct-exit-to-verified-
completion drain: captured protocol/transport 667/614 ms (770/725 ms total), and
terminal 780/655 ms (888/779 ms total). All four passed. These observations support
the 1-second normal drain allowance for this verified environment; they are not a
cross-platform or future-version guarantee. Resistant fixtures separately verify
bounded escalation and failure reporting.

Codex startup also spawned Git helpers and occasionally `xcode-select`. The owner
observed their inherited group and awaited its completion, rather than equating
launcher exit with completion. All successful attempts removed their owned scratch;
no raw configuration, responses, or fixture updates were retained. Node ran the
verification owner directly; production code and package/runtime versions were
unchanged, so no new build/runtime behavior is claimed.

Process API reference: [Node child-process lifecycle and detached groups](https://nodejs.org/api/child_process.html).

### Full-Range Review Follow-Up

Review of `a67aa952..815908c4` identified two ownership refinements: expose the
successfully spawned `groupId` explicitly, and require continuity with a previously
observed live descendant before signaling after leader exit. A replacement group
must not inherit signal authorization merely by reusing the same numeric PGID.
The regression establishes the descendant observation before releasing its launcher,
then exercises both observation loss and a simulated replacement group.

Phase 1 verified process observation and shutdown on macOS. The lifecycle owner
currently rejects other platforms because their behavior has not been verified;
this is the current verification boundary, not a macOS-specific process model.
The research records the [Linux and Windows extension considerations](../../researches/research-2026-09-05-multi-test-commands.md#scope-evidence-and-documentation).

The fixed repetition protocol was rerun after these behavior changes; all 12
probes passed without escalation:

| Mode     | Protocol total / drain ms, attempts 1–3 | Transport total / drain ms, attempts 1–3 |
| -------- | --------------------------------------- | ---------------------------------------- |
| Captured | 835/647, 732/610, 763/646               | 742/630, 768/641, 752/637                |
| Terminal | 788/671, 740/630, 750/635               | 732/619, 760/642, 841/628                |

A subsequent review added a defensive observation regression: an empty snapshot
while the direct child is alive must not retire the group. Retirement now requires
direct-child exit; the test injects one empty observation, then verifies successful
server shutdown using real process observations. This is a synthetic boundary
check, not a claim that a startup race was observed in the installed tool.

Final focused verification passed 21 tests and 127 assertions in 5.75 seconds.
TypeScript, repository lint, formatting, and whitespace checks passed. The final
fixed 12-probe repetition also passed without escalation:

| Mode     | Protocol total / drain ms, attempts 1–3 | Transport total / drain ms, attempts 1–3 |
| -------- | --------------------------------------- | ---------------------------------------- |
| Captured | 946/759, 757/639, 778/633               | 770/655, 866/743, 847/726                |
| Terminal | 730/613, 754/633, 763/643               | 745/626, 768/648, 785/666                |

The final implementation review covered the complete fixed-base range
`a67aa95255150ba785605e942a8395d7537fe7e0..c30b9e974ebf5ebc2803c25a7c4d008cada17012`.
Security, test-coverage, and maintainability reviews found no remaining material
findings. Earlier findings were resolved in the checkpoint commits within that
range. Phase 1 is complete; the following documentation-only closeout updates
status and acceptance without changing the reviewed implementation.

All 34 repository-relative links and anchors in the research, plan, and job were
validated. No installed-Codex lifecycle scratch directories remained after the
final successful protocol.

### Post-Closeout Shutdown Race Correction

Correction status: completed.

After closeout, a contributor reported a full `bun test` result of 2,969 passes,
one opt-in skip, and a failure in the empty-snapshot lifecycle test. A subsequent
failure excerpt identified the unrelated server's shutdown assertion in the
cancellation test. Neither excerpt contained the lifecycle result's diagnostic
fields, so the exact reported interleavings could not be established.

Twenty isolated repetitions initially passed. A controlled diagnostic then
confirmed that a live snapshot delivered after direct-child exit could record a
continuity error despite exit code zero and verified cleanup. A deterministic
regression reproduced that failure before the correction.

The owner now refreshes successful observations spanning direct-child exit before
using them for ownership or completion decisions, within the existing cleanup
deadline. Uncertain continuity continues to prohibit signaling, but becomes a
failure only when it prevents completion within the allowance. Success assertions
include structured lifecycle diagnostics; the cancellation test preserves both
body and cleanup failures.

Focused verification passed 22 tests and 134 assertions. The new regression and
both reported cases then passed 20 repetitions each: 60 passes, 420 assertions,
11.26 seconds. Full `bun test` passed 2,971 tests with one existing live-Codex
opt-in skip and zero failures: 16,445 assertions across 380 files in 123.58 seconds.
Types and lint passed. Formatting initially flagged one test-file layout; after
formatting that file, types, lint, formatting, and whitespace checks passed.

The fixed installed-Codex protocol passed all 12 attempts without escalation:

| Mode     | Protocol total / drain ms, attempts 1–3 | Transport total / drain ms, attempts 1–3 |
| -------- | --------------------------------------- | ---------------------------------------- |
| Captured | 834/649, 753/644, 750/639               | 800/684, 758/640, 748/635                |
| Terminal | 739/632, 747/634, 754/639               | 794/680, 833/718, 761/645                |

The expanded full Phase 1 review covered
`a67aa95255150ba785605e942a8395d7537fe7e0..2a895c80b0fb7d63b32a089dd8edfc540fafd90c`.
Security, test-coverage, and maintainability reviews found no remaining material
findings. No installed-Codex lifecycle scratch directories remained. This
documentation-only closeout leaves the reviewed implementation unchanged.

### Acceptance

- [x] Process completion and termination scenarios verified with bounded fixtures.
- [x] Hanging preflight and cancellation verified with real sequencing markers.
- [x] Installed Codex terminal/captured repetition protocol completed.
- [x] Full phase range reviewed and findings resolved.

## Phase 2: Classify and Migrate Existing Coverage

Status: completed.

Fixed phase review base: `34c8cceff3063032950482d2f827539f0a437cbd`.
The initial tracked worktree was clean. Section reviews use fixed section bases;
the final Phase 2 review includes every checkpoint from this phase base.

### 2A: Inventory and Selector

Status: completed.

The complete section implementation range
`34c8cceff3063032950482d2f827539f0a437cbd..db2445a2a42e844ab3212d545d9704d61af3d7b2`
passed test-coverage, maintainability, and security review. Documentation review
identified a stale opening scope statement; this closeout corrects it.
Types, lint, formatting, and whitespace checks passed. The mapping is ready for
pilot verification; its proposed paths are not yet migrated owners.

Record a fresh baseline before migration, classify every executable test and its
support dependencies, and verify suffix-derived selection with bounded fixtures.
Repository default discovery remains unchanged during partial migration.

- [x] Reconcile the complete file and case baseline, including skips and bypasses.
- [x] Record feature/suite ownership, target paths, support consumers, and dispositions.
- [x] Verify strict discovery, exclusions, config changes, and report file identities.
- [x] Review the complete section range and resolve findings.

#### Baseline and Classification Evidence

The fresh baseline used the Phase 1 process owner around Bun with JUnit enabled.
It passed 2,971 cases with one existing live-Codex opt-in skip and zero failures:
2,972 registered cases, 16,445 assertions, 380 files, 124.33 seconds. Owned work
completed without escalation. Versions remained Bun 1.4.1 and Node 26.5.0.

The complete filename scan found 380 executable sources, no out-of-tree tests,
and no test-shaped committed inputs. Source filenames and all 2,972 JUnit case
identities reconcile. The proposed mapping has 418 unique targets: 152 unit,
263 app, one Codex, and two Pandoc. It contains 38 mixed-file splits; target
counts are proposed ownership, not evidence that migration has passed.

Support inspection found 86 native-readiness early returns across 24 Data Query/
Data Extract/Doctor-related sources, six import-time native probe supports, and
20 PDF consumers of a support module that probes Pandoc at import. Only two
PDF source files register actual Pandoc cases. Interactive harness consumers
launch subprocesses; fake Codex retries with actual timing belong to app.
Single-artifact utility fixtures remain unit under the research's explicit
exception. No executable-test imports or hidden support registrations were found
in the scoped inventories. The non-Windows bundle permission case and the live
Codex opt-in/conditional fixture writer require explicit final-migration handling.

The selector's first focused run passed nine tests and failed one empty-report
diagnostic assertion. Correcting report-root presence handling produced ten
passes and 113 assertions. Bounded Bun fixtures verified default/feature unit
selection, exact integration overrides, complete union, config drift, and actual
JUnit file identities. No managed public commands or default config shipped.

#### Source-to-Target Inventory

Paths are repository-relative. These are original sources and proposed terminal
owners; shared support inputs retain their existing paths unless a later batch
records a separate support move. Case counts are expanded baseline JUnit cases.
Later changes to proposed assignments are recorded with their batch evidence.

| Source | Cases | Suite | Target | Change | Dependencies | Support imports |
| --- | ---: | --- | --- | --- | --- | --- |
| `test/adapters-codex-markdown-pdf-profile/fallback-failures.test.ts` | 3 | unit | `test/markdown-pdf/adapters/profile-codex/fallback-failures.unit.test.ts` | move | injected Codex runner or SDK mock (no live Codex) | `test/adapters-codex-markdown-pdf-profile/fixtures` |
| `test/adapters-codex-markdown-pdf-profile/patch-application.test.ts` | 10 | unit | `test/markdown-pdf/adapters/profile-codex/patch-application.unit.test.ts` | move | injected Codex runner or SDK mock (no live Codex) | `test/adapters-codex-markdown-pdf-profile/fixtures` |
| `test/adapters-codex-markdown-pdf-profile/prompt-schema.test.ts` | 10 | unit | `test/markdown-pdf/adapters/profile-codex/prompt-schema.unit.test.ts` | move | controlled values and collaborators | `test/adapters-codex-markdown-pdf-profile/fixtures` |
| `test/adapters-codex-markdown-pdf-profile/runner-behavior.test.ts` | 2 | unit | `test/markdown-pdf/adapters/profile-codex/runner-behavior.unit.test.ts` | move | module mocks (check combined selection ordering); injected Codex runner or SDK mock (no live Codex) | `test/adapters-codex-markdown-pdf-profile/fixtures` |
| `test/adapters-codex-markdown-pdf-template/css-safety.test.ts` | 8 | unit | `test/markdown-pdf/adapters/template-codex/css-safety.unit.test.ts` | move | injected Codex runner or SDK mock (no live Codex) | `test/markdown-pdf/adapters/template-codex-fixtures` |
| `test/adapters-codex-markdown-pdf-template/decision-parsing.test.ts` | 19 | unit | `test/markdown-pdf/adapters/template-codex/decision-parsing.unit.test.ts` | move | injected Codex runner or SDK mock (no live Codex) | `test/markdown-pdf/adapters/template-codex-fixtures` |
| `test/adapters-codex-markdown-pdf-template/failure-classification.test.ts` | 4 | unit | `test/markdown-pdf/adapters/template-codex/failure-classification.unit.test.ts` | move | injected Codex runner or SDK mock (no live Codex) | `test/markdown-pdf/adapters/template-codex-fixtures` |
| `test/adapters-codex-markdown-pdf-template/prompt-schema.test.ts` | 4 | unit | `test/markdown-pdf/adapters/template-codex/prompt-schema.unit.test.ts` | move | controlled values and collaborators | `test/markdown-pdf/adapters/template-codex-fixtures` |
| `test/cli-actions-md-to-pdf-actions-assets.test.ts` | 15 | app | `test/markdown-pdf/actions/rendering/assets.app.test.ts` | move | owned filesystem fixtures; render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/cli-actions-md-to-pdf-code-highlight.test.ts` | 16 | unit+pandoc | `test/markdown-pdf/direct/code-highlight.unit.test.ts`<br>`test/markdown-pdf/direct/code-highlight.pandoc.test.ts` | split | subprocess / CLI runtime; render-support import currently probes installed Pandoc; decouple before leaf isolation; installed Pandoc only for two fixture conversion cases | `test/markdown-pdf/actions/render-support` |
| `test/cli-actions-md-to-pdf-command-wiring.test.ts` | 4 | app | `test/markdown-pdf/commands/wiring.app.test.ts` | move | controlled values and collaborators | `test/helpers/cli-test-utils` |
| `test/cli-actions-md-to-pdf-css-inspection.test.ts` | 4 | unit | `test/markdown-pdf/direct/css-inspection.unit.test.ts` | move | controlled values and collaborators | — |
| `test/cli-actions-md-to-pdf-options.test.ts` | 4 | unit | `test/markdown-pdf/direct/options.unit.test.ts` | move | controlled values and collaborators | — |
| `test/cli-actions-md-to-pdf-page-number-format.test.ts` | 4 | unit | `test/markdown-pdf/direct/page-number-format.unit.test.ts` | move | controlled values and collaborators | — |
| `test/cli-actions-md-to-pdf-page-number-html.test.ts` | 17 | unit | `test/markdown-pdf/direct/page-number-html.unit.test.ts` | move | controlled values and collaborators | — |
| `test/cli-actions-md-to-pdf-pandoc.test.ts` | 1 | pandoc | `test/markdown-pdf/actions/rendering/pandoc-language.pandoc.test.ts` | move | owned filesystem fixtures; subprocess / CLI runtime; render-support import currently probes installed Pandoc; decouple before leaf isolation; installed Pandoc | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-test-utils` |
| `test/cli-actions-md-to-pdf-prepared-render.test.ts` | 10 | app | `test/markdown-pdf/actions/rendering/prepared-render.app.test.ts` | move | owned filesystem fixtures; render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/cli-actions-md-to-pdf-profile-codex-action/outputs-dry-run.test.ts` | 11 | app | `test/markdown-pdf/actions/profile-codex/outputs-dry-run.app.test.ts` | move | owned filesystem fixtures | `test/markdown-pdf/actions/profile-codex-fixtures`<br>`test/markdown-pdf/actions/profile-codex-fixtures` |
| `test/cli-actions-md-to-pdf-profile-codex-action/path-alias-safety.test.ts` | 8 | app | `test/markdown-pdf/actions/profile-codex/path-alias-safety.app.test.ts` | move | owned filesystem fixtures | `test/markdown-pdf/actions/profile-codex-fixtures` |
| `test/cli-actions-md-to-pdf-profile-codex-action/reports-failures.test.ts` | 14 | app | `test/markdown-pdf/actions/profile-codex/reports-failures.app.test.ts` | move | owned filesystem fixtures | `test/markdown-pdf/actions/profile-codex-fixtures` |
| `test/cli-actions-md-to-pdf-profile-codex-action/signals-bases.test.ts` | 16 | app | `test/markdown-pdf/actions/profile-codex/signals-bases.app.test.ts` | move | owned filesystem fixtures | `test/markdown-pdf/actions/profile-codex-fixtures` |
| `test/cli-actions-md-to-pdf-profile-codex-command-wiring.test.ts` | 1 | app | `test/markdown-pdf/commands/profile-codex-wiring.app.test.ts` | move | controlled values and collaborators | `test/helpers/cli-test-utils` |
| `test/cli-actions-md-to-pdf-profile-codex-helpers.test.ts` | 3 | unit | `test/markdown-pdf/actions/profile-codex/helpers.unit.test.ts` | move | controlled values and collaborators | — |
| `test/cli-actions-md-to-pdf-profile-codex-prepared.test.ts` | 2 | app | `test/markdown-pdf/actions/profile-codex/prepared.app.test.ts` | move | owned filesystem fixtures; injected Codex runner or SDK mock (no live Codex) | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/cli-actions-md-to-pdf-profile-init.test.ts` | 9 | unit+app | `test/markdown-pdf/actions/profile-init.unit.test.ts`<br>`test/markdown-pdf/actions/profile-init.app.test.ts` | split | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/cli-actions-md-to-pdf-profile-revision.test.ts` | 13 | unit | `test/markdown-pdf/direct/profile-revision.unit.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/cli-actions-md-to-pdf-profile.test.ts` | 28 | unit | `test/markdown-pdf/direct/profile.unit.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/cli-actions-md-to-pdf-project-codex-command-wiring.test.ts` | 2 | app | `test/markdown-pdf/commands/project-codex-wiring.app.test.ts` | move | controlled values and collaborators | `test/helpers/cli-test-utils` |
| `test/cli-actions-md-to-pdf-project-codex/action-write/asset-safety.test.ts` | 2 | app | `test/markdown-pdf/actions/project-codex/action-write/asset-safety.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/actions/template-codex-fixtures`<br>`test/markdown-pdf/support/path-fixtures`<br>`test/markdown-pdf/actions/project-codex-action-write-fixtures` |
| `test/cli-actions-md-to-pdf-project-codex/action-write/privacy-redaction.test.ts` | 9 | app | `test/markdown-pdf/actions/project-codex/action-write/privacy-redaction.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/support/path-fixtures`<br>`test/markdown-pdf/actions/project-codex-action-write-fixtures` |
| `test/cli-actions-md-to-pdf-project-codex/action-write/review-dry-run.test.ts` | 6 | app | `test/markdown-pdf/actions/project-codex/action-write/review-dry-run.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/support/path-fixtures`<br>`test/markdown-pdf/actions/project-codex-action-write-fixtures` |
| `test/cli-actions-md-to-pdf-project-codex/action-write/successful-writes.test.ts` | 6 | app | `test/markdown-pdf/actions/project-codex/action-write/successful-writes.app.test.ts` | move | owned filesystem fixtures; injected Codex runner or SDK mock (no live Codex); render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/actions/render-support`<br>`test/markdown-pdf/actions/template-codex-fixtures`<br>`test/markdown-pdf/support/path-fixtures`<br>`test/markdown-pdf/actions/project-codex-action-write-fixtures` |
| `test/cli-actions-md-to-pdf-project-codex/action-write/write-prevention.test.ts` | 5 | app | `test/markdown-pdf/actions/project-codex/action-write/write-prevention.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/support/path-fixtures`<br>`test/markdown-pdf/actions/project-codex-action-write-fixtures` |
| `test/cli-actions-md-to-pdf-project-codex/command-state.test.ts` | 6 | app | `test/markdown-pdf/actions/project-codex/command-state.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/cli-actions-md-to-pdf-project-codex/handoff-equivalence.test.ts` | 1 | app | `test/markdown-pdf/actions/project-codex/handoff-equivalence.app.test.ts` | move | owned filesystem fixtures; injected Codex runner or SDK mock (no live Codex); render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/cli-actions-md-to-pdf-project-codex/page-number-compatibility.test.ts` | 16 | unit | `test/markdown-pdf/actions/project-codex/page-number-compatibility.unit.test.ts` | move | controlled values and collaborators | — |
| `test/cli-actions-md-to-pdf-project-codex/profile-phase.test.ts` | 18 | app | `test/markdown-pdf/actions/project-codex/profile-phase.app.test.ts` | move | owned filesystem fixtures; module mocks (check combined selection ordering); injected Codex runner or SDK mock (no live Codex) | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/actions/template-codex-fixtures`<br>`test/markdown-pdf/support/path-fixtures` |
| `test/cli-actions-md-to-pdf-project-codex/signals.test.ts` | 3 | app | `test/markdown-pdf/actions/project-codex/signals.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/actions/template-codex-fixtures` |
| `test/cli-actions-md-to-pdf-project-codex/template-phase.test.ts` | 13 | app | `test/markdown-pdf/actions/project-codex/template-phase.app.test.ts` | move | owned filesystem fixtures; module mocks (check combined selection ordering) | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/actions/template-codex-fixtures`<br>`test/markdown-pdf/support/path-fixtures` |
| `test/cli-actions-md-to-pdf-recipe.test.ts` | 22 | unit | `test/markdown-pdf/direct/recipe.unit.test.ts` | move | controlled values and collaborators | — |
| `test/cli-actions-md-to-pdf-template-body.test.ts` | 21 | unit | `test/markdown-pdf/direct/template-body.unit.test.ts` | move | controlled values and collaborators | — |
| `test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts` | 17 | unit+app | `test/markdown-pdf/actions/template-codex/bundle-write.unit.test.ts`<br>`test/markdown-pdf/actions/template-codex/bundle-write.app.test.ts` | split | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/support/path-fixtures`<br>`test/markdown-pdf/actions/template-codex-fixtures`<br>`test/markdown-pdf/actions/template-synthesis-fixtures` |
| `test/cli-actions-md-to-pdf-template-codex/command-state.test.ts` | 13 | unit+app | `test/markdown-pdf/actions/template-codex/command-state.unit.test.ts`<br>`test/markdown-pdf/actions/template-codex/command-state.app.test.ts` | split | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/actions/template-codex-fixtures` |
| `test/cli-actions-md-to-pdf-template-codex/families.test.ts` | 2 | unit | `test/markdown-pdf/actions/template-codex/families.unit.test.ts` | move | controlled values and collaborators | `test/markdown-pdf/actions/template-synthesis-fixtures` |
| `test/cli-actions-md-to-pdf-template-codex/font-ownership.test.ts` | 3 | unit | `test/markdown-pdf/actions/template-codex/font-ownership.unit.test.ts` | move | controlled values and collaborators | — |
| `test/cli-actions-md-to-pdf-template-codex/image-metadata.test.ts` | 2 | unit | `test/markdown-pdf/actions/template-codex/image-metadata.unit.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-test-utils`<br>`test/markdown-pdf/actions/template-codex-fixtures` |
| `test/cli-actions-md-to-pdf-template-codex/output-collisions.test.ts` | 3 | app | `test/markdown-pdf/actions/template-codex/output-collisions.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/actions/template-codex-fixtures` |
| `test/cli-actions-md-to-pdf-template-codex/output-directory.test.ts` | 3 | app | `test/markdown-pdf/actions/template-codex/output-directory.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/support/path-fixtures` |
| `test/cli-actions-md-to-pdf-template-codex/output-paths.test.ts` | 9 | unit+app | `test/markdown-pdf/actions/template-codex/output-paths.unit.test.ts`<br>`test/markdown-pdf/actions/template-codex/output-paths.app.test.ts` | split | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/support/path-fixtures`<br>`test/markdown-pdf/actions/template-codex-fixtures` |
| `test/cli-actions-md-to-pdf-template-codex/output-targets.test.ts` | 4 | app | `test/markdown-pdf/actions/template-codex/output-targets.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/actions/template-codex-fixtures` |
| `test/cli-actions-md-to-pdf-template-codex/signal-collection.test.ts` | 10 | app | `test/markdown-pdf/actions/template-codex/signal-collection.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/actions/template-codex-fixtures` |
| `test/cli-actions-md-to-pdf-template-codex/signal-mode.test.ts` | 2 | unit | `test/markdown-pdf/actions/template-codex/signal-mode.unit.test.ts` | move | controlled values and collaborators | `test/helpers/cli-action-test-utils` |
| `test/cli-actions-md-to-pdf-template-codex/slots.test.ts` | 10 | unit | `test/markdown-pdf/actions/template-codex/slots.unit.test.ts` | move | controlled values and collaborators | `test/markdown-pdf/actions/template-synthesis-fixtures` |
| `test/cli-actions-md-to-pdf-template-codex/template-synthesis/cover-layout.test.ts` | 6 | unit | `test/markdown-pdf/actions/template-codex/template-synthesis/cover-layout.unit.test.ts` | move | controlled values and collaborators | `test/markdown-pdf/actions/template-synthesis-fixtures`<br>`test/cli-actions-md-to-pdf-template-codex/template-synthesis/css-assertions` |
| `test/cli-actions-md-to-pdf-template-codex/template-synthesis/document-title.test.ts` | 9 | unit | `test/markdown-pdf/actions/template-codex/template-synthesis/document-title.unit.test.ts` | move | controlled values and collaborators | `test/markdown-pdf/actions/template-synthesis-fixtures` |
| `test/cli-actions-md-to-pdf-template-codex/template-synthesis/font-ownership.test.ts` | 15 | unit | `test/markdown-pdf/actions/template-codex/template-synthesis/font-ownership.unit.test.ts` | move | controlled values and collaborators | `test/markdown-pdf/actions/template-synthesis-fixtures`<br>`test/cli-actions-md-to-pdf-template-codex/template-synthesis/css-assertions` |
| `test/cli-actions-md-to-pdf-template-codex/template-synthesis/toc-css-branches.test.ts` | 1 | unit | `test/markdown-pdf/actions/template-codex/template-synthesis/toc-css-branches.unit.test.ts` | move | controlled values and collaborators | `test/markdown-pdf/actions/template-synthesis-fixtures`<br>`test/cli-actions-md-to-pdf-template-codex/template-synthesis/css-assertions` |
| `test/cli-actions-md-to-pdf-template-compatibility.test.ts` | 19 | unit+app | `test/markdown-pdf/actions/rendering/template-compatibility.unit.test.ts`<br>`test/markdown-pdf/actions/rendering/template-compatibility.app.test.ts` | split | owned filesystem fixtures; render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/cli-actions-md-to-pdf-template-init.test.ts` | 7 | unit+app | `test/markdown-pdf/actions/template-init.unit.test.ts`<br>`test/markdown-pdf/actions/template-init.app.test.ts` | split | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/cli-command-data-query-codex.test.ts` | 1 | app | `test/data-query/commands/codex-duckdb-default-source.app.test.ts` | move | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/codex-support.ts` |
| `test/cli-command-data-query-duckdb-sources.test.ts` | 2 | app | `test/data-query/commands/duckdb-source-identifiers.app.test.ts` | move | Bun test runner; composed command parsing and/or built Node CLI subprocess; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/support.ts` |
| `test/cli-command-data-query-source-shape.test.ts` | 2 | app | `test/data-query/commands/excel-source-validation.app.test.ts` | move | Bun test runner; composed command parsing and/or built Node CLI subprocess; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/support.ts` |
| `test/cli-command-data-query-validation.test.ts` | 3 | app | `test/data-query/commands/source-validation.app.test.ts` | move | Bun test runner; composed command parsing and/or built Node CLI subprocess; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/support.ts` |
| `test/cli-command-data-query.test.ts` | 2 | app | `test/data-query/commands/header-modes.app.test.ts` | move | Bun test runner; composed command parsing and/or built Node CLI subprocess; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/support.ts` |
| `test/cli-foundations/color/commander-output.test.ts` | 10 | app | `test/cli-foundations/color/commander-output.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness | `test/helpers/cli-test-utils.ts` |
| `test/cli-foundations/color/controls.test.ts` | 2 | app | `test/cli-foundations/color/controls.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts` |
| `test/cli-foundations/color/diagnostic-labels.test.ts` | 5 | unit | `test/cli-foundations/color/diagnostic-labels.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | `test/helpers/cli-test-utils.ts` |
| `test/cli-foundations/commands/interactive-timeout.test.ts` | 15 | app | `test/cli-foundations/commands/interactive-timeout.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness | `test/helpers/cli-test-utils.ts` |
| `test/cli-foundations/commands/root-ux.test.ts` | 2 | app | `test/cli-foundations/commands/root-ux.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness | `test/helpers/cli-test-utils.ts` |
| `test/cli-foundations/dependencies/command-inspection.test.ts` | 3 | unit | `test/cli-foundations/dependencies/command-inspection.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/cli-foundations/inline-rendering/display-width.test.ts` | 2 | unit | `test/cli-foundations/inline-rendering/display-width.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/cli-foundations/inline-rendering/renderer.test.ts` | 5 | unit | `test/cli-foundations/inline-rendering/renderer.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | `test/cli-foundations/inline-rendering/virtual-terminal.ts` |
| `test/cli-foundations/inline-rendering/screen.test.ts` | 2 | unit | `test/cli-foundations/inline-rendering/screen.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/cli-foundations/interactive/analyzer-status.test.ts` | 2 | unit+app | `test/cli-foundations/interactive/analyzer-status.unit.test.ts`<br>`test/cli-foundations/interactive/analyzer-status.app.test.ts` | split | Composed application modules with controlled input | — |
| `test/cli-foundations/interactive/contextual-tip.test.ts` | 12 | unit | `test/cli-foundations/interactive/contextual-tip.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/cli-foundations/interactive/menu-prompt.test.ts` | 4 | unit+app | `test/cli-foundations/interactive/menu-prompt.unit.test.ts`<br>`test/cli-foundations/interactive/menu-prompt.app.test.ts` | split | Bun/Node subprocesses; controlled fixture tools or CLI/harness | `test/cli-foundations/interactive/real-select-search-fixture.ts` |
| `test/cli-foundations/interactive/menu-wiring.test.ts` | 3 | app | `test/cli-foundations/interactive/menu-wiring.app.test.ts` | suffix-only | Composed application modules with controlled input | — |
| `test/cli-foundations/interactive/notice.test.ts` | 8 | unit | `test/cli-foundations/interactive/notice.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/cli-foundations/options/codex-execution-scope.test.ts` | 25 | app | `test/cli-foundations/options/codex-execution-scope.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness | `test/helpers/cli-test-utils.ts` |
| `test/cli-foundations/options/codex-execution.test.ts` | 69 | unit+app | `test/cli-foundations/options/codex-execution.unit.test.ts`<br>`test/cli-foundations/options/codex-execution.app.test.ts` | split | Composed application modules with controlled input | — |
| `test/cli-foundations/options/codex-timeout.test.ts` | 38 | unit | `test/cli-foundations/options/codex-timeout.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/cli-foundations/path-prompts/fallback.test.ts` | 1 | unit | `test/cli-foundations/path-prompts/fallback.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/cli-foundations/path-prompts/inline-controller.test.ts` | 12 | app | `test/cli-foundations/path-prompts/inline-controller.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/cli-foundations/inline-rendering/virtual-terminal.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/cli-foundations/path-prompts/interaction-state.test.ts` | 9 | unit | `test/cli-foundations/path-prompts/interaction-state.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/cli-foundations/path-prompts/sibling-preview.test.ts` | 4 | unit+app | `test/cli-foundations/path-prompts/sibling-preview.unit.test.ts`<br>`test/cli-foundations/path-prompts/sibling-preview.app.test.ts` | split | Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts` |
| `test/cli-foundations/path-prompts/suggestions.test.ts` | 8 | unit+app | `test/cli-foundations/path-prompts/suggestions.unit.test.ts`<br>`test/cli-foundations/path-prompts/suggestions.app.test.ts` | split | Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts` |
| `test/cli-foundations/text-inline/completion-controller.test.ts` | 10 | app | `test/cli-foundations/text-inline/completion-controller.app.test.ts` | suffix-only | Real prompt scheduling via nextRenderTick; fake input/output streams | `test/cli-foundations/text-inline/prompt-fixtures.ts` |
| `test/cli-foundations/text-inline/fallback.test.ts` | 4 | unit | `test/cli-foundations/text-inline/fallback.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | `test/cli-foundations/text-inline/prompt-fixtures.ts` |
| `test/cli-foundations/text-inline/template-candidates.test.ts` | 7 | unit | `test/cli-foundations/text-inline/template-candidates.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/cli-foundations/text-inline/terminal-controller.test.ts` | 9 | app | `test/cli-foundations/text-inline/terminal-controller.app.test.ts` | suffix-only | Real prompt scheduling via nextRenderTick; fake input/output streams | `test/cli-foundations/inline-rendering/virtual-terminal.ts`<br>`test/cli-foundations/text-inline/prompt-fixtures.ts` |
| `test/cli-foundations/tui/keys.test.ts` | 7 | unit+app | `test/cli-foundations/tui/keys.unit.test.ts`<br>`test/cli-foundations/tui/keys.app.test.ts` | split | Composed application modules with controlled input | — |
| `test/cli-foundations/tui/raw-session.test.ts` | 2 | unit | `test/cli-foundations/tui/raw-session.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/cli-interactive-markdown-pdf/codex-authoring/entry-setup.test.ts` | 15 | app | `test/markdown-pdf/interactive/codex-authoring/entry-setup.app.test.ts` | move | Bun interactive harness subprocess | `test/cli-foundations/interactive-harness`<br>`test/markdown-pdf/interactive/codex-authoring-fixtures` |
| `test/cli-interactive-markdown-pdf/codex-authoring/font-hint-editing.test.ts` | 9 | app | `test/markdown-pdf/interactive/codex-authoring/font-hint-editing.app.test.ts` | move | Bun interactive harness subprocess | `test/cli-foundations/interactive-harness`<br>`test/markdown-pdf/interactive/codex-authoring-fixtures` |
| `test/cli-interactive-markdown-pdf/codex-authoring/regeneration.test.ts` | 8 | app | `test/markdown-pdf/interactive/codex-authoring/regeneration.app.test.ts` | move | Bun interactive harness subprocess | `test/cli-foundations/interactive-harness`<br>`test/markdown-pdf/interactive/codex-authoring-fixtures` |
| `test/cli-interactive-markdown-pdf/codex-execution.test.ts` | 4 | app | `test/markdown-pdf/interactive/codex-execution.app.test.ts` | move | Bun interactive harness subprocess; subprocess / CLI runtime; module mocks (check combined selection ordering) | `test/helpers/cli-action-test-utils`<br>`test/cli-foundations/interactive-harness`<br>`test/markdown-pdf/interactive/codex-authoring-fixtures` |
| `test/cli-interactive-markdown-pdf/codex-progress.test.ts` | 4 | unit | `test/markdown-pdf/interactive/codex-progress.unit.test.ts` | move | controlled values and collaborators | `test/helpers/cli-test-utils` |
| `test/cli-interactive-markdown-pdf/codex-service-profile-font-ownership.test.ts` | 3 | app | `test/markdown-pdf/interactive/codex-service-profile-font-ownership.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/actions/template-codex-fixtures` |
| `test/cli-interactive-markdown-pdf/deterministic-service.test.ts` | 10 | app | `test/markdown-pdf/interactive/deterministic-service.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/cli-interactive-markdown-pdf/formal-guide-prompts.test.ts` | 11 | unit | `test/markdown-pdf/interactive/formal-guide-prompts.unit.test.ts` | move | module mocks (check combined selection ordering) | — |
| `test/cli-interactive-markdown-pdf/lifecycle-unit.test.ts` | 7 | unit+app | `test/markdown-pdf/interactive/lifecycle.unit.test.ts`<br>`test/markdown-pdf/interactive/lifecycle.app.test.ts` | split | owned filesystem fixtures | — |
| `test/cli-interactive-markdown-pdf/materialization.test.ts` | 11 | app | `test/markdown-pdf/interactive/materialization.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/cli-interactive-markdown-pdf/page-number-review.test.ts` | 10 | unit | `test/markdown-pdf/interactive/page-number-review.unit.test.ts` | move | controlled values and collaborators | — |
| `test/cli-interactive-markdown-pdf/render-page-number-preparation.test.ts` | 4 | unit | `test/markdown-pdf/interactive/render-page-number-preparation.unit.test.ts` | move | controlled values and collaborators | — |
| `test/cli-interactive-markdown-pdf/render-page-numbers.test.ts` | 6 | unit | `test/markdown-pdf/interactive/render-page-numbers.unit.test.ts` | move | controlled values and collaborators | — |
| `test/cli-markdown-pdf-profile-authoring-review.test.ts` | 4 | unit | `test/markdown-pdf/direct/profile-authoring-review.unit.test.ts` | move | controlled values and collaborators | — |
| `test/cli-markdown-pdf-requirements.test.ts` | 3 | unit | `test/markdown-pdf/direct/requirements.unit.test.ts` | move | controlled values and collaborators | — |
| `test/cli-markdown-pdf-warning-output.test.ts` | 6 | unit | `test/markdown-pdf/direct/warning-output.unit.test.ts` | move | controlled values and collaborators | `test/helpers/cli-test-utils` |
| `test/codex-adapters/direct/batch-retry-failures.test.ts` | 8 | unit+app | `test/codex-adapters/direct/batch-retry-failures.unit.test.ts`<br>`test/codex-adapters/direct/batch-retry-failures.app.test.ts` | split | Supplied runners/collaborators; Real retryDelayMs/sleep in executeBatchesWithRetries on retrying cases | — |
| `test/codex-adapters/direct/execution-transport.test.ts` | 3 | app | `test/codex-adapters/direct/execution-transport.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts` |
| `test/codex-adapters/direct/filename-title-primitives.test.ts` | 3 | unit | `test/codex-adapters/direct/filename-title-primitives.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/codex-adapters/direct/prompt-only-workspace.test.ts` | 3 | app | `test/codex-adapters/direct/prompt-only-workspace.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | — |
| `test/codex-adapters/direct/rename-execution.test.ts` | 7 | unit+app | `test/codex-adapters/direct/rename-execution.unit.test.ts`<br>`test/codex-adapters/direct/rename-execution.app.test.ts` | split | Owned filesystem fixtures and cleanup; Real retryDelayMs/sleep in executeBatchesWithRetries on retrying cases | `test/helpers/cli-test-utils.ts` |
| `test/codex-adapters/direct/request-failure.test.ts` | 7 | unit | `test/codex-adapters/direct/request-failure.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/codex-info/action.test.ts` | 6 | unit | `test/codex-info/action.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | `test/helpers/cli-test-utils.ts` |
| `test/codex-info/cli-replay.test.ts` | 3 | app | `test/codex-info/cli-replay.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Owned filesystem fixtures and cleanup | `test/codex-info/fixtures/cli-0.153.4-protocol.json`<br>`test/helpers/cli-test-utils.ts` |
| `test/codex-info/color.test.ts` | 13 | unit+app | `test/codex-info/color.unit.test.ts`<br>`test/codex-info/color.app.test.ts` | split | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Owned filesystem fixtures and cleanup; Supplied runners/collaborators | `test/codex-info/fixtures/color-cli-runner.mjs`<br>`test/helpers/cli-test-utils.ts` |
| `test/codex-info/commands.test.ts` | 24 | app | `test/codex-info/commands.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness | `test/helpers/cli-test-utils.ts` |
| `test/codex-info/environment-parity.test.ts` | 1 | app | `test/codex-info/environment-parity.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts` |
| `test/codex-info/live-protocol.test.ts` | 1 | codex | `test/codex-info/live-protocol.codex.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Owned filesystem fixtures and cleanup; Installed Codex executable; Isolated HOME/CODEX_HOME/XDG directories; Opt-in CDX_CHORES_RUN_CODEX_DISCOVERY_PROBE during partial migration | `test/codex-info/live-protocol-client.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/codex-info/render.test.ts` | 22 | unit | `test/codex-info/render.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | `test/helpers/cli-test-utils.ts` |
| `test/codex-info/report.test.ts` | 26 | unit | `test/codex-info/report.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/codex-info/transport.test.ts` | 30 | app | `test/codex-info/transport.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup; Fake executable transport plus resolution of SDK-installed native executable path | `test/helpers/cli-test-utils.ts` |
| `test/data-conversion/actions/formats.test.ts` | 9 | app | `test/data-conversion/actions/formats.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; owned filesystem fixtures | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/data-conversion/commands/help.test.ts` | 2 | app | `test/data-conversion/commands/help.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess | `test/helpers/cli-test-utils.ts` |
| `test/data-conversion/commands/output-paths.test.ts` | 2 | app | `test/data-conversion/commands/output-paths.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; owned filesystem fixtures | `test/helpers/cli-test-utils.ts` |
| `test/data-conversion/interactive/routing.test.ts` | 4 | app | `test/data-conversion/interactive/routing.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | `test/helpers/cli-test-utils.ts` |
| `test/data-extract/actions/header-mapping-review.test.ts` | 2 | app | `test/data-extract/actions/header-mapping-review.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-extract/actions/support.ts` |
| `test/data-extract/actions/materialization.test.ts` | 4 | app | `test/data-extract/actions/materialization.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-extract/actions/support.ts` |
| `test/data-extract/actions/source-selection.test.ts` | 9 | app | `test/data-extract/actions/source-selection.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-extract/actions/support.ts` |
| `test/data-extract/actions/source-shape-reuse.test.ts` | 2 | app | `test/data-extract/actions/source-shape-reuse.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-extract/actions/support.ts` |
| `test/data-extract/actions/source-shape-review.test.ts` | 4 | app | `test/data-extract/actions/source-shape-review.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-extract/actions/support.ts` |
| `test/data-extract/actions/validation.test.ts` | 7 | unit+app | `test/data-extract/actions/validation.unit.test.ts`<br>`test/data-extract/actions/validation.app.test.ts` | split | Bun test runner; application action, filesystem workflow, or fixture generation; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-extract/actions/support.ts` |
| `test/data-extract/commands/basic-sources.test.ts` | 6 | app | `test/data-extract/commands/basic-sources.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-extract/commands/support.ts` |
| `test/data-extract/commands/excel-shape.test.ts` | 4 | app | `test/data-extract/commands/excel-shape.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-extract/commands/support.ts` |
| `test/data-extract/commands/header-mapping-review.test.ts` | 2 | app | `test/data-extract/commands/header-mapping-review.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-extract/commands/support.ts` |
| `test/data-extract/commands/help-and-input-format.test.ts` | 2 | app | `test/data-extract/commands/help-and-input-format.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess | `test/helpers/cli-test-utils.ts` |
| `test/data-extract/commands/source-shape-review.test.ts` | 4 | app | `test/data-extract/commands/source-shape-review.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-extract/commands/support.ts` |
| `test/data-extract/interactive/checkpoints.test.ts` | 4 | app | `test/data-extract/interactive/checkpoints.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | `test/helpers/ansi.ts` |
| `test/data-extract/interactive/core.test.ts` | 2 | app | `test/data-extract/interactive/core.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | `test/helpers/ansi.ts` |
| `test/data-extract/interactive/revision.test.ts` | 5 | app | `test/data-extract/interactive/revision.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | `test/helpers/ansi.ts` |
| `test/data-preview/actions/failures.test.ts` | 9 | app | `test/data-preview/actions/failures.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; owned filesystem fixtures | `test/data-preview/actions/support.ts`<br>`test/helpers/cli-action-test-utils.ts` |
| `test/data-preview/actions/highlighting.test.ts` | 7 | app | `test/data-preview/actions/highlighting.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; owned filesystem fixtures | `test/data-preview/actions/support.ts`<br>`test/helpers/ansi.ts` |
| `test/data-preview/actions/parquet.test.ts` | 8 | unit+app | `test/data-preview/actions/parquet.unit.test.ts`<br>`test/data-preview/actions/parquet.app.test.ts` | split | Bun test runner; application action, filesystem workflow, or fixture generation; native DuckDB and applicable cached SQLite/Excel extensions; owned filesystem fixtures | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/data-preview/actions/rendering.test.ts` | 15 | app | `test/data-preview/actions/rendering.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; owned filesystem fixtures | `test/data-preview/actions/support.ts` |
| `test/data-preview/commands/parquet-ux.test.ts` | 3 | app | `test/data-preview/commands/parquet-ux.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess | `test/helpers/cli-test-utils.ts` |
| `test/data-preview/commands/preview-ux.test.ts` | 5 | app | `test/data-preview/commands/preview-ux.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; owned filesystem fixtures | `test/helpers/cli-test-utils.ts` |
| `test/data-preview/interactive/filters.test.ts` | 4 | app | `test/data-preview/interactive/filters.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | — |
| `test/data-preview/interactive/routing.test.ts` | 5 | app | `test/data-preview/interactive/routing.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | `test/helpers/ansi.ts` |
| `test/data-query/actions/artifact-validation.test.ts` | 4 | unit+app | `test/data-query/actions/artifact-validation.unit.test.ts`<br>`test/data-query/actions/artifact-validation.app.test.ts` | split | Bun test runner; application action, filesystem workflow, or fixture generation; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/actions/support.ts` |
| `test/data-query/actions/codex-single-source.test.ts` | 9 | app | `test/data-query/actions/codex-single-source.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/actions/codex-support.ts` |
| `test/data-query/actions/codex-validation.test.ts` | 9 | unit+app | `test/data-query/actions/codex-validation.unit.test.ts`<br>`test/data-query/actions/codex-validation.app.test.ts` | split | Bun test runner; application action, filesystem workflow, or fixture generation; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/actions/codex-support.ts` |
| `test/data-query/actions/codex-workspace.test.ts` | 3 | app | `test/data-query/actions/codex-workspace.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/actions/codex-support.ts` |
| `test/data-query/actions/duckdb-lifecycle.test.ts` | 1 | unit | `test/data-query/actions/duckdb-lifecycle.unit.test.ts` | suffix-only | Bun test runner; supplied inputs and controlled collaborators | `test/helpers/cli-action-test-utils.ts` |
| `test/data-query/actions/execution-policy.test.ts` | 5 | unit+app | `test/data-query/actions/execution-policy.unit.test.ts`<br>`test/data-query/actions/execution-policy.app.test.ts` | split | Bun test runner; application action, filesystem workflow, or fixture generation | `test/helpers/cli-test-utils.ts` |
| `test/data-query/actions/header-artifacts.test.ts` | 3 | app | `test/data-query/actions/header-artifacts.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/actions/support.ts` |
| `test/data-query/actions/header-modes.test.ts` | 6 | app | `test/data-query/actions/header-modes.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/actions/support.ts` |
| `test/data-query/actions/option-validation.test.ts` | 7 | app | `test/data-query/actions/option-validation.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/actions/support.ts` |
| `test/data-query/actions/query-output.test.ts` | 6 | app | `test/data-query/actions/query-output.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/actions/support.ts` |
| `test/data-query/actions/source-shape.test.ts` | 5 | app | `test/data-query/actions/source-shape.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/actions/support.ts` |
| `test/data-query/actions/source-workspace.test.ts` | 11 | unit+app | `test/data-query/actions/source-workspace.unit.test.ts`<br>`test/data-query/actions/source-workspace.app.test.ts` | split | Bun test runner; application action, filesystem workflow, or fixture generation; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/actions/support.ts` |
| `test/data-query/codex-intent.test.ts` | 5 | unit | `test/data-query/codex-intent.unit.test.ts` | suffix-only | Bun test runner; controlled Codex runner or executable stub; no live Codex request; supplied inputs and controlled collaborators | — |
| `test/data-query/commands/basic-formats.test.ts` | 6 | app | `test/data-query/commands/basic-formats.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/support.ts` |
| `test/data-query/commands/codex-help-and-input-format.test.ts` | 2 | app | `test/data-query/commands/codex-help-and-input-format.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request | `test/helpers/cli-test-utils.ts` |
| `test/data-query/commands/codex-single-source.test.ts` | 6 | app | `test/data-query/commands/codex-single-source.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/codex-support.ts` |
| `test/data-query/commands/codex-timeout.test.ts` | 4 | app | `test/data-query/commands/codex-timeout.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request | `test/helpers/cli-test-utils.ts` |
| `test/data-query/commands/codex-validation.test.ts` | 3 | app | `test/data-query/commands/codex-validation.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/codex-support.ts` |
| `test/data-query/commands/codex-workspace.test.ts` | 6 | app | `test/data-query/commands/codex-workspace.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/codex-support.ts` |
| `test/data-query/commands/duckdb-lifecycle.test.ts` | 2 | app | `test/data-query/commands/duckdb-lifecycle.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/support.ts` |
| `test/data-query/commands/duckdb-sources.test.ts` | 5 | app | `test/data-query/commands/duckdb-sources.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/support.ts` |
| `test/data-query/commands/excel-shape.test.ts` | 4 | app | `test/data-query/commands/excel-shape.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/support.ts` |
| `test/data-query/commands/header-review.test.ts` | 1 | app | `test/data-query/commands/header-review.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/support.ts` |
| `test/data-query/commands/help-and-input-format.test.ts` | 2 | app | `test/data-query/commands/help-and-input-format.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess | `test/helpers/cli-test-utils.ts` |
| `test/data-query/commands/source-shape-artifacts.test.ts` | 3 | app | `test/data-query/commands/source-shape-artifacts.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/support.ts` |
| `test/data-query/commands/sqlite-workspace.test.ts` | 5 | app | `test/data-query/commands/sqlite-workspace.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/support.ts` |
| `test/data-query/commands/validation-remediation.test.ts` | 9 | app | `test/data-query/commands/validation-remediation.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request; native DuckDB and applicable cached SQLite/Excel extensions; native DuckDB import-time extension probe through support; owned filesystem fixtures | `test/data-query/commands/support.ts` |
| `test/data-query/direct/formal-guide.test.ts` | 8 | unit | `test/data-query/direct/formal-guide.unit.test.ts` | suffix-only | Bun test runner; supplied inputs and controlled collaborators | — |
| `test/data-query/direct/interactive-execution-validation.test.ts` | 3 | unit | `test/data-query/direct/interactive-execution-validation.unit.test.ts` | suffix-only | Bun test runner; supplied inputs and controlled collaborators | `test/helpers/cli-test-utils.ts` |
| `test/data-query/direct/interactive-facade.test.ts` | 1 | unit | `test/data-query/direct/interactive-facade.unit.test.ts` | suffix-only | Bun test runner; supplied inputs and controlled collaborators | — |
| `test/data-query/direct/relation-option-parser.test.ts` | 7 | unit | `test/data-query/direct/relation-option-parser.unit.test.ts` | suffix-only | Bun test runner; supplied inputs and controlled collaborators | — |
| `test/data-query/evidence/duckdb-fixtures.test.ts` | 2 | app | `test/data-query/evidence/duckdb-fixtures.app.test.ts` | suffix-only | Bun test runner; Node fixture-generator subprocess; coordinated output tree; application action, filesystem workflow, or fixture generation; native DuckDB and applicable cached SQLite/Excel extensions; owned filesystem fixtures | `test/helpers/cli-test-utils.ts` |
| `test/data-query/evidence/tabular-fixtures.test.ts` | 1 | app | `test/data-query/evidence/tabular-fixtures.app.test.ts` | suffix-only | Bun test runner; Node fixture-generator subprocess; coordinated output tree; application action, filesystem workflow, or fixture generation; owned filesystem fixtures | `test/helpers/cli-test-utils.ts` |
| `test/data-query/header-mapping.test.ts` | 15 | unit | `test/data-query/header-mapping.unit.test.ts` | suffix-only | Bun test runner; owned filesystem fixtures; supplied inputs and controlled collaborators | `test/helpers/cli-test-utils.ts` |
| `test/data-query/interactive/codex-single-source.test.ts` | 8 | app | `test/data-query/interactive/codex-single-source.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; controlled Codex runner or executable stub; no live Codex request; interactive harness subprocess with fake action modules | — |
| `test/data-query/interactive/codex-workspace.test.ts` | 5 | app | `test/data-query/interactive/codex-workspace.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; controlled Codex runner or executable stub; no live Codex request; interactive harness subprocess with fake action modules | — |
| `test/data-query/interactive/execution-policy.test.ts` | 2 | app | `test/data-query/interactive/execution-policy.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | — |
| `test/data-query/interactive/formal-guide.test.ts` | 7 | app | `test/data-query/interactive/formal-guide.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | — |
| `test/data-query/interactive/header-review.test.ts` | 3 | app | `test/data-query/interactive/header-review.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | — |
| `test/data-query/interactive/manual.test.ts` | 4 | app | `test/data-query/interactive/manual.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | `test/helpers/ansi.ts` |
| `test/data-query/interactive/review-checkpoints.test.ts` | 6 | app | `test/data-query/interactive/review-checkpoints.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | `test/helpers/ansi.ts` |
| `test/data-query/interactive/source-shape.test.ts` | 4 | app | `test/data-query/interactive/source-shape.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | — |
| `test/data-query/interactive/workspace.test.ts` | 3 | app | `test/data-query/interactive/workspace.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | — |
| `test/data-query/source-introspection.test.ts` | 1 | unit | `test/data-query/source-introspection.unit.test.ts` | suffix-only | Bun test runner; supplied inputs and controlled collaborators | `test/helpers/cli-test-utils.ts` |
| `test/data-sources/adapters/duckdb-extensions.test.ts` | 4 | unit | `test/data-sources/adapters/duckdb-extensions.unit.test.ts` | suffix-only | Bun test runner; supplied inputs and controlled collaborators | `test/helpers/cli-test-utils.ts` |
| `test/data-sources/adapters/xlsx-sources.test.ts` | 10 | unit+app | `test/data-sources/adapters/xlsx-sources.unit.test.ts`<br>`test/data-sources/adapters/xlsx-sources.app.test.ts` | split | Bun test runner; Node fixture generators using native SQLite; application action, filesystem workflow, or fixture generation; owned filesystem fixtures; system temporary directory; zip/unzip subprocesses | `test/data-sources/fixtures/stacked-merged-band.ts`<br>`test/data-sources/fixtures/tabular.ts`<br>`test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/data-sources/direct/source-shape.test.ts` | 18 | unit | `test/data-sources/direct/source-shape.unit.test.ts` | suffix-only | Bun test runner; owned filesystem fixtures; supplied inputs and controlled collaborators | `test/helpers/cli-test-utils.ts` |
| `test/data-sources/evidence/stacked-merged-band-fixture.test.ts` | 1 | app | `test/data-sources/evidence/stacked-merged-band-fixture.app.test.ts` | suffix-only | Bun test runner; Node fixture-generator subprocess; coordinated output tree; application action, filesystem workflow, or fixture generation; owned filesystem fixtures | `test/helpers/cli-test-utils.ts` |
| `test/data-sources/evidence/tabular-fixtures.test.ts` | 1 | app | `test/data-sources/evidence/tabular-fixtures.app.test.ts` | suffix-only | Bun test runner; Node fixture-generator subprocess; coordinated output tree; application action, filesystem workflow, or fixture generation; owned filesystem fixtures | `test/helpers/cli-test-utils.ts` |
| `test/data-stack/actions/codex-assist.test.ts` | 7 | app | `test/data-stack/actions/codex-assist.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; controlled Codex runner or executable stub; no live Codex request; owned filesystem fixtures | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/data-stack/actions/dry-run-plan.test.ts` | 7 | app | `test/data-stack/actions/dry-run-plan.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; owned filesystem fixtures | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/data-stack/actions/execution-policy.test.ts` | 12 | unit+app | `test/data-stack/actions/execution-policy.unit.test.ts`<br>`test/data-stack/actions/execution-policy.app.test.ts` | split | Bun test runner; application action, filesystem workflow, or fixture generation; owned filesystem fixtures | `test/helpers/cli-test-utils.ts` |
| `test/data-stack/actions/materialization.test.ts` | 9 | app | `test/data-stack/actions/materialization.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; owned filesystem fixtures | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/data-stack/actions/schema-modes.test.ts` | 2 | app | `test/data-stack/actions/schema-modes.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; owned filesystem fixtures | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/data-stack/actions/validation.test.ts` | 29 | app | `test/data-stack/actions/validation.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; owned filesystem fixtures | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/data-stack/commands/codex-timeout.test.ts` | 5 | app | `test/data-stack/commands/codex-timeout.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; controlled Codex runner or executable stub; no live Codex request | `test/helpers/cli-test-utils.ts` |
| `test/data-stack/commands/direct-stack.test.ts` | 5 | app | `test/data-stack/commands/direct-stack.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; owned filesystem fixtures | `test/helpers/cli-test-utils.ts` |
| `test/data-stack/commands/help-and-input-format.test.ts` | 2 | app | `test/data-stack/commands/help-and-input-format.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess | `test/helpers/cli-test-utils.ts` |
| `test/data-stack/commands/options.test.ts` | 19 | app | `test/data-stack/commands/options.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; owned filesystem fixtures | `test/helpers/cli-test-utils.ts` |
| `test/data-stack/commands/replay.test.ts` | 8 | app | `test/data-stack/commands/replay.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; owned filesystem fixtures | `test/helpers/cli-test-utils.ts` |
| `test/data-stack/direct/artifact-paths.test.ts` | 3 | unit | `test/data-stack/direct/artifact-paths.unit.test.ts` | suffix-only | Bun test runner; owned filesystem fixtures; supplied inputs and controlled collaborators | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/data-stack/direct/codex-report/apply.test.ts` | 10 | unit | `test/data-stack/direct/codex-report/apply.unit.test.ts` | suffix-only | Bun test runner; supplied inputs and controlled collaborators | `test/data-stack/direct/support.ts` |
| `test/data-stack/direct/codex-report/validation.test.ts` | 8 | unit | `test/data-stack/direct/codex-report/validation.unit.test.ts` | suffix-only | Bun test runner; supplied inputs and controlled collaborators | `test/data-stack/direct/support.ts` |
| `test/data-stack/direct/codex-signals.test.ts` | 3 | unit | `test/data-stack/direct/codex-signals.unit.test.ts` | suffix-only | Bun test runner; controlled Codex runner or executable stub; no live Codex request; supplied inputs and controlled collaborators | — |
| `test/data-stack/direct/diagnostics.test.ts` | 8 | unit | `test/data-stack/direct/diagnostics.unit.test.ts` | suffix-only | Bun test runner; supplied inputs and controlled collaborators | — |
| `test/data-stack/direct/input-router.test.ts` | 5 | app | `test/data-stack/direct/input-router.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; owned filesystem fixtures | `test/helpers/cli-test-utils.ts` |
| `test/data-stack/direct/plan/identity-serialization.test.ts` | 4 | unit | `test/data-stack/direct/plan/identity-serialization.unit.test.ts` | suffix-only | Bun test runner; supplied inputs and controlled collaborators | `test/data-stack/direct/support.ts` |
| `test/data-stack/direct/plan/parse-io.test.ts` | 14 | unit | `test/data-stack/direct/plan/parse-io.unit.test.ts` | suffix-only | Bun test runner; owned filesystem fixtures; supplied inputs and controlled collaborators | `test/data-stack/direct/support.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/data-stack/direct/reporting.test.ts` | 1 | unit | `test/data-stack/direct/reporting.unit.test.ts` | suffix-only | Bun test runner; supplied inputs and controlled collaborators | `test/helpers/ansi.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/data-stack/evidence/fixture-generator.test.ts` | 4 | unit+app | `test/data-stack/evidence/fixture-generator.unit.test.ts`<br>`test/data-stack/evidence/fixture-generator.app.test.ts` | split | Bun test runner; Node fixture-generator subprocess; coordinated output tree; application action, filesystem workflow, or fixture generation; owned filesystem fixtures | `test/helpers/cli-test-utils.ts` |
| `test/data-stack/interactive/codex-review.test.ts` | 10 | app | `test/data-stack/interactive/codex-review.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; controlled Codex runner or executable stub; no live Codex request; interactive harness subprocess with fake action modules | `test/data-stack/interactive/support.ts` |
| `test/data-stack/interactive/discovery.test.ts` | 12 | app | `test/data-stack/interactive/discovery.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | `test/data-stack/interactive/support.ts` |
| `test/data-stack/interactive/dry-run-write.test.ts` | 12 | app | `test/data-stack/interactive/dry-run-write.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | `test/data-stack/interactive/support.ts` |
| `test/data-stack/interactive/routing.test.ts` | 1 | app | `test/data-stack/interactive/routing.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | `test/data-stack/interactive/support.ts`<br>`test/helpers/ansi.ts` |
| `test/data/commands/help.test.ts` | 1 | app | `test/data/commands/help.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness | `test/helpers/cli-test-utils.ts` |
| `test/data/interactive/menu-routing.test.ts` | 1 | app | `test/data/interactive/menu-routing.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Composed interactive harness with process-local module mocks | `test/cli-foundations/interactive-harness/index.ts`<br>`test/cli-foundations/interactive-harness/mock-composition.ts`<br>`test/cli-foundations/interactive-harness/runner.ts` |
| `test/data/interactive/unknown-action.test.ts` | 1 | app | `test/data/interactive/unknown-action.app.test.ts` | suffix-only | Composed application modules with controlled input | `test/helpers/cli-test-utils.ts` |
| `test/doctor/actions/dependency-integration.test.ts` | 14 | app | `test/doctor/actions/dependency-integration.app.test.ts` | suffix-only | Bun test runner; application action, filesystem workflow, or fixture generation; currently default native DuckDB, Codex environment/config/auth inspection; isolate HOME/CODEX_HOME/cache and executable paths during migration | `test/helpers/cli-action-test-utils.ts` |
| `test/doctor/actions/report-projections.test.ts` | 49 | unit | `test/doctor/actions/report-projections.unit.test.ts` | suffix-only | Bun test runner; owned filesystem fixtures; supplied inputs and controlled collaborators | `test/doctor/fixtures.ts`<br>`test/helpers/cli-action-test-utils.ts` |
| `test/doctor/commands/environment.test.ts` | 1 | app | `test/doctor/commands/environment.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; currently default native DuckDB, Codex environment/config/auth inspection; isolate HOME/CODEX_HOME/cache and executable paths during migration; owned filesystem fixtures | `test/helpers/cli-test-utils.ts` |
| `test/doctor/commands/routing.test.ts` | 7 | app | `test/doctor/commands/routing.app.test.ts` | suffix-only | Bun test runner; composed command parsing and/or built Node CLI subprocess; currently default native DuckDB, Codex environment/config/auth inspection; isolate HOME/CODEX_HOME/cache and executable paths during migration; owned filesystem fixtures | `test/doctor/fixtures.ts`<br>`test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/doctor/interactive/menu-routing.test.ts` | 1 | app | `test/doctor/interactive/menu-routing.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | — |
| `test/doctor/interactive/routing.test.ts` | 3 | app | `test/doctor/interactive/routing.app.test.ts` | suffix-only | Bun test runner; composed interactive workflow; interactive harness subprocess with fake action modules | — |
| `test/doctor/workflow-projection.test.ts` | 29 | unit | `test/doctor/workflow-projection.unit.test.ts` | suffix-only | Bun test runner; owned filesystem fixtures; supplied inputs and controlled collaborators | `test/doctor/fixtures.ts` |
| `test/document-rename/adapters/pdf-lifecycle.test.ts` | 9 | app | `test/document-rename/adapters/pdf-lifecycle.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup; Committed DOCX/PDF inputs; installed PDF.js/ZIP extraction modules | `test/helpers/cli-test-utils.ts` |
| `test/document-rename/adapters/title-evidence.test.ts` | 9 | app | `test/document-rename/adapters/title-evidence.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup; Committed DOCX/PDF inputs; installed PDF.js/ZIP extraction modules | `test/helpers/cli-test-utils.ts` |
| `test/fonts/actions/check-diagnostics.test.ts` | 2 | unit | `test/fonts/actions/check-diagnostics.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | `test/helpers/cli-action-test-utils.ts` |
| `test/fonts/actions/check-provider-mapping.test.ts` | 3 | unit | `test/fonts/actions/check-provider-mapping.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | `test/helpers/cli-action-test-utils.ts` |
| `test/fonts/actions/check-selection.test.ts` | 5 | unit | `test/fonts/actions/check-selection.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | `test/helpers/cli-action-test-utils.ts` |
| `test/fonts/actions/check-text-output.test.ts` | 6 | unit | `test/fonts/actions/check-text-output.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | `test/helpers/cli-action-test-utils.ts` |
| `test/fonts/actions/check-ttc.test.ts` | 5 | unit | `test/fonts/actions/check-ttc.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | `test/helpers/cli-action-test-utils.ts` |
| `test/fonts/actions/check-validation.test.ts` | 3 | unit+app | `test/fonts/actions/check-validation.unit.test.ts`<br>`test/fonts/actions/check-validation.app.test.ts` | split | Owned filesystem fixtures and cleanup; Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/fonts/actions/inspect-debug.test.ts` | 7 | unit | `test/fonts/actions/inspect-debug.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | `test/helpers/cli-action-test-utils.ts` |
| `test/fonts/actions/inspect-matching.test.ts` | 5 | unit | `test/fonts/actions/inspect-matching.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | `test/helpers/cli-action-test-utils.ts` |
| `test/fonts/actions/inspect-output.test.ts` | 6 | unit | `test/fonts/actions/inspect-output.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | `test/helpers/cli-action-test-utils.ts` |
| `test/fonts/actions/inspect-validation.test.ts` | 2 | unit | `test/fonts/actions/inspect-validation.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | `test/helpers/cli-action-test-utils.ts` |
| `test/fonts/actions/list.test.ts` | 10 | unit | `test/fonts/actions/list.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | `test/helpers/cli-action-test-utils.ts` |
| `test/fonts/adapters/coverage-fontconfig.test.ts` | 7 | unit | `test/fonts/adapters/coverage-fontconfig.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | — |
| `test/fonts/adapters/coverage-ttc-inconclusive.test.ts` | 4 | unit | `test/fonts/adapters/coverage-ttc-inconclusive.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | — |
| `test/fonts/adapters/coverage-ttc.test.ts` | 2 | unit | `test/fonts/adapters/coverage-ttc.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | — |
| `test/fonts/adapters/discovery-cancellation.test.ts` | 6 | unit+app | `test/fonts/adapters/discovery-cancellation.unit.test.ts`<br>`test/fonts/adapters/discovery-cancellation.app.test.ts` | split | Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | — |
| `test/fonts/adapters/discovery-parsers.test.ts` | 5 | unit | `test/fonts/adapters/discovery-parsers.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement | — |
| `test/fonts/adapters/discovery.test.ts` | 6 | unit | `test/fonts/adapters/discovery.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement; Supplied runners/collaborators | — |
| `test/fonts/commands/registration.test.ts` | 6 | app | `test/fonts/commands/registration.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness | `test/helpers/cli-test-utils.ts` |
| `test/fonts/direct/coverage-samples.test.ts` | 4 | unit | `test/fonts/direct/coverage-samples.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement | — |
| `test/fonts/direct/matching.test.ts` | 8 | unit | `test/fonts/direct/matching.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement | — |
| `test/fonts/direct/search-ranking.test.ts` | 8 | unit | `test/fonts/direct/search-ranking.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement | — |
| `test/fonts/direct/search-records.test.ts` | 3 | unit | `test/fonts/direct/search-records.unit.test.ts` | suffix-only | Injected fontconfig/native-discovery responses; no installed font tool requirement | — |
| `test/markdown-docx/actions/rendering.test.ts` | 4 | app | `test/markdown-docx/actions/rendering.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup; Supplied runners/collaborators | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/markdown-docx/adapters/ooxml-metadata.test.ts` | 10 | app | `test/markdown-docx/adapters/ooxml-metadata.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup; Committed DOCX/PDF inputs; installed PDF.js/ZIP extraction modules | `test/helpers/cli-test-utils.ts` |
| `test/markdown-docx/interactive/routing.test.ts` | 1 | app | `test/markdown-docx/interactive/routing.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Composed interactive harness with process-local module mocks | `test/cli-foundations/interactive-harness/index.ts`<br>`test/cli-foundations/interactive-harness/mock-composition.ts`<br>`test/cli-foundations/interactive-harness/runner.ts` |
| `test/markdown-frontmatter/actions/frontmatter-to-json.test.ts` | 6 | app | `test/markdown-frontmatter/actions/frontmatter-to-json.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/markdown-frontmatter/commands/frontmatter-to-json.test.ts` | 3 | app | `test/markdown-frontmatter/commands/frontmatter-to-json.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts` |
| `test/markdown-frontmatter/interactive/routing.test.ts` | 1 | app | `test/markdown-frontmatter/interactive/routing.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Composed interactive harness with process-local module mocks | `test/cli-foundations/interactive-harness/index.ts`<br>`test/cli-foundations/interactive-harness/mock-composition.ts`<br>`test/cli-foundations/interactive-harness/runner.ts` |
| `test/markdown-pdf-code-fixture-generator.test.ts` | 9 | app | `test/markdown-pdf/evidence/code-fixture-generator.app.test.ts` | move | owned filesystem fixtures; subprocess / CLI runtime | `test/helpers/cli-test-utils` |
| `test/markdown-pdf-font-discovery-evidence-spike.test.ts` | 5 | unit | `test/markdown-pdf/evidence/font-discovery-evidence-spike.unit.test.ts` | move | controlled values and collaborators | — |
| `test/markdown-pdf-page-number-renderer-evidence/inspection.test.ts` | 17 | unit+app | `test/markdown-pdf/evidence/page-number-renderer/inspection.unit.test.ts`<br>`test/markdown-pdf/evidence/page-number-renderer/inspection.app.test.ts` | split | owned filesystem fixtures; owned renderer laboratory, fake command execution, PDF/image libraries | `test/fixtures/markdown-pdf/page-number-renderer-contract`<br>`test/markdown-pdf/evidence/page-number-support` |
| `test/markdown-pdf-page-number-renderer-evidence/laboratory.test.ts` | 8 | unit+app | `test/markdown-pdf/evidence/page-number-renderer/laboratory.unit.test.ts`<br>`test/markdown-pdf/evidence/page-number-renderer/laboratory.app.test.ts` | split | owned filesystem fixtures; owned renderer laboratory, fake command execution, PDF/image libraries | `test/fixtures/markdown-pdf/page-number-renderer-contract`<br>`test/markdown-pdf/evidence/page-number-support` |
| `test/markdown-pdf-profile-font-preservation-smoke.test.ts` | 21 | app | `test/markdown-pdf/evidence/profile-font-preservation-smoke.app.test.ts` | move | owned filesystem fixtures; subprocess / CLI runtime | `test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/bundle-discovery.test.ts` | 35 | app | `test/markdown-pdf/actions/bundle-discovery.app.test.ts` | suffix-only | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/bundle-integration.test.ts` | 16 | app | `test/markdown-pdf/actions/bundle-integration.app.test.ts` | suffix-only | owned filesystem fixtures; render-support import currently probes installed Pandoc; decouple before leaf isolation; POSIX unreadable-file permissions case currently conditionally registered outside win32; replace silent platform omission with explicit supported-platform contract | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/bundle-resolution.test.ts` | 5 | app | `test/markdown-pdf/actions/bundle-resolution.app.test.ts` | suffix-only | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/execution-policy.test.ts` | 8 | app | `test/markdown-pdf/actions/execution-policy.app.test.ts` | suffix-only | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/actions/project-codex-prepared-fixtures`<br>`test/markdown-pdf/adapters/template-codex-fixtures` |
| `test/markdown-pdf/actions/profile-codex-candidates.test.ts` | 2 | unit | `test/markdown-pdf/actions/profile-codex/candidates.unit.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/profile-codex-progress.test.ts` | 5 | app | `test/markdown-pdf/actions/profile-codex/progress.app.test.ts` | move | owned filesystem fixtures | `test/markdown-pdf/actions/profile-codex-fixtures`<br>`test/markdown-pdf/actions/profile-codex-fixtures` |
| `test/markdown-pdf/actions/profile-codex-request-lifecycle.test.ts` | 6 | app | `test/markdown-pdf/actions/profile-codex/request-lifecycle.app.test.ts` | move | owned filesystem fixtures; module mocks (check combined selection ordering); injected Codex runner or SDK mock (no live Codex) | `test/markdown-pdf/actions/profile-codex-fixtures` |
| `test/markdown-pdf/actions/profile-codex-signals.test.ts` | 7 | unit | `test/markdown-pdf/actions/profile-codex/signals.unit.test.ts` | move | controlled values and collaborators | — |
| `test/markdown-pdf/actions/project-codex-output-plan.test.ts` | 21 | unit+app | `test/markdown-pdf/actions/project-codex/output-plan.unit.test.ts`<br>`test/markdown-pdf/actions/project-codex/output-plan.app.test.ts` | split | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/actions/template-codex-fixtures`<br>`test/markdown-pdf/support/path-fixtures` |
| `test/markdown-pdf/actions/project-codex-prepared-handoff.test.ts` | 2 | app | `test/markdown-pdf/actions/project-codex/prepared-handoff.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/actions/project-codex-prepared-fixtures`<br>`test/markdown-pdf/actions/template-codex-fixtures`<br>`test/markdown-pdf/support/path-fixtures` |
| `test/markdown-pdf/actions/project-codex-prepared-request-lifecycle.test.ts` | 6 | app | `test/markdown-pdf/actions/project-codex/prepared-request-lifecycle.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/actions/project-codex-prepared-fixtures`<br>`test/markdown-pdf/actions/template-codex-fixtures`<br>`test/markdown-pdf/support/path-fixtures` |
| `test/markdown-pdf/actions/project-codex-validation.test.ts` | 26 | unit+app | `test/markdown-pdf/actions/project-codex/validation.unit.test.ts`<br>`test/markdown-pdf/actions/project-codex/validation.app.test.ts` | split | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/support/path-fixtures`<br>`test/markdown-pdf/actions/template-codex-fixtures` |
| `test/markdown-pdf/actions/recipe-font-check.test.ts` | 1 | unit | `test/markdown-pdf/actions/recipe-font-check.unit.test.ts` | suffix-only | controlled values and collaborators | — |
| `test/markdown-pdf/actions/recipe-font-generation.test.ts` | 3 | unit | `test/markdown-pdf/actions/recipe-font-generation.unit.test.ts` | suffix-only | controlled values and collaborators | — |
| `test/markdown-pdf/actions/rendering-code-highlighting.test.ts` | 3 | app | `test/markdown-pdf/actions/rendering/code-highlighting.app.test.ts` | move | owned filesystem fixtures; render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/rendering-composition.test.ts` | 4 | app | `test/markdown-pdf/actions/rendering/composition.app.test.ts` | move | owned filesystem fixtures; render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/rendering-core.test.ts` | 1 | app | `test/markdown-pdf/actions/rendering/core.app.test.ts` | move | owned filesystem fixtures; render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/rendering-custom-css-page-numbers.test.ts` | 13 | app | `test/markdown-pdf/actions/rendering/custom-css-page-numbers.app.test.ts` | move | owned filesystem fixtures; render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/rendering-diagnostics.test.ts` | 19 | unit+app | `test/markdown-pdf/actions/rendering/diagnostics.unit.test.ts`<br>`test/markdown-pdf/actions/rendering/diagnostics.app.test.ts` | split | owned filesystem fixtures; render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/rendering-profile-rendering.test.ts` | 8 | app | `test/markdown-pdf/actions/rendering/profile-rendering.app.test.ts` | move | owned filesystem fixtures; render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/markdown-pdf/actions/render-support`<br>`test/markdown-pdf/actions/template-synthesis-fixtures`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/rendering-renderer-capability-gate.test.ts` | 21 | app | `test/markdown-pdf/actions/rendering/renderer-capability-gate.app.test.ts` | move | owned filesystem fixtures; render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/rendering-requirements.test.ts` | 1 | app | `test/markdown-pdf/actions/rendering/requirements.app.test.ts` | move | owned filesystem fixtures; render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/rendering-template-asset-safety.test.ts` | 8 | app | `test/markdown-pdf/actions/rendering/template-asset-safety.app.test.ts` | move | owned filesystem fixtures; render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/rendering-validation.test.ts` | 16 | unit+app | `test/markdown-pdf/actions/rendering/validation.unit.test.ts`<br>`test/markdown-pdf/actions/rendering/validation.app.test.ts` | split | owned filesystem fixtures; render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/rendering-write-lifecycle.test.ts` | 3 | app | `test/markdown-pdf/actions/rendering/write-lifecycle.app.test.ts` | move | owned filesystem fixtures; render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/markdown-pdf/actions/render-support`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/actions/template-codex-action.test.ts` | 3 | app | `test/markdown-pdf/actions/template-codex/action.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/support/path-fixtures` |
| `test/markdown-pdf/actions/template-codex-integration.test.ts` | 24 | app | `test/markdown-pdf/actions/template-codex/integration.app.test.ts` | move | owned filesystem fixtures; injected Codex runner or SDK mock (no live Codex); render-support import currently probes installed Pandoc; decouple before leaf isolation | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/support/path-fixtures`<br>`test/markdown-pdf/actions/render-support`<br>`test/markdown-pdf/actions/template-codex-fixtures` |
| `test/markdown-pdf/actions/template-codex-prepared.test.ts` | 3 | app | `test/markdown-pdf/actions/template-codex/prepared.app.test.ts` | move | owned filesystem fixtures | `test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils`<br>`test/markdown-pdf/support/path-fixtures`<br>`test/markdown-pdf/actions/template-codex-fixtures` |
| `test/markdown-pdf/adapters/execution-policy.test.ts` | 9 | unit | `test/markdown-pdf/adapters/execution-policy.unit.test.ts` | suffix-only | controlled values and collaborators | `test/adapters-codex-markdown-pdf-profile/fixtures`<br>`test/markdown-pdf/adapters/template-codex-fixtures` |
| `test/markdown-pdf/adapters/template-repair-timeout.test.ts` | 5 | unit | `test/markdown-pdf/adapters/template-repair-timeout.unit.test.ts` | suffix-only | module mocks (check combined selection ordering) | `test/markdown-pdf/adapters/template-codex-fixtures` |
| `test/markdown-pdf/commands/direct-render.test.ts` | 6 | app | `test/markdown-pdf/commands/direct-render.app.test.ts` | suffix-only | owned filesystem fixtures; subprocess / CLI runtime | `test/helpers/cli-test-utils`<br>`test/markdown-pdf/commands/fixtures` |
| `test/markdown-pdf/commands/profile-codex.test.ts` | 5 | app | `test/markdown-pdf/commands/profile-codex.app.test.ts` | suffix-only | owned filesystem fixtures; subprocess / CLI runtime | `test/helpers/cli-test-utils`<br>`test/markdown-pdf/commands/fixtures`<br>`test/markdown-pdf/support/path-fixtures` |
| `test/markdown-pdf/commands/profile-init.test.ts` | 1 | app | `test/markdown-pdf/commands/profile-init.app.test.ts` | suffix-only | owned filesystem fixtures; subprocess / CLI runtime | `test/helpers/cli-test-utils` |
| `test/markdown-pdf/commands/project-codex.test.ts` | 7 | app | `test/markdown-pdf/commands/project-codex.app.test.ts` | suffix-only | owned filesystem fixtures; subprocess / CLI runtime | `test/helpers/cli-test-utils`<br>`test/markdown-pdf/support/path-fixtures` |
| `test/markdown-pdf/commands/template-codex.test.ts` | 6 | app | `test/markdown-pdf/commands/template-codex.app.test.ts` | suffix-only | owned filesystem fixtures; subprocess / CLI runtime | `test/helpers/cli-test-utils`<br>`test/markdown-pdf/commands/fixtures`<br>`test/markdown-pdf/support/path-fixtures` |
| `test/markdown-pdf/commands/template-init.test.ts` | 2 | app | `test/markdown-pdf/commands/template-init.app.test.ts` | suffix-only | owned filesystem fixtures; subprocess / CLI runtime | `test/helpers/cli-test-utils` |
| `test/markdown-pdf/direct/page-chrome-area-styling.test.ts` | 7 | unit | `test/markdown-pdf/direct/page-chrome-area-styling.unit.test.ts` | suffix-only | controlled values and collaborators | `test/markdown-pdf/direct/page-chrome-test-utils` |
| `test/markdown-pdf/direct/page-chrome-sequence-visibility.test.ts` | 14 | unit | `test/markdown-pdf/direct/page-chrome-sequence-visibility.unit.test.ts` | suffix-only | controlled values and collaborators | `test/markdown-pdf/direct/page-chrome-test-utils` |
| `test/markdown-pdf/direct/renderer-capabilities-matrix.test.ts` | 46 | unit | `test/markdown-pdf/direct/renderer-capabilities-matrix.unit.test.ts` | suffix-only | controlled values and collaborators | — |
| `test/markdown-pdf/evidence/page-number-orchestration.test.ts` | 13 | unit+app | `test/markdown-pdf/evidence/page-number-renderer/orchestration.unit.test.ts`<br>`test/markdown-pdf/evidence/page-number-renderer/orchestration.app.test.ts` | split | owned filesystem fixtures; subprocess / CLI runtime; owned renderer laboratory, fake command execution, PDF/image libraries | `test/fixtures/markdown-pdf/page-number-renderer-contract`<br>`test/fixtures/markdown-pdf/page-number-renderer-contract`<br>`test/markdown-pdf/evidence/page-number-support` |
| `test/markdown-pdf/evidence/page-number-project-renderer-contract.test.ts` | 2 | unit+app | `test/markdown-pdf/evidence/page-number-renderer/project-renderer-contract.unit.test.ts`<br>`test/markdown-pdf/evidence/page-number-renderer/project-renderer-contract.app.test.ts` | split | owned filesystem fixtures | `test/fixtures/markdown-pdf/page-number-renderer-contract`<br>`test/helpers/cli-action-test-utils`<br>`test/helpers/cli-test-utils` |
| `test/markdown-pdf/interactive/codex-authoring-output-recovery-lifecycle.test.ts` | 29 | app | `test/markdown-pdf/interactive/codex-authoring/output-recovery-lifecycle.app.test.ts` | move | Bun interactive harness subprocess | `test/cli-foundations/interactive-harness`<br>`test/markdown-pdf/interactive/codex-authoring-fixtures` |
| `test/markdown-pdf/interactive/codex-authoring-project-handoff.test.ts` | 14 | app | `test/markdown-pdf/interactive/codex-authoring/project-handoff.app.test.ts` | move | Bun interactive harness subprocess | `test/cli-foundations/interactive-harness`<br>`test/markdown-pdf/interactive/codex-authoring-fixtures` |
| `test/markdown-pdf/interactive/deterministic-authoring.test.ts` | 17 | app | `test/markdown-pdf/interactive/deterministic-authoring.app.test.ts` | suffix-only | Bun interactive harness subprocess | `test/cli-foundations/interactive-harness` |
| `test/markdown-pdf/interactive/entry-routing.test.ts` | 1 | app | `test/markdown-pdf/interactive/entry-routing.app.test.ts` | suffix-only | Bun interactive harness subprocess | `test/cli-foundations/interactive-harness` |
| `test/markdown-pdf/interactive/font-model.test.ts` | 8 | unit | `test/markdown-pdf/interactive/font-model.unit.test.ts` | suffix-only | controlled values and collaborators | — |
| `test/markdown-pdf/interactive/font-post-codex-review.test.ts` | 4 | unit | `test/markdown-pdf/interactive/font-post-codex-review.unit.test.ts` | suffix-only | controlled values and collaborators | `test/helpers/cli-test-utils` |
| `test/markdown-pdf/interactive/font-suggestion-service.test.ts` | 16 | unit+app | `test/markdown-pdf/interactive/font-suggestion-service.unit.test.ts`<br>`test/markdown-pdf/interactive/font-suggestion-service.app.test.ts` | split | controlled values and collaborators; real @inquirer/search streams only in keyboard contract; injected deadlines/prompts elsewhere | `test/helpers/cli-test-utils` |
| `test/markdown-pdf/interactive/formal-guide-answers.test.ts` | 29 | unit | `test/markdown-pdf/interactive/formal-guide-answers.unit.test.ts` | suffix-only | controlled values and collaborators | `test/markdown-pdf/interactive/formal-guide-fixtures` |
| `test/markdown-pdf/interactive/formal-guide-compilation.test.ts` | 9 | unit | `test/markdown-pdf/interactive/formal-guide-compilation.unit.test.ts` | suffix-only | controlled values and collaborators | `test/markdown-pdf/interactive/formal-guide-fixtures` |
| `test/markdown-pdf/interactive/generated-lifecycle.test.ts` | 45 | app | `test/markdown-pdf/interactive/generated-lifecycle.app.test.ts` | suffix-only | Bun interactive harness subprocess | `test/cli-foundations/interactive-harness` |
| `test/markdown-pdf/interactive/render-sources.test.ts` | 56 | app | `test/markdown-pdf/interactive/render-sources.app.test.ts` | suffix-only | Bun interactive harness subprocess | `test/cli-foundations/interactive-harness` |
| `test/markdown-pdf/interactive/saved-recipe-handoff.test.ts` | 22 | app | `test/markdown-pdf/interactive/saved-recipe-handoff.app.test.ts` | suffix-only | Bun interactive harness subprocess | `test/cli-foundations/interactive-harness` |
| `test/markdown/commands/codex-timeout.test.ts` | 21 | app | `test/markdown/commands/codex-timeout.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness | `test/helpers/cli-test-utils.ts` |
| `test/markdown/interactive/menu-routing.test.ts` | 2 | app | `test/markdown/interactive/menu-routing.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Composed interactive harness with process-local module mocks | `test/cli-foundations/interactive-harness/index.ts`<br>`test/cli-foundations/interactive-harness/mock-composition.ts`<br>`test/cli-foundations/interactive-harness/runner.ts` |
| `test/release-tooling/branch-filter.test.ts` | 1 | app | `test/release-tooling/branch-filter.app.test.ts` | suffix-only | Git and release script subprocesses; isolated repo/config needed | `test/release-tooling/fixtures.ts` |
| `test/release-tooling/stable-notes.test.ts` | 6 | app | `test/release-tooling/stable-notes.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup; Git and release script subprocesses; isolated repo/config needed | `test/release-tooling/fixtures.ts` |
| `test/release-tooling/version-sync.test.ts` | 2 | app | `test/release-tooling/version-sync.app.test.ts` | suffix-only | Git and release script subprocesses; isolated repo/config needed | `test/release-tooling/fixtures.ts` |
| `test/rename/actions/apply-replay.test.ts` | 3 | app | `test/rename/actions/apply-replay.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts`<br>`test/rename/support/plan-artifacts.ts` |
| `test/rename/actions/apply-validation.test.ts` | 12 | app | `test/rename/actions/apply-validation.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts`<br>`test/rename/actions/apply-validation-support.ts`<br>`test/rename/support/plan-artifacts.ts` |
| `test/rename/actions/batch-codex-auto.test.ts` | 6 | app | `test/rename/actions/batch-codex-auto.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts`<br>`test/rename/support/plan-artifacts.ts` |
| `test/rename/actions/batch-codex-docs.test.ts` | 5 | app | `test/rename/actions/batch-codex-docs.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts`<br>`test/rename/support/plan-artifacts.ts` |
| `test/rename/actions/batch-codex-images.test.ts` | 5 | app | `test/rename/actions/batch-codex-images.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts`<br>`test/rename/support/plan-artifacts.ts` |
| `test/rename/actions/batch-core.test.ts` | 4 | app | `test/rename/actions/batch-core.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts`<br>`test/rename/support/plan-artifacts.ts` |
| `test/rename/actions/batch-filters.test.ts` | 5 | app | `test/rename/actions/batch-filters.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts`<br>`test/rename/support/plan-artifacts.ts` |
| `test/rename/actions/batch-preview.test.ts` | 4 | app | `test/rename/actions/batch-preview.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts`<br>`test/rename/support/plan-artifacts.ts` |
| `test/rename/actions/batch-recursion.test.ts` | 4 | app | `test/rename/actions/batch-recursion.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts`<br>`test/rename/support/plan-artifacts.ts` |
| `test/rename/actions/cleanup-analysis-report.test.ts` | 2 | app | `test/rename/actions/cleanup-analysis-report.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/rename/actions/cleanup-analyzer.test.ts` | 5 | app | `test/rename/actions/cleanup-analyzer.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/rename/actions/cleanup-directory.test.ts` | 8 | app | `test/rename/actions/cleanup-directory.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/rename/actions/cleanup-single.test.ts` | 21 | app | `test/rename/actions/cleanup-single.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/rename/actions/cleanup-validation.test.ts` | 5 | app | `test/rename/actions/cleanup-validation.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/rename/actions/execution-policy.test.ts` | 10 | app | `test/rename/actions/execution-policy.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts`<br>`test/rename/actions/file-support.ts` |
| `test/rename/actions/file-codex-auto.test.ts` | 2 | app | `test/rename/actions/file-codex-auto.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts`<br>`test/rename/actions/file-support.ts`<br>`test/rename/support/plan-artifacts.ts` |
| `test/rename/actions/file-codex-docs.test.ts` | 3 | app | `test/rename/actions/file-codex-docs.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts`<br>`test/rename/actions/file-support.ts`<br>`test/rename/support/plan-artifacts.ts` |
| `test/rename/actions/file-codex-images.test.ts` | 1 | app | `test/rename/actions/file-codex-images.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts`<br>`test/rename/actions/file-support.ts`<br>`test/rename/support/plan-artifacts.ts` |
| `test/rename/actions/file-core.test.ts` | 5 | app | `test/rename/actions/file-core.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts`<br>`test/rename/actions/file-support.ts`<br>`test/rename/support/plan-artifacts.ts` |
| `test/rename/actions/timestamp.test.ts` | 6 | app | `test/rename/actions/timestamp.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts`<br>`test/rename/support/plan-artifacts.ts` |
| `test/rename/adapters/cleanup-suggester.test.ts` | 10 | unit | `test/rename/adapters/cleanup-suggester.unit.test.ts` | suffix-only | Supplied runners/collaborators | — |
| `test/rename/adapters/document-title-suggester.test.ts` | 2 | app | `test/rename/adapters/document-title-suggester.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts`<br>`test/rename/adapters/title-suggester-support.ts` |
| `test/rename/adapters/image-title-suggester.test.ts` | 4 | unit+app | `test/rename/adapters/image-title-suggester.unit.test.ts`<br>`test/rename/adapters/image-title-suggester.app.test.ts` | split | Real retryDelayMs/sleep in executeBatchesWithRetries on retrying cases | `test/rename/adapters/title-suggester-support.ts` |
| `test/rename/codex/candidate-selection.test.ts` | 4 | app | `test/rename/codex/candidate-selection.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts` |
| `test/rename/commands/cleanup.test.ts` | 3 | app | `test/rename/commands/cleanup.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts`<br>`test/rename/support/run-cli.ts` |
| `test/rename/commands/codex-execution.test.ts` | 11 | app | `test/rename/commands/codex-execution.app.test.ts` | suffix-only | Composed application modules with controlled input | `test/helpers/cli-test-utils.ts` |
| `test/rename/commands/codex-timeout.test.ts` | 29 | app | `test/rename/commands/codex-timeout.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness | `test/helpers/cli-test-utils.ts` |
| `test/rename/commands/ux.test.ts` | 3 | app | `test/rename/commands/ux.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts`<br>`test/rename/support/run-cli.ts` |
| `test/rename/direct/cleanup-matchers.test.ts` | 10 | unit | `test/rename/direct/cleanup-matchers.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/rename/direct/cleanup-uid.test.ts` | 2 | unit | `test/rename/direct/cleanup-uid.unit.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts` |
| `test/rename/direct/interactive-router.test.ts` | 5 | unit | `test/rename/direct/interactive-router.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/rename/direct/template.test.ts` | 16 | unit | `test/rename/direct/template.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/rename/interactive/cleanup-analyzer-rendering.test.ts` | 2 | app | `test/rename/interactive/cleanup-analyzer-rendering.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Composed interactive harness with process-local module mocks | `test/cli-foundations/interactive-harness/index.ts`<br>`test/cli-foundations/interactive-harness/mock-composition.ts`<br>`test/cli-foundations/interactive-harness/runner.ts` |
| `test/rename/interactive/cleanup-analyzer-review.test.ts` | 3 | app | `test/rename/interactive/cleanup-analyzer-review.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Composed interactive harness with process-local module mocks | `test/cli-foundations/interactive-harness/index.ts`<br>`test/cli-foundations/interactive-harness/mock-composition.ts`<br>`test/cli-foundations/interactive-harness/runner.ts` |
| `test/rename/interactive/cleanup-codex-timestamp.test.ts` | 1 | app | `test/rename/interactive/cleanup-codex-timestamp.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Composed interactive harness with process-local module mocks | `test/cli-foundations/interactive-harness/index.ts`<br>`test/cli-foundations/interactive-harness/mock-composition.ts`<br>`test/cli-foundations/interactive-harness/runner.ts` |
| `test/rename/interactive/cleanup-codex.test.ts` | 6 | app | `test/rename/interactive/cleanup-codex.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Composed interactive harness with process-local module mocks | `test/cli-foundations/interactive-harness/index.ts`<br>`test/cli-foundations/interactive-harness/mock-composition.ts`<br>`test/cli-foundations/interactive-harness/runner.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/rename/interactive/cleanup-retention.test.ts` | 5 | app | `test/rename/interactive/cleanup-retention.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Composed interactive harness with process-local module mocks | `test/cli-foundations/interactive-harness/index.ts`<br>`test/cli-foundations/interactive-harness/mock-composition.ts`<br>`test/cli-foundations/interactive-harness/runner.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/rename/interactive/cleanup.test.ts` | 4 | app | `test/rename/interactive/cleanup.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Composed interactive harness with process-local module mocks | `test/cli-foundations/interactive-harness/index.ts`<br>`test/cli-foundations/interactive-harness/mock-composition.ts`<br>`test/cli-foundations/interactive-harness/runner.ts` |
| `test/rename/interactive/routing.test.ts` | 1 | app | `test/rename/interactive/routing.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Composed interactive harness with process-local module mocks | `test/cli-foundations/interactive-harness/index.ts`<br>`test/cli-foundations/interactive-harness/mock-composition.ts`<br>`test/cli-foundations/interactive-harness/runner.ts` |
| `test/rename/interactive/session-options.test.ts` | 3 | app | `test/rename/interactive/session-options.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Composed interactive harness with process-local module mocks | `test/cli-foundations/interactive-harness/index.ts`<br>`test/cli-foundations/interactive-harness/mock-composition.ts`<br>`test/cli-foundations/interactive-harness/runner.ts` |
| `test/rename/planner/collision-and-source-lifecycle.test.ts` | 4 | app | `test/rename/planner/collision-and-source-lifecycle.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts` |
| `test/rename/planner/serial-ordering.test.ts` | 4 | app | `test/rename/planner/serial-ordering.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts` |
| `test/rename/planner/template-rendering.test.ts` | 13 | app | `test/rename/planner/template-rendering.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts` |
| `test/rename/presentation/analyzer-progress.test.ts` | 2 | app | `test/rename/presentation/analyzer-progress.app.test.ts` | suffix-only | Real spinner interval creation/teardown with fake output | — |
| `test/rename/presentation/preview-composition.test.ts` | 10 | unit | `test/rename/presentation/preview-composition.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | `test/helpers/cli-test-utils.ts` |
| `test/rename/support/run-cli.test.ts` | 2 | app | `test/rename/commands/plan-artifact-cleanup.app.test.ts` | move | Owned filesystem fixtures and cleanup | `test/helpers/cli-test-utils.ts`<br>`test/rename/support/run-cli.ts` |
| `test/test-runner/process-table.unit.test.ts` | 2 | unit | `test/test-runner/process-table.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/test-runner/process.app.test.ts` | 20 | app | `test/test-runner/process.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup; macOS Phase 1 process-group support; ps process table observation; Bun/Node fixture child processes | `test/helpers/cli-test-utils.ts`<br>`test/test-runner/fixtures/process-subject.cjs` |
| `test/utils/datetime.test.ts` | 4 | unit | `test/utils/datetime.unit.test.ts` | suffix-only | Supplied values, fake streams/collaborators, and package JavaScript only | — |
| `test/video/actions/gif.test.ts` | 11 | app | `test/video/actions/gif.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/video/actions/preconditions.test.ts` | 8 | app | `test/video/actions/preconditions.app.test.ts` | suffix-only | Owned filesystem fixtures and cleanup | `test/helpers/cli-action-test-utils.ts`<br>`test/helpers/cli-test-utils.ts` |
| `test/video/commands/ux.test.ts` | 9 | app | `test/video/commands/ux.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness | `test/helpers/cli-test-utils.ts` |
| `test/video/interactive/gif.test.ts` | 1 | app | `test/video/interactive/gif.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Composed interactive harness with process-local module mocks | `test/cli-foundations/interactive-harness/index.ts`<br>`test/cli-foundations/interactive-harness/mock-composition.ts`<br>`test/cli-foundations/interactive-harness/runner.ts` |
| `test/video/interactive/routing.test.ts` | 1 | app | `test/video/interactive/routing.app.test.ts` | suffix-only | Bun/Node subprocesses; controlled fixture tools or CLI/harness; Composed interactive harness with process-local module mocks | `test/cli-foundations/interactive-harness/index.ts`<br>`test/cli-foundations/interactive-harness/mock-composition.ts`<br>`test/cli-foundations/interactive-harness/runner.ts` |

#### Mixed-File Case Assignments

Parameterized assignments include all expanded rows of the named registration.
Complement assignments refer to the original source's remaining cases; preserve
their original names and assertions when moving them.

| Original source | Suite | Case assignment |
| --- | --- | --- |
| `test/cli-actions-md-to-pdf-code-highlight.test.ts` | unit | highlights supported language fences and adds stable hook classes<br>strips code font-family styles from highlighted output<br>marks no-language and non-bundled-language blocks as plain<br>normalizes Pandoc sourceCode aliases before highlighting<br>finds supported Pandoc sourceCode language after extra classes<br>highlights bundled Shiki languages beyond the smoke fixture set<br>generates profile-controlled line number markup for highlighted blocks<br>keeps plain blocks unnumbered when line numbers are enabled<br>applies opt-in transformer notation classes and removes marker comments<br>applies opt-in transformer notation ranges<br>leaves transformer notation markers inert when the feature is disabled<br>combines transformer notation with line number markup<br>preserves surrounding content while replacing multiple code blocks<br>returns original HTML when highlighting is disabled |
| `test/cli-actions-md-to-pdf-code-highlight.test.ts` | pandoc | transforms required Pandoc fixture HTML with stable code hooks<br>keeps transformer markers inert in Pandoc fixture HTML when disabled |
| `test/cli-actions-md-to-pdf-profile-init.test.ts` | unit | accepts normalized code settings without changing omitted direct defaults<br>copies only supported defined Profile fields from runtime input |
| `test/cli-actions-md-to-pdf-profile-init.test.ts` | app | writes a default YAML profile file<br>writes a JSON profile file with preset-derived values<br>matches the direct action when writing the same accepted profile<br>prepares once and rebinds YAML and JSON destinations without writing<br>writes the bound accepted profile without regenerating it<br>rejects unknown profile extensions<br>refuses an existing profile file without overwrite |
| `test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts` | unit | redacts Windows absolute paths outside cwd in diagnostic reports |
| `test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts` | app | validates required template placeholders before writing<br>rejects unproven generated body hooks before any bundle write<br>rejects remote URLs, absolute paths, and unmanaged asset references<br>copies planned cover assets into the bundle<br>rejects managed asset sources that are symlinks at the copy boundary<br>rejects managed asset writes through symlinked parent directories<br>replaces hard-linked managed asset targets without clobbering the other link<br>rejects template writes through a symlinked output root at the final boundary<br>replaces hard-linked template targets without clobbering the other link<br>replaces hard-linked report targets without clobbering the other link<br>rejects planned write paths outside the output directory at the final boundary<br>writes requested reports without recipe files for no-usable-template decisions<br>writes rich diagnostic reports with redacted managed asset metadata<br>shell-quotes follow-up render command paths in diagnostic reports<br>keeps the selected input alias in diagnostic report display and replay command<br>validates no-usable-template report paths before writing |
| `test/cli-actions-md-to-pdf-template-codex/command-state.test.ts` | unit | rejects non-local cover image resources before signal collection |
| `test/cli-actions-md-to-pdf-template-codex/command-state.test.ts` | app | normalizes inputs, hints, report output, and recipe flags<br>allows positional input and --input when they resolve to the same file<br>allows positional input and --input when they resolve to the same file identity<br>preserves explicit --input alias spelling for replay and display<br>rejects invalid base profiles during early validation<br>rejects missing base profile files during early validation<br>rejects malformed base profile files during early validation<br>rejects unsupported cover image formats during early validation<br>rejects animated cover images during early validation<br>rejects missing cover image files during early validation<br>rejects symlinked cover images during early validation<br>normalizes output paths without requiring the directory to exist in Phase 1 |
| `test/cli-actions-md-to-pdf-template-codex/output-paths.test.ts` | unit | generates readable template bundle IDs |
| `test/cli-actions-md-to-pdf-template-codex/output-paths.test.ts` | app | plans generated output paths without input-derived bundle names<br>omits report targets by default<br>plans explicit Codex report output as an external report target<br>retries generated output paths when the first bundle directory exists<br>fails when generated output path retries are exhausted<br>uses the final generated output path retry attempt when earlier attempts collide<br>sanitizes planned cover asset filenames<br>falls back and truncates sanitized cover asset filenames |
| `test/cli-actions-md-to-pdf-template-compatibility.test.ts` | unit | does not require body proof for disabled numbering or document visibility<br>rejects a managed Template that promises but violates the hook contract<br>does not treat generator marker text in ordinary content as a managed Template<br>treats an actual Codex identity comment as a managed Template marker<br>requires managed identity and exactly one live cover element |
| `test/cli-actions-md-to-pdf-template-compatibility.test.ts` | app | rejects an arbitrary Template that cannot prove enabled cover ownership before probes or output<br>regenerates built-in CSS from the proven body boundary<br>regenerates selected-Template CSS from the legacy fallback<br>keeps arbitrary Template ownership while restoring ToC chrome and document numbering<br>accepts the built-in body contract for body-origin numbering<br>inspects the explicitly selected Template actual HTML<br>warns exactly once for document-origin body visibility on a legacy Template<br>keeps compatibility warnings ahead of renderer warnings<br>rejects body-origin numbering before probes or output writes when an explicit Template is unproven<br>rejects an unproven bundle-resolved Template before rendering<br>uses legacy fallback for the bundle-resolved Template with one warning<br>rejects a non-managed legacy Template with $label before probes or output writes (all three test.each rows) |
| `test/cli-actions-md-to-pdf-template-init.test.ts` | unit | does not invent an output directory fallback |
| `test/cli-actions-md-to-pdf-template-init.test.ts` | app | writes default template files with prepared-service parity<br>prepares and binds an explicit destination without writing<br>rebinds and writes the exact accepted prepared artifact<br>refuses a non-empty template directory without overwrite<br>overwrites existing recipe files with overwrite<br>leaves an existing bundle unchanged when either overwrite target is invalid |
| `test/cli-foundations/interactive/analyzer-status.test.ts` | app | uses a mutable tty status line and clears it on stop |
| `test/cli-foundations/interactive/analyzer-status.test.ts` | unit | Every other case in the original file; preserve nested describe/test.each names and assertions. |
| `test/cli-foundations/interactive/menu-prompt.test.ts` | app | preserves real select search behavior for q-prefixed menu entries |
| `test/cli-foundations/interactive/menu-prompt.test.ts` | unit | Every other case in the original file; preserve nested describe/test.each names and assertions. |
| `test/cli-foundations/options/codex-execution.test.ts` | unit | All cases inside describe("Codex execution resolution") |
| `test/cli-foundations/options/codex-execution.test.ts` | app | Every other case in the original file; preserve nested describe/test.each names and assertions. |
| `test/cli-foundations/path-prompts/sibling-preview.test.ts` | unit | scope keys are stable for the same segment scope and differ when the fragment changes |
| `test/cli-foundations/path-prompts/sibling-preview.test.ts` | app | Every other case in the original file; preserve nested describe/test.each names and assertions. |
| `test/cli-foundations/path-prompts/suggestions.test.ts` | unit | shouldSuggestForPathInput enforces min chars but allows explicit path prefixes |
| `test/cli-foundations/path-prompts/suggestions.test.ts` | app | Every other case in the original file; preserve nested describe/test.each names and assertions. |
| `test/cli-foundations/tui/keys.test.ts` | app | invokes escape abort callback for a bare escape key<br>dispose clears a pending escape abort |
| `test/cli-foundations/tui/keys.test.ts` | unit | Every other case in the original file; preserve nested describe/test.each names and assertions. |
| `test/cli-interactive-markdown-pdf/lifecycle-unit.test.ts` | unit | stores and removes the canonical factory result for an aliased temporary root<br>removes only the raw directory when canonicalization fails<br>preserves canonicalization and raw-cleanup failures without returning a session<br>fails closed for a raw path disguised as a session |
| `test/cli-interactive-markdown-pdf/lifecycle-unit.test.ts` | app | removes only the exact factory-owned session root<br>retains an owned session and its diagnostics<br>keeps the exact path retained when cleanup fails |
| `test/codex-adapters/direct/batch-retry-failures.test.ts` | app | executeBatchesWithRetries retries thrown errors and succeeds<br>records attempt exhaustion after multiple timeout retries |
| `test/codex-adapters/direct/batch-retry-failures.test.ts` | unit | Every other case in the original file; preserve nested describe/test.each names and assertions. |
| `test/codex-adapters/direct/rename-execution.test.ts` | app | image batches retain policy and partial results on %s (both test.each cases)<br>document batches and incompatible retries retain settings and partial results |
| `test/codex-adapters/direct/rename-execution.test.ts` | unit | Every other case in the original file; preserve nested describe/test.each names and assertions. |
| `test/codex-info/color.test.ts` | app | real CLI honors NO_COLOR, empty NO_COLOR, and --no-color with eligible output streams |
| `test/codex-info/color.test.ts` | unit | Every other case in the original file; preserve nested describe/test.each names and assertions. |
| `test/data-extract/actions/validation.test.ts` | unit | actionDataExtract rejects --codex-suggest-shape with --header-row |
| `test/data-extract/actions/validation.test.ts` | app | actionDataExtract requires --output for materialization runs<br>actionDataExtract rejects unsupported output extensions<br>actionDataExtract rejects --codex-suggest-headers with --output<br>actionDataExtract rejects --codex-suggest-shape with --output<br>actionDataExtract rejects --source-shape for non-Excel inputs<br>actionDataExtract enforces explicit overwrite behavior |
| `test/data-preview/actions/parquet.test.ts` | unit | actionDataPreview still rejects Parquet inputs on the lightweight path<br>actionDataParquetPreview rejects non-parquet inputs before DuckDB runs<br>actionDataParquetPreview surfaces missing file failures clearly<br>actionDataParquetPreview surfaces DuckDB initialization failures |
| `test/data-preview/actions/parquet.test.ts` | app | actionDataParquetPreview renders Parquet summary and table output<br>actionDataParquetPreview applies column filtering and row windowing<br>actionDataParquetPreview rejects unknown requested columns<br>actionDataParquetPreview surfaces invalid Parquet load failures |
| `test/data-query/actions/artifact-validation.test.ts` | unit | actionDataQuery rejects explicit shape flags when --source-shape is provided |
| `test/data-query/actions/artifact-validation.test.ts` | app | actionDataQuery rejects --source-shape for non-Excel inputs<br>actionDataQuery rejects mismatched header-mapping artifacts<br>actionDataQuery rejects mismatched source-shape artifacts |
| `test/data-query/actions/codex-validation.test.ts` | unit | actionDataQueryCodex requires intent<br>actionDataQueryCodex rejects --relation together with --source |
| `test/data-query/actions/codex-validation.test.ts` | app | actionDataQueryCodex reports codex unavailability failures clearly<br>actionDataQueryCodex reports malformed Codex draft JSON clearly<br>actionDataQueryCodex reports incomplete Codex draft payloads clearly<br>actionDataQueryCodex reports a structurally identified timeout with its limit<br>actionDataQueryCodex does not infer timeout from arbitrary error text<br>actionDataQueryCodex keeps ordinary aborts on the generic failure path<br>actionDataQueryCodex reports source ambiguity for SQLite inputs |
| `test/data-query/actions/execution-policy.test.ts` | unit | direct action rejects invalid settings before input access or runner invocation<br>direct drafting validates before building a prompt or invoking its runner |
| `test/data-query/actions/execution-policy.test.ts` | app | command forwards ${custom ? <br>provider rejection stays visible and does not retry with different settings |
| `test/data-query/actions/source-workspace.test.ts` | unit | actionDataQuery rejects --source together with --relation before query execution<br>actionDataQuery rejects duplicate relation aliases in workspace mode |
| `test/data-query/actions/source-workspace.test.ts` | app | actionDataQuery renders bounded table output for SQLite workspace relations<br>actionDataQuery treats one explicit relation binding as workspace mode<br>actionDataQuery renders bounded table output for DuckDB-file inputs<br>actionDataQuery infers the only DuckDB source when the file has one table<br>actionDataQuery supports schema-qualified DuckDB sources<br>actionDataQuery renders bounded table output for DuckDB workspace relations<br>actionDataQuery keeps dotted DuckDB source names selectable without collisions<br>actionDataQuery allows explicit file aliases in workspace mode<br>actionDataQuery reports unknown DuckDB sources clearly |
| `test/data-sources/adapters/xlsx-sources.test.ts` | unit | collectXlsxSheetSnapshot summarizes non-empty rows and used range for a simple workbook<br>listXlsxSheetNames converts corrupt zip offsets into CliError<br>listXlsxSheetNames reports malformed central-directory records<br>listXlsxSheetNames reports malformed local headers<br>collectXlsxSheetSnapshot reports malformed ZIP metadata from the snapshot path<br>listXlsxSheetNames reports unsupported ZIP compression methods<br>listXlsxSheetNames reports missing workbook relationship metadata |
| `test/data-sources/adapters/xlsx-sources.test.ts` | app | collectXlsxSheetSnapshot captures merged ranges for the collapsed merged-sheet fixture<br>listXlsxSheetNames and sheet snapshots preserve the true anchors for the public stacked merged-band fixture<br>listXlsxSheetNames and collectXlsxSheetSnapshot tolerate reordered workbook metadata attributes |
| `test/data-stack/actions/execution-policy.test.ts` | unit | invalid direct settings fail before preparation with assist disabled<br>direct suggestions validate before reading plan data or invoking a runner<br>configuration failure is not classified as a schema failure: ${message}<br>explicit schema failure retains its classification: ${message} |
| `test/data-stack/actions/execution-policy.test.ts` | app | command forwards ${custom ? <br>execution options do not enable assist<br>incompatible effort remains visible without retrying or changing the saved plan |
| `test/data-stack/evidence/fixture-generator.test.ts` | unit | cleanup target policy rejects broad paths before recursive removal |
| `test/data-stack/evidence/fixture-generator.test.ts` | app | reset creates a deterministic representative fixture tree<br>seed creates fixtures and clean removes them<br>clean refuses to remove the default tracked fixture tree |
| `test/fonts/actions/check-validation.test.ts` | unit | rejects invalid font check inputs before discovery |
| `test/fonts/actions/check-validation.test.ts` | app | Every other case in the original file; preserve nested describe/test.each names and assertions. |
| `test/fonts/adapters/discovery-cancellation.test.ts` | app | aborts the default runner child process<br>applies an explicit runner timeout without changing the default contract |
| `test/fonts/adapters/discovery-cancellation.test.ts` | unit | Every other case in the original file; preserve nested describe/test.each names and assertions. |
| `test/markdown-pdf-page-number-renderer-evidence/inspection.test.ts` | unit | extracts contract-driven negative logical values and compares all four counters<br>compacts PDF whitespace only for required and forbidden annotation text |
| `test/markdown-pdf-page-number-renderer-evidence/inspection.test.ts` | app | reports page roles and one-pass four-counter evidence without replacing the historical baseline<br>retains failed optional counter evidence without failing the required outcome<br>extracts text and A5 dimensions through the real PDF inspector<br>gates unexpected custom PDF page-label metadata<br>gates unexpected custom page labels on implemented product launches<br>allows ToC pages to repeat body heading markers<br>continues to reject repeated heading markers on non-ToC pages<br>requires the Product A company marker exactly once on its visible cover page<br>classifies extraction mismatches as contract failures and retains the laboratory<br>rejects missing physical pages and non-finite dimensions<br>gates product-launch extraction including selected-slot replacement<br>gates product page count, body visibility, dimensions, and margin-box region<br>aggregates contiguous split text runs before validating a label region<br>gates required repeating content and automatic metadata-title page ownership<br>requires every selected PNG to be complete and decodable |
| `test/markdown-pdf-page-number-renderer-evidence/laboratory.test.ts` | unit | redacts Unix and Windows paths from public output and omits the lab path<br>uses an allowlisted subprocess environment without ambient credentials |
| `test/markdown-pdf-page-number-renderer-evidence/laboratory.test.ts` | app | cleans the laboratory after an unexpected orchestration error<br>treats timeout and bounded-output violations as inconclusive launch failures<br>rolls back a partially initialized laboratory when marker creation fails<br>cleans successful runs automatically and honors explicit keep<br>closeout requires the exact direct temp child and ownership marker<br>writes a retained raw report only inside the owned laboratory |
| `test/markdown-pdf/actions/project-codex-output-plan.test.ts` | unit | generates shared project, profile, and template identities |
| `test/markdown-pdf/actions/project-codex-output-plan.test.ts` | app | rejects output planning before project signal classification can proceed<br>plans generated fixed project outputs without input-derived directory names<br>normalizes project cover asset bundle extensions<br>uses explicit output directories and explicit report paths exactly after resolution<br>retries generated output paths and fails after bounded retry exhaustion<br>rejects explicit output paths that are not directories<br>rejects unrelated Project entries even with overwrite<br>rejects nested unrelated Project assets before overwrite planning writes any role<br>permits overwrite preflight for existing canonical roles, reports, and one managed cover<br>rejects multiple managed cover extensions with one stable sorted diagnostic<br>accepts canonical complete Project files, recognized reports, and managed assets<br>reports duplicate roles, invalid profiles, and unrelated entries deterministically<br>rejects invalid canonical Profile content and unrecognized asset entries<br>validates actual planned output targets before writes<br>rejects symlink output directories<br>rejects symlink parents and unrelated hardlinks before writes<br>rejects source and sink collisions across reports, assets, and generated files<br>rejects a Project missing its canonical %s (all three test.each rows) |
| `test/markdown-pdf/actions/project-codex-validation.test.ts` | unit | sanitizes render command paths outside cwd and keeps placeholders replayable<br>quotes render command paths with spaces and single quotes<br>normalizes Windows-style render command paths relative to Windows cwd |
| `test/markdown-pdf/actions/project-codex-validation.test.ts` | app | validates deterministic project artifacts and creates a placeholder render command<br>projects Profile revision advisories through validation and the planned handoff<br>derives the pages-token migration from real legacy Profile validation<br>keeps render command input replayable without absolute local paths<br>maps no-usable template validation to no-usable project without a render command<br>rejects malformed project output plans that leave artifact boundaries<br>rejects malformed final profile output before render command generation<br>rejects generated template CSS that leaks unsafe resource references<br>returns a typed failure for Template-owned ordinary page-counter CSS<br>rejects page-counter mutation received through a Codex Template CSS block<br>rejects indeterminate counter references received through a Codex Template CSS block<br>rejects typed attr counter mutation received through a Codex Template CSS block<br>names final Profile and actual generated body incompatibility<br>rejects stylesheet ownership conflicts without relying on font decisions<br>rejects codex-assisted stylesheets that diverge from ownership-aware synthesis<br>rejects templates that drop profile-owned ToC hooks<br>rejects stylesheets that drop profile-owned Shiki hooks<br>rejects templates that invert profile-owned metadata title visibility<br>rejects template font decisions that override profile-owned fonts<br>rejects managed asset bindings that are not in the project output plan<br>rejects templates that silently drop a profile-owned text cover<br>projects empty Profile cover fields through managed Project diagnostics<br>validates cover image projects without disclosing the source asset path |
| `test/markdown-pdf/actions/rendering-diagnostics.test.ts` | unit | collects stable conditions once in deterministic order<br>uses configured trim semantics for occupied slots<br>warns once only for exact legacy {pages} tokens with declared revision 1 or 2<br>suppresses every page-number condition when effective numbering is disabled<br>collects an empty-cover warning without requiring page numbers<br>maps occupied %s to %s.%s (all six test.each rows) |
| `test/markdown-pdf/actions/rendering-diagnostics.test.ts` | app | evaluates cover visibility after Profile, frontmatter, and CLI metadata precedence<br>prints one empty-cover warning and continues rendering without rewriting the Profile<br>uses the direct effective disable during preparation<br>uses the direct effective enable for a declared legacy Profile<br>preserves the declared legacy revision when the Profile comes from a bundle<br>prints each structured warning once while preserving successful rendering<br>keeps action warning output plain for no-color and redirected stderr<br>resets structured diagnostics between sequential renders |
| `test/markdown-pdf/actions/rendering-validation.test.ts` | unit | rejects empty bundle values before dependency execution |
| `test/markdown-pdf/actions/rendering-validation.test.ts` | app | rejects missing bundle directories before dependency execution<br>rejects missing input before dependency execution<br>rejects invalid margin before dependency execution<br>rejects html output that resolves to the PDF output path<br>rejects missing custom template before dependency execution<br>rejects custom CSS directories before dependency execution<br>rejects missing profile files before dependency execution<br>rejects profile-only code line numbers without effective highlighting<br>allows explicit code highlight CLI overrides for profile line numbers<br>disables profile code line numbers when no-code-highlight is explicit<br>rejects profile-only transformer notation without effective highlighting<br>disables profile transformer notation when no-code-highlight is explicit<br>rejects existing html output without overwrite<br>reports pandoc renderer failures<br>reports weasyprint renderer failures |
| `test/markdown-pdf/evidence/page-number-orchestration.test.ts` | unit | keeps the tested catalog concrete while accepting future candidate identities |
| `test/markdown-pdf/evidence/page-number-orchestration.test.ts` | app | keeps stable harness metadata and uses bounded timed command requests<br>pins every candidate setup and selects it for doctor and the actual launch<br>fails candidate selection when PATH resolves a different WeasyPrint<br>requires the selected candidate PATH for the actual CLI launch<br>asserts exact contract and actual-launch page order, count, dimensions, and orientation<br>classifies Project extraction failures and bundle-explicit mismatches<br>keeps the optional repagination sentinel informative rather than gating<br>classifies actual-launch order mismatches separately<br>keeps dependency, native-library, font, and executable failures stage-aware<br>treats an effective pin or doctor-selection mismatch as environment evidence<br>does not convert a failed PNG executable into a renderer-contract failure<br>classifies a rejected command runner and retains its laboratory |
| `test/markdown-pdf/evidence/page-number-project-renderer-contract.test.ts` | unit | pins the no-base and base-profile live cases to the frozen candidates |
| `test/markdown-pdf/evidence/page-number-project-renderer-contract.test.ts` | app | materializes both deterministic Projects without invoking Codex |
| `test/markdown-pdf/interactive/font-suggestion-service.test.ts` | unit | starts lazily, caches family-only inventory, and filters without rediscovery<br>searches retained alias metadata and returns only the primary family<br>cancels soft and hard deadlines after discovery resolves before the soft threshold<br>caches unavailable discovery while falling back to ordinary input each time<br>caches command failure and shows its unavailable notice at most once<br>offers custom input once at the soft threshold and caches that choice silently<br>reuses the same promise and original hard deadline after continued waiting<br>keeps explicit custom input authoritative when discovery completes during the choice<br>uses the completed discovery when continued waiting is chosen from the visible choice<br>shows the slow-path choice at most once after back navigation<br>cancels discovery and the visible slow-path prompt without an unavailable notice<br>accepts success before the hard boundary and aborts discovery at the hard deadline<br>aborts active discovery silently without falling through to input<br>uses Escape as back navigation and aborts an active search on session cancellation<br>uses Escape as back navigation from unavailable-discovery text input |
| `test/markdown-pdf/interactive/font-suggestion-service.test.ts` | app | keeps the pinned real search keyboard contract usable in a narrow terminal |
| `test/rename/adapters/image-title-suggester.test.ts` | app | image batches retain partial suggestions and reuse one timeout through retries<br>image production retries create a fresh timeout signal for each attempt |
| `test/rename/adapters/image-title-suggester.test.ts` | unit | Every other case in the original file; preserve nested describe/test.each names and assertions. |

#### Support Consumers

Support import labels below identify original module dependencies; re-exporting
Bun registration functions is distinct from registering executable cases.

| Support module | Original consumers |
| --- | --- |
| `test/adapters-codex-markdown-pdf-profile/fixtures` | `test/adapters-codex-markdown-pdf-profile/fallback-failures.test.ts`<br>`test/adapters-codex-markdown-pdf-profile/patch-application.test.ts`<br>`test/adapters-codex-markdown-pdf-profile/prompt-schema.test.ts`<br>`test/adapters-codex-markdown-pdf-profile/runner-behavior.test.ts`<br>`test/markdown-pdf/adapters/execution-policy.test.ts` |
| `test/cli-actions-md-to-pdf-template-codex/template-synthesis/css-assertions` | `test/cli-actions-md-to-pdf-template-codex/template-synthesis/cover-layout.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/template-synthesis/font-ownership.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/template-synthesis/toc-css-branches.test.ts` |
| `test/cli-foundations/inline-rendering/virtual-terminal.ts` | `test/cli-foundations/inline-rendering/renderer.test.ts`<br>`test/cli-foundations/path-prompts/inline-controller.test.ts`<br>`test/cli-foundations/text-inline/terminal-controller.test.ts` |
| `test/cli-foundations/interactive-harness` | `test/cli-interactive-markdown-pdf/codex-authoring/entry-setup.test.ts`<br>`test/cli-interactive-markdown-pdf/codex-authoring/font-hint-editing.test.ts`<br>`test/cli-interactive-markdown-pdf/codex-authoring/regeneration.test.ts`<br>`test/cli-interactive-markdown-pdf/codex-execution.test.ts`<br>`test/markdown-pdf/interactive/codex-authoring-output-recovery-lifecycle.test.ts`<br>`test/markdown-pdf/interactive/codex-authoring-project-handoff.test.ts`<br>`test/markdown-pdf/interactive/deterministic-authoring.test.ts`<br>`test/markdown-pdf/interactive/entry-routing.test.ts`<br>`test/markdown-pdf/interactive/generated-lifecycle.test.ts`<br>`test/markdown-pdf/interactive/render-sources.test.ts`<br>`test/markdown-pdf/interactive/saved-recipe-handoff.test.ts` |
| `test/cli-foundations/interactive-harness/index.ts` | `test/data/interactive/menu-routing.test.ts`<br>`test/markdown-docx/interactive/routing.test.ts`<br>`test/markdown-frontmatter/interactive/routing.test.ts`<br>`test/markdown/interactive/menu-routing.test.ts`<br>`test/rename/interactive/cleanup-analyzer-rendering.test.ts`<br>`test/rename/interactive/cleanup-analyzer-review.test.ts`<br>`test/rename/interactive/cleanup-codex-timestamp.test.ts`<br>`test/rename/interactive/cleanup-codex.test.ts`<br>`test/rename/interactive/cleanup-retention.test.ts`<br>`test/rename/interactive/cleanup.test.ts`<br>`test/rename/interactive/routing.test.ts`<br>`test/rename/interactive/session-options.test.ts`<br>`test/video/interactive/gif.test.ts`<br>`test/video/interactive/routing.test.ts` |
| `test/cli-foundations/interactive-harness/mock-composition.ts` | `test/data/interactive/menu-routing.test.ts`<br>`test/markdown-docx/interactive/routing.test.ts`<br>`test/markdown-frontmatter/interactive/routing.test.ts`<br>`test/markdown/interactive/menu-routing.test.ts`<br>`test/rename/interactive/cleanup-analyzer-rendering.test.ts`<br>`test/rename/interactive/cleanup-analyzer-review.test.ts`<br>`test/rename/interactive/cleanup-codex-timestamp.test.ts`<br>`test/rename/interactive/cleanup-codex.test.ts`<br>`test/rename/interactive/cleanup-retention.test.ts`<br>`test/rename/interactive/cleanup.test.ts`<br>`test/rename/interactive/routing.test.ts`<br>`test/rename/interactive/session-options.test.ts`<br>`test/video/interactive/gif.test.ts`<br>`test/video/interactive/routing.test.ts` |
| `test/cli-foundations/interactive-harness/runner.ts` | `test/data/interactive/menu-routing.test.ts`<br>`test/markdown-docx/interactive/routing.test.ts`<br>`test/markdown-frontmatter/interactive/routing.test.ts`<br>`test/markdown/interactive/menu-routing.test.ts`<br>`test/rename/interactive/cleanup-analyzer-rendering.test.ts`<br>`test/rename/interactive/cleanup-analyzer-review.test.ts`<br>`test/rename/interactive/cleanup-codex-timestamp.test.ts`<br>`test/rename/interactive/cleanup-codex.test.ts`<br>`test/rename/interactive/cleanup-retention.test.ts`<br>`test/rename/interactive/cleanup.test.ts`<br>`test/rename/interactive/routing.test.ts`<br>`test/rename/interactive/session-options.test.ts`<br>`test/video/interactive/gif.test.ts`<br>`test/video/interactive/routing.test.ts` |
| `test/cli-foundations/interactive/real-select-search-fixture.ts` | `test/cli-foundations/interactive/menu-prompt.test.ts` |
| `test/cli-foundations/text-inline/prompt-fixtures.ts` | `test/cli-foundations/text-inline/completion-controller.test.ts`<br>`test/cli-foundations/text-inline/fallback.test.ts`<br>`test/cli-foundations/text-inline/terminal-controller.test.ts` |
| `test/codex-info/fixtures/cli-0.153.4-protocol.json` | `test/codex-info/cli-replay.test.ts` |
| `test/codex-info/fixtures/color-cli-runner.mjs` | `test/codex-info/color.test.ts` |
| `test/codex-info/live-protocol-client.ts` | `test/codex-info/live-protocol.test.ts` |
| `test/data-extract/actions/support.ts` | `test/data-extract/actions/header-mapping-review.test.ts`<br>`test/data-extract/actions/materialization.test.ts`<br>`test/data-extract/actions/source-selection.test.ts`<br>`test/data-extract/actions/source-shape-reuse.test.ts`<br>`test/data-extract/actions/source-shape-review.test.ts`<br>`test/data-extract/actions/validation.test.ts` |
| `test/data-extract/commands/support.ts` | `test/data-extract/commands/basic-sources.test.ts`<br>`test/data-extract/commands/excel-shape.test.ts`<br>`test/data-extract/commands/header-mapping-review.test.ts`<br>`test/data-extract/commands/source-shape-review.test.ts` |
| `test/data-preview/actions/support.ts` | `test/data-preview/actions/failures.test.ts`<br>`test/data-preview/actions/highlighting.test.ts`<br>`test/data-preview/actions/rendering.test.ts` |
| `test/data-query/actions/codex-support.ts` | `test/data-query/actions/codex-single-source.test.ts`<br>`test/data-query/actions/codex-validation.test.ts`<br>`test/data-query/actions/codex-workspace.test.ts` |
| `test/data-query/actions/support.ts` | `test/data-query/actions/artifact-validation.test.ts`<br>`test/data-query/actions/header-artifacts.test.ts`<br>`test/data-query/actions/header-modes.test.ts`<br>`test/data-query/actions/option-validation.test.ts`<br>`test/data-query/actions/query-output.test.ts`<br>`test/data-query/actions/source-shape.test.ts`<br>`test/data-query/actions/source-workspace.test.ts` |
| `test/data-query/commands/codex-support.ts` | `test/cli-command-data-query-codex.test.ts`<br>`test/data-query/commands/codex-single-source.test.ts`<br>`test/data-query/commands/codex-validation.test.ts`<br>`test/data-query/commands/codex-workspace.test.ts` |
| `test/data-query/commands/support.ts` | `test/cli-command-data-query-duckdb-sources.test.ts`<br>`test/cli-command-data-query-source-shape.test.ts`<br>`test/cli-command-data-query-validation.test.ts`<br>`test/cli-command-data-query.test.ts`<br>`test/data-query/commands/basic-formats.test.ts`<br>`test/data-query/commands/duckdb-lifecycle.test.ts`<br>`test/data-query/commands/duckdb-sources.test.ts`<br>`test/data-query/commands/excel-shape.test.ts`<br>`test/data-query/commands/header-review.test.ts`<br>`test/data-query/commands/source-shape-artifacts.test.ts`<br>`test/data-query/commands/sqlite-workspace.test.ts`<br>`test/data-query/commands/validation-remediation.test.ts` |
| `test/data-sources/fixtures/stacked-merged-band.ts` | `test/data-sources/adapters/xlsx-sources.test.ts` |
| `test/data-sources/fixtures/tabular.ts` | `test/data-sources/adapters/xlsx-sources.test.ts` |
| `test/data-stack/direct/support.ts` | `test/data-stack/direct/codex-report/apply.test.ts`<br>`test/data-stack/direct/codex-report/validation.test.ts`<br>`test/data-stack/direct/plan/identity-serialization.test.ts`<br>`test/data-stack/direct/plan/parse-io.test.ts` |
| `test/data-stack/interactive/support.ts` | `test/data-stack/interactive/codex-review.test.ts`<br>`test/data-stack/interactive/discovery.test.ts`<br>`test/data-stack/interactive/dry-run-write.test.ts`<br>`test/data-stack/interactive/routing.test.ts` |
| `test/doctor/fixtures.ts` | `test/doctor/actions/report-projections.test.ts`<br>`test/doctor/commands/routing.test.ts`<br>`test/doctor/workflow-projection.test.ts` |
| `test/fixtures/markdown-pdf/page-number-renderer-contract` | `test/markdown-pdf-page-number-renderer-evidence/inspection.test.ts`<br>`test/markdown-pdf-page-number-renderer-evidence/laboratory.test.ts`<br>`test/markdown-pdf/evidence/page-number-orchestration.test.ts`<br>`test/markdown-pdf/evidence/page-number-orchestration.test.ts`<br>`test/markdown-pdf/evidence/page-number-project-renderer-contract.test.ts` |
| `test/helpers/ansi.ts` | `test/data-extract/interactive/checkpoints.test.ts`<br>`test/data-extract/interactive/core.test.ts`<br>`test/data-extract/interactive/revision.test.ts`<br>`test/data-preview/actions/highlighting.test.ts`<br>`test/data-preview/interactive/routing.test.ts`<br>`test/data-query/interactive/manual.test.ts`<br>`test/data-query/interactive/review-checkpoints.test.ts`<br>`test/data-stack/direct/reporting.test.ts`<br>`test/data-stack/interactive/routing.test.ts` |
| `test/helpers/cli-action-test-utils` | `test/cli-actions-md-to-pdf-actions-assets.test.ts`<br>`test/cli-actions-md-to-pdf-prepared-render.test.ts`<br>`test/cli-actions-md-to-pdf-profile-codex-prepared.test.ts`<br>`test/cli-actions-md-to-pdf-profile-init.test.ts`<br>`test/cli-actions-md-to-pdf-profile-revision.test.ts`<br>`test/cli-actions-md-to-pdf-profile.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/asset-safety.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/privacy-redaction.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/review-dry-run.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/successful-writes.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/write-prevention.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/command-state.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/handoff-equivalence.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/profile-phase.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/signals.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/template-phase.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/command-state.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/output-collisions.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/output-directory.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/output-paths.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/output-targets.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/signal-collection.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/signal-mode.test.ts`<br>`test/cli-actions-md-to-pdf-template-compatibility.test.ts`<br>`test/cli-actions-md-to-pdf-template-init.test.ts`<br>`test/cli-interactive-markdown-pdf/codex-execution.test.ts`<br>`test/cli-interactive-markdown-pdf/codex-service-profile-font-ownership.test.ts`<br>`test/cli-interactive-markdown-pdf/deterministic-service.test.ts`<br>`test/cli-interactive-markdown-pdf/materialization.test.ts`<br>`test/markdown-pdf/actions/bundle-discovery.test.ts`<br>`test/markdown-pdf/actions/bundle-integration.test.ts`<br>`test/markdown-pdf/actions/bundle-resolution.test.ts`<br>`test/markdown-pdf/actions/execution-policy.test.ts`<br>`test/markdown-pdf/actions/profile-codex-candidates.test.ts`<br>`test/markdown-pdf/actions/project-codex-output-plan.test.ts`<br>`test/markdown-pdf/actions/project-codex-prepared-handoff.test.ts`<br>`test/markdown-pdf/actions/project-codex-prepared-request-lifecycle.test.ts`<br>`test/markdown-pdf/actions/project-codex-validation.test.ts`<br>`test/markdown-pdf/actions/rendering-code-highlighting.test.ts`<br>`test/markdown-pdf/actions/rendering-composition.test.ts`<br>`test/markdown-pdf/actions/rendering-core.test.ts`<br>`test/markdown-pdf/actions/rendering-custom-css-page-numbers.test.ts`<br>`test/markdown-pdf/actions/rendering-diagnostics.test.ts`<br>`test/markdown-pdf/actions/rendering-profile-rendering.test.ts`<br>`test/markdown-pdf/actions/rendering-renderer-capability-gate.test.ts`<br>`test/markdown-pdf/actions/rendering-requirements.test.ts`<br>`test/markdown-pdf/actions/rendering-template-asset-safety.test.ts`<br>`test/markdown-pdf/actions/rendering-validation.test.ts`<br>`test/markdown-pdf/actions/rendering-write-lifecycle.test.ts`<br>`test/markdown-pdf/actions/template-codex-action.test.ts`<br>`test/markdown-pdf/actions/template-codex-integration.test.ts`<br>`test/markdown-pdf/actions/template-codex-prepared.test.ts`<br>`test/markdown-pdf/evidence/page-number-project-renderer-contract.test.ts` |
| `test/helpers/cli-action-test-utils.ts` | `test/data-conversion/actions/formats.test.ts`<br>`test/data-preview/actions/failures.test.ts`<br>`test/data-preview/actions/parquet.test.ts`<br>`test/data-query/actions/duckdb-lifecycle.test.ts`<br>`test/data-sources/adapters/xlsx-sources.test.ts`<br>`test/data-stack/actions/codex-assist.test.ts`<br>`test/data-stack/actions/dry-run-plan.test.ts`<br>`test/data-stack/actions/materialization.test.ts`<br>`test/data-stack/actions/schema-modes.test.ts`<br>`test/data-stack/actions/validation.test.ts`<br>`test/data-stack/direct/artifact-paths.test.ts`<br>`test/doctor/actions/dependency-integration.test.ts`<br>`test/doctor/actions/report-projections.test.ts`<br>`test/doctor/commands/routing.test.ts`<br>`test/fonts/actions/check-diagnostics.test.ts`<br>`test/fonts/actions/check-provider-mapping.test.ts`<br>`test/fonts/actions/check-selection.test.ts`<br>`test/fonts/actions/check-text-output.test.ts`<br>`test/fonts/actions/check-ttc.test.ts`<br>`test/fonts/actions/check-validation.test.ts`<br>`test/fonts/actions/inspect-debug.test.ts`<br>`test/fonts/actions/inspect-matching.test.ts`<br>`test/fonts/actions/inspect-output.test.ts`<br>`test/fonts/actions/inspect-validation.test.ts`<br>`test/fonts/actions/list.test.ts`<br>`test/markdown-docx/actions/rendering.test.ts`<br>`test/markdown-frontmatter/actions/frontmatter-to-json.test.ts`<br>`test/rename/actions/apply-replay.test.ts`<br>`test/rename/actions/apply-validation.test.ts`<br>`test/rename/actions/batch-codex-auto.test.ts`<br>`test/rename/actions/batch-codex-docs.test.ts`<br>`test/rename/actions/batch-codex-images.test.ts`<br>`test/rename/actions/batch-core.test.ts`<br>`test/rename/actions/batch-filters.test.ts`<br>`test/rename/actions/batch-preview.test.ts`<br>`test/rename/actions/batch-recursion.test.ts`<br>`test/rename/actions/cleanup-analysis-report.test.ts`<br>`test/rename/actions/cleanup-analyzer.test.ts`<br>`test/rename/actions/cleanup-directory.test.ts`<br>`test/rename/actions/cleanup-single.test.ts`<br>`test/rename/actions/cleanup-validation.test.ts`<br>`test/rename/actions/file-core.test.ts`<br>`test/rename/actions/timestamp.test.ts`<br>`test/video/actions/gif.test.ts`<br>`test/video/actions/preconditions.test.ts` |
| `test/helpers/cli-test-utils` | `test/cli-actions-md-to-pdf-actions-assets.test.ts`<br>`test/cli-actions-md-to-pdf-command-wiring.test.ts`<br>`test/cli-actions-md-to-pdf-pandoc.test.ts`<br>`test/cli-actions-md-to-pdf-prepared-render.test.ts`<br>`test/cli-actions-md-to-pdf-profile-codex-command-wiring.test.ts`<br>`test/cli-actions-md-to-pdf-profile-codex-prepared.test.ts`<br>`test/cli-actions-md-to-pdf-profile-init.test.ts`<br>`test/cli-actions-md-to-pdf-profile-revision.test.ts`<br>`test/cli-actions-md-to-pdf-profile.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex-command-wiring.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/asset-safety.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/privacy-redaction.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/review-dry-run.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/successful-writes.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/write-prevention.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/command-state.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/handoff-equivalence.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/profile-phase.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/signals.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/template-phase.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/command-state.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/image-metadata.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/output-collisions.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/output-directory.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/output-paths.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/output-targets.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/signal-collection.test.ts`<br>`test/cli-actions-md-to-pdf-template-compatibility.test.ts`<br>`test/cli-actions-md-to-pdf-template-init.test.ts`<br>`test/cli-interactive-markdown-pdf/codex-progress.test.ts`<br>`test/cli-interactive-markdown-pdf/codex-service-profile-font-ownership.test.ts`<br>`test/cli-interactive-markdown-pdf/deterministic-service.test.ts`<br>`test/cli-interactive-markdown-pdf/materialization.test.ts`<br>`test/cli-markdown-pdf-warning-output.test.ts`<br>`test/markdown-pdf-code-fixture-generator.test.ts`<br>`test/markdown-pdf-profile-font-preservation-smoke.test.ts`<br>`test/markdown-pdf/actions/bundle-discovery.test.ts`<br>`test/markdown-pdf/actions/bundle-integration.test.ts`<br>`test/markdown-pdf/actions/bundle-resolution.test.ts`<br>`test/markdown-pdf/actions/execution-policy.test.ts`<br>`test/markdown-pdf/actions/profile-codex-candidates.test.ts`<br>`test/markdown-pdf/actions/project-codex-output-plan.test.ts`<br>`test/markdown-pdf/actions/project-codex-prepared-handoff.test.ts`<br>`test/markdown-pdf/actions/project-codex-prepared-request-lifecycle.test.ts`<br>`test/markdown-pdf/actions/project-codex-validation.test.ts`<br>`test/markdown-pdf/actions/rendering-code-highlighting.test.ts`<br>`test/markdown-pdf/actions/rendering-composition.test.ts`<br>`test/markdown-pdf/actions/rendering-core.test.ts`<br>`test/markdown-pdf/actions/rendering-custom-css-page-numbers.test.ts`<br>`test/markdown-pdf/actions/rendering-diagnostics.test.ts`<br>`test/markdown-pdf/actions/rendering-profile-rendering.test.ts`<br>`test/markdown-pdf/actions/rendering-renderer-capability-gate.test.ts`<br>`test/markdown-pdf/actions/rendering-requirements.test.ts`<br>`test/markdown-pdf/actions/rendering-template-asset-safety.test.ts`<br>`test/markdown-pdf/actions/rendering-validation.test.ts`<br>`test/markdown-pdf/actions/rendering-write-lifecycle.test.ts`<br>`test/markdown-pdf/actions/template-codex-action.test.ts`<br>`test/markdown-pdf/actions/template-codex-integration.test.ts`<br>`test/markdown-pdf/actions/template-codex-prepared.test.ts`<br>`test/markdown-pdf/commands/direct-render.test.ts`<br>`test/markdown-pdf/commands/profile-codex.test.ts`<br>`test/markdown-pdf/commands/profile-init.test.ts`<br>`test/markdown-pdf/commands/project-codex.test.ts`<br>`test/markdown-pdf/commands/template-codex.test.ts`<br>`test/markdown-pdf/commands/template-init.test.ts`<br>`test/markdown-pdf/evidence/page-number-project-renderer-contract.test.ts`<br>`test/markdown-pdf/interactive/font-post-codex-review.test.ts`<br>`test/markdown-pdf/interactive/font-suggestion-service.test.ts` |
| `test/helpers/cli-test-utils.ts` | `test/cli-foundations/color/commander-output.test.ts`<br>`test/cli-foundations/color/controls.test.ts`<br>`test/cli-foundations/color/diagnostic-labels.test.ts`<br>`test/cli-foundations/commands/interactive-timeout.test.ts`<br>`test/cli-foundations/commands/root-ux.test.ts`<br>`test/cli-foundations/options/codex-execution-scope.test.ts`<br>`test/cli-foundations/path-prompts/inline-controller.test.ts`<br>`test/cli-foundations/path-prompts/sibling-preview.test.ts`<br>`test/cli-foundations/path-prompts/suggestions.test.ts`<br>`test/codex-adapters/direct/execution-transport.test.ts`<br>`test/codex-adapters/direct/rename-execution.test.ts`<br>`test/codex-info/action.test.ts`<br>`test/codex-info/cli-replay.test.ts`<br>`test/codex-info/color.test.ts`<br>`test/codex-info/commands.test.ts`<br>`test/codex-info/environment-parity.test.ts`<br>`test/codex-info/live-protocol.test.ts`<br>`test/codex-info/render.test.ts`<br>`test/codex-info/transport.test.ts`<br>`test/data-conversion/actions/formats.test.ts`<br>`test/data-conversion/commands/help.test.ts`<br>`test/data-conversion/commands/output-paths.test.ts`<br>`test/data-conversion/interactive/routing.test.ts`<br>`test/data-extract/commands/help-and-input-format.test.ts`<br>`test/data-preview/actions/parquet.test.ts`<br>`test/data-preview/commands/parquet-ux.test.ts`<br>`test/data-preview/commands/preview-ux.test.ts`<br>`test/data-query/actions/execution-policy.test.ts`<br>`test/data-query/commands/codex-help-and-input-format.test.ts`<br>`test/data-query/commands/codex-timeout.test.ts`<br>`test/data-query/commands/help-and-input-format.test.ts`<br>`test/data-query/direct/interactive-execution-validation.test.ts`<br>`test/data-query/evidence/duckdb-fixtures.test.ts`<br>`test/data-query/evidence/tabular-fixtures.test.ts`<br>`test/data-query/header-mapping.test.ts`<br>`test/data-query/source-introspection.test.ts`<br>`test/data-sources/adapters/duckdb-extensions.test.ts`<br>`test/data-sources/adapters/xlsx-sources.test.ts`<br>`test/data-sources/direct/source-shape.test.ts`<br>`test/data-sources/evidence/stacked-merged-band-fixture.test.ts`<br>`test/data-sources/evidence/tabular-fixtures.test.ts`<br>`test/data-stack/actions/codex-assist.test.ts`<br>`test/data-stack/actions/dry-run-plan.test.ts`<br>`test/data-stack/actions/execution-policy.test.ts`<br>`test/data-stack/actions/materialization.test.ts`<br>`test/data-stack/actions/schema-modes.test.ts`<br>`test/data-stack/actions/validation.test.ts`<br>`test/data-stack/commands/codex-timeout.test.ts`<br>`test/data-stack/commands/direct-stack.test.ts`<br>`test/data-stack/commands/help-and-input-format.test.ts`<br>`test/data-stack/commands/options.test.ts`<br>`test/data-stack/commands/replay.test.ts`<br>`test/data-stack/direct/artifact-paths.test.ts`<br>`test/data-stack/direct/input-router.test.ts`<br>`test/data-stack/direct/plan/parse-io.test.ts`<br>`test/data-stack/direct/reporting.test.ts`<br>`test/data-stack/evidence/fixture-generator.test.ts`<br>`test/data/commands/help.test.ts`<br>`test/data/interactive/unknown-action.test.ts`<br>`test/doctor/commands/environment.test.ts`<br>`test/doctor/commands/routing.test.ts`<br>`test/document-rename/adapters/pdf-lifecycle.test.ts`<br>`test/document-rename/adapters/title-evidence.test.ts`<br>`test/fonts/actions/check-validation.test.ts`<br>`test/fonts/commands/registration.test.ts`<br>`test/markdown-docx/actions/rendering.test.ts`<br>`test/markdown-docx/adapters/ooxml-metadata.test.ts`<br>`test/markdown-frontmatter/actions/frontmatter-to-json.test.ts`<br>`test/markdown-frontmatter/commands/frontmatter-to-json.test.ts`<br>`test/markdown/commands/codex-timeout.test.ts`<br>`test/rename/actions/apply-replay.test.ts`<br>`test/rename/actions/apply-validation.test.ts`<br>`test/rename/actions/batch-codex-auto.test.ts`<br>`test/rename/actions/batch-codex-docs.test.ts`<br>`test/rename/actions/batch-codex-images.test.ts`<br>`test/rename/actions/batch-core.test.ts`<br>`test/rename/actions/batch-filters.test.ts`<br>`test/rename/actions/batch-preview.test.ts`<br>`test/rename/actions/batch-recursion.test.ts`<br>`test/rename/actions/cleanup-analysis-report.test.ts`<br>`test/rename/actions/cleanup-analyzer.test.ts`<br>`test/rename/actions/cleanup-directory.test.ts`<br>`test/rename/actions/cleanup-single.test.ts`<br>`test/rename/actions/cleanup-validation.test.ts`<br>`test/rename/actions/execution-policy.test.ts`<br>`test/rename/actions/file-codex-auto.test.ts`<br>`test/rename/actions/file-codex-docs.test.ts`<br>`test/rename/actions/file-codex-images.test.ts`<br>`test/rename/actions/file-core.test.ts`<br>`test/rename/actions/timestamp.test.ts`<br>`test/rename/adapters/document-title-suggester.test.ts`<br>`test/rename/codex/candidate-selection.test.ts`<br>`test/rename/commands/cleanup.test.ts`<br>`test/rename/commands/codex-execution.test.ts`<br>`test/rename/commands/codex-timeout.test.ts`<br>`test/rename/commands/ux.test.ts`<br>`test/rename/direct/cleanup-uid.test.ts`<br>`test/rename/interactive/cleanup-codex.test.ts`<br>`test/rename/interactive/cleanup-retention.test.ts`<br>`test/rename/planner/collision-and-source-lifecycle.test.ts`<br>`test/rename/planner/serial-ordering.test.ts`<br>`test/rename/planner/template-rendering.test.ts`<br>`test/rename/presentation/preview-composition.test.ts`<br>`test/rename/support/run-cli.test.ts`<br>`test/test-runner/process.app.test.ts`<br>`test/video/actions/gif.test.ts`<br>`test/video/actions/preconditions.test.ts`<br>`test/video/commands/ux.test.ts` |
| `test/markdown-pdf/actions/profile-codex-fixtures` | `test/cli-actions-md-to-pdf-profile-codex-action/outputs-dry-run.test.ts`<br>`test/cli-actions-md-to-pdf-profile-codex-action/outputs-dry-run.test.ts`<br>`test/cli-actions-md-to-pdf-profile-codex-action/path-alias-safety.test.ts`<br>`test/cli-actions-md-to-pdf-profile-codex-action/reports-failures.test.ts`<br>`test/cli-actions-md-to-pdf-profile-codex-action/signals-bases.test.ts`<br>`test/markdown-pdf/actions/profile-codex-progress.test.ts`<br>`test/markdown-pdf/actions/profile-codex-progress.test.ts`<br>`test/markdown-pdf/actions/profile-codex-request-lifecycle.test.ts` |
| `test/markdown-pdf/actions/project-codex-action-write-fixtures` | `test/cli-actions-md-to-pdf-project-codex/action-write/asset-safety.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/privacy-redaction.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/review-dry-run.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/successful-writes.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/write-prevention.test.ts` |
| `test/markdown-pdf/actions/project-codex-prepared-fixtures` | `test/markdown-pdf/actions/execution-policy.test.ts`<br>`test/markdown-pdf/actions/project-codex-prepared-handoff.test.ts`<br>`test/markdown-pdf/actions/project-codex-prepared-request-lifecycle.test.ts` |
| `test/markdown-pdf/actions/render-support` | `test/cli-actions-md-to-pdf-actions-assets.test.ts`<br>`test/cli-actions-md-to-pdf-code-highlight.test.ts`<br>`test/cli-actions-md-to-pdf-pandoc.test.ts`<br>`test/cli-actions-md-to-pdf-prepared-render.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/successful-writes.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/handoff-equivalence.test.ts`<br>`test/cli-actions-md-to-pdf-template-compatibility.test.ts`<br>`test/markdown-pdf/actions/bundle-integration.test.ts`<br>`test/markdown-pdf/actions/rendering-code-highlighting.test.ts`<br>`test/markdown-pdf/actions/rendering-composition.test.ts`<br>`test/markdown-pdf/actions/rendering-core.test.ts`<br>`test/markdown-pdf/actions/rendering-custom-css-page-numbers.test.ts`<br>`test/markdown-pdf/actions/rendering-diagnostics.test.ts`<br>`test/markdown-pdf/actions/rendering-profile-rendering.test.ts`<br>`test/markdown-pdf/actions/rendering-renderer-capability-gate.test.ts`<br>`test/markdown-pdf/actions/rendering-requirements.test.ts`<br>`test/markdown-pdf/actions/rendering-template-asset-safety.test.ts`<br>`test/markdown-pdf/actions/rendering-validation.test.ts`<br>`test/markdown-pdf/actions/rendering-write-lifecycle.test.ts`<br>`test/markdown-pdf/actions/template-codex-integration.test.ts` |
| `test/markdown-pdf/actions/template-codex-fixtures` | `test/cli-actions-md-to-pdf-project-codex/action-write/asset-safety.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/successful-writes.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/profile-phase.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/signals.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/template-phase.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/command-state.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/image-metadata.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/output-collisions.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/output-paths.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/output-targets.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/signal-collection.test.ts`<br>`test/cli-interactive-markdown-pdf/codex-service-profile-font-ownership.test.ts`<br>`test/markdown-pdf/actions/project-codex-output-plan.test.ts`<br>`test/markdown-pdf/actions/project-codex-prepared-handoff.test.ts`<br>`test/markdown-pdf/actions/project-codex-prepared-request-lifecycle.test.ts`<br>`test/markdown-pdf/actions/project-codex-validation.test.ts`<br>`test/markdown-pdf/actions/template-codex-integration.test.ts`<br>`test/markdown-pdf/actions/template-codex-prepared.test.ts` |
| `test/markdown-pdf/actions/template-synthesis-fixtures` | `test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/families.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/slots.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/template-synthesis/cover-layout.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/template-synthesis/document-title.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/template-synthesis/font-ownership.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/template-synthesis/toc-css-branches.test.ts`<br>`test/markdown-pdf/actions/rendering-profile-rendering.test.ts` |
| `test/markdown-pdf/adapters/template-codex-fixtures` | `test/adapters-codex-markdown-pdf-template/css-safety.test.ts`<br>`test/adapters-codex-markdown-pdf-template/decision-parsing.test.ts`<br>`test/adapters-codex-markdown-pdf-template/failure-classification.test.ts`<br>`test/adapters-codex-markdown-pdf-template/prompt-schema.test.ts`<br>`test/markdown-pdf/actions/execution-policy.test.ts`<br>`test/markdown-pdf/adapters/execution-policy.test.ts`<br>`test/markdown-pdf/adapters/template-repair-timeout.test.ts` |
| `test/markdown-pdf/commands/fixtures` | `test/markdown-pdf/commands/direct-render.test.ts`<br>`test/markdown-pdf/commands/profile-codex.test.ts`<br>`test/markdown-pdf/commands/template-codex.test.ts` |
| `test/markdown-pdf/direct/page-chrome-test-utils` | `test/markdown-pdf/direct/page-chrome-area-styling.test.ts`<br>`test/markdown-pdf/direct/page-chrome-sequence-visibility.test.ts` |
| `test/markdown-pdf/evidence/page-number-support` | `test/markdown-pdf-page-number-renderer-evidence/inspection.test.ts`<br>`test/markdown-pdf-page-number-renderer-evidence/laboratory.test.ts`<br>`test/markdown-pdf/evidence/page-number-orchestration.test.ts` |
| `test/markdown-pdf/interactive/codex-authoring-fixtures` | `test/cli-interactive-markdown-pdf/codex-authoring/entry-setup.test.ts`<br>`test/cli-interactive-markdown-pdf/codex-authoring/font-hint-editing.test.ts`<br>`test/cli-interactive-markdown-pdf/codex-authoring/regeneration.test.ts`<br>`test/cli-interactive-markdown-pdf/codex-execution.test.ts`<br>`test/markdown-pdf/interactive/codex-authoring-output-recovery-lifecycle.test.ts`<br>`test/markdown-pdf/interactive/codex-authoring-project-handoff.test.ts` |
| `test/markdown-pdf/interactive/formal-guide-fixtures` | `test/markdown-pdf/interactive/formal-guide-answers.test.ts`<br>`test/markdown-pdf/interactive/formal-guide-compilation.test.ts` |
| `test/markdown-pdf/support/path-fixtures` | `test/cli-actions-md-to-pdf-project-codex/action-write/asset-safety.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/privacy-redaction.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/review-dry-run.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/successful-writes.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/action-write/write-prevention.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/profile-phase.test.ts`<br>`test/cli-actions-md-to-pdf-project-codex/template-phase.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/output-directory.test.ts`<br>`test/cli-actions-md-to-pdf-template-codex/output-paths.test.ts`<br>`test/markdown-pdf/actions/project-codex-output-plan.test.ts`<br>`test/markdown-pdf/actions/project-codex-prepared-handoff.test.ts`<br>`test/markdown-pdf/actions/project-codex-prepared-request-lifecycle.test.ts`<br>`test/markdown-pdf/actions/project-codex-validation.test.ts`<br>`test/markdown-pdf/actions/template-codex-action.test.ts`<br>`test/markdown-pdf/actions/template-codex-integration.test.ts`<br>`test/markdown-pdf/actions/template-codex-prepared.test.ts`<br>`test/markdown-pdf/commands/profile-codex.test.ts`<br>`test/markdown-pdf/commands/project-codex.test.ts`<br>`test/markdown-pdf/commands/template-codex.test.ts` |
| `test/release-tooling/fixtures.ts` | `test/release-tooling/branch-filter.test.ts`<br>`test/release-tooling/stable-notes.test.ts`<br>`test/release-tooling/version-sync.test.ts` |
| `test/rename/actions/apply-validation-support.ts` | `test/rename/actions/apply-validation.test.ts` |
| `test/rename/actions/file-support.ts` | `test/rename/actions/execution-policy.test.ts`<br>`test/rename/actions/file-codex-auto.test.ts`<br>`test/rename/actions/file-codex-docs.test.ts`<br>`test/rename/actions/file-codex-images.test.ts`<br>`test/rename/actions/file-core.test.ts` |
| `test/rename/adapters/title-suggester-support.ts` | `test/rename/adapters/document-title-suggester.test.ts`<br>`test/rename/adapters/image-title-suggester.test.ts` |
| `test/rename/support/plan-artifacts.ts` | `test/rename/actions/apply-replay.test.ts`<br>`test/rename/actions/apply-validation.test.ts`<br>`test/rename/actions/batch-codex-auto.test.ts`<br>`test/rename/actions/batch-codex-docs.test.ts`<br>`test/rename/actions/batch-codex-images.test.ts`<br>`test/rename/actions/batch-core.test.ts`<br>`test/rename/actions/batch-filters.test.ts`<br>`test/rename/actions/batch-preview.test.ts`<br>`test/rename/actions/batch-recursion.test.ts`<br>`test/rename/actions/file-codex-auto.test.ts`<br>`test/rename/actions/file-codex-docs.test.ts`<br>`test/rename/actions/file-codex-images.test.ts`<br>`test/rename/actions/file-core.test.ts`<br>`test/rename/actions/timestamp.test.ts` |
| `test/rename/support/run-cli.ts` | `test/rename/commands/cleanup.test.ts`<br>`test/rename/commands/ux.test.ts`<br>`test/rename/support/run-cli.test.ts` |
| `test/test-runner/fixtures/process-subject.cjs` | `test/test-runner/process.app.test.ts` |

#### Phase 2 Added Coverage

The selector adds two files beyond the migration baseline:

- `test/test-runner/selection.unit.test.ts`: eight supplied-data contract cases.
- `test/test-runner/selection.app.test.ts`: two filesystem/Bun discovery cases.

### 2B: Representative Pilots

Status: completed.

Fixed section review base: `d8735eda1fd7d1d44f8852a0e84da390e93c34b5`.
Pilot Codex information and the selected PDF parsing/rendering/Pandoc files from
the inventory. Separate prerequisite probes from reusable support before wider
migration. Keep repository default discovery and live opt-in gates during pilots.

- [x] Reconcile pilot cases, imports, fixtures, and combined execution.
- [x] Verify isolated prerequisites and bounded explicit failures.
- [x] Run live Codex and Pandoc pilots without committed-input updates.
- [x] Review the full section range and settle the mapping before wider migration.

#### Prerequisite Isolation

The six native supports no longer probe at import. All 86 readiness early returns
in 24 consumers now await an explicit requirement; unused readiness imports were
removed from the remaining consumers. This prerequisite correction precedes their
filename migration so later move-only batches preserve executable checks.

Native preparation runs in a bounded child, returns boolean readiness only, and
disables automatic extension installation/loading before explicit `LOAD`. The
helper uses the invocation's allowlisted environment and caches its result. It
does not discover personal configuration or install missing prerequisites.

The verification-only unit preload rejects subprocess, native-package, and fetch
probes, including attempts caught by a test. Its first checks found a fetch type
annotation mismatch and an overly specific native diagnostic expectation; both
were corrected. Combined helper verification passed ten tests and 30 assertions.
Initial native/live-fixture helper attempts were denied process observation by
the execution sandbox and failed explicitly. Fresh permitted observations found
no remaining fixture work before successful reruns.

An isolated application home received regular-file copies of the four existing
DuckDB 1.5.5 `osx_arm64` Excel/SQLite cache and metadata files. Fifteen native cases
passed with 80 assertions in 4.44 seconds. An empty isolated home instead produced
the expected explicit Excel prerequisite failure with zero skips, verified process
completion, and no installation. Personal caches and committed inputs were not
modified. Shared invocation setup remains Phase 3 work.
Synthetic Linux and Windows platform values also confirmed that the existing
ownership guard rejects before launch; these checks do not establish support on
either operating system.

#### PDF Pilot

The five original PDF pilot sources became six files: code highlighting split
into 14 unit and two Pandoc cases, with four format cases, 17 HTML cases, one
fake-rendering application case, and one Pandoc language case. All 39 original
file/class/name/assertion identities reconcile exactly across their targets.

The shared rendering helper retains its current path for unmigrated consumers,
but no longer probes Pandoc or exports conditional test registration. Dedicated
live support verifies Pandoc 3.9 inside each test, uses an empty fixture-owned
home and temporary directory, bounds execution/cleanup, preserves original and
cleanup failures, and reports retained ownership before blocking further launches.

Unit/application verification passed 36 cases and 125 assertions, including with
no tools available on `PATH`. Real Pandoc passed three cases and 138 assertions;
the combined six-file selection passed all 39 cases and 263 assertions in 2.35
seconds. Unavailable Pandoc produced the expected explicit failure with verified
cleanup and no skips. Narrow helper checks also covered error preservation and
retained ownership. No committed input or generated fixture was changed.

#### Codex Information Pilot

Eight files received suite suffixes; color coverage split into 12 unit cases and
one application case. All 126 original cases remain, with unchanged assertion
identities for previously executed cases. The independent live protocol retains
its original assertions, adds version/lifecycle checks, and no longer writes
committed evidence. A new live case exercises the real production discovery
adapter's summary, models, and providers views. Two application helper cases
verify original-error preservation and timeout cleanup diagnostics.

Live-only support owns version, protocol, and adapter processes with isolated
homes/projects, an allowlisted environment, a Git discovery ceiling, and bounded
cleanup. Unverified ownership retains its exact scratch path and blocks further
launches and fixture allocation. The shared protocol client's existing inherited-
group mode remains available for the Phase 1 Node verification fixture.

Nonlive pilot verification passed 125 cases and 847 assertions with two temporary
live opt-in skips. The helper cases passed with 11 assertions after permitted
process observation. Automatic approval review initially rejected a live launch
whose outer command did not make home isolation explicit; no test ran. After
checking the metadata-only request scope, the outer test process also used an
empty environment and isolated home. Both live cases passed: 58 assertions in
3.08 seconds. No personal credentials/configuration or generation requests were
used, and the committed protocol JSON remained unchanged.

A fixed follow-up protocol then ran each live case three times with captured
output and three times in a terminal. All 12 case executions passed:

| Mode | Independent protocol ms, attempts 1–3 | Production adapter ms, attempts 1–3 |
| --- | --- | --- |
| Captured | 921.69, 931.49, 843.05 | 2079.07, 2410.73, 2037.78 |
| Terminal | 982.44, 921.90, 881.34 | 2207.65, 2074.09, 2044.72 |

The original Node/inherited-client repetition protocol also passed all 12 probes
without escalation after the shared-client extension:

| Mode | Protocol total / drain ms, attempts 1–3 | Transport total / drain ms, attempts 1–3 |
| --- | --- | --- |
| Captured | 843/656, 770/657, 738/620 | 786/649, 752/632, 778/663 |
| Terminal | 812/629, 805/621, 759/637 | 788/680, 848/678, 738/619 |

#### Combined Pilot Verification

The exact selection of 55 changed pilot/native files passed 343 cases and 2,075
assertions with zero skips/failures in 50.50 seconds. It used an isolated invocation
home, the copied existing native cache, and explicit live opt-in. All 329 previously
executed baseline cases matched their original class/name/assertion multisets;
the formerly skipped protocol case also ran. Thirteen cases were added: six
native-helper, four unit-boundary, two live-fixture helper, and one production
discovery case.

An isolated, instrumented unit selection passed 104 cases and 557 assertions
across eight pilot/helper files without subprocess, native-package, or fetch
probes. Types, lint, formatting, and whitespace checks passed.

The full section range
`d8735eda1fd7d1d44f8852a0e84da390e93c34b5..02eaadf169c1649b10d42de4e60fe42595111d30`
passed security, test-coverage, maintainability, and documentation review. A
proposed consolidation of the code-highlight assertions was withdrawn after
comparison with the baseline showed that those separate contracts already existed.
The pilot mapping is accepted and recorded in the path correspondence; broader
migration proceeds from it without duplicating or pruning cases.

### 2C: Feature Batches and Final Discovery

Status: completed.

Fixed section review base: `62239f6973b7730ef2f2126af6b81927119749a0`.
Migrate the remaining PDF owners first, then Data Query/Data Extract/Doctor-related
owners, then the remaining features. Preserve current prerequisite corrections
while applying the accepted source-to-target map and reconciling each batch.

- [x] Reconcile cases and combined execution for every migrated feature batch.
- [x] Verify controlled homes, native caches, and unit prerequisite isolation.
- [x] Update terminal path correspondence, links, and lint/format coverage.
- [x] Switch to final unit-default discovery and remove remaining live gates together.
- [x] Verify all four leaves, complete union, reports, and raw/default selection.
- [x] Review the complete section and Phase 2 ranges and resolve findings.

#### PDF Codex and Adapter Batch

The first 2C batch moves 50 sources to 55 targets, including five accepted
unit/application splits. Its 406 literal test declarations expand to 408 cases
and 3,641 assertions. Exact combined execution passed, and the baseline
class/name/assertion multisets match with no additions or losses. An instrumented
unit selection passed 142 cases and 958 assertions across 25 files without
subprocess, native-package, or fetch probes. Scoped formatting and lint passed.

A pure bundle-writing fixture helper supports the split tests. At this earlier
batch checkpoint, shared PDF support paths were temporarily retained for the
adjacent batch. The general PDF batch below records their completed relocation;
the final discovery and closeout sections record the completed switch and reviews.

#### PDF Isolation Corrections

Unit instrumentation exposed eager native renderer loading in the development
PDF evidence helper. Loading `pdfjs-dist` inside `inspectPdf` preserves real PDF
inspection while allowing supplied-text evidence utilities to remain pure.
Parameterized diagnostic fixtures now copy their header before mutation, matching
the existing footer/page-number copies and preventing shared-default pollution.
These two corrections are checkpointed separately from the general PDF moves.
The migrated combined selection, including real PDF inspection, passed 876 cases
and 5,309 assertions; guarded units passed 327 cases and 1,383 assertions.

#### General PDF and Support Batch

The adjacent batch moves 78 sources to 89 targets and retains 876 cases with
5,309 assertions. Eight existing shared helpers now live with their feature
owners; imports resolve directly to those locations. The font-suggestion split
uses one small shared fixture helper. No committed input assets changed.

One accepted inventory correction moves the disguised-session lifecycle case
from unit to application integration: it creates and cleans an owned filesystem
session. This changes case membership, not target count or assertions. Imports
used by pure cases now name existing owner modules where broad barrels loaded
unrelated native prerequisites.

After support relocation, all 133 original PDF sources reconcile to 150 targets:
1,323 cases and 9,213 assertions match the baseline per-source
class/name/assertion multisets exactly. Combined execution passed in 24.95 seconds
with zero skips/failures, including three installed-Pandoc cases and real PDF
inspection. Instrumented units passed 504 cases and 2,457 assertions across 66
files in 0.50 seconds under an isolated home. Bounded ownership reported complete
cleanup. Type checking, scoped lint, formatting, and whitespace checks passed.

#### Data Feature Batch

Data Query, Data Extract, related data features, and Doctor move 112 sources to
121 targets: 27 unit and 94 application files. All 623 literal test declarations
retain their bodies; the 690 expanded baseline cases and 3,348 assertions match
exactly, including duplicate parameterized identities. Combined execution passed
in 51.23 seconds with zero failures/skips and verified cleanup. Instrumented units
passed 215 cases and 686 assertions, including the preload's guard assertions.
The application selection used an isolated home and the previously copied native
extension cache; no extensions were fetched. Scoped formatting and lint passed.

Accepted inventory corrections preserve the current production import graph:

- Duplicate relation-alias validation belongs in application integration because
  the action loads DuckDB before that validation; the earlier source/relation
  argument check remains unit.
- Interactive execution validation and the public facade contract are application
  files because their entry modules eagerly import native Skia through the action
  graph. Their cases are unchanged; the two files switch suffix without adding
  targets. Production modules remain unchanged.

No new shared helpers or support relocations were needed in this batch.

#### Remaining Feature Batch

The remaining 124 sources move to 135 targets: 52 unit and 83 application files,
including 11 splits. Isolated combined execution passed 811 cases and 2,903
assertions with verified cleanup; guarded units passed 332 cases and 882
assertions. All 2,043 static assertion calls are preserved per source. Formatting
and lint passed, and committed fixtures remain unchanged.

The document-renaming preflight case is application integration because its
current batch module imports the native PDF extractor. This accepted membership
correction retains the same case body and requires no production changes.

Baseline correspondence matches 810 case identities exactly. One existing
malformed-options parameter uses `new Date()`, so its generated case name contains
the execution time. For this one source/classname/registration, reconciliation
normalizes only the ISO timestamp in the name and then compares assertions; all
811 cases match. The original dynamic parameter remains unchanged. No other case
names are normalized or discarded.

#### Final Discovery and Reconciliation

Committed discovery revision: `7e06cdc135345bf8344a4ae0fad6949552fe4c4c`.
The correspondence range `62239f69..dcea21ed` covers path migration only.

`bunfig.toml` now uses `./test` and excludes application, Codex, Pandoc, and
fixture-input paths by default. The Codex opt-in gate is removed in the same
checkpoint; its describe title now says only "isolated". Filename-only discovery
classifies all 424 executable files with no unclassified or out-of-tree owners.
The four selections are disjoint and their union exactly matches discovery.
Their JUnit testcase file identities match the selected files.

| Selection | Files | Cases | Assertions | Bounded elapsed time |
| --- | ---: | ---: | ---: | ---: |
| Bare unit default | 152 | 1,130 | 4,561 | 0.81 s |
| Instrumented bare unit default | 152 | 1,130 | 4,561 | 0.86 s |
| Raw PDF feature folder | 66 | 504 | 2,457 | 0.50 s |
| Exact application | 269 | 1,860 | 11,900 | 119.43 s |
| Exact Codex | 1 | 2 | 58 | 3.20 s |
| Exact Pandoc | 2 | 3 | 138 | 2.48 s |
| Exact complete union | 424 | 2,995 | 16,658 | 116.75 s |

All positive runs have zero failures/skips and verified process cleanup. Unit
verification used an empty owned home/cache and blocked subprocess, native-package,
and fetch probes. Application and aggregate verification used an isolated home
and only the existing copied native cache. Live Codex used isolated outer and
fixture homes with metadata-only requests. Exact integration selections replace
the default ignore list with the common fixture exclusion; public named commands
remain pending Phase 3.

All 2,971 previously executed baseline case identities are retained, using only
the single documented date-name normalization. The original skipped protocol
case now runs with 35 assertions. Twenty-three new cases cover discovery,
prerequisite/lifecycle helpers, unit-boundary instrumentation, and production
Codex discovery. The 380 original sources map to 418 targets; six new helper-contract
files bring the final count to 424.

One unchanged transport case has a timing-dependent assertion count. Its original
helper checks child exit only if the child writes its PID before the cancellation
timer. The baseline and application leaf recorded one assertion; the combined
run recorded two. The source is byte-identical to the baseline. This explains the
one-assertion difference between summed leaves and the union; all other baseline
assertion identities match. Review classified waiting for the PID before starting
the timer as a possible focused follow-up, outside this relocation phase. No
assertion was removed to force equal totals.

Negative selections proved explicit prerequisite failure after the default switch:
a Pandoc case on a controlled path without Pandoc failed once with a launch-failure
diagnostic, and an Excel case with no cached extension failed once with the required
extension diagnostic. Neither skipped, attempted installation, or left owned
processes running. Phase 2B's synthetic unsupported-platform checks remain the
platform-boundary evidence; this does not certify another operating system.

Types, lint, formatting across 1,102 source/test/script files, and whitespace
checks passed. The current path correspondence records all 364 remaining source
migrations and eight shared-helper relocations, and current research links resolve
to their terminal owners. Final full-section and whole-Phase-2 reviews passed.

#### Section and Phase Closeout

The complete section range
`62239f6973b7730ef2f2126af6b81927119749a0..7e06cdc135345bf8344a4ae0fad6949552fe4c4c`
and complete Phase 2 range
`34c8cceff3063032950482d2f827539f0a437cbd..7e06cdc135345bf8344a4ae0fad6949552fe4c4c`
passed security, test-coverage, maintainability, and documentation review with no
remaining material findings.

Review dispositions:

- Accepted the documentation traceability clarification: path migration and final
  discovery have distinct recorded revisions.
- Recorded the unchanged transport assertion variation instead of claiming strict
  total-assertion equality. Case preservation and the existing test weakness are
  both explicit above.
- Withdrew an old-command finding in the mixed-code Markdown fixture: the string
  is frozen syntax-highlighting input, not contributor usage documentation. The
  committed corpus remains unchanged as required by this phase's scope.

All Phase 2 acceptance items are complete. The final documentation-only checkpoint
closes the status/checklists; it does not change the verified implementation.
Public managed commands, full report validation, and retention remain Phase 3;
usage documentation and final repository verification remain Phase 4.

## Phase 3: Deliver the Managed Runner

Status: in progress.

Fixed phase review base: `815a72a41734d3c3fad11a1df612df4b0db5d171`.
The starting tracked worktree was clean. Use the ten acceptance items in the
implementation plan; mark each complete only after its evidence passes.

### 3A: Run Ownership and Prerequisites

Status: completed.

Establish one immutable invocation context, unique run roots, suite prerequisite
policies, bounded probes, and controlled homes/caches before public commands.

The first implementation batch adds argument parsing, canonical run allocation,
root/namespace identity checks, isolated suite environments, and a central
prerequisite/execution policy. Unknown or repeated arguments are rejected by a
pure parser. Serialized fixture context is bound to the allocated repository,
run identity, and selected suite; it never adopts a caller-supplied directory.

Prerequisite work executes in one bounded child per leaf. Application preflight
checks Node SQLite, required shell tools, DuckDB in Bun and Node, the current
cached Excel/SQLite extensions, and PDF.js. It copies only the four existing
regular extension/metadata files for the detected DuckDB version/platform into
the owned home and disables extension installation/loading by discovery. Unit
preflight checks runner infrastructure without integration prerequisites.

Focused verification passed 38 cases and 129 assertions in 1.16 seconds, with
verified process cleanup. It covers concurrent owners, earlier retained results,
replaced/symlinked roots and namespaces, argument rejection, isolated environment
snapshots, missing/malformed/nonzero prerequisite results, unavailable caches,
hanging probes, and cancellation. A real isolated application preflight passed
in 1.427 seconds using Bun 1.4.1, Node 26.5.0, DuckDB 1.5.5, and PDF.js 6.3.289.
Scoped type, lint, formatting, and whitespace checks passed.

Two initial test-harness mistakes were corrected before the passing checkpoint:
Bun's successful `fs.access` result differed from the asserted value, and an empty
`test.each` array was interpreted as callback-style registration. The tests now
assert directory existence directly and pass explicit argument objects.
The full plan items remain unchecked until orchestration proves the combined
requirements, including no reports/counts for unlaunched tests.

The full 3A range
`815a72a41734d3c3fad11a1df612df4b0db5d171..cb07cbe7974d5082c367666bf0f1fe3f01913e6e`
passed security, test-coverage, and maintainability review with no material findings.

### 3B: Reports and Fixture Retention

Status: completed.

Fixed batch review base: `cb07cbe7974d5082c367666bf0f1fe3f01913e6e`.

Validate complete JUnit records and integrate fixture allocation, designated
exports, and cleanup with the owned run. Audit direct and sibling allocations.

The report checkpoint adds pure structural/outcome validation and owned-file
consumption. Counts come from actual testcase records and must agree with every
supplied ancestor total. Legitimate duplicate parameterized names remain separate
cases. Structurally valid failure/skip reports retain useful counts, while the
passing gate rejects failures/errors/skips/TODOs. Reports with no executed cases
or invalid structure provide no trusted counts.

Reports must be absent before launch, fresh afterward, bounded regular files,
and stable while read. The reader refuses symlinks and replaced result namespaces.
Focused report validation/storage passed 51 cases and 137 assertions. A bounded
installed-Bun sample confirmed TODO appears as a skipped record even with exit
zero. The prior real 2,995-case report also reconciled exactly. Full process-exit
and finalization agreement is verified when the orchestrator is connected.

#### Fixture Ownership and Designated Exports

Managed fixture helpers allocate beneath the suite's owned scratch namespace.
They record fixture identity before setup, export designated files before inner
cleanup, and preserve callback/export/cleanup errors together. Both retention
modes exercise the same staged export path; finalization alone decides whether
results survive. Interrupted publication is removed only when its recorded
directory identity still matches. Raw standalone helpers retain their existing
allocation location.

Native, Pandoc, and Codex infrastructure launches now record pending/started/
completed ownership receipts for their detached child groups. Missing or
unverified completion prevents later scheduling and scratch deletion. Managed
SIGINT/SIGTERM and caller cancellation are forwarded to active nested owners;
listeners are removed when completion or launch rejection is recorded. Deliberate
failure/timeout fixtures with verified stopped work remain valid tests.

The allocation audit led to these scoped adaptations:

- Rename actions and CLI fixtures write plans under their own workspace; cleanup
  no longer scans or deletes repository-root plans. Concurrent-owner regressions
  preserve another workspace's plan.
- Release fixture setup failures clean their owner without replacing the original
  error. A deterministic curl stub keeps fallback-note tests offline while the
  explicit PR-title stub remains covered.
- Newly allocated tabular fixture roots use seeding instead of destructive reset;
  all 19 helper callers were verified to supply fresh owners. Dedicated reset and
  clean tests still exercise those operations against child data directories.
- Markdown code and font-preservation generators recognize the current managed
  suite's approved fixture children while retaining marker, symlink, input,
  capability, and raw-path protections. Another run or suite is not authorized.
- Real OS-temp session and sibling outputs have exact failure-safe cleanup owners.
  The child environment roots production temporary allocation inside suite scratch.

Designated outputs are limited to representative generated template/Pandoc files
and whitelisted Codex request/check evidence. No configuration, credentials, homes,
whole workspaces, or committed input copies are retained. Keys and values in the
Codex evidence are constructed from fixed names and validated check outcomes.

Focused fixture verification passed 17 cases and 74 assertions, including real
SIGINT/SIGTERM handling and independent sibling survival. Earlier managed smoke
verification passed 72 case executions across application, Pandoc, and Codex in
both retention modes, with export/process inspection and exact acceptance cleanup.
The unit selection passed 1,197 cases with prerequisite probes blocked.

The first complete managed application run passed 1,881 cases and failed 16: an
older font-smoke guard rejected the new nesting before its intended assertions.
After its scoped guard correction, all 1,898 application cases passed across 273
files: 12,082 assertions in 122.42 seconds, zero skips/failures, verified outer and
nested shutdown, and successful export inspection. The subsequent signal-forwarding
extension passed its focused checks. The final runner acceptance will exercise
that extension in the full aggregate.

A raw pre-fix tabular fixture was intentionally retained when reset replaced its
registered owner. It was removed only after fresh inspection confirmed the exact
nine generated regular files and no aliases. Reviewed managed acceptance runs were
also removed only after their recorded shutdown and ownership checks passed.
Types, lint, formatting, and whitespace checks passed for the completed batch.

A final ownership check additionally rejects hard-linked JUnit files before and
after consumption. Its regression preserves the other file owner unchanged;
all five storage cases passed (11 assertions), and type checking passed.

The full 3B range
`cb07cbe7974d5082c367666bf0f1fe3f01913e6e..7eac5b8eb8d805144966fcd0a1813e0a7f1c9268`
passed security, test-coverage, and maintainability review after the ownership
correction. Documentation review confirmed the evidence and pending integration
boundary. No material findings remain in this batch.

### 3C: Scheduling and Finalization

Status: in progress.

Fixed batch review base: `7eac5b8eb8d805144966fcd0a1813e0a7f1c9268`.

Connect ordered suite execution, failure/cancellation states, finalization, and
terminal summaries without hiding earlier failures.

### 3D: Command Publication and Integrated Verification

Status: pending.

Publish named commands only after the complete contract passes. Verify the real
aggregate in default and retained modes and review the complete phase range.

## Remaining Phases

Phase 4 has not started. Its broader repetition matrix, built-package checks, and
usage documentation follow the completed managed runner.
