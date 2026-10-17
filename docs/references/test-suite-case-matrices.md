---
title: "Test Suite Contract Ownership Catalog"
created-date: 2026-08-23
modified-date: 2026-10-17
status: completed
agent: codex
---

## Goal

Map current test ownership and the boundaries between routine coverage and manual verification. Case inventories, execution results, and migration decisions belong in tests and dated records.

Use the [Testing Guide](../guides/testing.md) for suite selection, prerequisites, and fixture lifecycle, and [Test Catalog Path Correspondence](test-catalog-path-correspondence.md) for historical-to-current paths.

## Ownership Rules

- Prefer a stable feature or platform owner over a source-shaped or command-shaped root name.
- Use boundary directories such as `actions`, `commands`, `direct`, `interactive`, `adapters`, and `evidence` only when they separate independently changing contracts.
- Keep support beside its consumers unless at least two independent feature families use a feature-neutral contract.
- Retain command coverage only for registration, parsing, option precedence, forwarding, environment, process, or exit behavior that action tests cannot protect.
- Retain vague or overlapping product coverage until an exact stronger owner is named; test-count reduction is never sufficient evidence.
- Keep manual feature-script verification outside routine suites. Preserve product assertions from mixed tests under their product owner; shared managed-test infrastructure retains its own coverage.
- Allow a temporary root or legacy location only with a named ownership reason and an event that triggers reconsideration.

## Current Catalog

| Owner                      | Current locations                                                                                                                               | Contract boundary                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| CLI foundations            | `test/cli-foundations/`                                                                                                                         | command registration, root UX, Interactive platform, terminal rendering, and shared harness infrastructure |
| Data platform and features | `test/data/`, `test/data-conversion/`, `test/data-extract/`, `test/data-preview/`, `test/data-query/`, `test/data-sources/`, `test/data-stack/` | data feature actions, commands, adapters, Interactive flows, fixtures, and evidence                        |
| Doctor                     | `test/doctor/`                                                                                                                                  | inspection, report projections, command routing, workflow, and Interactive ownership                       |
| Markdown features          | `test/markdown/`, `test/markdown-docx/`, `test/markdown-frontmatter/`, `test/markdown-pdf/`                                                     | Markdown platform and feature-specific contracts                                                           |
| Rename                     | `test/rename/`, `test/document-rename/`                                                                                                         | planning, apply lifecycle, adapters, presentation, commands, and Interactive flows                         |
| Video                      | `test/video/`                                                                                                                                   | conversion actions, frame selection/export, command behavior, and Interactive flows                        |
| Platform and utilities     | `test/codex-adapters/`, `test/fonts/`, `test/release-tooling/`, `test/utils/`                                                                   | shared adapter, font, release-tooling, and utility contracts                                               |
| Codex discovery            | `test/codex-info/`                                                                                                                              | protocol parsing, transport, and isolated installed-Codex verification                                     |
| Test runner                | `test/test-runner/`                                                                                                                             | suite discovery, prerequisites, process/output ownership, reporting, retention, and terminal presentation  |
| Shared fixtures            | `test/fixtures/`                                                                                                                                | checked-in data consumed by more than one accepted owner                                                   |
| Global helpers             | `test/helpers/`                                                                                                                                 | independently reused, feature-neutral test infrastructure only                                             |

## Coverage Boundaries

### Document Rename

`test/document-rename/` owns document evidence extraction, title ranking, and DOCX reader/runtime coverage.

| Coverage                    | Primary owners                                                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence and compatibility  | `test/document-rename/adapters/` and `test/document-rename/docx-evidence.unit.test.ts`; complete evidence/prompt expectations and adapter failure classification           |
| Reader semantics and limits | DOCX content, drawing, numbering, and resource unit suites under `test/document-rename/`; inline comparisons in `test/document-rename/adapters/docx-candidate.app.test.ts` |
| Process lifecycle           | `test/document-rename/docx-runtime.app.test.ts` and runtime unit coverage; admission, cancellation, memory checks, offline controls, and cleanup                           |

Representative adapter suites are [docx-baseline.app.test.ts](../../test/document-rename/adapters/docx-baseline.app.test.ts) for frozen compatibility, [docx-product.app.test.ts](../../test/document-rename/adapters/docx-product.app.test.ts) for product integration, and [docx-review.app.test.ts](../../test/document-rename/adapters/docx-review.app.test.ts) for regressions.

DOCX adapter regressions use a compiled Node product fixture with fixed runtime assets. Independent frozen expectations and fixture definitions stay under `test/document-rename/fixtures/`; inline reader comparisons cover parsing separately. Built-format comparisons, resource measurements, and installed-package checks remain explicit manual verification.

### Video Frames

| Coverage                           | Primary owners                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Interactive selection and workflow | `test/video/interactive/`; input, menus, draft retention, cancellation, and guided export                                |
| Frame resolution and export        | `test/video/frames/`; metadata, timing, sampling, image policy/framing, staging/publication, and export lifecycle        |
| Shared input behavior              | `test/cli-foundations/path-prompts/` and `test/cli-foundations/text-inline/`; path/text draft and cancellation contracts |

[export.app.test.ts](../../test/video/frames/export.app.test.ts) exercises decoder/encoder orchestration with controlled tools; [publication.app.test.ts](../../test/video/frames/publication.app.test.ts) owns filesystem staging, publication, and cleanup. Routine frame tests use controlled tool responses and synthetic fixtures. Real media, installed encoder output, pixel/color fidelity, and workload measurements require explicit manual checks.

### Video Frames Command and Doctor

Frame command/action and progress coverage stays under `test/video/frames/`; CLI registration and option forwarding stay under `test/video/commands/`. `test/doctor/actions/video-frames.unit.test.ts` owns dependency capability reporting. Their controlled fixtures do not establish actual encoder output.

### Streaming Process Foundation

`test/cli-foundations/process/` owns streaming records, bounded I/O, progress, and child/input/output lifecycle. Application tests exercise real Node pipes and process settlement; unit tests cover pure policies and injected failures. Generated media checks belong to manual feature verification.

### Manual Feature Tooling

Routine suites cover product behavior and shared test infrastructure. Manual smoke/evidence scripts, evaluation launchers, and fixture generators are verified explicitly. Product inputs and assertions stay with their test owner; routine tests do not launch manual generators or verification commands.

- DOCX: `scripts/docx-candidate/launch.mjs`, `measure-launch.mjs`, and `package-check.mjs` cover built ESM/CommonJS comparisons, resource measurements, and installed-package behavior. Inputs/assertions stay under `test/document-rename/`; execution files use owned temporary storage. See [manual commands and retention](../plans/jobs/2026-10-16-docx-reader-and-mammoth-replacement.md#manual-validation).
- Markdown PDF: product materialization and saved-style/image-cover regressions stay under `test/markdown-pdf/evidence/page-number-renderer/`; renderer-evidence and smoke commands remain manual.
- Data: product tests consume durable synthetic inputs under `test/data-sources/fixtures/extract/` through test-owned helpers.
- Video: real terminal, installed FFmpeg/FFprobe, and generated/private-media checks remain outside routine suites and CI. The [built-CLI smoke command](../../scripts/spikes/video-frames-phase11.ts) provides explicit product checks.

### Global Helpers

The shared helper files have the following responsibilities:

| Helper                                      | Retained contract                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `test/helpers/ansi.ts`                      | feature-neutral ANSI stripping reused across feature owners                                                                  |
| `test/helpers/cli-action-test-utils.ts`     | action-test stream capture, CLI error assertions, no-output checks, and scoped cleanup                                       |
| `test/helpers/cli-test-utils.ts`            | Bun source-CLI process launch, repository paths, owned temporary fixture lifecycle, designated exports, and captured streams |
| `test/helpers/native-prerequisites.ts`      | lazy, cached native prerequisites with explicit failure and bounded probe ownership                                          |
| `test/helpers/native-prerequisite-probe.ts` | child probe for installed DuckDB and existing Excel/SQLite extension caches; no installation                                 |
| `test/helpers/unit-boundary-preload.ts`     | verification instrumentation rejecting process, native, and fetch dependencies, including caught attempts                    |

The Interactive harness is not a global helper. Its neutral platform lives under `test/cli-foundations/interactive-harness/`; feature mocks and scenario contracts remain with their feature owners.

## Accepted Exceptions

| Exception                                      | Current scope                                                                          | Revisit event                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Source-aligned Markdown PDF and Codex families | existing bounded adapter, action, project, template, and renderer-evidence directories | a change that mixes owners, duplicates support, or requires a broader feature move |

Flat-root and legacy Markdown PDF Interactive deferrals are resolved. New coverage belongs under the current feature owners unless it satisfies the bounded exception above.

## Related Records

Use the [Testing Guide](../guides/testing.md) for current command usage and lifecycle guidance. The dated records below preserve their original counts, decisions, and verification scope.

- [Audit baseline](test-suite-audit-inventory.md), [catalog admission decisions](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#phase-2-case-matrices-and-catalog-admission), and [removal ledger](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md#final-beforeafter-and-removal-record).
- [Catalog design research](../researches/research-2026-08-23-test-suite-contract-overlap-and-catalog.md) and [implementation record](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md).
- [Suite lifecycle research](../researches/research-2026-09-05-multi-test-commands.md) and [feature/suite refactor record](../plans/jobs/2026-09-05-test-suite-refactor.md).
- [DOCX implementation](../plans/jobs/2026-10-16-docx-reader-and-mammoth-replacement.md), [test/tooling separation](../plans/jobs/2026-10-16-docx-reader-and-mammoth-replacement.md#phase-63-manual-script-simplification-and-test-ownership), and [compatibility follow-ups](../plans/jobs/2026-10-16-docx-reader-review-follow-up.md).
- [Video implementation](../plans/jobs/2026-10-01-video-frames-implementation.md), [enhancement verification](../plans/jobs/2026-10-02-video-frames-enhancement-follow-up.md#integrated-verification), [native image verification](../plans/jobs/2026-10-02-video-frames-enhancement-follow-up.md#native-image-interpretation-and-conversion), and [PNG framing correction](../plans/jobs/2026-10-02-png-idat-chunk-limit-fix.md).
