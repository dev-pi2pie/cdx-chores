---
title: "Test Catalog Path Correspondence"
created-date: 2026-08-23
status: draft
agent: codex
---

## Goal

Maintain the canonical lookup from historical test paths to their current
contract owners as the test catalog is reorganized.

This reference records correspondence only after a path move, split, merge, or
removal is accepted. Research and plans own the decision rationale. The unified
implementation job owns execution evidence, validation results, and exact
review decisions.

## Entry Contract

Each accepted path change receives one row:

| Field                   | Meaning                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Reference date          | UTC date on which the new path or retained owner became the accepted repository location |
| Historical path         | Repository-relative path that existed before the accepted change                         |
| Transition              | `moved`, `split`, `merged`, or `removed`                                                 |
| Current owner or owners | Current path or paths that retain the historical contract                                |
| Migration range         | Exact `<base>..<tip>` implementation range                                               |
| Job evidence            | Unified job section containing execution and validation evidence                         |

The reference date supports documentation-currentness review. The exact
migration range remains authoritative when same-day ordering matters.

Use one row per historical path. For a split, list every current owner that
retains part of the historical contract. For a merge or removal, name the
existing test path that retains the contract rather than leaving the current
owner blank. Job evidence should link to the exact unified-job section when a
stable section anchor is available.

Current guides and current reference docs must use the latest accepted paths.
Historical commands and time-bounded wording follow the dated currentness
contract in the related research.

## Correspondence

Current state: Phase 3 has established the first accepted path correspondences.
The reference remains `draft` until the complete initial migration and final
documentation reconciliation are finished.

| Reference date | Historical path                                                       | Transition | Current owner or owners                                                                                                                             | Migration range      | Job evidence                |
| -------------- | --------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------- |
| 2026-08-23     | `test/helpers/interactive-harness/mocks/action-data-shared.ts`        | moved      | `test/cli-foundations/interactive-harness/action-output.ts`                                                                                         | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-actions-data-query-artifact-validation.test.ts`             | moved      | `test/data-query/actions/artifact-validation.test.ts`                                                                                               | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-actions-data-query-codex.test.ts`                           | moved      | `test/data-query/actions/codex-single-source.test.ts`                                                                                               | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-actions-data-query-codex.helpers.ts`                        | moved      | `test/data-query/actions/codex-support.ts`                                                                                                          | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-actions-data-query-codex-validation.test.ts`                | moved      | `test/data-query/actions/codex-validation.test.ts`                                                                                                  | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-actions-data-query-codex-workspace.test.ts`                 | moved      | `test/data-query/actions/codex-workspace.test.ts`                                                                                                   | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-actions-data-query-header-artifacts.test.ts`                | moved      | `test/data-query/actions/header-artifacts.test.ts`                                                                                                  | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-actions-data-query-headers.test.ts`                         | moved      | `test/data-query/actions/header-modes.test.ts`                                                                                                      | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-actions-data-query-validation.test.ts`                      | moved      | `test/data-query/actions/option-validation.test.ts`                                                                                                 | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-actions-data-query.test.ts`                                 | moved      | `test/data-query/actions/query-output.test.ts`                                                                                                      | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-actions-data-query-shape.test.ts`                           | moved      | `test/data-query/actions/source-shape.test.ts`                                                                                                      | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-actions-data-query-workspace.test.ts`                       | moved      | `test/data-query/actions/source-workspace.test.ts`                                                                                                  | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-actions-data-query.helpers.ts`                              | moved      | `test/data-query/actions/support.ts`                                                                                                                | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-actions-data-query-codex-prompt.test.ts`                    | split      | `test/data-query/codex-intent.test.ts`<br>`test/data-query/actions/codex-single-source.test.ts`                                                     | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-command-data-query-codex.helpers.ts`                        | moved      | `test/data-query/commands/codex-support.ts`                                                                                                         | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-command-data-query-codex-validation.test.ts`                | moved      | `test/data-query/commands/codex-validation.test.ts`                                                                                                 | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-command-data-query-codex-workspace.test.ts`                 | moved      | `test/data-query/commands/codex-workspace.test.ts`                                                                                                  | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-command-data-query-duckdb-lifecycle.test.ts`                | moved      | `test/data-query/commands/duckdb-lifecycle.test.ts`                                                                                                 | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-command-data-query-shape.test.ts`                           | moved      | `test/data-query/commands/excel-shape.test.ts`                                                                                                      | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-command-data-query-headers.test.ts`                         | moved      | `test/data-query/commands/header-review.test.ts`                                                                                                    | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-command-data-query-workspace.test.ts`                       | moved      | `test/data-query/commands/sqlite-workspace.test.ts`                                                                                                 | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-command-data-query.helpers.ts`                              | moved      | `test/data-query/commands/support.ts`                                                                                                               | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-interactive-data-query-formal-guide.test.ts`                | moved      | `test/data-query/direct/formal-guide.test.ts`                                                                                                       | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-interactive-data-query-facade.test.ts`                      | moved      | `test/data-query/direct/interactive-facade.test.ts`                                                                                                 | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-options-parsers.test.ts`                                    | moved      | `test/data-query/direct/relation-option-parser.test.ts`                                                                                             | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/data-query-duckdb-fixture-generator.test.ts`                    | moved      | `test/data-query/evidence/duckdb-fixtures.test.ts`                                                                                                  | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/data-query-fixture-generator.test.ts`                           | moved      | `test/data-query/evidence/tabular-fixtures.test.ts`                                                                                                 | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/data-query-header-mapping.test.ts`                              | moved      | `test/data-query/header-mapping.test.ts`                                                                                                            | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-interactive-routing-data-query-codex-single.test.ts`        | moved      | `test/data-query/interactive/codex-single-source.test.ts`                                                                                           | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-interactive-routing-data-query-codex-workspace.test.ts`     | moved      | `test/data-query/interactive/codex-workspace.test.ts`                                                                                               | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-interactive-routing-data-query-formal.test.ts`              | moved      | `test/data-query/interactive/formal-guide.test.ts`                                                                                                  | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-interactive-routing-data-query-headers.test.ts`             | moved      | `test/data-query/interactive/header-review.test.ts`                                                                                                 | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-interactive-routing-data-query-manual.test.ts`              | moved      | `test/data-query/interactive/manual.test.ts`                                                                                                        | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/helpers/interactive-harness/mocks/data-query/codex.ts`          | moved      | `test/data-query/interactive/mock-codex.ts`                                                                                                         | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/helpers/interactive-harness/mocks/data-query/header-mapping.ts` | moved      | `test/data-query/interactive/mock-header-mapping.ts`                                                                                                | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/helpers/interactive-harness/mocks/data-query/workspace.ts`      | moved      | `test/data-query/interactive/mock-workspace.ts`                                                                                                     | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-interactive-routing-data-query-review.test.ts`              | moved      | `test/data-query/interactive/review-checkpoints.test.ts`                                                                                            | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-interactive-routing-data-query-source-shape.test.ts`        | split      | `test/data-query/interactive/source-shape.test.ts`<br>`test/data-query/source-introspection.test.ts`                                                | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-interactive-routing-data-query-workspace.test.ts`           | moved      | `test/data-query/interactive/workspace.test.ts`                                                                                                     | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-command-data-codex-timeout.test.ts`                         | split      | `test/data-query/commands/codex-timeout.test.ts`<br>`test/data-stack/commands/codex-timeout.test.ts`                                                | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-command-data-query-codex.test.ts`                           | split      | `test/cli-command-data-query-codex.test.ts`<br>`test/data-query/commands/codex-single-source.test.ts`                                               | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-command-data-query-duckdb-sources.test.ts`                  | split      | `test/cli-command-data-query-duckdb-sources.test.ts`<br>`test/data-query/commands/duckdb-sources.test.ts`                                           | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-command-data-query-source-shape.test.ts`                    | split      | `test/cli-command-data-query-source-shape.test.ts`<br>`test/data-query/commands/source-shape-artifacts.test.ts`                                     | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-command-data-query-validation.test.ts`                      | split      | `test/cli-command-data-query-validation.test.ts`<br>`test/data-query/commands/validation-remediation.test.ts`                                       | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-command-data-query.test.ts`                                 | split      | `test/cli-command-data-query.test.ts`<br>`test/data-query/commands/basic-formats.test.ts`                                                           | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/cli-ux.test.ts`                                                 | split      | `test/cli-ux.test.ts`<br>`test/data-query/commands/help-and-input-format.test.ts`<br>`test/data-query/commands/codex-help-and-input-format.test.ts` | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/helpers/interactive-harness/mocks/action-data.ts`               | split      | `test/helpers/interactive-harness/mocks/action-data.ts`<br>`test/data-query/interactive/mock-action.ts`                                             | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/helpers/interactive-harness/mocks/data-query/index.ts`          | split      | `test/helpers/interactive-harness/mocks/data-query/index.ts`<br>`test/data-query/interactive/mock-installation.ts`                                  | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/helpers/interactive-harness/mocks/data-query/query.ts`          | split      | `test/helpers/interactive-harness/mocks/data-query/query.ts`<br>`test/data-query/interactive/mock-query.ts`                                         | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/helpers/interactive-harness/mocks/data-query/source-shape.ts`   | split      | `test/helpers/interactive-harness/mocks/data-query/source-shape.ts`<br>`test/data-query/interactive/mock-source-shape.ts`                           | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/helpers/interactive-harness/mocks/data-query/types.ts`          | split      | `test/helpers/interactive-harness/mocks/data-query/types.ts`<br>`test/data-query/interactive/mock-types.ts`                                         | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/helpers/interactive-harness/module-urls.ts`                     | split      | `test/helpers/interactive-harness/module-urls.ts`<br>`test/data-query/interactive/module-urls.ts`                                                   | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |
| 2026-08-23     | `test/helpers/interactive-harness/types.ts`                           | split      | `test/helpers/interactive-harness/types.ts`<br>`test/data-query/interactive/harness-contract.ts`                                                    | `db9622cf..885e3846` | [Phase 3][phase-3-evidence] |

[phase-3-evidence]: ../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-3-data-query-migration-pilot

## Completion Boundary

This reference remains `draft` throughout the initial test-catalog migration,
including after the first correspondence rows are added. It may move to
`completed` only after the final documentation reconciliation confirms that:

- every accepted move, split, merge, and removal has a correspondence row
- every row names its reference date, current owner or owners, exact migration
  range, and job evidence
- current guides and reference docs use the accepted current paths
- every remaining historical path occurrence is intentionally historical
- no accepted historical path remains unclassified

After that initial completion, later isolated migrations may append rows and
update `modified-date` without reopening the reference unless its schema or
currentness contract changes materially.

## Related Research

- [Test Suite Contract, Overlap, And Catalog Review](../researches/research-2026-08-23-test-suite-contract-overlap-and-catalog.md)
