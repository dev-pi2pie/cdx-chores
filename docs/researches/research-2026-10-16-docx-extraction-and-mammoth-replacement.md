---
title: "DOCX Extraction and Mammoth Replacement"
created-date: 2026-10-16
modified-date: 2026-10-16
status: in-progress
agent: codex
---

## Goal and Scope

Evaluate whether a focused, project-owned TypeScript/Node DOCX reader can replace Mammoth while preserving the document evidence and integration mechanics used by semantic rename, with acceptable complexity and maintenance cost.

The current Mammoth integration is the compatibility baseline; the outcome is a recommendation to proceed with or defer the rewrite. Removing Mammoth's transitive `argparse > sprintf-js` dependency is a motivation. Success requires complete Mammoth removal from runtime and development dependencies, the lockfile, and installed repository and consumer dependency trees. Production code, tests, and historical tooling must no longer require it.

Investigate metadata, ordered text, and headings for the existing DOCX rename workflow, including when unsupported or malformed input permits best-effort extraction or requires a warning or failure.

Here, a project-owned reader means TypeScript/JavaScript running in Node.js with the existing ZIP/XML dependencies. It does not mean a compiled native addon, another language runtime, or a bundled external converter. Maintaining a Mammoth fork is outside this investigation.

Dependency overrides, patches, and upstream Mammoth upgrades belong to separate dependency maintenance. Upstream source references remain the basis for understanding current behavior.

Full DOCX-to-HTML conversion, layout rendering, images/OCR, legacy `.doc` support, new CLI commands, and replacing Markdown-to-DOCX generation are outside this research. The existing `md to-docx` action in `src/cli/actions/markdown/to-docx.ts` uses Pandoc.

## Current Code and Reader-Facing Contract

DOCX files participate in semantic rename under `--codex-docs`; extraction is documented as best-effort and fallback-safe.[^rename-guide] Paths and diagrams describe the reviewed snapshot, commit `8c75fdb831fab3b8348ae46e4f3b023281db2b25`, rather than a required future file layout.

### Current flow

The DOCX adapter gathers three inputs before applying consumer policy:

```text
DOCX input
    |
    v
Existing document dispatcher
    |
    v
Existing DOCX rename adapter
    |
    +-- Mammoth HTML --> h1..h6 heading signals --+
    +-- Mammoth raw text --> body/raw lines ------+--> Adapter policy
    `-- OOXML metadata --> properties/warnings ---+       |
                                                        v
                                          Normalization / ranking / limits
                                                        |
                         +------------------------------+------------------+
                         |                                                 |
                         v                                                 v
                DocumentTitleEvidence                               Extraction reason
                         |                                                 |
                         v                                                 v
                Existing prompt / Codex flow                  Existing deterministic fallback
```

### Current source map

```text
src/
|-- adapters/
|   |-- codex/document-rename/
|   |   |-- batch.ts                  DOCX dispatch and Codex batch orchestration
|   |   |-- extractors/
|   |   |   |-- docx.ts               DOCX evidence assembly and title ranking
|   |   |   `-- shared.ts             Normalization and candidate helpers
|   |   |-- types.ts                  Evidence contract and consumer limits
|   |   `-- prompt.ts                 Complete evidence-to-prompt projection
|   `-- docx/
|       |-- ooxml-package.ts          ZIP reading and XML decoding
|       |-- ooxml-part-path.ts        Package-part path normalization
|       |-- ooxml-part-discovery.ts   Metadata-part discovery
|       |-- ooxml-metadata-parser.ts  Property parsing
|       `-- ooxml-metadata.ts         Metadata-read orchestration
|-- cli/actions/
|   |-- rename/codex/analyzer.ts      Rename integration and fallback reason propagation
|   `-- markdown/to-docx.ts           Separate Pandoc generation action
`-- markdown/                        Existing Markdown parsing subsystem
```

The dispatcher in `src/adapters/codex/document-rename/batch.ts` routes `.docx` inputs to the asynchronous `extractDocxEvidence(path)` adapter, which returns `DocumentTitleEvidence | { reason: string }`. Its effective contract includes:

| Area             | Current behavior                                                                                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document body    | Calls `convertToHtml({ buffer })` and `extractRawText({ buffer })`; HTML is intermediate evidence, not a rendered product artifact.                                                                                                     |
| Headings         | Extracts HTML `h1` through `h6`, preserves level for ranking, and emits up to eight unique heading strings. `tocCandidates` currently repeats those strings; it is not an independently parsed DOCX table of contents.                  |
| Title candidates | Prioritizes core title metadata, meaningful H1/early headings, and body text according to the existing weak-title rules; returns at most four unique candidates.                                                                        |
| Lead text        | Normalizes raw-text lines, removes blank lines, then uses the shared first-paragraph helper with an 800-character limit. Preserving blank-line paragraph boundaries here would change current behavior.                                 |
| Metadata         | Reads core properties and application information through the existing OOXML reader. Creator supplies author candidates. Missing metadata can coexist with usable body evidence.                                                        |
| Diagnostics      | Preserves metadata warnings, can add `docx_no_lead_text`, and returns `docx_no_title_signal` or `docx_extract_error` when evidence cannot be produced. Mammoth conversion messages are not currently copied into the evidence warnings. |
| Provenance       | Sets `metadata.extractor` to `mammoth+ooxml` or `mammoth`; a replacement must use an accurate identity and update affected expectations.                                                                                                |

When no title candidates, lead text, or headings survive, the adapter returns `docx_no_title_signal` if either HTML or raw text remains nonempty after trimming; otherwise it returns `docx_extract_error`. Non-text HTML can therefore affect the reason. A usable metadata title can produce evidence with `docx_no_lead_text` when body evidence is empty, provided conversion succeeds. A thrown read/conversion error returns `docx_extract_error` even if metadata is available.

The evidence contract and limits live in `src/adapters/codex/document-rename/types.ts`; shared normalization and candidate helpers live in `src/adapters/codex/document-rename/extractors/shared.ts`. These are rename-consumer responsibilities. The reusable reader should supply document facts without selecting rename titles.

The prompt builder in `src/adapters/codex/document-rename/prompt.ts` forwards the complete evidence object, including warnings and extractor metadata, while adapting filename fields for prompt identity. Adding a parser warning changes model input even when title candidates and lead text are unchanged.

## Key Findings

### Mammoth's parsing path uses JavaScript in Node.js

The installed `mammoth@1.13.0` library path uses JavaScript for package reading, XML parsing, and document interpretation:

| Component                  | Observed implementation                                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library integration        | The DOCX rename adapter shown in the current source map calls `convertToHtml({ buffer })` and `extractRawText({ buffer })` directly; it does not launch Mammoth's CLI.              |
| CLI entry point            | `bin/mammoth` is a JavaScript script with a Node shebang. It imports the JavaScript `argparse` package; no Python interpreter is involved.[^mammoth-cli]                            |
| ZIP decompression          | Mammoth uses JSZip; the installed JSZip implementation uses Pako's JavaScript DEFLATE support.[^mammoth-zip][^jszip-flate]                                                          |
| XML parsing                | Mammoth uses the JavaScript `@xmldom/xmldom` package.[^mammoth-xml]                                                                                                                 |
| Browser-bundle preparation | Mammoth's package manifest declares a `prepare` command using `make` to build its browser bundle. That command is separate from the library's DOCX parsing path.[^mammoth-manifest] |

The reviewed parsing path does not require Word, LibreOffice, Pandoc, an external unzip command, or a separate compiled conversion engine. Reading or base64-encoding embedded image bytes does not require rendering or OCR.[^mammoth-images] Removing a non-JavaScript engine is therefore not a rewrite benefit. This source review is not an exhaustive security audit or a guarantee about future versions.

### Existing DOCX infrastructure is reusable, with limits

`src/adapters/docx/` already contains ZIP reading through `yauzl`, XML decoding, package-path normalization, metadata-part discovery, and property parsing through `fast-xml-parser`. The current source map identifies these helper responsibilities.

The package reader collects XML/relationship parts and skips parts whose declared uncompressed size exceeds 256 KiB. This metadata-oriented cap does not establish document-body or aggregate resource budgets. Generalizing it requires selected-part reading and explicit oversized-input outcomes; the resource checks below define the broader evaluation.

Metadata discovery in `src/adapters/docx/ooxml-part-discovery.ts` already ignores external relationship targets. The metadata tests described below cover non-default part locations, UTF-16, dot-segments, and percent-escaped paths. Main-document and style-part discovery need their own relationship/content-type handling; metadata discovery does not already provide a general content reader.

### The dependency issue is separate from DOCX conversion fidelity

The reviewed installation uses `mammoth@1.13.0 > argparse@1.0.10 > sprintf-js@1.0.3`. The moderate precision-specifier advisory lists versions through `1.1.3` as affected and no patched version as of this review.[^advisory] The October maintenance record documents the library/CLI boundary and limits of its static assessment; its validation of the existing dependency set is not replacement compatibility evidence.[^maintenance]

An earlier installed-tree inventory and blocked-import diagnostic lack reproducible checks and identified inputs; neither is decision evidence. Any future use requires a linked harness, identified inputs, and asserted outcomes. Import-blocking checks must install interception before loading Mammoth and independently assert positive controls and per-fixture conversion attempts. Neither a lockfile nor successful conversions establish installed-file contents, replacement fidelity, or universal advisory non-reachability.

### Phase 1 consumer inventory

The execution baseline is recorded in the [unified record](../plans/jobs/2026-10-16-docx-reader-and-mammoth-replacement.md); intervening changes from the research snapshot affected documentation only.

| Surface | Migration responsibility |
| --- | --- |
| Production | `src/adapters/codex/document-rename/extractors/docx.ts` imports Mammoth for HTML/raw-text conversion. Preserve dispatch, ranking, prompts, and fallback. |
| Tests | Current title-evidence and file-rename application tests assert provenance, routing, and failure behavior. OOXML metadata tests remain reusable. |
| Historical tooling | `scripts/spikes/docx-pdf-title-evidence-spike.ts` imports Mammoth. Preserve useful PDF comparisons and linked historical findings before changing or retiring its DOCX path. |
| Baseline tooling | `scripts/docx-baseline/capture.ts` imports Mammoth for comparisons and the external-file positive control. Retain expectations when later migrating or retiring this dependency. |
| Build and declarations | Production ESM/CJS outputs keep Mammoth external; Mammoth supplies its own declarations. No repository ambient declaration needs migration. |
| Dependencies | The manifest, lockfile, and baseline installed tree retain the Mammoth/Argparse/`sprintf-js` chain above. No independent JavaScript path was found; Python's standard-library `argparse` reference is unrelated. |

### Existing tests provide a starting comparison corpus

The title-evidence tests in `test/document-rename/adapters/title-evidence.app.test.ts` cover core metadata precedence, weak/no-heading body fallbacks, table-heavy and hyperlink-heavy documents, and an alternate-editor document whose metadata is unavailable. Metadata-specific tests in `test/markdown-docx/adapters/ooxml-metadata.app.test.ts` also cover malformed properties, missing metadata, invalid ZIP bytes, and absence of runtime fetching for relationship identifiers.

These assertions validate selected evidence fields. They do not exhaustively cover Mammoth's supported WordprocessingML structures. DOCX contains paragraphs, runs, text, styles, and additional document parts; simple text-node concatenation is not sufficient to define the intended reading behavior.[^word-structure]

### Feature presence and rename evidence need separate tracing

Source inspection identifies the paths below. Phase 1 captures their current outcomes; candidate compatibility remains unverified:

| Feature                              | Observed path and remaining question                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text boxes                           | The body reader explicitly traverses `v:textbox` and `w:txbxContent`. Compare their text, headings, and ordering through both APIs before deciding on support; do not preclassify text boxes as unsupported.[^mammoth-body]                                                                                                                                                                       |
| Tables, lists, fields, and revisions | Mammoth has dedicated table, numbering, and field handling, plus inclusion/exclusion logic for revisions. Establish the actual resulting text and heading signals before adopting a simpler content policy.[^mammoth-body][^mammoth-docx-reader]                                                                                                                                                  |
| Symbols and heading mappings         | The body reader maps supported symbol characters to Unicode. HTML conversion also uses default and embedded style mappings. Identify which mappings affect headings or title text instead of assuming all evidence comes from ordinary `w:t` nodes and standard heading names.[^mammoth-body][^mammoth-entry][^mammoth-options]                                                                   |
| Notes and comments                   | The DOCX reader loads these separately. HTML conversion can append referenced note content, while raw-text extraction walks document children without separately traversing stored note/comment bodies. Trace each API through the rename consumer; feature parsing alone does not prove that its content becomes title or lead-text evidence.[^mammoth-docx-reader][^mammoth-html][^mammoth-raw] |

Metadata is already supplied by the project's OOXML helper. A replacement needs document text and heading facts sufficient for the existing consumer; it does not need to reproduce Mammoth's full HTML product. However, formatting or secondary content that affects those facts cannot be dropped solely because it looks unrelated to rename.

The [baseline expectations](../../test/document-rename/fixtures/docx-baseline/expected.json) establish several compatibility details: UTF-16 metadata succeeds while UTF-16 main content fails; dot-segment/escaped main targets fail, and equivalent style targets lose heading mapping. Inheritance, outline levels, default paragraph styles, and unmapped localized names do not independently produce headings. Notes can supply HTML-only heading signals while raw text excludes their bodies. Raw text omits explicit breaks, simple-field content is excluded, and later normalized duplicate document parts win. Empty valid documents return `docx_extract_error`; image/table/break-only HTML returns `docx_no_title_signal`. A metadata title can succeed with `docx_no_lead_text`, but does not rescue conversion failure. These observations are comparison inputs, not proposed fixes.

## Ownership Hypothesis

If project-owned extraction is justified, use an internal `src/docx/` subsystem beside `src/markdown/`. The integration guide already keeps cohesive parsing subsystems outside generic `src/utils/`.[^integration-guide]

### Proposed source ownership

This conceptual tree leaves the internal file split and relocation of existing OOXML helpers open:

```text
src/
|-- docx/                                 Proposed project-owned package/content reader
|                                         Reuse existing ZIP/XML and metadata logic
|-- adapters/codex/document-rename/
|   `-- extractors/docx.ts                 Existing adapter; retain rename-consumer policy
|-- cli/actions/markdown/to-docx.ts        Existing Pandoc generation action
`-- markdown/                             Existing Markdown parsing subsystem
```

The reader would own package access, part discovery, and document/metadata parsing. The existing DOCX adapter retains normalization, title ranking, consumer limits, and fallback semantics.

### Proposed reader relationship

The reader would replace document-reading internals behind the existing adapter, without a runtime backend selector or new public API:

```text
DOCX input
    |
    v
Project-owned DOCX reader [PROPOSED]
    |
    +-- ordered heading signals --+
    +-- body/raw-text stream -----+--> Existing DOCX rename adapter
    +-- metadata -----------------+         |
    `-- parser diagnostics                  +--> Same evidence / prompt / Codex flow
        (internal initially)                `--> Same reason / deterministic fallback
```

Reuse or relocate the existing OOXML helpers rather than introduce a second ZIP/XML implementation. Choose the file split after establishing the required content/style handling.

A candidate reader should expose separate ordered heading signals with levels and a body/raw-text stream, alongside optional core metadata and internal diagnostics. Those outputs may contain different content because the current HTML and raw-text paths differ. Paragraph/table/list structure may stay internal; a shared paragraph representation must not force HTML-only content into the body stream.

The exact types and failure representation remain open. In particular, the reader may need an internal signal for non-text content to preserve the current no-evidence reason distinction without generating HTML. The failure-boundary cases below must establish whether that is necessary. A buffer-based entry point could share one read between content and metadata; the current metadata helper reads the path separately.

## Compatibility Policy

These rules govern evaluation and any later implementation:

1. Preserve the current contract above, including the asynchronous adapter boundary and separate heading/body outputs. Keep dispatcher routing, prompt construction, CLI options, Codex execution settings, batching/retries, and deterministic fallback unchanged.
2. Preserve content that contributes to normalized evidence or extraction outcomes. Trace both Mammoth APIs through the consumer before deciding which features are needed; do not pre-exclude secondary content or introduce a visible-content-only policy. Parsing a feature in Mammoth does not by itself require reproducing it.
3. Preserve outward warnings and failure conditions. Keep detailed new parser diagnostics internal initially; usable evidence must not automatically gain prompt warnings, and existing failures must not silently become partial successes. Record internal-to-existing diagnostic mappings and the exact replacement extractor identity.
4. Require a documented compatibility decision for intentional differences, including resource-limit outcomes and the necessary provenance change. Record the affected cases, rationale, and expected results before accepting a departure.

## Validation Matrix and Method

### Minimum comparison corpus

Existing fixtures and assertions provide seeds. Each variation below needs an identifiable case and expected handling; one fixture may cover several independently asserted variations. Unsupported-content cases establish a limitation or failure policy rather than a promise to support every DOCX feature.

| Category                         | Minimum cases and questions                                                                                                                                                                                                               | Evidence state                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Existing evidence                | All seven DOCX fixtures: metadata-rich, heading-rich, weak-heading, no-heading, table-heavy, hyperlink-heavy, and alternate-editor. Preserve existing title-evidence assertions.                                                          | Baseline captured; candidate comparison pending.         |
| Metadata and part discovery      | Missing/malformed metadata, non-default metadata paths, UTF-16, dot-segments, and percent-escaped paths; non-default main-document/style parts and namespace variants.                                                                    | Baseline captured; candidate comparison pending.              |
| Text and order                   | Split runs, Unicode and preserved spaces, symbol characters, tabs/breaks, blank lines, lists, and paragraphs before/inside/after tables or content controls.                                                                              | Baseline captured; candidate comparison pending.                                 |
| Heading styles                   | Standard/custom/localized names, inherited styles, default/embedded style mappings, outline levels, missing definitions, and cyclic inheritance.                                                                                          | Baseline captured; candidate comparison pending.                                 |
| Links and fields                 | Visible hyperlink text and complex fields with quoted/unquoted targets; displayed results versus instruction text. Include the historical hyperlink-syntax concern.[^historical]                                                          | Baseline captured; candidate comparison pending.             |
| Revisions and secondary content  | Insertions/deletions, hidden runs, text boxes, headers/footers, notes, and comments. Trace inclusion and order separately through HTML and raw text.                                                                                      | Baseline captured; candidate comparison pending.                                 |
| Empty and non-text content       | Valid empty documents, image-only documents, and structure-only content such as empty tables or line breaks, all without usable title metadata. Trace whether nonempty HTML changes the no-evidence reason despite empty normalized text. | Baseline captured; candidate comparison pending.                           |
| Metadata-only evidence           | A usable core title with an empty body and successful conversion; assert evidence with `docx_no_lead_text`. Contrast author-only metadata with no title/body/headings, and available metadata with a conversion failure.                  | Baseline captured; candidate comparison pending.                           |
| Partial and malformed extraction | Usable text with unsupported content; invalid ZIP/XML; missing/invalid required parts; duplicate normalized part names. Distinguish limitations, empty output, and extraction failure under the compatibility policy.                     | Baseline captured; candidate comparison pending.           |
| Resource and I/O boundaries      | A body above the metadata reader's 256 KiB cap; below/at/above each proposed resource cap; external relationship targets, deterministic cleanup, no external URL/file loading, and no executable-content evaluation.                      | Structural/offline baseline captured; candidate enforcement pending. |

Image-only cases check structural outcomes and binary-part handling; they do not require image interpretation or OCR. Expected reasons for empty/non-text cases must come from identified baseline cases, not an assumption that all empty text has the same outcome.

### Comparison method

1. Run the current Mammoth integration and candidate over the same identified corpus. Retain reproducible harness source, identified cases, reviewed expectations, and concise check outcomes. Trace HTML, raw text, metadata, and final evidence separately; synthetic cases also need independent expected results. Keep execution files and raw reports temporary, following the plan's output-handling rules.
2. Compare complete normalized evidence: candidate ordering, headings/TOC candidates, author and metadata fields, lead text, warnings, and failure reasons. Verify that the proposed reader outputs preserve these results or identify the additional internal signals needed.
3. Compare resulting prompt payloads, including filename identity, warnings, and metadata. Allow only specifically recorded intentional differences such as the extractor label; do not exclude whole fields. Use stubbed batch/thread checks for routing, execution-option forwarding, retries/batching, and reason propagation.
4. Classify each difference as equivalent under the stated normalization, intentional and justified, or an unresolved regression. Unresolved consequential differences prevent candidate selection; missing cases remain pending evidence. Nonempty output, byte-identical HTML, and matching live model-generated titles are not substitutes for these comparisons.

### Resource budgets

Define a supported workload from identified representative documents and measure the current Mammoth baseline. Inspect compressed input size, per-part and total decompressed bytes, entry/node counts, XML depth, style traversal steps, peak memory, and elapsed processing time. Retain proposed limits and their headroom rationale rather than raw execution reports. The maintainer must accept these budgets and the support envelope before candidate results are classified as passing; the metadata cap alone is insufficient.

Test every cap below, at, and above its boundary with expected limitation/failure outcomes. Use the reproducible harness to measure representative and adversarial cases; record check outcomes without local environment details. The candidate must stay within accepted budgets or terminate with the defined outcome. Later budget/support-policy changes require a rationale and renewed checks of affected cases.

Phase 1 measured the baseline and defined the [provisional limits](../../scripts/docx-baseline/resources.ts) below. These are exploratory limits, not accepted support policy or production enforcement. Per-run measurements remain temporary.

| Dimension | Proposal | Headroom rationale |
| --- | --- | --- |
| Compressed input | 8 MiB | Allows larger packages; decompressed limits may bind earlier. |
| Decompressed part / total | 1 MiB / 4 MiB | About 33 / 46 times the corresponding seed maxima. |
| ZIP entries | 256 | Sixteen times the seed maximum. |
| XML elements / depth | 100,000 / 64 | About 40 / seven times the corresponding seed maxima. |
| Distinct style traversal steps | 128 | Thirty-two times the seed maximum. |
| Extraction time / peak RSS | 5 seconds / 256 MiB | More than 80 / two times the corresponding bounded baseline maxima; candidate enforcement remains untested. |

The [structural cases](../../scripts/docx-baseline/resource-cases.ts) isolate seven exact below/at/above dimensions; some exceed other proposed caps and are not examples of fully supported inputs. Inspector safety ceilings are separate from candidate limits. Controlled candidate elapsed-time and RSS enforcement checks remain unrun because those are not deterministic DOCX fixture dimensions. Maintainer acceptance and candidate enforcement remain pending.

### Runtime and distribution checks

Verify the executable candidate under Node.js `>=22.23.0`, including representative built ESM/CJS integration. Use relevant managed application cases for repository filesystem integration; an isolated candidate may use a focused harness with recorded inputs and outcomes. Keep pure parsing checks in unit coverage. Bun source tests alone do not establish Node compatibility.[^testing]

The build currently externalizes Mammoth, and published files are limited to `dist`, license, and README files. Inspect packed artifacts and their resolved consumer dependency trees through fresh installations with supported package managers, alongside repository declarations and imports. Account for any independent retained Argparse/`sprintf-js` paths.

The historical `scripts/spikes/docx-pdf-title-evidence-spike.ts` also imports Mammoth. Migrate its DOCX path and backend labels while preserving useful PDF comparisons, or retire it after checking references and preserving still-needed evidence. Production code, scripts, tests, declarations, the lockfile, and installed trees must satisfy the removal goal; explanatory historical references may remain.

### Maintenance assessment

Assess the benefit of owning the narrow extraction contract against the ongoing cost of OOXML semantics, resource handling, editor compatibility, and corpus upkeep. Record:

- Reused helpers and new parsing responsibilities, including the resulting code surface and difficult compatibility cases.
- The supported subset, known limitations, and whether preserving evidence requires substantially broader conversion logic.
- Retained dependencies, licenses/provenance, update obligations, and remaining migration work.

The maintainer must explicitly accept responsibility for dependency/security updates, editor regressions and corpus upkeep, unsupported-content/diagnostic decisions, and future resource-budget changes before reader selection. A subsystem location alone does not establish that acceptance.

## Decision and Shipping Gates

### Research decision

Recommend proceeding only when the comparison matrix and method establish equivalent useful evidence or accepted differences, resource handling meets accepted budgets, and runtime/distribution checks pass for an isolated executable and packed candidate. The maintenance assessment must support a focused, maintainable implementation with accepted ownership. Record how existing consumers can migrate or retire and any remaining integration work; completing repository migration is not a prerequisite for this decision.

Otherwise, recommend deferral and identify unmet criteria. Record the supporting evidence, benefits, limitations, and remaining risks. A supported recommendation may justify a separate implementation plan; research completion is distinct from shipping the replacement.[^doc-policy]

### Shipping acceptance

The implementation plan must repeat applicable evidence/prompt, fallback, resource, and distribution checks on the final integrated product. Pass affected managed tests and Node.js checks of the CLI and built ESM/CJS entry points. Confirm consumer migration/retirement and complete Mammoth removal in repository and fresh packed-product installations. Record final results, maintenance acceptance, and remaining limitations before claiming shipping acceptance or dependency remediation.

Phase 1 is complete in the [unified execution record](../plans/jobs/2026-10-16-docx-reader-and-mammoth-replacement.md). The retained corpus has 70 semantic cases and 21 structural boundary cases, with reviewed expectations, scoped offline checks, and provisional budgets. Validation, temporary-output cleanup, and full-range review passed. No candidate implementation or comparison has started. Output equivalence, concrete support/diagnostic mappings, accepted resource budgets, maintenance acceptance, and both gates remain unverified. Execution stops before Phase 2.

## Related Plans

- [DOCX reader and Mammoth replacement](../plans/plan-2026-10-16-docx-reader-and-mammoth-replacement.md) — active phased evaluation and conditional migration plan. Phase 1 is complete; execution stops before Phase 2. Candidate compatibility and selection remain unverified.

## References

[^rename-guide]: [Rename scope and Codex capabilities](../guides/rename-scope-and-codex-capability-guide.md).

[^integration-guide]: [CLI integration and subsystem placement](../guides/cli-action-tool-integration-guide.md#what-belongs-in-srcutils-vs-not).

[^testing]: [Testing guide](../guides/testing.md).

[^maintenance]: [Dependency refresh and audit assessment](../plans/jobs/2026-10-16-v0.2.1-canary.2-dependency-refresh.md#existing-audit-finding).

[^historical]: [Archived Mammoth upgrade review](archive/research-2026-03-17-package-upgrade-risk-inquirer-mammoth.md).

[^doc-policy]: [Research lifecycle policy](../../DOCUMENTATION_POLICY.md#research-documents).

[^advisory]: [sprintf-js advisory, GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).

[^word-structure]: [Microsoft: WordprocessingML document structure](https://learn.microsoft.com/en-us/office/open-xml/word/structure-of-a-wordprocessingml-document).

[^mammoth-manifest]: [Mammoth 1.13.0 package manifest](https://github.com/mwilliamson/mammoth.js/blob/1.13.0/package.json).

[^mammoth-cli]: [Mammoth 1.13.0 Node CLI](https://github.com/mwilliamson/mammoth.js/blob/1.13.0/bin/mammoth).

[^mammoth-zip]: [Mammoth 1.13.0 ZIP reader](https://github.com/mwilliamson/mammoth.js/blob/1.13.0/lib/zipfile.js).

[^jszip-flate]: [JSZip 3.10.1 JavaScript DEFLATE worker](https://github.com/Stuk/jszip/blob/v3.10.1/lib/flate.js).

[^mammoth-xml]: [Mammoth 1.13.0 XML parser](https://github.com/mwilliamson/mammoth.js/blob/1.13.0/lib/xml/xmldom.js).

[^mammoth-images]: [Mammoth 1.13.0 image byte handling](https://github.com/mwilliamson/mammoth.js/blob/1.13.0/lib/images.js).

[^mammoth-body]: [Mammoth 1.13.0 body reader](https://github.com/mwilliamson/mammoth.js/blob/1.13.0/lib/docx/body-reader.js).

[^mammoth-docx-reader]: [Mammoth 1.13.0 document-part reader](https://github.com/mwilliamson/mammoth.js/blob/1.13.0/lib/docx/docx-reader.js).

[^mammoth-entry]: [Mammoth 1.13.0 library entry point](https://github.com/mwilliamson/mammoth.js/blob/1.13.0/lib/index.js).

[^mammoth-options]: [Mammoth 1.13.0 default options and style mappings](https://github.com/mwilliamson/mammoth.js/blob/1.13.0/lib/options-reader.js).

[^mammoth-html]: [Mammoth 1.13.0 HTML conversion](https://github.com/mwilliamson/mammoth.js/blob/1.13.0/lib/document-to-html.js).

[^mammoth-raw]: [Mammoth 1.13.0 raw-text extraction](https://github.com/mwilliamson/mammoth.js/blob/1.13.0/lib/raw-text.js).
