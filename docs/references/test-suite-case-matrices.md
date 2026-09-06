---
title: "Test Suite Contract Ownership Catalog"
created-date: 2026-08-23
modified-date: 2026-09-06
status: completed
agent: codex
---

## Goal

Provide the current test-contract ownership and catalog rules accepted by the
suite-wide audit. This reference summarizes the settled decisions without
repeating plan sequencing, focused commands, or declaration-by-declaration
execution evidence.

Use [Test Suite Audit Inventory](test-suite-audit-inventory.md) for the fixed
pre-migration snapshot and
[Test Catalog Path Correspondence](test-catalog-path-correspondence.md) for
historical-to-current paths. The completed
[implementation job](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md)
owns exact validation, removal ledgers, commit ranges, and review decisions.

## Ownership Rules

- Prefer a stable feature or platform owner over a source-shaped or command-shaped root name.
- Use boundary directories such as `actions`, `commands`, `direct`, `interactive`, `adapters`, and `evidence` only when they separate independently changing contracts.
- Keep support beside its consumers unless at least two independent feature families use a feature-neutral contract.
- Retain command coverage only for registration, parsing, option precedence, forwarding, environment, process, or exit behavior that action tests cannot protect.
- Retain vague or overlapping coverage until an exact stronger owner is named; test-count reduction is never sufficient evidence.
- Allow a temporary root or legacy location only with a named ownership reason and an event that triggers reconsideration.

## Current Catalog

| Owner | Current locations | Contract boundary |
| --- | --- | --- |
| CLI foundations | `test/cli-foundations/` | command registration, root UX, Interactive platform, terminal rendering, and shared harness infrastructure |
| Data platform and features | `test/data/`, `test/data-conversion/`, `test/data-extract/`, `test/data-preview/`, `test/data-query/`, `test/data-sources/`, `test/data-stack/` | data feature actions, commands, adapters, Interactive flows, fixtures, and evidence |
| Doctor | `test/doctor/` | inspection, report projections, command routing, workflow, and Interactive ownership |
| Markdown features | `test/markdown/`, `test/markdown-docx/`, `test/markdown-frontmatter/`, `test/markdown-pdf/` | Markdown platform and feature-specific contracts |
| Rename | `test/rename/`, `test/document-rename/` | planning, apply lifecycle, adapters, presentation, commands, and Interactive flows |
| Platform and utilities | `test/codex-adapters/`, `test/fonts/`, `test/release-tooling/`, `test/utils/`, `test/video/` | bounded platform, tooling, utility, and feature contracts |
| Codex discovery | `test/codex-info/` | protocol parsing, transport, and isolated installed-Codex verification |
| Test runner | `test/test-runner/` | suite discovery, prerequisites, process/output ownership, reporting, retention, and terminal presentation |
| Shared fixtures | `test/fixtures/` | checked-in data consumed by more than one accepted owner |
| Global helpers | `test/helpers/` | independently reused, feature-neutral test infrastructure only |

### Global Helpers

The shared helper files have the following responsibilities:

| Helper | Retained contract |
| --- | --- |
| `test/helpers/ansi.ts` | feature-neutral ANSI stripping used independently by Data Preview and Data Stack |
| `test/helpers/cli-action-test-utils.ts` | action-test stream capture, CLI error assertions, no-output checks, and scoped cleanup |
| `test/helpers/cli-test-utils.ts` | Bun source-CLI process launch, repository paths, owned temporary fixture lifecycle, designated exports, and captured streams |
| `test/helpers/native-prerequisites.ts` | lazy, cached native prerequisites with explicit failure and bounded probe ownership |
| `test/helpers/native-prerequisite-probe.ts` | child probe for installed DuckDB and existing Excel/SQLite extension caches; no installation |
| `test/helpers/unit-boundary-preload.ts` | verification instrumentation rejecting process, native, and fetch dependencies, including caught attempts |

The Interactive harness is not a global helper. Its neutral platform lives
under `test/cli-foundations/interactive-harness/`; feature mocks and scenario
contracts remain with their feature owners.

## Audit Decision Summary

The admission audit compared 982 source declarations across 94 suites:

| Contract family | Audited suites | Source declarations |
| --- | ---: | ---: |
| Data Query and Data Query Codex | 31 | 184 |
| Markdown PDF | 32 | 482 |
| Data Extract and Data Stack | 14 | 112 |
| Rename, Fonts, Video, Markdown Frontmatter, and release tooling | 10 | 70 |
| CLI foundations and Doctor | 7 | 134 |
| **Total** | **94** | **982** |

Accepted declaration decisions were 739 `move`, 215 `split`, 4 `rename`,
4 `merge`, 10 `remove`, and 10 `keep pending evidence`. These were ownership
decisions, not a test-reduction target. Exact declaration evidence remains in
the dated [catalog admission record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-2-case-matrices-and-catalog-admission).

### Removal And Retention Outcome

- Ten whole declarations and three parameter variants were removed only after a stronger retained owner was named.
- Thirteen removed runtime cases were offset by eleven new or newly parameterized protection cases, producing a net change of two runtime tests.
- Cases lacking a distinct owner stayed protected under `keep pending evidence`.
- The audit’s final suite contained 355 test files, 2,623 passing tests, and 14,876 expectations.

The exact removed title, retained owner, and implementation range for every
accepted removal live in the
[final removal record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#final-beforeafter-and-removal-record).

## Accepted Exceptions

| Exception | Current scope | Revisit event |
| --- | --- | --- |
| Source-aligned Markdown PDF and Codex families | existing bounded adapter, action, project, template, and renderer-evidence directories | a change that mixes owners, duplicates support, or requires a broader feature move |

The former flat-root and legacy Markdown PDF Interactive deferrals were resolved
by the feature/suite migration. Their historical paths remain in the correspondence
reference; new coverage belongs under the current feature owners.

The remaining source-aligned locations are bounded exceptions, not templates for
new test placement. New coverage should use the feature-first catalog unless it
satisfies the recorded exception rule.

## Historical Migration Pointers

The completed plan links to the two pilot path contracts below. The visible
reference vocabulary is feature-based; compatibility anchors preserve those
historical links.

<a id="phase-3-data-query-path-contract"></a>
### Data Query

The former root action, command, Interactive, fixture, and support families now
resolve through the [Data Query path lookup](test-catalog-path-correspondence.md#data-query).

<a id="phase-4-doctor-path-contract"></a>
### Doctor

The former Doctor action, command, workflow, Interactive, fixture, and mixed
suite owners now resolve through the
[Doctor path lookup](test-catalog-path-correspondence.md#doctor).

## Related Records

- [Testing Guide](../guides/testing.md)
- [Test Suite Responsibilities and Verification Lifecycle](../researches/research-2026-09-05-multi-test-commands.md)
- [Test Suite Refactor Implementation Record](../plans/jobs/2026-09-05-test-suite-refactor.md)

- [Test Suite Audit Inventory](test-suite-audit-inventory.md)
- [Test Catalog Path Correspondence](test-catalog-path-correspondence.md)
- [Test Suite Contract, Overlap, And Catalog Review](../researches/research-2026-08-23-test-suite-contract-overlap-and-catalog.md)
- [Test Suite Contract And Catalog Enhancement Job](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md)
