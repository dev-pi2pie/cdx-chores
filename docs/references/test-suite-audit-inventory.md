---
title: "Test Suite Audit Inventory"
created-date: 2026-08-23
modified-date: 2026-08-24
status: completed
agent: codex
---

## Goal

Preserve the dated file-level audit baseline used to review test ownership,
overlap, and catalog placement before the reorganization.

This is a snapshot at commit `2f3013ca`, not a live path index. Use
[Test Catalog Path Correspondence](test-catalog-path-correspondence.md) for
historical-to-current paths and
[Test Suite Contract Ownership Catalog](test-suite-case-matrices.md) for the
settled current ownership rules.

## Audit Baseline

Recorded on 2026-08-23 before test edits or path migration:

- 289 discovered `*.test.ts` files
- 355 TypeScript files under `test/`, totaling 90,399 lines
- 197 root test files, 78 one directory below root, and 14 two directories below root
- 2,625 passing tests, 14,983 assertions, and 99.37 seconds

File size, runtime, and matcher shape were context only; none was a removal
criterion.

## Inventory Fields

| Field | Meaning |
| --- | --- |
| Audited path | Exact repository-relative path at the fixed baseline |
| Feature owner | Product or stable platform family that owned the behavior |
| Layer | Direct, adapter, action, command, Interactive, integration, or evidence boundary |
| Tested boundary | Specific seam exercised by the suite |
| Disposition | Baseline review action defined below |

### Dispositions

- `retain` — coherent contract family with no material overlap signal
- `rename review` — useful ownership whose name obscured the contract
- `case audit` — possible vague, duplicate, or layered overlap requiring literal comparison
- `split review` — independently changing contract families shared one suite
- `move-only review` — useful coverage lacked a settled catalog owner
- `fixture/helper review` — support ownership was duplicated, broad, or misplaced
- `keep pending evidence` — evidence was insufficient, so removal was not admitted

The completed ownership review resolved every admitted `case audit` and `split
review`. Exact execution and removal evidence remains in the completed
[implementation job](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md).

## Audited Test Files

Rows remain in exact sorted baseline-manifest order.

| Audited path | Feature owner | Layer | Tested boundary | Disposition |
| --- | --- | --- | --- | --- |
| `test/adapters-codex-document-rename-titles.test.ts` | Document Rename | adapter | PDF and DOCX title-evidence extraction | retain |
| `test/adapters-codex-failure.test.ts` | Codex adapter platform | direct/unit | structural request-failure classification | retain |
| `test/adapters-codex-markdown-pdf-profile/fallback-failures.test.ts` | Markdown PDF Profile | adapter | Codex profile fallback and failure translation | retain |
| `test/adapters-codex-markdown-pdf-profile/patch-application.test.ts` | Markdown PDF Profile | adapter | bounded profile patch parsing and application | retain |
| `test/adapters-codex-markdown-pdf-profile/prompt-schema.test.ts` | Markdown PDF Profile | adapter | bounded prompt facts and response schema | retain |
| `test/adapters-codex-markdown-pdf-profile/runner-behavior.test.ts` | Markdown PDF Profile | adapter | Codex runner working-directory forwarding | retain |
| `test/adapters-codex-markdown-pdf-template/css-safety.test.ts` | Markdown PDF Template | adapter | generated Template CSS safety policy | retain |
| `test/adapters-codex-markdown-pdf-template/decision-parsing.test.ts` | Markdown PDF Template | adapter | structured template decision parsing and application | retain |
| `test/adapters-codex-markdown-pdf-template/failure-classification.test.ts` | Markdown PDF Template | adapter | no-usable template and runner-failure translation | retain |
| `test/adapters-codex-markdown-pdf-template/prompt-schema.test.ts` | Markdown PDF Template | adapter | bounded template prompt and output schema | retain |
| `test/adapters-codex-markdown-pdf-template/repair-timeout.test.ts` | Markdown PDF Template | adapter | request, one-repair, and timeout lifecycle | case audit |
| `test/adapters-codex-rename-timeout.test.ts` | Rename | adapter | image and document Codex batch timeout behavior | split review |
| `test/adapters-codex-shared.test.ts` | Codex adapter platform | direct/unit | shared title, batching, retry, and disposable-runner helpers | fixture/helper review |
| `test/adapters-docx-ooxml-metadata.test.ts` | DOCX | integration | OOXML core-metadata discovery and decoding | retain |
| `test/cli-action-doctor.test.ts` | Doctor | action | evidence report projections | case audit |
| `test/cli-actions-data-extract-review.test.ts` | Data Extract | action | header-mapping review artifact lifecycle | retain |
| `test/cli-actions-data-extract-source-shape-reuse.test.ts` | Data Extract | action | accepted source-shape replay | retain |
| `test/cli-actions-data-extract-source-shape-review.test.ts` | Data Extract | action | source-shape review artifact creation | retain |
| `test/cli-actions-data-extract-sources.test.ts` | Data Extract | action | Excel and DuckDB source selection | retain |
| `test/cli-actions-data-extract-validation.test.ts` | Data Extract | action | option and overwrite validation | retain |
| `test/cli-actions-data-extract.test.ts` | Data Extract | action | CSV, TSV, and JSON materialization | retain |
| `test/cli-actions-data-parquet-preview.test.ts` | Data Preview | action | Parquet preview through DuckDB | retain |
| `test/cli-actions-data-preview/failures.test.ts` | Data Preview | action | lightweight preview validation and parse failures | retain |
| `test/cli-actions-data-preview/highlighting.test.ts` | Data Preview | action | TTY styling and match visibility | retain |
| `test/cli-actions-data-preview/rendering.test.ts` | Data Preview | action | lightweight table shaping and rendering | retain |
| `test/cli-actions-data-query-artifact-validation.test.ts` | Data Query | action | reviewed artifact admission | case audit |
| `test/cli-actions-data-query-codex-prompt.test.ts` | Data Query Codex | direct/unit and action | intent normalization and editor prompt construction | split review |
| `test/cli-actions-data-query-codex-validation.test.ts` | Data Query Codex | action | drafting preconditions and Codex failure translation | case audit |
| `test/cli-actions-data-query-codex-workspace.test.ts` | Data Query Codex | action | workspace-assisted drafting | case audit |
| `test/cli-actions-data-query-codex.test.ts` | Data Query Codex | action | single-source SQL drafting | case audit |
| `test/cli-actions-data-query-header-artifacts.test.ts` | Data Query | action | header review artifact lifecycle | case audit |
| `test/cli-actions-data-query-headers.test.ts` | Data Query | action | headerless and reviewed-header semantics | case audit |
| `test/cli-actions-data-query-shape.test.ts` | Data Query | action | Excel source-shape execution | case audit |
| `test/cli-actions-data-query-validation.test.ts` | Data Query | action | query option compatibility | case audit |
| `test/cli-actions-data-query-workspace.test.ts` | Data Query | action | file and relation source resolution | case audit |
| `test/cli-actions-data-query.test.ts` | Data Query | action | query result rendering and file output | case audit |
| `test/cli-actions-data-stack/codex-assist.test.ts` | Data Stack | action | dry-run Codex advisory lifecycle | case audit |
| `test/cli-actions-data-stack/dry-run-plan.test.ts` | Data Stack | action | dry-run plan output safety | case audit |
| `test/cli-actions-data-stack/happy-paths.test.ts` | Data Stack | action | multi-file stack materialization | case audit |
| `test/cli-actions-data-stack/schema-modes.test.ts` | Data Stack | action | union-by-name schema materialization | case audit |
| `test/cli-actions-data-stack/validation.test.ts` | Data Stack | action | schema, input, collision, and overwrite failures | case audit |
| `test/cli-actions-data.test.ts` | Data Conversion | action | JSON, CSV, and TSV conversions | retain |
| `test/cli-actions-doctor-markdown-video-deferred.test.ts` | Doctor / DOCX / Video | action and direct/unit | deferred Doctor reports, dependency inspection, DOCX rendering, and Video validation | split review |
| `test/cli-actions-md-frontmatter-to-json.test.ts` | Markdown Frontmatter | action and command | frontmatter extraction, output, and CLI forwarding | split review |
| `test/cli-actions-md-to-pdf-actions-assets.test.ts` | Markdown PDF | action | render asset access policy | retain |
| `test/cli-actions-md-to-pdf-actions-profile-rendering.test.ts` | Markdown PDF Profile | action | Profile-to-render recipe precedence | case audit |
| `test/cli-actions-md-to-pdf-actions-validation.test.ts` | Markdown PDF | action | render preconditions and renderer failure translation | case audit |
| `test/cli-actions-md-to-pdf-actions.test.ts` | Markdown PDF | action and integration | end-to-end render orchestration and write safety | split review |
| `test/cli-actions-md-to-pdf-bundle.test.ts` | Markdown PDF Bundle | direct/unit and action | bundle discovery, role resolution, and render integration | split review |
| `test/cli-actions-md-to-pdf-code-highlight.test.ts` | Markdown PDF | direct/unit | Shiki HTML transformation | retain |
| `test/cli-actions-md-to-pdf-command-wiring.test.ts` | Markdown PDF | command | render-bundle option forwarding | retain |
| `test/cli-actions-md-to-pdf-commands/direct-render.test.ts` | Markdown PDF | command | direct-render option registration and forwarding | case audit |
| `test/cli-actions-md-to-pdf-commands/profile.test.ts` | Markdown PDF Profile | command | Profile init and Codex subcommands | split review |
| `test/cli-actions-md-to-pdf-commands/project.test.ts` | Markdown PDF Project | command | Codex project command parsing and orchestration | case audit |
| `test/cli-actions-md-to-pdf-commands/template.test.ts` | Markdown PDF Template | command | Template init and Codex subcommands | split review |
| `test/cli-actions-md-to-pdf-css-inspection.test.ts` | Markdown PDF | direct/unit | CSS normalization for policy inspection | retain |
| `test/cli-actions-md-to-pdf-diagnostics.test.ts` | Markdown PDF | direct/unit and action | structured render diagnostics and emission | split review |
| `test/cli-actions-md-to-pdf-no-default-css.test.ts` | Markdown PDF | direct/unit and action | page-number and cover behavior without default CSS | split review |
| `test/cli-actions-md-to-pdf-options.test.ts` | Markdown PDF / Render options | direct/unit | Option normalization and validation | retain |
| `test/cli-actions-md-to-pdf-page-chrome.test.ts` | Markdown PDF / Page chrome | direct/unit | Page-chrome CSS synthesis | split review |
| `test/cli-actions-md-to-pdf-page-number-format.test.ts` | Markdown PDF / Page numbers | direct/unit | Format-token parsing | retain |
| `test/cli-actions-md-to-pdf-page-number-html.test.ts` | Markdown PDF / Page numbers | direct/unit | Rendered-HTML finalization | retain |
| `test/cli-actions-md-to-pdf-pandoc.test.ts` | Markdown PDF / Pandoc compatibility | integration | External Pandoc HTML conversion | retain |
| `test/cli-actions-md-to-pdf-prepared-render.test.ts` | Markdown PDF / Render | action | Prepared render lifecycle | retain |
| `test/cli-actions-md-to-pdf-profile-codex-action/outputs-dry-run.test.ts` | Markdown PDF / Profile Codex | action | Profile artifact output and dry-run behavior | retain |
| `test/cli-actions-md-to-pdf-profile-codex-action/path-alias-safety.test.ts` | Markdown PDF / Profile Codex | evidence/smoke | Profile/report filesystem safety | retain |
| `test/cli-actions-md-to-pdf-profile-codex-action/reports-failures.test.ts` | Markdown PDF / Profile Codex | action | Failure classification and report lifecycle | retain |
| `test/cli-actions-md-to-pdf-profile-codex-action/request-progress.test.ts` | Markdown PDF / Profile Codex | action | Codex request execution and progress presentation | split review |
| `test/cli-actions-md-to-pdf-profile-codex-action/signals-bases.test.ts` | Markdown PDF / Profile Codex | action | Signal-mode and base-Profile orchestration | retain |
| `test/cli-actions-md-to-pdf-profile-codex-command-wiring.test.ts` | Markdown PDF / Profile Codex | command | Commander registration and forwarding | retain |
| `test/cli-actions-md-to-pdf-profile-codex-helpers.test.ts` | Markdown PDF / Profile Codex | direct/unit | Candidate ordering and Profile identity | rename review |
| `test/cli-actions-md-to-pdf-profile-codex-phase2.test.ts` | Markdown PDF / Profile Codex | direct/unit | Candidate loading and bounded signal collection | split review |
| `test/cli-actions-md-to-pdf-profile-codex-prepared.test.ts` | Markdown PDF / Profile Codex | action | Prepared Profile Codex artifact lifecycle | retain |
| `test/cli-actions-md-to-pdf-profile-init.test.ts` | Markdown PDF / Profile init | action | Deterministic Profile initialization | retain |
| `test/cli-actions-md-to-pdf-profile-revision.test.ts` | Markdown PDF / Profile compatibility | direct/unit | Profile revision inference and advisory projection | retain |
| `test/cli-actions-md-to-pdf-profile.test.ts` | Markdown PDF / Profile | direct/unit | Profile schema normalization and serialization | retain |
| `test/cli-actions-md-to-pdf-project-codex-command-wiring.test.ts` | Markdown PDF / Project Codex | command | Commander registration and forwarding | retain |
| `test/cli-actions-md-to-pdf-project-codex/action-write/asset-safety.test.ts` | Markdown PDF / Project Codex | evidence/smoke | Managed-asset read safety | retain |
| `test/cli-actions-md-to-pdf-project-codex/action-write/privacy-redaction.test.ts` | Markdown PDF / Project Codex | evidence/smoke | Action diagnostics and report privacy | retain |
| `test/cli-actions-md-to-pdf-project-codex/action-write/review-dry-run.test.ts` | Markdown PDF / Project Codex | action | Review and dry-run artifact policy | retain |
| `test/cli-actions-md-to-pdf-project-codex/action-write/successful-writes.test.ts` | Markdown PDF / Project Codex | integration | Successful Project bundle handoff | retain |
| `test/cli-actions-md-to-pdf-project-codex/action-write/write-prevention.test.ts` | Markdown PDF / Project Codex | evidence/smoke | Failure atomicity | retain |
| `test/cli-actions-md-to-pdf-project-codex/command-state.test.ts` | Markdown PDF / Project Codex | direct/unit | Project command-state normalization | retain |
| `test/cli-actions-md-to-pdf-project-codex/handoff-equivalence.test.ts` | Markdown PDF / Project Codex | integration | Canonical Project render handoff | retain |
| `test/cli-actions-md-to-pdf-project-codex/output-plan.test.ts` | Markdown PDF / Project Codex | direct/unit | Identity, output planning, and bundle completeness | split review |
| `test/cli-actions-md-to-pdf-project-codex/page-number-compatibility.test.ts` | Markdown PDF / Project Codex | direct/unit | Template CSS ownership validation | retain |
| `test/cli-actions-md-to-pdf-project-codex/prepared.test.ts` | Markdown PDF / Project Codex | action | Prepared Project orchestration | split review |
| `test/cli-actions-md-to-pdf-project-codex/profile-phase.test.ts` | Markdown PDF / Project Codex | action | Project Profile step | retain |
| `test/cli-actions-md-to-pdf-project-codex/signals.test.ts` | Markdown PDF / Project Codex | direct/unit | Project signal classification | retain |
| `test/cli-actions-md-to-pdf-project-codex/template-phase.test.ts` | Markdown PDF / Project Codex | action | Project Template step | retain |
| `test/cli-actions-md-to-pdf-project-codex/validation.test.ts` | Markdown PDF / Project Codex | integration | Project validation and handoff construction | split review |
| `test/cli-actions-md-to-pdf-recipe-fonts.test.ts` | Markdown PDF / Recipe fonts | direct/unit | Recipe font CSS and coverage reporting | split review |
| `test/cli-actions-md-to-pdf-recipe.test.ts` | Markdown PDF / Recipe | direct/unit | HTML and CSS recipe synthesis | retain |
| `test/cli-actions-md-to-pdf-template-body.test.ts` | Markdown PDF / Template | direct/unit | Template body-hook inspection | retain |
| `test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts` | Markdown PDF / Template Codex | integration | Standalone Template Codex action lifecycle | case audit |
| `test/cli-actions-md-to-pdf-template-codex/action.test.ts` | Markdown PDF / Template Codex | action | Top-level deterministic action outcomes | case audit |
| `test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts` | Markdown PDF / Template Codex | evidence/smoke | Final bundle and report write boundary | retain |
| `test/cli-actions-md-to-pdf-template-codex/command-state.test.ts` | Markdown PDF / Template Codex | direct/unit | Template command-state normalization | retain |
| `test/cli-actions-md-to-pdf-template-codex/families.test.ts` | Markdown PDF / Template Codex | direct/unit | Deterministic Template family catalog | retain |
| `test/cli-actions-md-to-pdf-template-codex/font-ownership.test.ts` | Markdown PDF / Template Codex | direct/unit | Profile-to-Template font ownership derivation | retain |
| `test/cli-actions-md-to-pdf-template-codex/image-metadata.test.ts` | Markdown PDF / Template Codex | adapter | Cover-image metadata parsing | retain |
| `test/cli-actions-md-to-pdf-template-codex/output-collisions.test.ts` | Markdown PDF / Template Codex | direct/unit | Source-sink collision validation | retain |
| `test/cli-actions-md-to-pdf-template-codex/output-directory.test.ts` | Markdown PDF / Template Codex | direct/unit | Output-directory admission | retain |
| `test/cli-actions-md-to-pdf-template-codex/output-paths.test.ts` | Markdown PDF / Template Codex | direct/unit | Generated output-path planning | retain |
| `test/cli-actions-md-to-pdf-template-codex/output-targets.test.ts` | Markdown PDF / Template Codex | evidence/smoke | Planned target filesystem safety | retain |
| `test/cli-actions-md-to-pdf-template-codex/prepared.test.ts` | Markdown PDF / Template Codex | action | Prepared Template artifact lifecycle | case audit |
| `test/cli-actions-md-to-pdf-template-codex/signal-collection.test.ts` | Markdown PDF / Template Codex | direct/unit | Bounded Template signal collection | retain |
| `test/cli-actions-md-to-pdf-template-codex/signal-mode.test.ts` | Markdown PDF / Template Codex | direct/unit | Template signal-mode classification | retain |
| `test/cli-actions-md-to-pdf-template-codex/slots.test.ts` | Markdown PDF / Template Codex | direct/unit | Synthesis slot resolution and provenance | retain |
| `test/cli-actions-md-to-pdf-template-codex/template-synthesis/cover-layout.test.ts` | Markdown PDF / Template Codex | direct/unit | Cover layout synthesis | retain |
| `test/cli-actions-md-to-pdf-template-codex/template-synthesis/document-title.test.ts` | Markdown PDF / Template Codex | direct/unit | Document and title synthesis | retain |
| `test/cli-actions-md-to-pdf-template-codex/template-synthesis/font-ownership.test.ts` | Markdown PDF / Template Codex | direct/unit | Ownership-aware font CSS synthesis | retain |
| `test/cli-actions-md-to-pdf-template-codex/template-synthesis/toc-css-branches.test.ts` | Markdown PDF / Template Codex | direct/unit | ToC CSS branch synthesis | retain |
| `test/cli-actions-md-to-pdf-template-compatibility.test.ts` | Markdown PDF / Template compatibility | integration | Selected-template render compatibility | retain |
| `test/cli-actions-md-to-pdf-template-init.test.ts` | Markdown PDF / Template init | action | Deterministic Template initialization | retain |
| `test/cli-actions-rename-apply-replay.test.ts` | Rename / Apply replay | action | Rename-plan replay lifecycle | retain |
| `test/cli-actions-rename-apply-validation.test.ts` | Rename | action | replay-plan validation before filesystem mutation | retain |
| `test/cli-actions-rename-batch-codex-auto.test.ts` | Rename | action | automatic analyzer routing and overrides | retain |
| `test/cli-actions-rename-batch-codex-docs.test.ts` | Rename | action | document-title assistance in batch rename | rename review |
| `test/cli-actions-rename-batch-codex-images.test.ts` | Rename | action | image-assist orchestration, fallback, and eligibility | retain |
| `test/cli-actions-rename-batch-core.test.ts` | Rename | action | core batch preview and apply lifecycle | retain |
| `test/cli-actions-rename-batch-filters.test.ts` | Rename | action | batch candidate filtering | retain |
| `test/cli-actions-rename-batch-preview.test.ts` | Rename | action | preview presentation and skipped-item detail | retain |
| `test/cli-actions-rename-batch-recursion.test.ts` | Rename | action | recursive traversal, depth, and symlink policy | retain |
| `test/cli-actions-rename-cleanup-analysis-report.test.ts` | Rename cleanup | action | cleanup-analysis artifact construction and write lifecycle | retain |
| `test/cli-actions-rename-cleanup-analyzer.test.ts` | Rename cleanup | action | bounded cleanup evidence collection | retain |
| `test/cli-actions-rename-cleanup-codex.test.ts` | Rename cleanup | adapter | Codex suggestion translation, prompt bounds, and failure semantics | retain |
| `test/cli-actions-rename-cleanup-directory.test.ts` | Rename cleanup | action | directory cleanup planning and conflict handling | retain |
| `test/cli-actions-rename-cleanup-matchers.test.ts` | Rename cleanup | direct/unit | cleanup-fragment matching and stem composition | retain |
| `test/cli-actions-rename-cleanup-single.test.ts` | Rename cleanup | action | single-file cleanup preview, apply, and conflict lifecycle | retain |
| `test/cli-actions-rename-cleanup-uid.test.ts` | Rename cleanup | direct/unit | deterministic cleanup UID basename generation | retain |
| `test/cli-actions-rename-cleanup-validation.test.ts` | Rename cleanup | action | cleanup option combinations by target kind | retain |
| `test/cli-actions-rename-codex-internals.test.ts` | Rename | direct/unit | analyzer progress rendering and Codex candidate admission | split review |
| `test/cli-actions-rename-file.test.ts` | Rename | action | single-file core rename plus Codex-assist modes | split review |
| `test/cli-actions-rename-timestamp.test.ts` | Rename | action | effective timestamp-template behavior across file and batch actions | retain |
| `test/cli-actions-video-gif.test.ts` | Video | action | ffmpeg GIF orchestration and temporary-palette cleanup | retain |
| `test/cli-color.test.ts` | CLI foundations | integration | global color-disable controls through the built CLI | retain |
| `test/cli-command-data-codex-timeout.test.ts` | Data Query / Data Stack | command | shared Codex timeout parsing and forwarding for direct data commands | split review |
| `test/cli-command-data-extract-review.test.ts` | Data Extract | command | reviewed header-mapping artifact command flow | case audit |
| `test/cli-command-data-extract-shape.test.ts` | Data Extract | command | Excel range and shaped-workbook extraction through the CLI | case audit |
| `test/cli-command-data-extract-source-shape.test.ts` | Data Extract | command | source-shape review, conflict validation, and artifact reuse | case audit |
| `test/cli-command-data-extract.test.ts` | Data Extract | command | basic CSV and DuckDB extraction through the built CLI | case audit |
| `test/cli-command-data-query-codex-validation.test.ts` | Data Query | command | Codex-lane workspace alias parsing | case audit |
| `test/cli-command-data-query-codex-workspace.test.ts` | Data Query | command | Codex workspace relation parsing and prompt forwarding | case audit |
| `test/cli-command-data-query-codex.test.ts` | Data Query | command | single-source Codex SQL drafting through the built CLI | case audit |
| `test/cli-command-data-query-duckdb-lifecycle.test.ts` | Data Query / DuckDB | command | DuckDB lifecycle subcommand registration | retain |
| `test/cli-command-data-query-duckdb-sources.test.ts` | Data Query | command | DuckDB source and workspace syntax through the built CLI | case audit |
| `test/cli-command-data-query-headers.test.ts` | Data Query | command | header-review artifact command flow | case audit |
| `test/cli-command-data-query-shape.test.ts` | Data Query | command | Excel range, header, and body-start query shape | case audit |
| `test/cli-command-data-query-source-shape.test.ts` | Data Query | command | accepted source-shape reuse and CLI remediation | case audit |
| `test/cli-command-data-query-validation.test.ts` | Data Query | command | query option conflicts, alias parsing, and remediation | case audit |
| `test/cli-command-data-query-workspace.test.ts` | Data Query | command | SQLite workspace relation syntax and execution | case audit |
| `test/cli-command-data-query.test.ts` | Data Query | command | basic format and row-bound query execution | case audit |
| `test/cli-command-data-stack/direct-stack.test.ts` | Data Stack | command | direct stack execution across supported formats | case audit |
| `test/cli-command-data-stack/options.test.ts` | Data Stack | command | stack option parsing, schema modes, traversal, dry-run, and validation | case audit |
| `test/cli-command-data-stack/replay.test.ts` | Data Stack | command | replay artifact validation and materialization | case audit |
| `test/cli-command-doctor.test.ts` | Doctor | command | Doctor registration, view routing, help, and built-CLI conflict behavior | retain |
| `test/cli-command-interactive-timeout.test.ts` | CLI Interactive | command | Interactive timeout option scope and normalization | retain |
| `test/cli-command-markdown-codex-timeout.test.ts` | Markdown | command | Markdown Codex timeout parsing across authoring commands | retain |
| `test/cli-command-output-color.test.ts` | CLI foundations | command | Commander output stream routing and presentation | retain |
| `test/cli-command-rename-cleanup.test.ts` | Rename cleanup | command | cleanup aliases and removed/invalid option parsing | retain |
| `test/cli-command-rename-timeout.test.ts` | Rename | command | scoped and legacy Codex timeout compatibility | retain |
| `test/cli-diagnostic-color.test.ts` | CLI foundations | direct/unit | semantic diagnostic-label color policy | retain |
| `test/cli-doctor-workflow.test.ts` | Doctor | direct/unit | workflow projection, ordering, deduplication, and compact trust boundary | retain |
| `test/cli-fs-utils-rename-template.test.ts` | Rename | direct/unit | planner templates, serial/UID generation, collision policy, and timestamp placeholders | split review |
| `test/cli-interactive-analyzer-status.test.ts` | CLI Interactive infrastructure | direct/unit | reusable non-TTY and mutable-TTY analyzer status | retain |
| `test/cli-interactive-contextual-tip.test.ts` | CLI Interactive infrastructure | direct/unit | contextual tip literals, pool construction, and selection | case audit |
| `test/cli-interactive-data-query-facade.test.ts` | Data Query | direct/unit | legacy Interactive module compatibility facade | retain |
| `test/cli-interactive-data-query-formal-guide.test.ts` | Data Query | direct/unit | formal-guide operator menus and deterministic SQL rendering | retain |
| `test/cli-interactive-data-stack/codex-review.test.ts` | Data Stack | Interactive | Codex recommendation review, report retention, and recovery | retain |
| `test/cli-interactive-data-stack/discovery.test.ts` | Data Stack | Interactive | source discovery recovery and schema setup | retain |
| `test/cli-interactive-data-stack/dry-run-write.test.ts` | Data Stack | Interactive | final review, dry-run plan, destination revision, write, and cleanup lifecycle | retain |
| `test/cli-interactive-markdown-pdf/codex-authoring/entry-setup.test.ts` | Markdown PDF | Interactive | Codex authoring entry matrix and initial setup | retain |
| `test/cli-interactive-markdown-pdf/codex-authoring/font-hint-editing.test.ts` | Markdown PDF | Interactive | font-hint collection mutation and installed-family suggestions | retain |
| `test/cli-interactive-markdown-pdf/codex-authoring/output-recovery-lifecycle.test.ts` | Markdown PDF | Interactive | Codex candidate output binding, acceptance, render, and recovery state | case audit |
| `test/cli-interactive-markdown-pdf/codex-authoring/project-handoff.test.ts` | Markdown PDF | Interactive | Generated Project review and handoff ownership | case audit |
| `test/cli-interactive-markdown-pdf/codex-authoring/regeneration.test.ts` | Markdown PDF | Interactive | Codex candidate invalidation and regeneration | retain |
| `test/cli-interactive-markdown-pdf/codex-progress.test.ts` | Markdown PDF | direct/unit | Interactive Codex progress presentation | retain |
| `test/cli-interactive-markdown-pdf/codex-service-profile-font-ownership.test.ts` | Markdown PDF | integration | Codex preparation across Profile, Template, and Project font ownership | retain |
| `test/cli-interactive-markdown-pdf/deterministic-authoring.test.ts` | Markdown PDF | Interactive | Deterministic recipe authoring, revision, save, and render orchestration | case audit |
| `test/cli-interactive-markdown-pdf/deterministic-service.test.ts` | Markdown PDF | integration | Accepted deterministic recipe preparation, persistence, and reload | retain |
| `test/cli-interactive-markdown-pdf/font-hints.test.ts` | Markdown PDF | direct/unit and adapter | Font-hint model, discovery service, prompt cancellation, and post-Codex review | split review |
| `test/cli-interactive-markdown-pdf/formal-guide-prompts.test.ts` | Markdown PDF | adapter | Formal-guide prompt choices, defaults, validation, and revision initial values | retain |
| `test/cli-interactive-markdown-pdf/formal-guide.test.ts` | Markdown PDF | direct/unit | Formal-guide answer collection, revision, compilation, and normalization | split review |
| `test/cli-interactive-markdown-pdf/handoff.test.ts` | Markdown PDF | Interactive | Saved-recipe selection, overrides, preparation sample, and repeated authoring | case audit |
| `test/cli-interactive-markdown-pdf/lifecycle-unit.test.ts` | Markdown PDF | direct/unit | Factory-owned temporary-session cleanup | retain |
| `test/cli-interactive-markdown-pdf/lifecycle.test.ts` | Markdown PDF | Interactive | Generated recipe render, recovery, collision, and cleanup lifecycle | case audit |
| `test/cli-interactive-markdown-pdf/materialization.test.ts` | Markdown PDF | integration | Candidate binding, single-write discipline, ownership, and alias guards | retain |
| `test/cli-interactive-markdown-pdf/page-number-review.test.ts` | Markdown PDF | direct/unit | Page-number review formatting and generated configuration resolution | retain |
| `test/cli-interactive-markdown-pdf/render-page-number-preparation.test.ts` | Markdown PDF | adapter | Translation from Interactive page-number choice to render input | retain |
| `test/cli-interactive-markdown-pdf/render-page-numbers.test.ts` | Markdown PDF | adapter | Interactive page-number choice prompt | retain |
| `test/cli-interactive-markdown-pdf/render-sources.test.ts` | Markdown PDF | Interactive | Existing recipe source selection, override review, output planning, and render execution | case audit |
| `test/cli-interactive-menu-prompt.test.ts` | CLI foundations | adapter | Root and submenu select prompt Escape behavior | retain |
| `test/cli-interactive-menu.test.ts` | CLI foundations and Doctor | Interactive | Menu stream wiring plus Doctor output selection and rendering | split review |
| `test/cli-interactive-notice.test.ts` | CLI foundations | direct/unit | Abort notice width policy and stderr tip coloring | retain |
| `test/cli-interactive-rename-cleanup-analyzer-rendering.test.ts` | Rename | Interactive | Analyzer group and example preview truncation | retain |
| `test/cli-interactive-rename-cleanup-analyzer-review.test.ts` | Rename | Interactive | Analyzer family narrowing before Codex suggestion | retain |
| `test/cli-interactive-rename-cleanup-codex-timestamp.test.ts` | Rename | Interactive | Suggested cleanup timestamp-action forwarding | retain |
| `test/cli-interactive-rename-cleanup-codex.test.ts` | Rename | Interactive | Analyzer-assisted cleanup, report persistence, and manual fallback | retain |
| `test/cli-interactive-rename-cleanup-retention.test.ts` | Rename | Interactive | Cleanup plan and analysis-report retention after dry-run or apply | retain |
| `test/cli-interactive-rename-cleanup.test.ts` | Rename | Interactive | Core cleanup file and directory routing | retain |
| `test/cli-interactive-rename.test.ts` | Rename | Interactive | Session option forwarding into custom and batch rename | rename review |
| `test/cli-interactive-routing-data-convert.test.ts` | Data Convert | Interactive | Conversion source and target prompt routing | retain |
| `test/cli-interactive-routing-data-extract-checkpoints.test.ts` | Data Extract | Interactive | Pre-write confirmation and checkpoint backtracking | case audit |
| `test/cli-interactive-routing-data-extract-core.test.ts` | Data Extract | Interactive | Shared extraction execution for ordinary and DuckDB sources | retain |
| `test/cli-interactive-routing-data-extract-revision.test.ts` | Data Extract | Interactive | Setup, destination, source-shape, and header revision | case audit |
| `test/cli-interactive-routing-data-preview-filters.test.ts` | Data Preview | Interactive | Repeated contains-filter collection and local validation | retain |
| `test/cli-interactive-routing-data-preview.test.ts` | Data Preview | Interactive | Lightweight CSV and Parquet preview routing | retain |
| `test/cli-interactive-routing-data-query-codex-single.test.ts` | Data Query | Interactive | Single-source Codex intent, SQL review, recovery, and JSON stream hygiene | case audit |
| `test/cli-interactive-routing-data-query-codex-workspace.test.ts` | Data Query | Interactive | Workspace Codex drafting and SQL-review navigation | case audit |
| `test/cli-interactive-routing-data-query-formal.test.ts` | Data Query | Interactive | Formal-guide SQL construction, validation, and output checkpoint | case audit |
| `test/cli-interactive-routing-data-query-headers.test.ts` | Data Query | Interactive | Header suggestion review and source reinspection | case audit |
| `test/cli-interactive-routing-data-query-manual.test.ts` | Data Query | Interactive | Manual SQL routing across single and workspace sources | case audit |
| `test/cli-interactive-routing-data-query-review.test.ts` | Data Query | Interactive | SQL/output review, mode change, cancel, and overwrite recovery | case audit |
| `test/cli-interactive-routing-data-query-source-shape.test.ts` | Data Query | direct/unit and Interactive | Introspection presentation plus Excel and DuckDB source-shape recovery | split review |
| `test/cli-interactive-routing-data-query-workspace.test.ts` | Data Query | Interactive | Workspace alias validation and mode transitions | case audit |
| `test/cli-interactive-routing-data-stack.test.ts` | Data Stack | Interactive | Stack workflow routing into shared execution | retain |
| `test/cli-interactive-routing-video.test.ts` | Video | Interactive | Compressed GIF generation routing | case audit |
| `test/cli-interactive-routing.test.ts` | CLI foundations | evidence/smoke | Root and submenu dispatch across Doctor, Data, Markdown, Rename, and Video | case audit |
| `test/cli-markdown-pdf-profile-authoring-review.test.ts` | Markdown PDF | direct/unit | Shared Profile advisory review normalization and safe rendering | retain |
| `test/cli-markdown-pdf-renderer-capabilities.test.ts` | Markdown PDF | direct/unit and integration | Capability catalog, effective-request collection, and pre-write renderer gate | split review |
| `test/cli-markdown-pdf-requirements.test.ts` | Markdown PDF | direct/unit | Pandoc version comparison and combined renderer dependency readiness | retain |
| `test/cli-markdown-pdf-warning-output.test.ts` | Markdown PDF | direct/unit | Render-warning stderr formatting and color eligibility | retain |
| `test/cli-options-codex-timeout.test.ts` | CLI foundations | direct/unit | Codex timeout parsing, precedence, conflicts, and legacy notices | retain |
| `test/cli-options-parsers.test.ts` | Data Query | direct/unit | Relation option bundle parsing | rename review |
| `test/cli-path-inline-state.test.ts` | CLI foundations | direct/unit | Inline path completion and sibling-preview state transitions | retain |
| `test/cli-path-inline.test.ts` | CLI foundations | integration | Raw-terminal inline path controller | retain |
| `test/cli-path-sibling-preview.test.ts` | CLI foundations | integration | Filesystem sibling browsing and preview scope keys | retain |
| `test/cli-path-suggestions.test.ts` | CLI foundations | integration | Filesystem path suggestion ranking, visibility, filtering, and caps | retain |
| `test/cli-path.test.ts` | CLI foundations | adapter | Advanced-to-simple path prompt fallback | rename review |
| `test/cli-rename-interactive-router.test.ts` | Rename | direct/unit | Smart route inference and option precedence | retain |
| `test/cli-rename-preview.test.ts` | Rename | direct/unit | Rename preview budgeting, composition, skipped summaries, and CSV replay | retain |
| `test/cli-rename-template.test.ts` | Rename | direct/unit | Rename-template parsing and timestamp rewriting | retain |
| `test/cli-text-display-width.test.ts` | CLI foundations | direct/unit | Terminal grapheme display width | retain |
| `test/cli-text-inline.test.ts` | CLI foundations | Interactive | Inline prompt completion, rendering, cancellation, and fallback lifecycle | split review |
| `test/cli-text-template-candidates.test.ts` | CLI foundations | direct/unit | Template-completion candidate resolution | retain |
| `test/cli-tui-inline-renderer.test.ts` | CLI foundations | direct/unit | Wrapped inline-frame repainting | retain |
| `test/cli-tui-keys.test.ts` | CLI foundations | direct/unit | Keypress stream normalization | retain |
| `test/cli-tui-raw-session.test.ts` | CLI foundations | adapter | TTY raw-session setup and teardown | retain |
| `test/cli-tui-screen.test.ts` | CLI foundations | direct/unit | ANSI screen primitives | retain |
| `test/cli-ux.test.ts` | CLI command families | command | Root and cross-feature CLI help, parsing, paths, and process output | split review |
| `test/data-duckdb-extensions.test.ts` | DuckDB adapter | adapter | Managed extension install and load lifecycle | retain |
| `test/data-extract-fixture-generator.test.ts` | Shared data fixtures | evidence/smoke | Deterministic Data Extract fixture generation | fixture/helper review |
| `test/data-query-duckdb-fixture-generator.test.ts` | Data Query | evidence/smoke | Deterministic DuckDB fixture generation | retain |
| `test/data-query-fixture-generator.test.ts` | Data Query | evidence/smoke | Deterministic tabular query fixture generation | retain |
| `test/data-query-header-mapping.test.ts` | Data Query | direct/unit | Header-mapping suggestion, artifact persistence, and exact reuse | case audit |
| `test/data-query-xlsx-sources.test.ts` | Spreadsheet source adapter | adapter | XLSX ZIP metadata and sheet snapshot discovery | move-only review |
| `test/data-source-shape.test.ts` | Shared data shaping | direct/unit | Source-shape suggestion, artifact I/O, compatibility, and reuse | move-only review |
| `test/data-stack-artifact-paths.test.ts` | Data Stack | direct/unit | Dry-run plan and report path collision policy | retain |
| `test/data-stack-codex-report/apply.test.ts` | Data Stack | direct/unit | Codex recommendation application and lineage | retain |
| `test/data-stack-codex-report/validation.test.ts` | Data Stack | direct/unit | Codex report schema and patch validation | retain |
| `test/data-stack-codex-signals.test.ts` | Data Stack | direct/unit | Codex-assist signal derivation and labels | retain |
| `test/data-stack-diagnostics.test.ts` | Data Stack | direct/unit | Duplicate, key, and bounded-column diagnostics | retain |
| `test/data-stack-fixture-generator.test.ts` | Data Stack | evidence/smoke | Data Stack fixture lifecycle and cleanup safety | retain |
| `test/data-stack-input-router.test.ts` | Data Stack | direct/unit | Mixed input discovery and routing | retain |
| `test/data-stack-plan/identity-serialization.test.ts` | Data Stack | direct/unit | Stack-plan identity, construction, and serialization | retain |
| `test/data-stack-plan/parse-io.test.ts` | Data Stack | direct/unit | Stack-plan parsing, validation, and filesystem I/O | retain |
| `test/fonts-cli-check-output.test.ts` | Fonts | action | Font-check text and warning rendering | case audit |
| `test/fonts-cli-check-provider.test.ts` | Fonts | action | Coverage-provider result mapping and exit status | case audit |
| `test/fonts-cli-check-selection.test.ts` | Fonts | action | Deterministic font face selection for coverage | retain |
| `test/fonts-cli-check-ttc.test.ts` | Fonts | action | TTC-specific font-check result rendering | retain |
| `test/fonts-cli-check-validation.test.ts` | Fonts | action | Font-check input and text-file validation | retain |
| `test/fonts-cli-inspect-debug.test.ts` | Fonts | action | Font-inspect discovery warnings and debug output | retain |
| `test/fonts-cli-inspect-matching.test.ts` | Fonts | action | Font-inspect query matching and family grouping | case audit |
| `test/fonts-cli-inspect-output.test.ts` | Fonts | action | Font-inspect text and JSON schemas | retain |
| `test/fonts-cli-inspect-validation.test.ts` | Fonts | action | Font-inspect required-family validation | retain |
| `test/fonts-cli-list.test.ts` | Fonts | action | Font-list output, diagnostics, deduplication, and limits | retain |
| `test/fonts-cli-registration.test.ts` | Fonts | command | Font command registration and option parsing | retain |
| `test/fonts-coverage-fontconfig.test.ts` | Fonts | adapter | Fontconfig coverage query and classification | retain |
| `test/fonts-coverage-samples.test.ts` | Fonts | direct/unit | Controlled language samples and charset parsing | retain |
| `test/fonts-coverage-ttc-inconclusive.test.ts` | Fonts | adapter | TTC coverage inconclusive classification | retain |
| `test/fonts-coverage-ttc.test.ts` | Fonts | adapter | Indexed TTC fontconfig coverage | retain |
| `test/fonts-discovery-cancellation.test.ts` | Fonts | adapter | Discovery signal, timeout, abort, and fallback controls | retain |
| `test/fonts-discovery-parsers.test.ts` | Fonts | adapter | Platform font-discovery response parsing | retain |
| `test/fonts-discovery.test.ts` | Fonts | adapter | Cross-platform discovery selection and fallback | retain |
| `test/fonts-matching.test.ts` | Fonts | direct/unit | Shared family and face matching | retain |
| `test/fonts-search-ranking.test.ts` | Fonts | direct/unit | Installed-font search scoring and result order | retain |
| `test/fonts-search-records.test.ts` | Fonts | direct/unit | Searchable family record construction | retain |
| `test/markdown-pdf-code-fixture-generator.test.ts` | Markdown PDF | evidence/smoke | Code-render fixture and smoke-output lifecycle | retain |
| `test/markdown-pdf-font-discovery-evidence-spike.test.ts` | Markdown PDF | evidence/smoke | Public-safe repeated font-discovery evidence collection | retain |
| `test/markdown-pdf-page-number-project-renderer-contract.test.ts` | Markdown PDF | evidence/smoke | Deterministic renderer candidate projects | case audit |
| `test/markdown-pdf-page-number-renderer-evidence/inspection.test.ts` | Markdown PDF | evidence/smoke | PDF extraction and renderer-contract validation | retain |
| `test/markdown-pdf-page-number-renderer-evidence/laboratory.test.ts` | Markdown PDF | evidence/smoke | Owned evidence laboratory and subprocess safety | retain |
| `test/markdown-pdf-page-number-renderer-evidence/orchestration.test.ts` | Markdown PDF | evidence/smoke | Renderer candidate selection, launch, and evidence classification | case audit |
| `test/markdown-pdf-profile-font-preservation-smoke.test.ts` | Markdown PDF | evidence/smoke | Profile font-preservation smoke harness and destructive safety | retain |
| `test/release-scripts.test.ts` | Release tooling | integration | Release-branch policy and stable-note publication scripts | split review |
| `test/stacked-merged-band-fixture-generator.test.ts` | Shared spreadsheet fixtures | evidence/smoke | Deterministic merged-band workbook generation | fixture/helper review |
| `test/utils-datetime.test.ts` | Utilities | direct/unit | Filename-safe UTC and local datetime formatting | retain |
| `test/version-embedded-sync.test.ts` | Release tooling | integration | Embedded CLI version synchronization | retain |

## Audited Support Files

The baseline contained 66 TypeScript support files outside `*.test.ts`. A row
marked `ownership review required` crossed feature or platform boundaries at
the audit baseline; the completed catalog records the settled current rule.

| Audited support path | Baseline owner | Baseline review state |
| --- | --- | --- |
| `test/adapters-codex-markdown-pdf-profile/fixtures.ts` | Markdown PDF profile Codex adapter | owned through consuming suites |
| `test/adapters-codex-markdown-pdf-template/fixtures.ts` | Markdown PDF template Codex adapter | ownership review required |
| `test/cli-actions-data-extract.helpers.ts` | Data Extract action suites | ownership review required |
| `test/cli-actions-data-preview/helpers.ts` | Data Preview action suites | ownership review required |
| `test/cli-actions-data-query-codex.helpers.ts` | Data Query Codex action suites | ownership review required |
| `test/cli-actions-data-query.helpers.ts` | Data Query action suites | ownership review required |
| `test/cli-actions-md-to-pdf-commands/fixtures.ts` | Markdown PDF command suites | owned through consuming suites |
| `test/cli-actions-md-to-pdf-profile-codex-action/fixtures.ts` | Markdown PDF profile Codex action suites | ownership review required |
| `test/cli-actions-md-to-pdf-project-codex/action-write/fixtures.ts` | Markdown PDF Project Codex action-write suites | owned through consuming suites |
| `test/cli-actions-md-to-pdf-template-codex/fixtures.ts` | Markdown PDF Template Codex action suites | ownership review required |
| `test/cli-actions-md-to-pdf-template-codex/synthesis-fixtures.ts` | Markdown PDF Template Codex synthesis suites | ownership review required |
| `test/cli-actions-md-to-pdf-template-codex/template-synthesis/css-assertions.ts` | Markdown PDF Template Codex synthesis suites | owned through consuming suites |
| `test/cli-actions-md-to-pdf.helpers.ts` | Markdown PDF rendering action suites | ownership review required |
| `test/cli-command-data-extract.helpers.ts` | Data Extract command suites | ownership review required |
| `test/cli-command-data-query-codex.helpers.ts` | Data Query Codex command suites | ownership review required |
| `test/cli-command-data-query.helpers.ts` | Data Query command suites | ownership review required |
| `test/cli-interactive-data-stack/helpers.ts` | Interactive Data Stack suites | ownership review required |
| `test/cli-interactive-markdown-pdf/codex-authoring/fixtures.ts` | Interactive Markdown PDF Codex authoring suites | owned through consuming suites |
| `test/cli-interactive-routing.helpers.ts` | Interactive CLI routing suites | ownership review required |
| `test/fixtures/markdown-pdf/page-number-renderer-contract.ts` | Markdown PDF page-number renderer contract | owned through consuming suites |
| `test/fixtures/markdown-pdf/page-number-renderer-contract/body-hooks.ts` | Markdown PDF page-number renderer contract | owned through consuming suites |
| `test/fixtures/markdown-pdf/page-number-renderer-contract/candidates.ts` | Markdown PDF page-number renderer contract | owned through consuming suites |
| `test/fixtures/markdown-pdf/page-number-renderer-contract/constants.ts` | Markdown PDF page-number renderer contract | owned through consuming suites |
| `test/fixtures/markdown-pdf/page-number-renderer-contract/counter-experiments.ts` | Markdown PDF page-number renderer contract | owned through consuming suites |
| `test/fixtures/markdown-pdf/page-number-renderer-contract/materialize.ts` | Markdown PDF page-number renderer contract | owned through consuming suites |
| `test/fixtures/markdown-pdf/page-number-renderer-contract/product-scenarios.ts` | Markdown PDF page-number renderer contract | owned through consuming suites |
| `test/fixtures/markdown-pdf/page-number-renderer-contract/project-scenarios.ts` | Markdown PDF page-number renderer contract | owned through consuming suites |
| `test/fixtures/markdown-pdf/page-number-renderer-contract/renderer-scenarios.ts` | Markdown PDF page-number renderer contract | owned through consuming suites |
| `test/fixtures/markdown-pdf/page-number-renderer-contract/shared-content.ts` | Markdown PDF page-number renderer contract | owned through consuming suites |
| `test/fixtures/markdown-pdf/page-number-renderer-contract/types.ts` | Markdown PDF page-number renderer contract | owned through consuming suites |
| `test/helpers/cli-action-test-utils.ts` | Cross-feature CLI action tests | ownership review required |
| `test/helpers/cli-test-utils.ts` | Repository-wide CLI tests | ownership review required |
| `test/helpers/data-extract-fixture-test-utils.ts` | Data Extract and Data Query fixture tests | ownership review required |
| `test/helpers/data-query-duckdb-fixture-test-utils.ts` | Data Extract and Data Query DuckDB fixture tests | ownership review required |
| `test/helpers/data-stack-test-utils.ts` | Data Stack plan and Codex report tests | owned through consuming suites |
| `test/helpers/doctor-test-fixtures.ts` | Doctor direct, action, command, workflow, and menu projection tests | owned through consuming suites |
| `test/helpers/interactive-harness.ts` | Cross-feature interactive CLI tests | ownership review required |
| `test/helpers/interactive-harness/context.ts` | Cross-feature interactive harness | ownership review required |
| `test/helpers/interactive-harness/index.ts` | Cross-feature interactive harness | ownership review required |
| `test/helpers/interactive-harness/mocks/action-data-shared.ts` | Interactive Data Extract, Data Query, and Data Stack mocks | ownership review required |
| `test/helpers/interactive-harness/mocks/action-data.ts` | Interactive Data Extract and Data Query mocks | ownership review required |
| `test/helpers/interactive-harness/mocks/action-misc.ts` | Mixed interactive Doctor, Data Preview, conversion, Markdown, DOCX, and Video mocks | ownership review required |
| `test/helpers/interactive-harness/mocks/action-rename.ts` | Interactive Rename tests | owned through consuming suites |
| `test/helpers/interactive-harness/mocks/action-stack.ts` | Interactive Data Stack tests | owned through consuming suites |
| `test/helpers/interactive-harness/mocks/actions.ts` | Cross-feature interactive action mocks | ownership review required |
| `test/helpers/interactive-harness/mocks/data-query/codex.ts` | Data Query interactive Codex flow | owned through consuming suites |
| `test/helpers/interactive-harness/mocks/data-query/header-mapping.ts` | Data Query interactive header mapping | owned through consuming suites |
| `test/helpers/interactive-harness/mocks/data-query/index.ts` | Data Query and Data Extract interactive mock installation | ownership review required |
| `test/helpers/interactive-harness/mocks/data-query/query.ts` | Data Query and Data Extract DuckDB introspection mock | ownership review required |
| `test/helpers/interactive-harness/mocks/data-query/source-shape.ts` | Data Query and Data Extract source-shape mock | ownership review required |
| `test/helpers/interactive-harness/mocks/data-query/types.ts` | Data-query mock support types | ownership review required |
| `test/helpers/interactive-harness/mocks/data-query/workspace.ts` | Data Query interactive workspace introspection | owned through consuming suites |
| `test/helpers/interactive-harness/mocks/fs.ts` | Global interactive harness filesystem mock | ownership review required |
| `test/helpers/interactive-harness/mocks/index.ts` | Global interactive harness mock coordinator | ownership review required |
| `test/helpers/interactive-harness/mocks/markdown-pdf.ts` | Markdown PDF interactive flow | owned through consuming suites |
| `test/helpers/interactive-harness/mocks/path-prompts.ts` | Global interactive path-prompt mocking | ownership review required |
| `test/helpers/interactive-harness/mocks/prompts.ts` | Global interactive prompt mocking | ownership review required |
| `test/helpers/interactive-harness/module-urls.ts` | Cross-feature interactive harness module registry | ownership review required |
| `test/helpers/interactive-harness/runner.ts` | Cross-feature interactive subprocess harness | ownership review required |
| `test/helpers/interactive-harness/runtime.ts` | Global interactive harness runtime capture | ownership review required |
| `test/helpers/interactive-harness/types.ts` | Cross-feature interactive scenario and result schema | ownership review required |
| `test/helpers/rename-apply-test-utils.ts` | Rename Apply validation fixtures | owned through consuming suites |
| `test/helpers/rename-plan-test-utils.ts` | Global CLI cleanup for Rename plan artifacts | ownership review required |
| `test/helpers/stacked-merged-band-fixture-test-utils.ts` | Data Query XLSX source fixture | owned through consuming suites |
| `test/helpers/virtual-terminal.ts` | CLI inline-rendering infrastructure | ownership review required |
| `test/markdown-pdf-page-number-renderer-evidence/support.ts` | Markdown PDF page-number renderer evidence | owned through consuming suites |

## Related Records

- [Test Catalog Path Correspondence](test-catalog-path-correspondence.md)
- [Test Suite Contract Ownership Catalog](test-suite-case-matrices.md)
- [Test Suite Contract And Catalog Enhancement Job](../plans/jobs/2026-08-23-test-suite-contract-and-catalog-enhancement.md)
