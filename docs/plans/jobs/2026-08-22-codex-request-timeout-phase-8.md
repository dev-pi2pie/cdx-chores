---
title: "Codex request timeout Phase 8"
created-date: 2026-08-22
status: in-progress
agent: codex
---

## Goal

Run final cumulative validation, update the timeout research with shipped
implementation evidence, review the exact closeout ranges, and complete the
lifecycle defined by Phase 8 of the
[Codex request timeout plan](../plan-2026-08-21-codex-request-timeout-contract.md).

## Starting Point

Phase 8 begins from the reviewed Phase 7 tip:

```text
TIMEOUT_PHASE7_TIP
24ddbfe0dd383677e5c3d6db61d572a6ae7e7815
```

The working tree was clean at this boundary. The final Phase 7 documentation
and contract reviews found no remaining actionable findings.

## Review Boundaries

```text
original timeout implementation
6636a88bb962946c9e51defbf144c1a7bcd4b995..efca21ea364d4765d1b780abb5e42cd3e499196f

Phase 6 closeout receipt
efca21ea364d4765d1b780abb5e42cd3e499196f..7a634fd43312aabb6713254b27830ae0560423a4

diagnostic-color closeout tip
3dfadaff2ceeb0314aeca907608cf4c3cbec9c97

Phase 7 public documentation
365a7d40dcc85b133c8316a20eb21cd0c642b0ea..24ddbfe0dd383677e5c3d6db61d572a6ae7e7815

Phase 8 validation and closeout
24ddbfe0dd383677e5c3d6db61d572a6ae7e7815..TIMEOUT_PHASE8_TIP

resumed timeout documentation and closeout
365a7d40dcc85b133c8316a20eb21cd0c642b0ea..TIMEOUT_PHASE8_TIP
```

The diagnostic-color commits remain outside the original timeout
implementation range. Repository ancestry confirms that the diagnostic-color
tip is the sole parent of the Phase 7 base.

## Implementation Boundary

- run the cumulative focused timeout suites and repository-wide validation
- inspect all shipped help surfaces and the unsupported root spelling
- verify styled and plain legacy-warning equivalence
- resolve accepted cumulative-review findings without expanding CLI scope
- update the research from pre-implementation findings to shipped evidence
- link all eight phase records and complete checklists only from evidence
- record release impact and the separately approved legacy-removal boundary
- review the exact Phase 8, resumed-timeout, and composite whole-plan slices

## Phase Records

1. [Phase 1: duration parser and pure resolver](2026-08-21-codex-request-timeout-phase-1.md)
2. [Phase 2: rename command surface and compatibility](2026-08-21-codex-request-timeout-phase-2.md)
3. [Phase 3: action routing and retry preservation](2026-08-21-codex-request-timeout-phase-3.md)
4. [Phase 4: timeout-specific fallback information](2026-08-21-codex-request-timeout-phase-4.md)
5. [Phase 5: explicit direct-command adoption](2026-08-21-codex-request-timeout-phase-5.md)
6. [Phase 6: Interactive session timeout](2026-08-21-codex-request-timeout-phase-6.md)
7. [Phase 7: public documentation and integration](2026-08-22-codex-request-timeout-phase-7.md)
8. [Phase 8: final validation and lifecycle closeout](2026-08-22-codex-request-timeout-phase-8.md)

## Validation

Focused rename and shared timeout contract:

```text
bun test test/cli-options-codex-timeout.test.ts test/cli-command-rename-timeout.test.ts test/cli-actions-rename-file.test.ts test/cli-actions-rename-batch-codex-images.test.ts test/cli-actions-rename-batch-codex-docs.test.ts test/cli-actions-rename-batch-codex-auto.test.ts test/cli-actions-rename-codex-internals.test.ts test/adapters-codex-failure.test.ts test/adapters-codex-shared.test.ts test/adapters-codex-rename-timeout.test.ts test/adapters-codex-document-rename-titles.test.ts
130 pass, 0 fail
```

Focused direct data and Markdown contract:

```text
bun test test/cli-options-codex-timeout.test.ts test/cli-command-rename-timeout.test.ts test/cli-command-data-codex-timeout.test.ts test/cli-command-markdown-codex-timeout.test.ts test/cli-actions-data-query-codex-validation.test.ts test/cli-actions-data-query-codex.test.ts test/cli-actions-data-stack/codex-assist.test.ts test/adapters-codex-failure.test.ts test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts test/cli-actions-md-to-pdf-project-codex/prepared.test.ts
247 pass, 0 fail
```

Focused Interactive and command-regression contract:

```text
bun test test/cli-command-interactive-timeout.test.ts test/cli-interactive-rename.test.ts test/cli-interactive-rename-cleanup-codex.test.ts test/cli-interactive-routing-data-query-codex-single.test.ts test/cli-interactive-routing-data-query-codex-workspace.test.ts test/cli-interactive-routing-data-query-headers.test.ts test/cli-interactive-routing-data-query-source-shape.test.ts test/cli-interactive-data-stack/codex-review.test.ts test/cli-interactive-markdown-pdf/codex-authoring.test.ts test/cli-command-rename-timeout.test.ts test/cli-command-data-codex-timeout.test.ts test/cli-command-markdown-codex-timeout.test.ts
169 pass, 0 fail
```

Repository-wide validation:

```text
bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
passed

bun test
2614 pass, 0 fail
```

Accepted final-review regression coverage:

```text
bun test test/adapters-codex-failure.test.ts test/adapters-codex-rename-timeout.test.ts test/cli-actions-rename-cleanup-codex.test.ts test/data-query-header-mapping.test.ts test/data-source-shape.test.ts
46 pass, 0 fail
```

The accepted corrections use the shared 30-second default in every adopted
Interactive suggestion helper, prove that production rename retries construct
a fresh signal for every attempt, and preserve timeout classification plus the
effective per-attempt duration in rename-cleanup, header-mapping, and
source-shape fallback results. Direct and wrapped timeouts are covered alongside
ordinary abort controls.

Built Node help inspection covered:

```text
rename file --help
rename batch --help
batch-rename --help
data query codex --help
data stack --help
md pdf-profile codex --help
md pdf-template codex --help
md pdf-project codex --help
interactive --help
```

All nine surfaces exposed only their documented timeout options. Root help did
not expose `--codex-timeout`, and the root-level spelling exited `1` with the
expected unknown-option diagnostic.

Warning presentation and canonical plain-text equivalence:

```text
bun test test/cli-command-rename-timeout.test.ts test/cli-diagnostic-color.test.ts
28 pass, 0 fail
```

The styled legacy warning emphasizes only `Warning:` on eligible stderr, while
ANSI removal, disabled color, and redirected output preserve the canonical
plain text.

Documentation validation for the research, plan, and Phase 8 record passed:

```text
oxfmt --check
repository-relative Markdown link validation
public-safety pattern scan
git diff --check
passed
```

The final working-tree result will be recorded after the lifecycle text is
complete.

## Review

The first cumulative implementation review accepted three findings:

- replace the rename-cleanup helper's duplicated default and cover fresh
  production timeout signals per retry attempt
- preserve timeout classification and duration in the rename-cleanup,
  header-mapping, and source-shape fallback result shapes
- replace the header-mapping and source-shape helper-local defaults with the
  shared request-timeout default

The corrections landed as:

```text
ac66254a2fbc14f2f6857cc859db10ba2cd2ae18
1a72464ddbe9d0012084c3cbcdb78c370140ae09
```

Focused correctness and test re-reviews found no remaining actionable findings.
The Phase 8 candidate documentation review also found no actionable findings.
Exact Phase 8 and final composite plan reviews remain pending until the
closeout tip is immutable.

## Release Handoff

No implementation release is selected. The Phase 7 release-note handoff remains
the current release record; this closeout will confirm it without inventing a
target changelog.

Decision gate: pending.
