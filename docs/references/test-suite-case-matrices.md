---
title: "Test Suite Contract Ownership Catalog"
created-date: 2026-08-23
modified-date: 2026-10-16
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
- Retain vague or overlapping product coverage until an exact stronger owner is named; test-count reduction is never sufficient evidence.
- Keep manual feature-script verification outside routine suites. Preserve product assertions from mixed tests under their product owner; shared managed-test infrastructure retains its own coverage.
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

### Document Rename Baseline

`test/document-rename/adapters/docx-baseline.app.test.ts` owns 70 product semantic cases against historical captures; `docx-baseline-contract.app.test.ts` owns 31 noncyclic symbol/style/note cases and independent expectation checks. Both use bounded batches through the compiled Node product fixture, preserving named case assertions, input hashes, complete evidence/prompts, and document facts. Frozen captures and pure assertions remain under `test/document-rename/fixtures/docx-baseline/`; the live Mammoth oracle was retired in Phase 9. The 33 contract cases comprise 31 routine cases and two explicit bounded manual cycle comparisons; routine tests do not launch manual commands.

`docx-product.app.test.ts` owns sequential failure/recovery, independent concurrent operations, batch/thread forwarding and reasons, and exact 8/10 MiB boundaries. It and the existing DOCX cases in `title-evidence.app.test.ts` use the test-owned compiled Node driver under `fixtures/docx-product/`, exercising the actual production adapter with fixed runtime siblings. `docx-evidence.unit.test.ts` owns adapter failure containment and no-title classification. Complete integrated ESM/CJS comparisons and actual packed-product consumers remain explicit phase verification.

`docx-review.app.test.ts` owns 114 named follow-up cases with independent complete evidence/prompt expectations: sixty cases cover Strong character styling, vertical merges, checkbox controls, shared malformed metadata, hyperlink boundaries, XML references and document roots, and three accepted CDATA-preservation cases; fifty drawing cases cover image/link relationships, source scoping, suppression, and omission; four fallback cases cover selection, nesting, absent fallback, and eager failures. The same definitions supply focused content/drawing unit regressions; resource unit tests protect failed-inspection accounting, built-in reference bounds, and safety failures. Historical frozen captures remain unchanged. `docx-verification.unit.test.ts` checks only the pure version/timing predicates; manual launchers remain outside routine application tests. The [follow-up record](../plans/jobs/2026-10-16-docx-reader-review-follow-up.md) owns verification and review outcomes.

`docx-candidate.app.test.ts` retains 22 inline reader comparisons, using test-owned case/comparison support and the product extractor factory with an injected inline reader. Content, numbering, resource, and runtime unit tests own semantic interactions, selected-content caps, and protocol policy. `docx-runtime.app.test.ts` owns real Node child/worker failures, admission, cancellation, parent loss, sampled RSS, offline controls, and cleanup. Its generated builds use the shared managed fixture lifecycle.

The explicit `scripts/docx-candidate/launch.mjs` command checks all 134 frozen cases through the production adapter/runtime in ESM/CJS builds. Four above-cap inputs separately assert default failure and raised-cap semantics. `measure-launch.mjs` checks 18 workloads against accepted limits and frozen supported evidence; historical Mammoth benchmarks are not rerun. `package-check.mjs` checks the actual product tarball through public API and installed CLI consumers in all eight npm/Bun/runtime/format paths. Inputs/assertions stay under the test owner; execution files use owned temporary storage. These manual runs remain separate from routine product tests; their completion is recorded in final acceptance.

Manual launcher/help, harness, retention, package-inspector, and resource-inspector wrappers have left routine suites. The package command no longer runs embedded harness self-tests. Live progress, bounded execution, interruption, cleanup, and explicit ignored smoke retention remain manual-command behavior. See [manual commands](../plans/jobs/2026-10-16-docx-reader-and-mammoth-replacement.md#manual-validation) and the [Phase 6.3 record](../plans/jobs/2026-10-16-docx-reader-and-mammoth-replacement.md#phase-63-manual-script-simplification-and-test-ownership).

### Manual Feature Tooling

Markdown PDF smoke/renderer-evidence scripts, data fixture generators, and video smoke-workspace/budget tools use explicit manual verification. Their script-only routine wrappers are retired. Direct Project materialization and saved-style/image-cover regressions remain under `test/markdown-pdf/evidence/page-number-renderer/`; shared renderer fixture definitions remain available to their consumers.

Data product tests copy the reviewed synthetic inputs in `test/data-sources/fixtures/extract/` through test-owned helpers, without launching manual generators. This preserves the prior input bytes and product assertions. Shared runner and release-tooling coverage retains its existing ownership.

### Video Frames

`test/video/interactive/frames-*.unit.test.ts` owns selector grammar, coarse movement, adaptive display fit, naming tokens, and completion. `frames-controller.app.test.ts` owns input sessions, resolver cancellation, restoration, and isolated checks against the installed prompt library. Its real-library fixture stays beside that consumer under `test/video/interactive/fixtures/`.

`frames-settings.unit.test.ts` owns pure cadence feedback and advertised format/quality choices. `frames-operation.app.test.ts` owns asynchronous input ownership, confirmed cancellation and fatal closure. `frames-workflow.app.test.ts` owns guided preparation/review/export integration under Node.js with controlled tools, retained identities, source invalidation and recovery. Shared path/text cancellation remains covered by the existing `test/cli-foundations/path-prompts/` and `text-inline/` owners. Interactive routing covers the new peer entry without loading frames prompts in unrelated workflows.

`frames-menus.app.test.ts` owns finite menu pagination, disabled choices, selected descriptions/resize, Back/Escape parent routes, and editable draft retention using the installed prompt library under Node.js. Its fixture stays under `test/video/interactive/fixtures/`; shared path/text draft hooks also retain their existing foundation owners.

Development smoke-budget/workspace tools, real terminal interactions, and generated/private media smoke are explicit plan verification outside regular suites and CI. The opt-in [built-CLI proof](../../scripts/spikes/video-frames-phase11.ts) owns direct selection/format, saved-output and minimum-Node smoke checks. See the [original record](../plans/jobs/2026-10-01-video-frames-implementation.md) and [enhancement verification](../plans/jobs/2026-10-02-video-frames-enhancement-follow-up.md#integrated-verification) for their evidence. These are new contracts, with no historical-path migration.

`test/video/frames/` owns selected-stream metadata, checked exact timing, EOF/prefix identity resolution, fixed presets, bounded session reuse, and source/stream invalidation. Unit cases use independent records and injected inspection; application cases bundle the resolver for Node and use controlled executable responses. Their fixtures stay beside the consumer. Neither suite reads private media or requires installed FFmpeg.

`image-plan.unit.test.ts` owns format/quality/scale policies, aspect/display geometry, color inference/rejection, transparency checks, and advertised image encoder interpretation. Actual encoded pixels and metadata require the explicit synthetic smoke checkpoint.

`color-profile.unit.test.ts` owns deterministic ICC headers, tag bounds, profile IDs, selected image curves and primaries. `image-plan.unit.test.ts` separates signal transfer from image interpretation and pins accurate matrix conversion. Metadata and image-export cases reject reported stream/frame ICC profiles rather than replacing their interpretation. `image-framing.unit.test.ts` owns bounded completion parsing and ICC attachment, including conflicting descriptions, compressed-payload preservation, byte accounting and backpressure. Native image/profile and independent color-management evidence belongs in the [follow-up record](../plans/jobs/2026-10-02-video-frames-enhancement-follow-up.md#native-image-interpretation-and-conversion).

`staging-boundary.unit.test.ts` owns the default 256-MiB encoded-byte accounting boundary and its one-byte overflow with virtual storage and bounded chunks. It also checks exact container-plus-profile byte accounting for a valid PNG divided into more than 4,096 `IDAT` chunks. `image-framing.unit.test.ts` covers that PNG's payload/profile preservation, fragmented input, consecutive images, truncation and retained non-data chunk limits. The [PNG fix record](../plans/jobs/2026-10-02-png-idat-chunk-limit-fix.md) records the separate built-CLI export evidence. These unit cases neither create a 256-MiB file nor establish native encoding at that size. `publication.app.test.ts` owns real Node filesystem staging/publication, collisions, alias protection, injected I/O failures including `ENOSPC` and `EDQUOT`, partial accounting, and safe cleanup. The structural fixtures establish lifecycle boundaries; the valid segmented PNG also checks inflated pixels, and the explicit real-image smoke establishes actual encoder output and pixels.

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
