---
title: "Test Catalog Path Correspondence"
created-date: 2026-08-23
modified-date: 2026-09-06
status: completed
agent: codex
---

## Goal

Provide the canonical lookup from historical test paths to their current
contract owners after the test catalog reorganization.

The table is organized by named catalog change sets instead of plan numbering.
The completed implementation job retains execution order, validation detail,
and exact review decisions.

## Lookup Contract

Each historical path appears once for each accepted move, split, merge, or
removal. Current-owner cells point directly to existing terminal owners; readers
do not need to follow intermediate migration chains.

- `moved` names the current path that owns the same contract.
- `split` names every current path that owns part of the former contract.
- `merged` names the current path that absorbed the contract.
- `removed` names the retained current test that protects the useful contract.

A change set records the acceptance date, evidence range, and implementation
record once for the related path group. Later path changes update current-owner
cells and append a new change set without rewriting completed job evidence.

## Catalog Change Sets

| Change set | Accepted | Scope | Evidence range | Implementation record |
| --- | --- | --- | --- | --- |
| `test-suite-pilots` | 2026-09-06 | PDF and Codex information suite pilots | `d8735eda..02eaadf1` | [job record](../plans/jobs/2026-09-05-test-suite-refactor.md#2b-representative-pilots) |
| `data-query` | 2026-08-23 | Data Query | `db9622cf..885e3846` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-3-data-query-migration-pilot) |
| `doctor` | 2026-08-23 | Doctor | `ff0f3d6f..93c60f9e` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-4-doctor-ownership-migration-pilot) |
| `markdown-pdf-pilot` | 2026-08-23 | Markdown PDF Pilot | `05a87d54..802d3b86` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-5-bounded-markdown-pdf-migration-pilot) |
| `markdown-pdf-general` | 2026-08-23 | Markdown PDF General | `fca1204a..b5ffc3f1` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-61-markdown-pdf-general) |
| `markdown-pdf-template` | 2026-08-23 | Markdown PDF Template | `2af1ae7b..b74f6279` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-62-markdown-pdf-template-codex) |
| `markdown-pdf-profile` | 2026-08-23 | Markdown PDF Profile | `171eec39..b66e1c35` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-63-markdown-pdf-profile) |
| `markdown-pdf-project` | 2026-08-23 | Markdown PDF Project | `54c24460..e5489182` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-64-markdown-pdf-project-codex) |
| `markdown-pdf-interactive` | 2026-08-23 | Markdown PDF Interactive And Support | `2b8151dd..b1d2c133` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-65-markdown-pdf-interactive-and-support-closeout) |
| `release-tooling` | 2026-08-23 | Release Tooling | `bb3d683a..608b0d2b` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-66-release-tooling) |
| `markdown-frontmatter` | 2026-08-23 | Markdown Frontmatter | `16966305..61df100e` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-67-markdown-frontmatter) |
| `video` | 2026-08-23 | Video | `5b362772..cf85a757` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-68-video) |
| `data-sources` | 2026-08-23 | Data Sources | `9458f888..a3a76f53` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-69-data-sources) |
| `data-extract` | 2026-08-23 | Data Extract | `733f27cb..d02bf761` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-610-data-extract) |
| `data-preview` | 2026-08-23 | Data Preview | `7b840652..3d95eba5` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-611-data-preview) |
| `data-stack` | 2026-08-23 | Data Stack | `cf15f599..4ae50698` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-612-data-stack) |
| `data-conversion` | 2026-08-23 | Data Conversion | `f2fb794b..f7f509ee` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-613-data-conversion) |
| `fonts` | 2026-08-23 | Fonts | `ba8a6cd7..4be23beb` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-614-fonts) |
| `rename` | 2026-08-23 | Rename | `93e7a797..da247175` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-615-rename) |
| `codex-adapters` | 2026-08-23 | Codex Adapter Platform | `2f5d5a20..c69a9abc` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-616-codex-adapter-platform) |
| `document-rename` | 2026-08-23 | Document Rename | `91165757..111a67ea` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-617-document-rename) |
| `markdown-docx` | 2026-08-23 | Markdown DOCX | `56624bef..0018929c` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-618-docx) |
| `markdown` | 2026-08-23 | Markdown Platform | `de108f7d..16020bd3` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-619-markdown-platform) |
| `utilities` | 2026-08-23 | Utilities | `a48b30b1..60e3b5ce` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-620-utilities) |
| `cli-foundations` | 2026-08-23 | CLI Foundations And Mixed-Root Cleanup | `10f7eeef..d5985314` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-621-cli-foundations-and-mixed-root-decomposition) |
| `support-and-root-cleanup` | 2026-08-24 | Shared Support And Root Cleanup | `b83d14f5..275f88f9`<br>`275f88f9..ba4701aa`<br>`ba4701aa..5411dc03`<br>`ba4701aa..b8f78174`<br>`5411dc03..b8f78174` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-7-global-support-ownership-and-root-deferrals) |
| `final-reconciliation` | 2026-08-24 | Final Reconciliation | `1009d3c8..6e288cb1` | [job record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-8-final-test-tree-and-documentation-reconciliation) |

## Historical-To-Current Lookup

### Data Query

Change set: `data-query`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/helpers/interactive-harness/mocks/action-data-shared.ts` | moved | `test/cli-foundations/interactive-harness/action-output.ts` |
| `test/cli-actions-data-query-artifact-validation.test.ts` | moved | `test/data-query/actions/artifact-validation.test.ts` |
| `test/cli-actions-data-query-codex.test.ts` | moved | `test/data-query/actions/codex-single-source.test.ts` |
| `test/cli-actions-data-query-codex.helpers.ts` | moved | `test/data-query/actions/codex-support.ts` |
| `test/cli-actions-data-query-codex-validation.test.ts` | moved | `test/data-query/actions/codex-validation.test.ts` |
| `test/cli-actions-data-query-codex-workspace.test.ts` | moved | `test/data-query/actions/codex-workspace.test.ts` |
| `test/cli-actions-data-query-header-artifacts.test.ts` | moved | `test/data-query/actions/header-artifacts.test.ts` |
| `test/cli-actions-data-query-headers.test.ts` | moved | `test/data-query/actions/header-modes.test.ts` |
| `test/cli-actions-data-query-validation.test.ts` | moved | `test/data-query/actions/option-validation.test.ts` |
| `test/cli-actions-data-query.test.ts` | moved | `test/data-query/actions/query-output.test.ts` |
| `test/cli-actions-data-query-shape.test.ts` | moved | `test/data-query/actions/source-shape.test.ts` |
| `test/cli-actions-data-query-workspace.test.ts` | moved | `test/data-query/actions/source-workspace.test.ts` |
| `test/cli-actions-data-query.helpers.ts` | moved | `test/data-query/actions/support.ts` |
| `test/cli-actions-data-query-codex-prompt.test.ts` | split | `test/data-query/codex-intent.test.ts`<br>`test/data-query/actions/codex-single-source.test.ts` |
| `test/cli-command-data-query-codex.helpers.ts` | moved | `test/data-query/commands/codex-support.ts` |
| `test/cli-command-data-query-codex-validation.test.ts` | moved | `test/data-query/commands/codex-validation.test.ts` |
| `test/cli-command-data-query-codex-workspace.test.ts` | moved | `test/data-query/commands/codex-workspace.test.ts` |
| `test/cli-command-data-query-duckdb-lifecycle.test.ts` | moved | `test/data-query/commands/duckdb-lifecycle.test.ts` |
| `test/cli-command-data-query-shape.test.ts` | moved | `test/data-query/commands/excel-shape.test.ts` |
| `test/cli-command-data-query-headers.test.ts` | moved | `test/data-query/commands/header-review.test.ts` |
| `test/cli-command-data-query-workspace.test.ts` | moved | `test/data-query/commands/sqlite-workspace.test.ts` |
| `test/cli-command-data-query.helpers.ts` | moved | `test/data-query/commands/support.ts` |
| `test/cli-interactive-data-query-formal-guide.test.ts` | moved | `test/data-query/direct/formal-guide.test.ts` |
| `test/cli-interactive-data-query-facade.test.ts` | moved | `test/data-query/direct/interactive-facade.test.ts` |
| `test/cli-options-parsers.test.ts` | moved | `test/data-query/direct/relation-option-parser.test.ts` |
| `test/data-query-duckdb-fixture-generator.test.ts` | moved | `test/data-query/evidence/duckdb-fixtures.test.ts` |
| `test/data-query-fixture-generator.test.ts` | moved | `test/data-query/evidence/tabular-fixtures.test.ts` |
| `test/data-query-header-mapping.test.ts` | moved | `test/data-query/header-mapping.test.ts` |
| `test/cli-interactive-routing-data-query-codex-single.test.ts` | moved | `test/data-query/interactive/codex-single-source.test.ts` |
| `test/cli-interactive-routing-data-query-codex-workspace.test.ts` | moved | `test/data-query/interactive/codex-workspace.test.ts` |
| `test/cli-interactive-routing-data-query-formal.test.ts` | moved | `test/data-query/interactive/formal-guide.test.ts` |
| `test/cli-interactive-routing-data-query-headers.test.ts` | moved | `test/data-query/interactive/header-review.test.ts` |
| `test/cli-interactive-routing-data-query-manual.test.ts` | moved | `test/data-query/interactive/manual.test.ts` |
| `test/helpers/interactive-harness/mocks/data-query/codex.ts` | moved | `test/data-query/interactive/mock-codex.ts` |
| `test/helpers/interactive-harness/mocks/data-query/header-mapping.ts` | moved | `test/data-query/interactive/mock-header-mapping.ts` |
| `test/helpers/interactive-harness/mocks/data-query/workspace.ts` | moved | `test/data-query/interactive/mock-workspace.ts` |
| `test/cli-interactive-routing-data-query-review.test.ts` | moved | `test/data-query/interactive/review-checkpoints.test.ts` |
| `test/cli-interactive-routing-data-query-source-shape.test.ts` | split | `test/data-query/interactive/source-shape.test.ts`<br>`test/data-query/source-introspection.test.ts` |
| `test/cli-interactive-routing-data-query-workspace.test.ts` | moved | `test/data-query/interactive/workspace.test.ts` |
| `test/cli-command-data-codex-timeout.test.ts` | split | `test/data-query/commands/codex-timeout.test.ts`<br>`test/data-stack/commands/codex-timeout.test.ts` |
| `test/cli-command-data-query-codex.test.ts` | split | `test/cli-command-data-query-codex.test.ts`<br>`test/data-query/commands/codex-single-source.test.ts` |
| `test/cli-command-data-query-duckdb-sources.test.ts` | split | `test/cli-command-data-query-duckdb-sources.test.ts`<br>`test/data-query/commands/duckdb-sources.test.ts` |
| `test/cli-command-data-query-source-shape.test.ts` | split | `test/cli-command-data-query-source-shape.test.ts`<br>`test/data-query/commands/source-shape-artifacts.test.ts` |
| `test/cli-command-data-query-validation.test.ts` | split | `test/cli-command-data-query-validation.test.ts`<br>`test/data-query/commands/validation-remediation.test.ts` |
| `test/cli-command-data-query.test.ts` | split | `test/cli-command-data-query.test.ts`<br>`test/data-query/commands/basic-formats.test.ts` |
| `test/cli-ux.test.ts` | split | `test/cli-foundations/commands/root-ux.test.ts`<br>`test/data/commands/help.test.ts`<br>`test/data-conversion/commands/help.test.ts`<br>`test/data-conversion/commands/output-paths.test.ts`<br>`test/data-extract/commands/help-and-input-format.test.ts`<br>`test/data-preview/commands/parquet-ux.test.ts`<br>`test/data-preview/commands/preview-ux.test.ts`<br>`test/data-query/commands/codex-help-and-input-format.test.ts`<br>`test/data-query/commands/help-and-input-format.test.ts`<br>`test/data-stack/commands/help-and-input-format.test.ts`<br>`test/rename/commands/ux.test.ts`<br>`test/video/commands/ux.test.ts` |
| `test/helpers/interactive-harness/mocks/action-data.ts` | split | `test/data-extract/interactive/mock-action.ts`<br>`test/data-query/interactive/mock-action.ts` |
| `test/helpers/interactive-harness/mocks/data-query/index.ts` | split | `test/data-extract/interactive/mock-installation.ts`<br>`test/data-query/interactive/mock-installation.ts` |
| `test/helpers/interactive-harness/mocks/data-query/query.ts` | split | `test/data-extract/interactive/mock-introspection.ts`<br>`test/data-query/interactive/mock-query.ts` |
| `test/helpers/interactive-harness/mocks/data-query/source-shape.ts` | split | `test/data-extract/interactive/mock-source-shape.ts`<br>`test/data-query/interactive/mock-source-shape.ts` |
| `test/helpers/interactive-harness/mocks/data-query/types.ts` | split | `test/cli-foundations/interactive-harness/types.ts`<br>`test/data-extract/interactive/harness-contract.ts`<br>`test/data-query/interactive/harness-contract.ts`<br>`test/data-query/interactive/mock-types.ts`<br>`test/data-sources/interactive/harness-contract.ts`<br>`test/data-stack/interactive/harness-contract.ts`<br>`test/markdown-pdf/interactive/harness-contract.ts`<br>`test/rename/interactive/harness-contract.ts` |
| `test/helpers/interactive-harness/module-urls.ts` | split | `test/cli-foundations/interactive-harness/module-urls.ts`<br>`test/data-query/interactive/module-urls.ts`<br>`test/markdown-pdf/interactive/module-urls.ts` |
| `test/helpers/interactive-harness/types.ts` | split | `test/cli-foundations/interactive-harness/types.ts`<br>`test/data-extract/interactive/harness-contract.ts`<br>`test/data-query/interactive/harness-contract.ts`<br>`test/data-sources/interactive/harness-contract.ts`<br>`test/data-stack/interactive/harness-contract.ts`<br>`test/markdown-pdf/interactive/harness-contract.ts`<br>`test/rename/interactive/harness-contract.ts` |

### Doctor

Change set: `doctor`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/cli-action-doctor.test.ts` | moved | `test/doctor/actions/report-projections.test.ts` |
| `test/cli-actions-doctor-markdown-video-deferred.test.ts` | split | `test/doctor/actions/dependency-integration.test.ts`<br>`test/doctor/actions/report-projections.test.ts`<br>`test/doctor/commands/environment.test.ts`<br>`test/doctor/commands/routing.test.ts`<br>`test/cli-foundations/dependencies/command-inspection.test.ts`<br>`test/cli-markdown-pdf-requirements.test.ts`<br>`test/data-query/actions/duckdb-lifecycle.test.ts`<br>`test/data-query/commands/duckdb-lifecycle.test.ts`<br>`test/markdown-docx/actions/rendering.test.ts`<br>`test/video/actions/preconditions.test.ts` |
| `test/cli-command-doctor.test.ts` | moved | `test/doctor/commands/routing.test.ts` |
| `test/cli-doctor-workflow.test.ts` | moved | `test/doctor/workflow-projection.test.ts` |
| `test/helpers/doctor-test-fixtures.ts` | moved | `test/doctor/fixtures.ts` |
| `test/cli-interactive-menu.test.ts` | split | `test/cli-foundations/interactive/menu-wiring.test.ts`<br>`test/doctor/actions/report-projections.test.ts`<br>`test/doctor/interactive/menu-routing.test.ts`<br>`test/doctor/interactive/routing.test.ts` |
| `test/cli-interactive-routing.test.ts` | split | `test/data/interactive/menu-routing.test.ts`<br>`test/data/interactive/unknown-action.test.ts`<br>`test/doctor/interactive/routing.test.ts`<br>`test/markdown/interactive/menu-routing.test.ts`<br>`test/markdown-pdf/interactive/entry-routing.test.ts`<br>`test/markdown-frontmatter/interactive/routing.test.ts`<br>`test/markdown-docx/interactive/routing.test.ts`<br>`test/rename/interactive/routing.test.ts`<br>`test/video/interactive/routing.test.ts` |
| `test/helpers/interactive-harness/mocks/action-misc.ts` | split | `test/data-conversion/interactive/mock-action.ts`<br>`test/data-preview/interactive/mock-action.ts`<br>`test/doctor/interactive/mock-action.ts`<br>`test/markdown-docx/interactive/mock-action.ts`<br>`test/markdown-frontmatter/interactive/mock-action.ts`<br>`test/video/interactive/mock-action.ts` |

### Markdown PDF Pilot

Change set: `markdown-pdf-pilot`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/cli-actions-md-to-pdf-bundle.test.ts` | split | `test/markdown-pdf/actions/bundle-discovery.test.ts`<br>`test/markdown-pdf/actions/bundle-resolution.test.ts`<br>`test/markdown-pdf/actions/bundle-integration.test.ts` |
| `test/cli-interactive-markdown-pdf/font-hints.test.ts` | split | `test/markdown-pdf/interactive/font-model.test.ts`<br>`test/markdown-pdf/interactive/font-suggestion-service.test.ts`<br>`test/markdown-pdf/interactive/font-post-codex-review.test.ts` |

### Markdown PDF General

Change set: `markdown-pdf-general`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/cli-actions-md-to-pdf-actions-validation.test.ts` | moved | `test/markdown-pdf/actions/rendering-validation.test.ts` |
| `test/cli-actions-md-to-pdf-actions.test.ts` | split | `test/markdown-pdf/actions/rendering-code-highlighting.test.ts`<br>`test/markdown-pdf/actions/rendering-composition.test.ts`<br>`test/markdown-pdf/actions/rendering/core.app.test.ts`<br>`test/markdown-pdf/actions/rendering-requirements.test.ts`<br>`test/markdown-pdf/actions/rendering-template-asset-safety.test.ts`<br>`test/markdown-pdf/actions/rendering-write-lifecycle.test.ts` |
| `test/cli-actions-md-to-pdf-commands/direct-render.test.ts` | moved | `test/markdown-pdf/commands/direct-render.test.ts` |
| `test/cli-actions-md-to-pdf-diagnostics.test.ts` | moved | `test/markdown-pdf/actions/rendering-diagnostics.test.ts` |
| `test/cli-actions-md-to-pdf-no-default-css.test.ts` | moved | `test/markdown-pdf/actions/rendering-custom-css-page-numbers.test.ts` |
| `test/cli-actions-md-to-pdf-page-chrome.test.ts` | split | `test/markdown-pdf/direct/page-chrome-area-styling.test.ts`<br>`test/markdown-pdf/direct/page-chrome-sequence-visibility.test.ts` |
| `test/cli-actions-md-to-pdf-recipe-fonts.test.ts` | split | `test/markdown-pdf/actions/recipe-font-check.test.ts`<br>`test/markdown-pdf/actions/recipe-font-generation.test.ts` |
| `test/cli-markdown-pdf-renderer-capabilities.test.ts` | split | `test/markdown-pdf/actions/rendering-renderer-capability-gate.test.ts`<br>`test/markdown-pdf/direct/renderer-capabilities-matrix.test.ts` |
| `test/markdown-pdf-page-number-project-renderer-contract.test.ts` | moved | `test/markdown-pdf/evidence/page-number-project-renderer-contract.test.ts` |
| `test/markdown-pdf-page-number-renderer-evidence/orchestration.test.ts` | moved | `test/markdown-pdf/evidence/page-number-orchestration.test.ts` |
| `test/cli-actions-md-to-pdf.helpers.ts` | moved | `test/markdown-pdf/actions/render-support.ts` |
| `test/cli-actions-md-to-pdf-commands/fixtures.ts` | moved | `test/markdown-pdf/commands/fixtures.ts` |
| `test/markdown-pdf-page-number-renderer-evidence/support.ts` | moved | `test/markdown-pdf/evidence/page-number-support.ts` |
| `test/cli-actions-md-to-pdf-template-codex/fixtures.ts` | split | `test/markdown-pdf/actions/template-codex-fixtures.ts`<br>`test/markdown-pdf/support/path-fixtures.ts` |

### Markdown PDF Template

Change set: `markdown-pdf-template`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/adapters-codex-markdown-pdf-template/repair-timeout.test.ts` | moved | `test/markdown-pdf/adapters/template-repair-timeout.test.ts` |
| `test/cli-actions-md-to-pdf-commands/template.test.ts` | split | `test/markdown-pdf/commands/template-codex.test.ts`<br>`test/markdown-pdf/commands/template-init.test.ts` |
| `test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts` | moved | `test/markdown-pdf/actions/template-codex-integration.test.ts` |
| `test/cli-actions-md-to-pdf-template-codex/action.test.ts` | moved | `test/markdown-pdf/actions/template-codex-action.test.ts` |
| `test/cli-actions-md-to-pdf-template-codex/prepared.test.ts` | moved | `test/markdown-pdf/actions/template-codex-prepared.test.ts` |
| `test/adapters-codex-markdown-pdf-template/fixtures.ts` | moved | `test/markdown-pdf/adapters/template-codex-fixtures.ts` |
| `test/cli-actions-md-to-pdf-template-codex/fixtures.ts` | moved | `test/markdown-pdf/actions/template-codex-fixtures.ts` |
| `test/cli-actions-md-to-pdf-template-codex/synthesis-fixtures.ts` | moved | `test/markdown-pdf/actions/template-synthesis-fixtures.ts` |

### Markdown PDF Profile

Change set: `markdown-pdf-profile`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/cli-actions-md-to-pdf-actions-profile-rendering.test.ts` | moved | `test/markdown-pdf/actions/rendering-profile-rendering.test.ts` |
| `test/cli-actions-md-to-pdf-commands/profile.test.ts` | split | `test/markdown-pdf/commands/profile-codex.test.ts`<br>`test/markdown-pdf/commands/profile-init.test.ts` |
| `test/cli-actions-md-to-pdf-profile-codex-action/request-progress.test.ts` | split | `test/markdown-pdf/actions/profile-codex-request-lifecycle.test.ts`<br>`test/markdown-pdf/actions/profile-codex-progress.test.ts` |
| `test/cli-actions-md-to-pdf-profile-codex-phase2.test.ts` | split | `test/markdown-pdf/actions/profile-codex-candidates.test.ts`<br>`test/markdown-pdf/actions/profile-codex-signals.test.ts` |
| `test/cli-actions-md-to-pdf-profile-codex-action/fixtures.ts` | moved | `test/markdown-pdf/actions/profile-codex-fixtures.ts` |

### Markdown PDF Project

Change set: `markdown-pdf-project`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/cli-actions-md-to-pdf-commands/project.test.ts` | moved | `test/markdown-pdf/commands/project-codex.test.ts` |
| `test/cli-actions-md-to-pdf-project-codex/output-plan.test.ts` | moved | `test/markdown-pdf/actions/project-codex-output-plan.test.ts` |
| `test/cli-actions-md-to-pdf-project-codex/prepared.test.ts` | split | `test/markdown-pdf/actions/project-codex-prepared-handoff.test.ts`<br>`test/markdown-pdf/actions/project-codex-prepared-request-lifecycle.test.ts`<br>`test/markdown-pdf/actions/project-codex-prepared-fixtures.ts` |
| `test/cli-actions-md-to-pdf-project-codex/validation.test.ts` | moved | `test/markdown-pdf/actions/project-codex-validation.test.ts` |
| `test/cli-actions-md-to-pdf-project-codex/action-write/fixtures.ts` | moved | `test/markdown-pdf/actions/project-codex-action-write-fixtures.ts` |

### Markdown PDF Interactive And Support

Change set: `markdown-pdf-interactive`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/cli-interactive-markdown-pdf/codex-authoring/output-recovery-lifecycle.test.ts` | moved | `test/markdown-pdf/interactive/codex-authoring-output-recovery-lifecycle.test.ts` |
| `test/cli-interactive-markdown-pdf/codex-authoring/project-handoff.test.ts` | moved | `test/markdown-pdf/interactive/codex-authoring-project-handoff.test.ts` |
| `test/cli-interactive-markdown-pdf/deterministic-authoring.test.ts` | moved | `test/markdown-pdf/interactive/deterministic-authoring.test.ts` |
| `test/cli-interactive-markdown-pdf/formal-guide.test.ts` | split | `test/markdown-pdf/interactive/formal-guide-answers.test.ts`<br>`test/markdown-pdf/interactive/formal-guide-compilation.test.ts`<br>`test/markdown-pdf/interactive/formal-guide-fixtures.ts` |
| `test/cli-interactive-markdown-pdf/handoff.test.ts` | moved | `test/markdown-pdf/interactive/saved-recipe-handoff.test.ts` |
| `test/cli-interactive-markdown-pdf/lifecycle.test.ts` | moved | `test/markdown-pdf/interactive/generated-lifecycle.test.ts` |
| `test/cli-interactive-markdown-pdf/render-sources.test.ts` | moved | `test/markdown-pdf/interactive/render-sources.test.ts` |
| `test/helpers/interactive-harness/module-urls.ts` | split | `test/cli-foundations/interactive-harness/module-urls.ts`<br>`test/data-query/interactive/module-urls.ts`<br>`test/markdown-pdf/interactive/module-urls.ts` |
| `test/helpers/interactive-harness/mocks/markdown-pdf.ts` | moved | `test/markdown-pdf/interactive/mock-action.ts` |
| `test/cli-interactive-markdown-pdf/codex-authoring/fixtures.ts` | moved | `test/markdown-pdf/interactive/codex-authoring-fixtures.ts` |

### Release Tooling

Change set: `release-tooling`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/release-scripts.test.ts` | split | `test/release-tooling/branch-filter.test.ts`<br>`test/release-tooling/stable-notes.test.ts`<br>`test/release-tooling/fixtures.ts` |
| `test/version-embedded-sync.test.ts` | moved | `test/release-tooling/version-sync.test.ts` |

### Markdown Frontmatter

Change set: `markdown-frontmatter`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/cli-actions-md-frontmatter-to-json.test.ts` | split | `test/markdown-frontmatter/actions/frontmatter-to-json.test.ts`<br>`test/markdown-frontmatter/commands/frontmatter-to-json.test.ts` |
| `test/helpers/interactive-harness/mocks/action-misc.ts` | split | `test/data-conversion/interactive/mock-action.ts`<br>`test/data-preview/interactive/mock-action.ts`<br>`test/doctor/interactive/mock-action.ts`<br>`test/markdown-docx/interactive/mock-action.ts`<br>`test/markdown-frontmatter/interactive/mock-action.ts`<br>`test/video/interactive/mock-action.ts` |

### Video

Change set: `video`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/cli-actions-video-gif.test.ts` | moved | `test/video/actions/gif.test.ts` |
| `test/cli-interactive-routing-video.test.ts` | moved | `test/video/interactive/gif.test.ts` |
| `test/helpers/interactive-harness/mocks/action-misc.ts` | split | `test/data-conversion/interactive/mock-action.ts`<br>`test/data-preview/interactive/mock-action.ts`<br>`test/doctor/interactive/mock-action.ts`<br>`test/markdown-docx/interactive/mock-action.ts`<br>`test/markdown-frontmatter/interactive/mock-action.ts`<br>`test/video/interactive/mock-action.ts` |

### Data Sources

Change set: `data-sources`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/data-duckdb-extensions.test.ts` | moved | `test/data-sources/adapters/duckdb-extensions.test.ts` |
| `test/data-extract-fixture-generator.test.ts` | moved | `test/data-sources/evidence/tabular-fixtures.test.ts` |
| `test/data-query-xlsx-sources.test.ts` | moved | `test/data-sources/adapters/xlsx-sources.test.ts` |
| `test/data-source-shape.test.ts` | moved | `test/data-sources/direct/source-shape.test.ts` |
| `test/stacked-merged-band-fixture-generator.test.ts` | moved | `test/data-sources/evidence/stacked-merged-band-fixture.test.ts` |
| `test/helpers/data-extract-fixture-test-utils.ts` | moved | `test/data-sources/fixtures/tabular.ts` |
| `test/helpers/data-query-duckdb-fixture-test-utils.ts` | moved | `test/data-sources/fixtures/duckdb.ts` |
| `test/helpers/stacked-merged-band-fixture-test-utils.ts` | moved | `test/data-sources/fixtures/stacked-merged-band.ts` |
| `test/fixtures/data-query/basic.csv` | moved | `test/data-sources/fixtures/basic.csv` |
| `test/fixtures/data-query/basic.parquet` | moved | `test/data-sources/fixtures/basic.parquet` |
| `test/fixtures/data-query/basic.tsv` | moved | `test/data-sources/fixtures/basic.tsv` |
| `test/fixtures/data-query/large.csv` | moved | `test/data-sources/fixtures/large.csv` |
| `test/fixtures/data-query/large.parquet` | moved | `test/data-sources/fixtures/large.parquet` |
| `test/fixtures/data-query/multi.sqlite` | moved | `test/data-sources/fixtures/multi.sqlite` |
| `test/fixtures/data-query/multi.xlsx` | moved | `test/data-sources/fixtures/multi.xlsx` |

### Data Extract

Change set: `data-extract`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/cli-actions-data-extract-review.test.ts` | moved | `test/data-extract/actions/header-mapping-review.test.ts` |
| `test/cli-actions-data-extract-source-shape-reuse.test.ts` | moved | `test/data-extract/actions/source-shape-reuse.test.ts` |
| `test/cli-actions-data-extract-source-shape-review.test.ts` | moved | `test/data-extract/actions/source-shape-review.test.ts` |
| `test/cli-actions-data-extract-sources.test.ts` | moved | `test/data-extract/actions/source-selection.test.ts` |
| `test/cli-actions-data-extract-validation.test.ts` | moved | `test/data-extract/actions/validation.test.ts` |
| `test/cli-actions-data-extract.test.ts` | moved | `test/data-extract/actions/materialization.test.ts` |
| `test/cli-command-data-extract-review.test.ts` | moved | `test/data-extract/commands/header-mapping-review.test.ts` |
| `test/cli-command-data-extract-shape.test.ts` | moved | `test/data-extract/commands/excel-shape.test.ts` |
| `test/cli-command-data-extract-source-shape.test.ts` | moved | `test/data-extract/commands/source-shape-review.test.ts` |
| `test/cli-command-data-extract.test.ts` | moved | `test/data-extract/commands/basic-sources.test.ts` |
| `test/cli-interactive-routing-data-extract-checkpoints.test.ts` | moved | `test/data-extract/interactive/checkpoints.test.ts` |
| `test/cli-interactive-routing-data-extract-core.test.ts` | moved | `test/data-extract/interactive/core.test.ts` |
| `test/cli-interactive-routing-data-extract-revision.test.ts` | moved | `test/data-extract/interactive/revision.test.ts` |
| `test/cli-actions-data-extract.helpers.ts` | moved | `test/data-extract/actions/support.ts` |
| `test/cli-command-data-extract.helpers.ts` | moved | `test/data-extract/commands/support.ts` |
| `test/helpers/interactive-harness/mocks/action-data.ts` | split | `test/data-query/interactive/mock-action.ts`<br>`test/data-extract/interactive/mock-action.ts` |
| `test/helpers/interactive-harness/mocks/data-query/index.ts` | split | `test/data-query/interactive/mock-installation.ts`<br>`test/data-extract/interactive/mock-installation.ts` |
| `test/helpers/interactive-harness/mocks/data-query/query.ts` | split | `test/data-query/interactive/mock-query.ts`<br>`test/data-extract/interactive/mock-introspection.ts` |
| `test/helpers/interactive-harness/mocks/data-query/source-shape.ts` | split | `test/data-query/interactive/mock-source-shape.ts`<br>`test/data-extract/interactive/mock-source-shape.ts` |
| `test/helpers/interactive-harness/mocks/data-query/types.ts` | split | `test/data-query/interactive/mock-types.ts`<br>`test/cli-foundations/interactive-harness/types.ts`<br>`test/data-extract/interactive/harness-contract.ts`<br>`test/data-query/interactive/harness-contract.ts`<br>`test/data-sources/interactive/harness-contract.ts`<br>`test/data-stack/interactive/harness-contract.ts`<br>`test/markdown-pdf/interactive/harness-contract.ts`<br>`test/rename/interactive/harness-contract.ts` |
| `test/helpers/interactive-harness/types.ts` | split | `test/cli-foundations/interactive-harness/types.ts`<br>`test/data-extract/interactive/harness-contract.ts`<br>`test/data-query/interactive/harness-contract.ts`<br>`test/data-sources/interactive/harness-contract.ts`<br>`test/data-stack/interactive/harness-contract.ts`<br>`test/markdown-pdf/interactive/harness-contract.ts`<br>`test/rename/interactive/harness-contract.ts` |
| `test/data-query/interactive/module-urls.ts` | split | `test/data-query/interactive/module-urls.ts`<br>`test/data-extract/interactive/module-urls.ts` |

### Data Preview

Change set: `data-preview`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/cli-actions-data-parquet-preview.test.ts` | moved | `test/data-preview/actions/parquet.test.ts` |
| `test/cli-actions-data-preview/failures.test.ts` | moved | `test/data-preview/actions/failures.test.ts` |
| `test/cli-actions-data-preview/highlighting.test.ts` | moved | `test/data-preview/actions/highlighting.test.ts` |
| `test/cli-actions-data-preview/rendering.test.ts` | moved | `test/data-preview/actions/rendering.test.ts` |
| `test/cli-interactive-routing-data-preview-filters.test.ts` | moved | `test/data-preview/interactive/filters.test.ts` |
| `test/cli-interactive-routing-data-preview.test.ts` | moved | `test/data-preview/interactive/routing.test.ts` |
| `test/cli-actions-data-preview/helpers.ts` | split | `test/data-preview/actions/support.ts`<br>`test/helpers/ansi.ts` |
| Data Preview behavior in `test/helpers/interactive-harness/mocks/action-misc.ts` | split | `test/data-conversion/interactive/mock-action.ts`<br>`test/data-preview/interactive/mock-action.ts`<br>`test/doctor/interactive/mock-action.ts`<br>`test/markdown-docx/interactive/mock-action.ts`<br>`test/markdown-frontmatter/interactive/mock-action.ts`<br>`test/video/interactive/mock-action.ts` |
| `stripAnsi` in `test/cli-interactive-routing.helpers.ts` | split | `test/cli-foundations/interactive-harness/index.ts`<br>`test/data-stack/interactive/support.ts`<br>`test/helpers/ansi.ts`<br>`test/helpers/cli-test-utils.ts` |

### Data Stack

Change set: `data-stack`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/cli-actions-data-stack/codex-assist.test.ts` | moved | `test/data-stack/actions/codex-assist.test.ts` |
| `test/cli-actions-data-stack/dry-run-plan.test.ts` | moved | `test/data-stack/actions/dry-run-plan.test.ts` |
| `test/cli-actions-data-stack/happy-paths.test.ts` | moved | `test/data-stack/actions/materialization.test.ts` |
| `test/cli-actions-data-stack/schema-modes.test.ts` | moved | `test/data-stack/actions/schema-modes.test.ts` |
| `test/cli-actions-data-stack/validation.test.ts` | moved | `test/data-stack/actions/validation.test.ts` |
| `test/cli-command-data-stack/direct-stack.test.ts` | moved | `test/data-stack/commands/direct-stack.test.ts` |
| `test/cli-command-data-stack/options.test.ts` | split | `test/data-stack/commands/options.test.ts`<br>`test/data-stack/direct/reporting.test.ts` |
| `test/cli-command-data-stack/replay.test.ts` | moved | `test/data-stack/commands/replay.test.ts` |
| `test/cli-interactive-data-stack/codex-review.test.ts` | moved | `test/data-stack/interactive/codex-review.test.ts` |
| `test/cli-interactive-data-stack/discovery.test.ts` | moved | `test/data-stack/interactive/discovery.test.ts` |
| `test/cli-interactive-data-stack/dry-run-write.test.ts` | moved | `test/data-stack/interactive/dry-run-write.test.ts` |
| `test/cli-interactive-routing-data-stack.test.ts` | moved | `test/data-stack/interactive/routing.test.ts` |
| `test/data-stack-artifact-paths.test.ts` | moved | `test/data-stack/direct/artifact-paths.test.ts` |
| `test/data-stack-codex-report/apply.test.ts` | moved | `test/data-stack/direct/codex-report/apply.test.ts` |
| `test/data-stack-codex-report/validation.test.ts` | moved | `test/data-stack/direct/codex-report/validation.test.ts` |
| `test/data-stack-codex-signals.test.ts` | moved | `test/data-stack/direct/codex-signals.test.ts` |
| `test/data-stack-diagnostics.test.ts` | moved | `test/data-stack/direct/diagnostics.test.ts` |
| `test/data-stack-input-router.test.ts` | moved | `test/data-stack/direct/input-router.test.ts` |
| `test/data-stack-plan/identity-serialization.test.ts` | moved | `test/data-stack/direct/plan/identity-serialization.test.ts` |
| `test/data-stack-plan/parse-io.test.ts` | moved | `test/data-stack/direct/plan/parse-io.test.ts` |
| `test/data-stack-fixture-generator.test.ts` | moved | `test/data-stack/evidence/fixture-generator.test.ts` |
| `test/helpers/data-stack-test-utils.ts` | moved | `test/data-stack/direct/support.ts` |
| `test/cli-interactive-data-stack/helpers.ts` | moved | `test/data-stack/interactive/support.ts` |
| `test/helpers/interactive-harness/mocks/action-stack.ts` | moved | `test/data-stack/interactive/mock-action.ts` |
| Data Stack fields in `test/helpers/interactive-harness/types.ts` | split | `test/cli-foundations/interactive-harness/types.ts`<br>`test/data-extract/interactive/harness-contract.ts`<br>`test/data-query/interactive/harness-contract.ts`<br>`test/data-sources/interactive/harness-contract.ts`<br>`test/data-stack/interactive/harness-contract.ts`<br>`test/markdown-pdf/interactive/harness-contract.ts`<br>`test/rename/interactive/harness-contract.ts` |
| Data Stack matcher in `test/cli-interactive-routing.helpers.ts` | split | `test/cli-foundations/interactive-harness/index.ts`<br>`test/data-stack/interactive/support.ts`<br>`test/helpers/ansi.ts`<br>`test/helpers/cli-test-utils.ts` |

### Data Conversion

Change set: `data-conversion`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/cli-actions-data.test.ts` | moved | `test/data-conversion/actions/formats.test.ts` |
| `test/cli-interactive-routing-data-convert.test.ts` | moved | `test/data-conversion/interactive/routing.test.ts` |
| Data Conversion behavior in `test/helpers/interactive-harness/mocks/action-misc.ts` | split | `test/data-conversion/interactive/mock-action.ts`<br>`test/data-preview/interactive/mock-action.ts`<br>`test/doctor/interactive/mock-action.ts`<br>`test/markdown-docx/interactive/mock-action.ts`<br>`test/markdown-frontmatter/interactive/mock-action.ts`<br>`test/video/interactive/mock-action.ts` |

### Fonts

Change set: `fonts`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/fonts-cli-check-output.test.ts` | split | `test/fonts/actions/check-text-output.test.ts`<br>`test/fonts/actions/check-diagnostics.test.ts` |
| `test/fonts-cli-check-provider.test.ts` | moved | `test/fonts/actions/check-provider-mapping.test.ts` |
| `test/fonts-cli-check-selection.test.ts` | moved | `test/fonts/actions/check-selection.test.ts` |
| `test/fonts-cli-check-ttc.test.ts` | moved | `test/fonts/actions/check-ttc.test.ts` |
| `test/fonts-cli-check-validation.test.ts` | moved | `test/fonts/actions/check-validation.test.ts` |
| `test/fonts-cli-inspect-debug.test.ts` | moved | `test/fonts/actions/inspect-debug.test.ts` |
| `test/fonts-cli-inspect-matching.test.ts` | split | `test/fonts/actions/inspect-matching.test.ts`<br>`test/fonts/actions/inspect-output.test.ts` |
| `test/fonts-cli-inspect-output.test.ts` | moved | `test/fonts/actions/inspect-output.test.ts` |
| `test/fonts-cli-inspect-validation.test.ts` | moved | `test/fonts/actions/inspect-validation.test.ts` |
| `test/fonts-cli-list.test.ts` | moved | `test/fonts/actions/list.test.ts` |
| `test/fonts-cli-registration.test.ts` | moved | `test/fonts/commands/registration.test.ts` |
| `test/fonts-coverage-fontconfig.test.ts` | moved | `test/fonts/adapters/coverage-fontconfig.test.ts` |
| `test/fonts-coverage-ttc-inconclusive.test.ts` | moved | `test/fonts/adapters/coverage-ttc-inconclusive.test.ts` |
| `test/fonts-coverage-ttc.test.ts` | moved | `test/fonts/adapters/coverage-ttc.test.ts` |
| `test/fonts-discovery-cancellation.test.ts` | moved | `test/fonts/adapters/discovery-cancellation.test.ts` |
| `test/fonts-discovery-parsers.test.ts` | moved | `test/fonts/adapters/discovery-parsers.test.ts` |
| `test/fonts-discovery.test.ts` | moved | `test/fonts/adapters/discovery.test.ts` |
| `test/fonts-coverage-samples.test.ts` | moved | `test/fonts/direct/coverage-samples.test.ts` |
| `test/fonts-matching.test.ts` | moved | `test/fonts/direct/matching.test.ts` |
| `test/fonts-search-ranking.test.ts` | moved | `test/fonts/direct/search-ranking.test.ts` |
| `test/fonts-search-records.test.ts` | moved | `test/fonts/direct/search-records.test.ts` |

### Rename

Change set: `rename`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/adapters-codex-rename-timeout.test.ts` | split | `test/rename/adapters/image-title-suggester.test.ts`<br>`test/rename/adapters/document-title-suggester.test.ts`<br>`test/rename/adapters/title-suggester-support.ts` |
| `test/cli-actions-rename-apply-replay.test.ts` | moved | `test/rename/actions/apply-replay.test.ts` |
| `test/cli-actions-rename-apply-validation.test.ts` | moved | `test/rename/actions/apply-validation.test.ts` |
| `test/cli-actions-rename-batch-codex-auto.test.ts` | moved | `test/rename/actions/batch-codex-auto.test.ts` |
| `test/cli-actions-rename-batch-codex-docs.test.ts` | moved | `test/rename/actions/batch-codex-docs.test.ts` |
| `test/cli-actions-rename-batch-codex-images.test.ts` | moved | `test/rename/actions/batch-codex-images.test.ts` |
| `test/cli-actions-rename-batch-core.test.ts` | moved | `test/rename/actions/batch-core.test.ts` |
| `test/cli-actions-rename-batch-filters.test.ts` | moved | `test/rename/actions/batch-filters.test.ts` |
| `test/cli-actions-rename-batch-preview.test.ts` | moved | `test/rename/actions/batch-preview.test.ts` |
| `test/cli-actions-rename-batch-recursion.test.ts` | moved | `test/rename/actions/batch-recursion.test.ts` |
| `test/cli-actions-rename-cleanup-analysis-report.test.ts` | moved | `test/rename/actions/cleanup-analysis-report.test.ts` |
| `test/cli-actions-rename-cleanup-analyzer.test.ts` | moved | `test/rename/actions/cleanup-analyzer.test.ts` |
| `test/cli-actions-rename-cleanup-codex.test.ts` | moved | `test/rename/adapters/cleanup-suggester.test.ts` |
| `test/cli-actions-rename-cleanup-directory.test.ts` | moved | `test/rename/actions/cleanup-directory.test.ts` |
| `test/cli-actions-rename-cleanup-matchers.test.ts` | moved | `test/rename/direct/cleanup-matchers.test.ts` |
| `test/cli-actions-rename-cleanup-single.test.ts` | moved | `test/rename/actions/cleanup-single.test.ts` |
| `test/cli-actions-rename-cleanup-uid.test.ts` | moved | `test/rename/direct/cleanup-uid.test.ts` |
| `test/cli-actions-rename-cleanup-validation.test.ts` | moved | `test/rename/actions/cleanup-validation.test.ts` |
| `test/cli-actions-rename-codex-internals.test.ts` | split | `test/rename/presentation/analyzer-progress.test.ts`<br>`test/rename/codex/candidate-selection.test.ts` |
| `test/cli-actions-rename-file.test.ts` | split | `test/rename/actions/file-core.test.ts`<br>`test/rename/actions/file-codex-images.test.ts`<br>`test/rename/actions/file-codex-auto.test.ts`<br>`test/rename/actions/file-codex-docs.test.ts`<br>`test/rename/actions/file-support.ts` |
| `test/cli-actions-rename-timestamp.test.ts` | moved | `test/rename/actions/timestamp.test.ts` |
| `test/cli-command-rename-cleanup.test.ts` | moved | `test/rename/commands/cleanup.test.ts` |
| `test/cli-command-rename-timeout.test.ts` | moved | `test/rename/commands/codex-timeout.test.ts` |
| `test/cli-fs-utils-rename-template.test.ts` | split | `test/rename/planner/serial-ordering.test.ts`<br>`test/rename/planner/template-rendering.test.ts`<br>`test/rename/planner/collision-and-source-lifecycle.test.ts` |
| `test/cli-interactive-rename-cleanup-analyzer-rendering.test.ts` | moved | `test/rename/interactive/cleanup-analyzer-rendering.test.ts` |
| `test/cli-interactive-rename-cleanup-analyzer-review.test.ts` | moved | `test/rename/interactive/cleanup-analyzer-review.test.ts` |
| `test/cli-interactive-rename-cleanup-codex-timestamp.test.ts` | moved | `test/rename/interactive/cleanup-codex-timestamp.test.ts` |
| `test/cli-interactive-rename-cleanup-codex.test.ts` | moved | `test/rename/interactive/cleanup-codex.test.ts` |
| `test/cli-interactive-rename-cleanup-retention.test.ts` | moved | `test/rename/interactive/cleanup-retention.test.ts` |
| `test/cli-interactive-rename-cleanup.test.ts` | moved | `test/rename/interactive/cleanup.test.ts` |
| `test/cli-interactive-rename.test.ts` | moved | `test/rename/interactive/session-options.test.ts` |
| `test/cli-rename-interactive-router.test.ts` | moved | `test/rename/direct/interactive-router.test.ts` |
| `test/cli-rename-preview.test.ts` | moved | `test/rename/presentation/preview-composition.test.ts` |
| `test/cli-rename-template.test.ts` | moved | `test/rename/direct/template.test.ts` |
| `test/helpers/rename-apply-test-utils.ts` | moved | `test/rename/actions/apply-validation-support.ts` |
| `test/helpers/rename-plan-test-utils.ts` | moved | `test/rename/support/plan-artifacts.ts` |
| `test/helpers/interactive-harness/mocks/action-rename.ts` | moved | `test/rename/interactive/mock-action.ts` |
| Rename fields in `test/helpers/interactive-harness/types.ts` | split | `test/cli-foundations/interactive-harness/types.ts`<br>`test/data-extract/interactive/harness-contract.ts`<br>`test/data-query/interactive/harness-contract.ts`<br>`test/data-sources/interactive/harness-contract.ts`<br>`test/data-stack/interactive/harness-contract.ts`<br>`test/markdown-pdf/interactive/harness-contract.ts`<br>`test/rename/interactive/harness-contract.ts` |

### Codex Adapter Platform

Change set: `codex-adapters`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/adapters-codex-failure.test.ts` | moved | `test/codex-adapters/direct/request-failure.test.ts` |
| `test/adapters-codex-shared.test.ts` | split | `test/codex-adapters/direct/filename-title-primitives.test.ts`<br>`test/codex-adapters/direct/batch-retry-failures.test.ts`<br>`test/codex-adapters/direct/prompt-only-workspace.test.ts` |

### Document Rename

Change set: `document-rename`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/adapters-codex-document-rename-titles.test.ts` | moved | `test/document-rename/adapters/title-evidence.test.ts` |

### Markdown DOCX

Change set: `markdown-docx`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/adapters-docx-ooxml-metadata.test.ts` | moved | `test/markdown-docx/adapters/ooxml-metadata.test.ts` |
| Markdown DOCX behavior in `test/helpers/interactive-harness/mocks/action-misc.ts` | moved | `test/markdown-docx/interactive/mock-action.ts` |

### Markdown Platform

Change set: `markdown`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/cli-command-markdown-codex-timeout.test.ts` | moved | `test/markdown/commands/codex-timeout.test.ts` |

### Utilities

Change set: `utilities`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/utils-datetime.test.ts` | moved | `test/utils/datetime.test.ts` |

### CLI Foundations And Mixed-Root Cleanup

Change set: `cli-foundations`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/cli-color.test.ts` | moved | `test/cli-foundations/color/controls.test.ts` |
| `test/cli-command-interactive-timeout.test.ts` | moved | `test/cli-foundations/commands/interactive-timeout.test.ts` |
| `test/cli-command-output-color.test.ts` | moved | `test/cli-foundations/color/commander-output.test.ts` |
| `test/cli-diagnostic-color.test.ts` | moved | `test/cli-foundations/color/diagnostic-labels.test.ts` |
| `test/cli-interactive-analyzer-status.test.ts` | moved | `test/cli-foundations/interactive/analyzer-status.test.ts` |
| `test/cli-interactive-contextual-tip.test.ts` | moved | `test/cli-foundations/interactive/contextual-tip.test.ts` |
| `test/cli-interactive-menu-prompt.test.ts` | split | `test/cli-foundations/interactive/menu-prompt.test.ts`<br>`test/cli-foundations/interactive/real-select-search-fixture.ts` |
| Residual in `test/cli-interactive-menu.test.ts` after the Doctor migration | moved | `test/cli-foundations/interactive/menu-wiring.test.ts` |
| `test/cli-interactive-notice.test.ts` | moved | `test/cli-foundations/interactive/notice.test.ts` |
| Residual in `test/cli-interactive-routing.test.ts` after the Doctor migration | split | `test/data/interactive/menu-routing.test.ts`<br>`test/markdown/interactive/menu-routing.test.ts`<br>`test/markdown-pdf/interactive/entry-routing.test.ts`<br>`test/markdown-frontmatter/interactive/routing.test.ts`<br>`test/markdown-docx/interactive/routing.test.ts`<br>`test/rename/interactive/routing.test.ts`<br>`test/video/interactive/routing.test.ts`<br>`test/data/interactive/unknown-action.test.ts` |
| `test/cli-options-codex-timeout.test.ts` | moved | `test/cli-foundations/options/codex-timeout.test.ts` |
| `test/cli-path-inline-state.test.ts` | moved | `test/cli-foundations/path-prompts/interaction-state.test.ts` |
| `test/cli-path-inline.test.ts` | moved | `test/cli-foundations/path-prompts/inline-controller.test.ts` |
| `test/cli-path-sibling-preview.test.ts` | moved | `test/cli-foundations/path-prompts/sibling-preview.test.ts` |
| `test/cli-path-suggestions.test.ts` | moved | `test/cli-foundations/path-prompts/suggestions.test.ts` |
| `test/cli-path.test.ts` | moved | `test/cli-foundations/path-prompts/fallback.test.ts` |
| `test/cli-text-display-width.test.ts` | moved | `test/cli-foundations/inline-rendering/display-width.test.ts` |
| `test/cli-text-inline.test.ts` | split | `test/cli-foundations/text-inline/completion-controller.test.ts`<br>`test/cli-foundations/text-inline/terminal-controller.test.ts`<br>`test/cli-foundations/text-inline/fallback.test.ts`<br>`test/cli-foundations/text-inline/prompt-fixtures.ts` |
| `test/cli-text-template-candidates.test.ts` | moved | `test/cli-foundations/text-inline/template-candidates.test.ts` |
| `test/cli-tui-inline-renderer.test.ts` | moved | `test/cli-foundations/inline-rendering/renderer.test.ts` |
| `test/cli-tui-keys.test.ts` | moved | `test/cli-foundations/tui/keys.test.ts` |
| `test/cli-tui-raw-session.test.ts` | moved | `test/cli-foundations/tui/raw-session.test.ts` |
| `test/cli-tui-screen.test.ts` | moved | `test/cli-foundations/inline-rendering/screen.test.ts` |
| Residual in `test/cli-ux.test.ts` after the Data Query migration | split | `test/cli-foundations/commands/root-ux.test.ts`<br>`test/data-conversion/commands/output-paths.test.ts`<br>`test/data-preview/commands/preview-ux.test.ts`<br>`test/data-preview/commands/parquet-ux.test.ts`<br>`test/data/commands/help.test.ts`<br>`test/data-conversion/commands/help.test.ts`<br>`test/data-extract/commands/help-and-input-format.test.ts`<br>`test/data-stack/commands/help-and-input-format.test.ts`<br>`test/rename/commands/ux.test.ts`<br>`test/video/commands/ux.test.ts` |
| `test/helpers/virtual-terminal.ts` | moved | `test/cli-foundations/inline-rendering/virtual-terminal.ts` |

### Shared Support And Root Cleanup

Change set: `support-and-root-cleanup`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| Markdown PDF fields in `test/helpers/interactive-harness/types.ts` | split | `test/markdown-pdf/interactive/harness-contract.ts`<br>`test/cli-foundations/interactive-harness/types.ts` |
| Shared Data Sources fields and source-shape options in `test/helpers/interactive-harness/types.ts` | moved | `test/data-sources/interactive/harness-contract.ts` |
| Data Stack hooks in `test/helpers/interactive-harness/context.ts` | split | `test/data-stack/interactive/harness-contract.ts`<br>`test/data-stack/interactive/mock-action.ts`<br>`test/cli-foundations/interactive-harness/context.ts` |
| `test/cli-foundations/interactive/root-routing.test.ts` | moved | `test/data/interactive/unknown-action.test.ts` |
| `test/helpers/interactive-harness/context.ts` | moved | `test/cli-foundations/interactive-harness/context.ts` |
| `test/helpers/interactive-harness/index.ts` | merged | `test/cli-foundations/interactive-harness/index.ts` |
| `test/helpers/interactive-harness/mocks/actions.ts` | moved | `test/cli-foundations/interactive-harness/action-mocks.ts` |
| `test/helpers/interactive-harness/mocks/fs.ts` | moved | `test/cli-foundations/interactive-harness/fs-mock.ts` |
| `test/helpers/interactive-harness/mocks/index.ts` | moved | `test/cli-foundations/interactive-harness/mock-composition.ts` |
| `test/helpers/interactive-harness/mocks/path-prompts.ts` | moved | `test/cli-foundations/interactive-harness/path-prompt-mocks.ts` |
| `test/helpers/interactive-harness/mocks/prompts.ts` | moved | `test/cli-foundations/interactive-harness/prompt-mocks.ts` |
| `test/helpers/interactive-harness/module-urls.ts` | moved | `test/cli-foundations/interactive-harness/module-urls.ts` |
| `test/helpers/interactive-harness/runner.ts` | moved | `test/cli-foundations/interactive-harness/runner.ts` |
| `test/helpers/interactive-harness/runtime.ts` | moved | `test/cli-foundations/interactive-harness/runtime.ts` |
| `test/helpers/interactive-harness/types.ts` | moved | `test/cli-foundations/interactive-harness/types.ts` |
| `test/helpers/interactive-harness.ts` | merged | `test/cli-foundations/interactive-harness/index.ts` |
| `test/cli-interactive-routing.helpers.ts` | removed | `test/cli-foundations/interactive-harness/index.ts`<br>`test/helpers/ansi.ts`<br>`test/data-stack/interactive/support.ts`<br>`test/helpers/cli-test-utils.ts` |

### Final Reconciliation

Change set: `final-reconciliation`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/fixtures/parquet-preview/wide.parquet` | removed | `test/data-preview/actions/parquet.test.ts` |

## Completion

The completed lookup contains 296 accepted transitions:

- 226 moved
- 66 split
- 2 merged
- 2 removed

Every current-owner path was reconciled against the final `test/**` tree on
2026-08-24. Current guides and reference docs use current paths; historical
commands and plan wording remain in their dated implementation records.

Later isolated migrations may append a named change set and update
`modified-date` without reopening this reference unless its lookup schema
changes materially.

## Related Records

- [Test Suite Contract, Overlap, And Catalog Review](../researches/research-2026-08-23-test-suite-contract-overlap-and-catalog.md)
- [Test Suite Contract And Catalog Enhancement Job](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md)
- [Test Suite Contract Ownership Catalog](test-suite-case-matrices.md)

### Test Suite Pilots

Change set: `test-suite-pilots`.

| Historical path or fragment | Transition | Current owner or owners |
| --- | --- | --- |
| `test/cli-actions-md-to-pdf-code-highlight.test.ts` | split | `test/markdown-pdf/direct/code-highlight.unit.test.ts`<br>`test/markdown-pdf/direct/code-highlight.pandoc.test.ts` |
| `test/cli-actions-md-to-pdf-page-number-format.test.ts` | moved | `test/markdown-pdf/direct/page-number-format.unit.test.ts` |
| `test/cli-actions-md-to-pdf-page-number-html.test.ts` | moved | `test/markdown-pdf/direct/page-number-html.unit.test.ts` |
| `test/cli-actions-md-to-pdf-pandoc.test.ts` | moved | `test/markdown-pdf/actions/rendering/pandoc-language.pandoc.test.ts` |
| `test/codex-info/action.test.ts` | moved | `test/codex-info/action.unit.test.ts` |
| `test/codex-info/cli-replay.test.ts` | moved | `test/codex-info/cli-replay.app.test.ts` |
| `test/codex-info/color.test.ts` | split | `test/codex-info/color.unit.test.ts`<br>`test/codex-info/color.app.test.ts` |
| `test/codex-info/commands.test.ts` | moved | `test/codex-info/commands.app.test.ts` |
| `test/codex-info/environment-parity.test.ts` | moved | `test/codex-info/environment-parity.app.test.ts` |
| `test/codex-info/live-protocol.test.ts` | moved | `test/codex-info/live-protocol.codex.test.ts` |
| `test/codex-info/render.test.ts` | moved | `test/codex-info/render.unit.test.ts` |
| `test/codex-info/report.test.ts` | moved | `test/codex-info/report.unit.test.ts` |
| `test/codex-info/transport.test.ts` | moved | `test/codex-info/transport.app.test.ts` |
| `test/markdown-pdf/actions/rendering-core.test.ts` | moved | `test/markdown-pdf/actions/rendering/core.app.test.ts` |
