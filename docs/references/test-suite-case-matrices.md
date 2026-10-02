---
title: "Test Suite Contract Ownership Catalog"
created-date: 2026-08-23
modified-date: 2026-10-02
status: completed
agent: codex
---

## Goal

Provide the current test-contract ownership and catalog rules accepted by the suite-wide audit. This reference summarizes the settled decisions without repeating plan sequencing, focused commands, or declaration-by-declaration execution evidence.

Use [Test Suite Audit Inventory](test-suite-audit-inventory.md) for the fixed pre-migration snapshot and [Test Catalog Path Correspondence](test-catalog-path-correspondence.md) for historical-to-current paths. The completed [implementation job](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md) owns exact validation, removal ledgers, commit ranges, and review decisions.

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

### Video Frames

`test/video/interactive/frames-*.unit.test.ts` owns selector grammar, coarse movement, adaptive display fit, naming tokens, and completion. `frames-controller.app.test.ts` owns input sessions, resolver cancellation, restoration, and isolated checks against the installed prompt library. Its real-library fixture stays beside that consumer under `test/video/interactive/fixtures/`.

`frames-settings.unit.test.ts` owns pure cadence feedback and advertised format/quality choices. `frames-operation.app.test.ts` owns asynchronous input ownership, confirmed cancellation and fatal closure. `frames-workflow.app.test.ts` owns guided preparation/review/export integration under Node.js with controlled tools, retained identities, source invalidation and recovery. Shared path/text cancellation remains covered by the existing `test/cli-foundations/path-prompts/` and `text-inline/` owners. Interactive routing covers the new peer entry without loading frames prompts in unrelated workflows.

`frames-menus.app.test.ts` owns finite menu pagination, disabled choices, selected descriptions/resize, Back/Escape parent routes, and editable draft retention using the installed prompt library under Node.js. Its fixture stays under `test/video/interactive/fixtures/`; shared path/text draft hooks also retain their existing foundation owners.

`test/video/smoke-budget.unit.test.ts` checks only pure development-budget calculations. Real terminal interactions and generated/private media smoke are explicit plan verification outside regular suites and CI. See the [implementation record](../plans/jobs/2026-10-01-video-frames-implementation.md) for their evidence. These are new contracts, with no historical-path migration.

`test/video/frames/` owns selected-stream metadata, checked exact timing, EOF/prefix identity resolution, fixed presets, bounded session reuse, and source/stream invalidation. Unit cases use independent records and injected inspection; application cases bundle the resolver for Node and use controlled executable responses. Their fixtures stay beside the consumer. Neither suite reads private media or requires installed FFmpeg.

`image-plan.unit.test.ts` owns format/quality/scale policies, aspect/display geometry, color inference/rejection, transparency checks, and advertised image encoder interpretation. Actual encoded pixels and metadata require the explicit synthetic smoke checkpoint.

`color-profile.unit.test.ts` owns deterministic ICC headers, tag bounds, profile IDs, source-transfer curves and primaries. `image-framing.unit.test.ts` owns bounded format completion parsing and streaming ICC attachment, including conflicting descriptions, compressed-payload preservation, byte accounting and backpressure. Native saved-image and independent color-management evidence belongs in the [follow-up record](../plans/jobs/2026-10-02-video-frames-enhancement-follow-up.md#production-color-preservation).

`staging-boundary.unit.test.ts` owns the default 256-MiB encoded-byte accounting boundary and its one-byte overflow with virtual storage and bounded chunks. It neither creates a 256-MiB file nor establishes native encoding at that size. `publication.app.test.ts` owns real Node filesystem staging/publication, collisions, alias protection, injected I/O failures including `ENOSPC` and `EDQUOT`, partial accounting, and safe cleanup. Their tiny structural format fixtures establish lifecycle boundaries; the explicit real-image smoke establishes actual encoding and pixels.

`raw-frames.unit.test.ts` owns bounded reusable RGBA framing. `export.app.test.ts` owns the Node decoder/encoder/publication pipeline, retained roles, encoder preflight, duplicate/case-alias names under both overwrite policies, partial output, source mutation, alpha failure, and cancellation with controlled executable responses. Resolver cases also verify that copied or stale selections cannot be exported. Frame records retain selected image metadata for conversion checks without collecting a full frame table.

`naming.unit.test.ts` owns shared source stems, concrete mode-specific rendering, serial precedence/width/overflow and filename limits. `destination.app.test.ts` owns mode-defined defaults/custom paths, explicit extensions, existing kinds/aliases, nonempty-folder detection, and inspection without creation. Existing prototype naming and rename rendering tests protect reuse of the shared grammar and separator normalization.

`sampler.unit.test.ts` owns exact FPS/interval grammar, independent cadence targets and count estimates, presentation boundaries, retained repeats, bounded selection expressions, incremental timing rejection, and reliable end/EOF handling. `sequence.app.test.ts` owns the Node sampler/exporter boundary, global ordinals/serials, backpressure, overwrite, partial counts, and late timing/tool/filesystem/cancellation failures with controlled executables. `images.app.test.ts` owns generated/literal single-image and fixed-set destinations, requested labels, overwrite, and pre-write source-alpha rejection. Real sequence content, resource observations, and source/encoder alpha limitations remain explicit synthetic smoke evidence; regular fixtures do not establish pixel fidelity.

### Video Frames Command and Doctor

`test/video/frames/options.unit.test.ts` owns shared direct option validation. `action.app.test.ts` owns the Node command/action boundary with controlled tools, pre-write review, retained identities, all export modes, dependency preflight, and partial failures. Command UX cases cover discovery and repeated cadence rejection. These new contracts introduce no historical test-path migration.

`test/video/frames/progress.unit.test.ts` owns presentation throttling, distinct counts/estimates, quiet activity, measured resize, stopping and renderer release. The action owner also checks result-path layout and per-stream color eligibility. Export/sequence owners check pass-local inspection, selected extractions, confirmed publications and cancellation during finishing/cleanup. The Interactive operation owner checks input ownership through late acknowledgement and fatal closure precedence.

`test/doctor/actions/video-frames.unit.test.ts` owns the FFmpeg/FFprobe availability matrix, exact advertised encoder/input/lossless assessments, unknown successful output, operational failure, and consistent Summary/Details/JSON projections. Controlled dependency/report fixtures preserve existing video capability meanings.

### Streaming Process Foundation

`test/cli-foundations/process/` owns incremental UTF-8 records, bounded metadata/input queues/diagnostic tails, structured progress, direct argument handling, and registered child/input-producer/consumer closure. Application fixtures exercise actual Node pipes, awaited input writes, and cooperative/resistant children; unit cases model queue rejection, unconfirmed closure, and Windows force transitions. Generated media remains an explicitly invoked smoke task, separate from these process contracts.

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

The Interactive harness is not a global helper. Its neutral platform lives under `test/cli-foundations/interactive-harness/`; feature mocks and scenario contracts remain with their feature owners.

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

Accepted declaration decisions were 739 `move`, 215 `split`, 4 `rename`, 4 `merge`, 10 `remove`, and 10 `keep pending evidence`. These were ownership decisions, not a test-reduction target. Exact declaration evidence remains in the dated [catalog admission record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-2-case-matrices-and-catalog-admission).

### Removal And Retention Outcome

- Ten whole declarations and three parameter variants were removed only after a stronger retained owner was named.
- Thirteen removed runtime cases were offset by eleven new or newly parameterized protection cases, producing a net change of two runtime tests.
- Cases lacking a distinct owner stayed protected under `keep pending evidence`.
- The audit’s final suite contained 355 test files, 2,623 passing tests, and 14,876 expectations.

The exact removed title, retained owner, and implementation range for every accepted removal live in the [final removal record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#final-beforeafter-and-removal-record).

## Accepted Exceptions

| Exception | Current scope | Revisit event |
| --- | --- | --- |
| Source-aligned Markdown PDF and Codex families | existing bounded adapter, action, project, template, and renderer-evidence directories | a change that mixes owners, duplicates support, or requires a broader feature move |

The former flat-root and legacy Markdown PDF Interactive deferrals were resolved by the feature/suite migration. Their historical paths remain in the correspondence reference; new coverage belongs under the current feature owners.

The remaining source-aligned locations are bounded exceptions, not templates for new test placement. New coverage should use the feature-first catalog unless it satisfies the recorded exception rule.

## Historical Migration Pointers

The completed plan links to the two pilot path contracts below. The visible reference vocabulary is feature-based; compatibility anchors preserve those historical links.

<a id="phase-3-data-query-path-contract"></a>
### Data Query

The former root action, command, Interactive, fixture, and support families now resolve through the [Data Query path lookup](test-catalog-path-correspondence.md#data-query).

<a id="phase-4-doctor-path-contract"></a>
### Doctor

The former Doctor action, command, workflow, Interactive, fixture, and mixed suite owners now resolve through the [Doctor path lookup](test-catalog-path-correspondence.md#doctor).

## Related Records

- [Testing Guide](../guides/testing.md)
- [Test Suite Responsibilities and Verification Lifecycle](../researches/research-2026-09-05-multi-test-commands.md)
- [Test Suite Refactor Implementation Record](../plans/jobs/2026-09-05-test-suite-refactor.md)

- [Test Suite Audit Inventory](test-suite-audit-inventory.md)
- [Test Catalog Path Correspondence](test-catalog-path-correspondence.md)
- [Test Suite Contract, Overlap, And Catalog Review](../researches/research-2026-08-23-test-suite-contract-overlap-and-catalog.md)
- [Test Suite Contract And Catalog Enhancement Job](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md)
