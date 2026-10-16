---
title: "DOCX Extraction and Mammoth Replacement"
created-date: 2026-10-16
modified-date: 2026-10-16
status: draft
agent: codex
---

## Goal

Evaluate whether a focused, project-owned TypeScript/Node DOCX reader can replace Mammoth while preserving the document evidence and integration mechanics used by semantic rename, with acceptable complexity and maintenance cost.

This research focuses on rewrite feasibility. The current Mammoth integration is the compatibility baseline; the outcome is a recommendation to proceed with or defer the rewrite. Removing Mammoth's transitive `argparse > sprintf-js` dependency is a motivation and a distribution acceptance criterion. The rewrite has not yet demonstrated feasibility or been approved for implementation.

For the rewrite, success means complete Mammoth removal from runtime and development dependencies, the lockfile, and the installed dependency tree. Production code, tests, and historical tooling must no longer require Mammoth.

This draft records the current contract, an initial ownership hypothesis, and the evidence needed for a decision. Candidate output equivalence, resource budgets, and support for additional DOCX structures remain unverified.

## Scope

Investigate extraction of metadata, ordered text, and headings for the existing DOCX rename workflow. Define where best-effort extraction is acceptable and when unsupported or malformed input must produce a warning or failure.

Here, a project-owned reader means TypeScript/JavaScript running in Node.js with the existing ZIP/XML dependencies. It does not mean a compiled native addon, another language runtime, or a bundled external converter. Maintaining a Mammoth fork is outside this investigation.

Dependency overrides, patches, and upstream Mammoth upgrade evaluation belong to separate dependency maintenance and are outside this rewrite investigation. Upstream source references remain the basis for understanding current behavior.

Full DOCX-to-HTML conversion, layout rendering, images/OCR, legacy `.doc` support, new CLI commands, and replacing Markdown-to-DOCX generation are outside this research. The existing `md to-docx` action in `src/cli/actions/markdown/to-docx.ts` uses Pandoc.

## Current Code and Reader-Facing Contract

DOCX files participate in semantic rename under `--codex-docs`; extraction is documented as best-effort and fallback-safe.[^rename-guide] The diagrams describe responsibilities and data flow. Repository code paths are orientation references for the reviewed snapshot, commit `8c75fdb831fab3b8348ae46e4f3b023281db2b25`; they are not a promise that the file layout will remain unchanged during replacement.

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

This is a selected map of the reviewed source tree. Each label explains the responsibility so the relationships remain readable if a later implementation moves files.

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

The format consumer is `extractDocxEvidence()` in `src/adapters/codex/document-rename/extractors/docx.ts`; `src/adapters/codex/document-rename/batch.ts` routes `.docx` inputs to it. Its effective contract includes:

| Area             | Current behavior                                                                                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document body    | Calls `convertToHtml({ buffer })` and `extractRawText({ buffer })`; HTML is intermediate evidence, not a rendered product artifact.                                                                                                     |
| Headings         | Extracts HTML `h1` through `h6`, preserves level for ranking, and emits up to eight unique heading strings. `tocCandidates` currently repeats those strings; it is not an independently parsed DOCX table of contents.                  |
| Title candidates | Prioritizes core title metadata, meaningful H1/early headings, and body text according to the existing weak-title rules; returns at most four unique candidates.                                                                        |
| Lead text        | Normalizes raw-text lines, removes blank lines, then uses the shared first-paragraph helper with an 800-character limit. Preserving blank-line paragraph boundaries here would change current behavior.                                                                                                                                       |
| Metadata         | Reads core properties and application information through the existing OOXML reader. Creator supplies author candidates. Missing metadata can coexist with usable body evidence.                                                        |
| Diagnostics      | Preserves metadata warnings, can add `docx_no_lead_text`, and returns `docx_no_title_signal` or `docx_extract_error` when evidence cannot be produced. Mammoth conversion messages are not currently copied into the evidence warnings. |
| Provenance       | Sets `metadata.extractor` to `mammoth+ooxml` or `mammoth`; a replacement must use an accurate identity and update affected expectations.                                                                                                |

The evidence contract and limits live in `src/adapters/codex/document-rename/types.ts`; shared normalization and candidate helpers live in `src/adapters/codex/document-rename/extractors/shared.ts`. These are rename-consumer responsibilities. The reusable reader should supply document facts without selecting rename titles.

The prompt builder in `src/adapters/codex/document-rename/prompt.ts` forwards the complete evidence object, including warnings and extractor metadata, while adapting filename fields for prompt identity. Adding a parser warning changes model input even when title candidates and lead text are unchanged.

The historical DOCX/PDF evidence spike in `scripts/spikes/docx-pdf-title-evidence-spike.ts` also imports Mammoth. Project-owned replacement must either migrate its DOCX path and backend labels to the chosen reader, preserving its useful PDF comparisons, or retire the spike after checking its references and preserving any still-needed evidence. Moving Mammoth to development-only dependencies or leaving a broken script does not satisfy complete removal. Production imports and test expectations must also use the selected reader and accurate provenance labels.

## Key Findings

### Mammoth's parsing path uses JavaScript in Node.js

The installed `mammoth@1.13.0` library path uses JavaScript for package reading, XML parsing, and document interpretation. The following source boundaries were inspected read-only; they are distinct from the provisional conversion diagnostic below.

| Component | Observed implementation |
| --- | --- |
| Library integration | The DOCX rename adapter shown in the current source map calls `convertToHtml({ buffer })` and `extractRawText({ buffer })` directly; it does not launch Mammoth's CLI. |
| CLI entry point | `bin/mammoth` is a JavaScript script with a Node shebang. It imports the JavaScript `argparse` package; no Python interpreter is involved.[^mammoth-cli] |
| ZIP decompression | Mammoth uses JSZip; the installed JSZip implementation uses Pako's JavaScript DEFLATE support.[^mammoth-zip][^jszip-flate] |
| XML parsing | Mammoth uses the JavaScript `@xmldom/xmldom` package.[^mammoth-xml] |
| Browser-bundle preparation | Mammoth's package manifest declares a `prepare` command using `make` to build its browser bundle. That command is separate from the library's DOCX parsing path.[^mammoth-manifest] |

An installed-tree inventory is a provisional supporting observation. It followed runtime dependency manifests, including optional dependencies where present, and reported 24 packages including Mammoth with no `.node` addons, `.wasm` modules, `.bin` files, or recognized ELF, PE, or Mach-O executable signatures. A pattern check of non-test JavaScript outside example/documentation/benchmark/distribution directories reported no matches for direct `child_process` require/import patterns, `process.dlopen()` calls, or `WebAssembly` API references. The exact inventory commands/harness and full results are not retained or linked here; add them before relying on these aggregate findings as decision evidence. The lockfile, `bun.lock`, identifies intended resolutions but does not attest installed file contents or reproduce the checks. The version-pinned sources above independently support the narrower library/CLI findings. Neither the source review nor the provisional inventory is an exhaustive security audit or a guarantee about future versions.

The reviewed parsing path does not require Word, LibreOffice, Pandoc, an external unzip command, or a separate compiled conversion engine. DOCX ZIP bytes and embedded media are binary input data; reading or base64-encoding image bytes does not require image rendering or OCR.[^mammoth-images] The proposed reader should define handling for embedded binary parts without adding executable-content evaluation. Existing Markdown-to-DOCX generation remains a separate Pandoc workflow.

### Existing DOCX infrastructure is reusable, with limits

`src/adapters/docx/` already contains ZIP reading through `yauzl`, XML decoding, package-path normalization, metadata-part discovery, and property parsing through `fast-xml-parser`. The current source map identifies these helper responsibilities.

The package reader in `src/adapters/docx/ooxml-package.ts` collects XML/relationship parts and skips parts whose declared uncompressed size exceeds 256 KiB. This is a metadata-oriented limit, not an established document-body budget. Generalizing it requires selected-part reading, explicit oversized-input outcomes, and review of total decompressed bytes, entry count, XML depth, and style traversal limits. The per-part check alone does not establish those aggregate bounds.

Metadata discovery in `src/adapters/docx/ooxml-part-discovery.ts` already ignores external relationship targets. The metadata tests described below cover non-default part locations, UTF-16, dot-segments, and percent-escaped paths. Main-document and style-part discovery need their own relationship/content-type handling; metadata discovery does not already provide a general content reader.

### The dependency issue is separate from DOCX conversion fidelity

The reviewed installation uses `mammoth@1.13.0 > argparse@1.0.10 > sprintf-js@1.0.3`. The moderate precision-specifier advisory lists versions through `1.1.3` as affected and no patched version as of this review.[^advisory] The maintenance record documents the installed library/CLI boundary and the limits of its static assessment.[^maintenance]

An initial read-only diagnostic reportedly blocked Node imports of `argparse` and `sprintf-js` before loading Mammoth, then invoked both conversion APIs over the seven DOCX fixtures in `test/fixtures/docs/`. The reported result was nonempty HTML and raw text for all seven fixtures, with zero attempted imports of the blocked packages. The original command/harness, Node version, and per-fixture output are not recorded or linked here, so this remains a provisional observation rather than reproducible decision evidence. It does not establish project-owned reader feasibility, equal output, or universal non-reachability of the advisory.

Before relying on this diagnostic, add a reproducible evidence record with the exact command and retained harness, Node and resolved dependency versions, identified fixtures, and per-fixture API outcomes and blocked-import attempt counts. The harness must install interception before loading Mammoth and demonstrate that a deliberate import of each blocked package is detected and rejected; record those control attempts separately from conversion attempts. Link the command/harness and captured output from this research when available. Reproduction remains pending; this document update does not run the diagnostic or begin a comparison spike.

### Existing tests provide a starting comparison corpus

The title-evidence tests in `test/document-rename/adapters/title-evidence.app.test.ts` cover core metadata precedence, weak/no-heading body fallbacks, table-heavy and hyperlink-heavy documents, and an alternate-editor document whose metadata is unavailable. Metadata-specific tests in `test/markdown-docx/adapters/ooxml-metadata.app.test.ts` also cover malformed properties, missing metadata, invalid ZIP bytes, and absence of runtime fetching for relationship identifiers.

These assertions validate selected evidence fields. They do not exhaustively cover Mammoth's supported WordprocessingML structures. DOCX contains paragraphs, runs, text, styles, and additional document parts; simple text-node concatenation is not sufficient to define the intended reading behavior.[^word-structure]

### Feature presence and rename evidence need separate tracing

Source inspection confirms several existing parsing paths, but their effect on normalized rename evidence still needs fixture-level validation:

| Feature | Observed path and remaining question |
| --- | --- |
| Text boxes | The body reader explicitly traverses `v:textbox` and `w:txbxContent`. Compare their text, headings, and ordering through both APIs before deciding on support; do not preclassify text boxes as unsupported.[^mammoth-body] |
| Tables, lists, fields, and revisions | Mammoth has dedicated table, numbering, and field handling, plus inclusion/exclusion logic for revisions. Establish the actual resulting text and heading signals before adopting a simpler content policy.[^mammoth-body][^mammoth-docx-reader] |
| Symbols and heading mappings | The body reader maps supported symbol characters to Unicode. HTML conversion also uses default and embedded style mappings. Identify which mappings affect headings or title text instead of assuming all evidence comes from ordinary `w:t` nodes and standard heading names.[^mammoth-body][^mammoth-entry][^mammoth-options] |
| Notes and comments | The DOCX reader loads these separately. HTML conversion can append referenced note content, while raw-text extraction walks document children without separately traversing stored note/comment bodies. Trace each API through the rename consumer; feature parsing alone does not prove that its content becomes title or lead-text evidence.[^mammoth-docx-reader][^mammoth-html][^mammoth-raw] |

Metadata is already supplied by the project's OOXML helper. A replacement needs document text and heading facts sufficient for the existing consumer; it does not need to reproduce Mammoth's full HTML product. However, formatting or secondary content that affects those facts cannot be dropped solely because it looks unrelated to rename.

## Ownership Hypothesis

If project-owned extraction is justified, use an internal `src/docx/` subsystem beside `src/markdown/`. The integration guide already keeps cohesive parsing subsystems outside generic `src/utils/`.[^integration-guide]

### Proposed source ownership

This tree is conceptual and has not been implemented. Only the proposed subsystem location is shown; its internal file split remains undecided. Existing OOXML helpers may be reused or relocated after evaluation.

```text
src/
|-- docx/                                 Proposed project-owned package/content reader
|                                         Reuse existing ZIP/XML and metadata logic
|-- adapters/codex/document-rename/
|   `-- extractors/docx.ts                 Existing adapter; retain rename-consumer policy
|-- cli/actions/markdown/to-docx.ts        Existing Pandoc generation action
`-- markdown/                             Existing Markdown parsing subsystem
```

The shared reader would own package access, part discovery, metadata parsing, and separate heading/body outputs. The existing DOCX adapter would continue to own normalization, title ranking, consumer limits, and fallback semantics. Markdown parsing and Markdown-to-DOCX generation retain their current responsibilities.

### Proposed reader relationship

If selected, the project-owned reader would replace the document-reading internals behind the existing adapter. This sketch describes that possible implementation; it does not introduce a runtime backend selector or new public API.

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

Reuse or relocate the existing OOXML helpers rather than introduce a second ZIP/XML implementation. A small `index.ts`, shared types, parse entry point, and content/style readers may be sufficient additions. The exact file split and any relocation should follow the chosen implementation scope.

A candidate reader should expose separate ordered heading signals with levels and a body/raw-text stream, alongside optional core metadata and internal format diagnostics. Those outputs need not contain identical content: the current HTML-derived headings and raw text have different extraction paths. Its exact internal types, failure representation, and input-size limits remain pending validation. A buffer-based entry point could let content and metadata share one read; the current metadata helper reads the path separately. New package exports remain outside this replacement's integration scope.

Paragraphs and table/list context may remain an internal representation without introducing a full layout model. The adapter projects the reader's outputs into the existing evidence contract under the compatibility decisions below; a shared paragraph list must not force heading and body outputs to include the same content.

## Rewrite Benefits, Costs, and Distribution

The intended benefit is ownership of the narrow extraction contract and complete Mammoth removal from the repository dependency tree and published installations. The cost is maintaining the required OOXML semantics, resource bounds, editor compatibility, and comparison corpus, plus migrating or retiring the historical spike. Removing a non-JavaScript engine is not a benefit because the reviewed Mammoth path already runs in JavaScript.

The build configuration in `tsdown.config.ts` currently externalizes Mammoth, and `package.json` limits published files to `dist`, license, and README files. Distribution validation must inspect the packed product and its resolved consumer dependency tree, as well as repository imports and dependency declarations. A clean local dependency tree alone does not establish complete removal for published consumers.

Evaluate the rewrite against the compatibility, resource, maintenance, and distribution requirements below. A successful isolated candidate can justify a later implementation plan; it does not establish that repository migration or final shipping checks have passed.

## Coverage and Safety Questions

Before selecting project-owned extraction, validate current contributions and required failure behavior for each area against the compatibility decisions below. Any intentional departure needs an identified case and recorded justification.

| Area                            | Evidence still needed                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reading order and whitespace    | Split runs, Unicode/space preservation, symbol characters, tabs, breaks, lists, and paragraphs inside tables or content controls.                                                                                    |
| Headings                        | Standard/custom/localized styles, inherited styles, default/embedded style mappings, outline levels, missing style definitions, and cycle limits.                                                                                  |
| Links and fields                | Visible hyperlink text, complex fields, and displayed results versus instruction text. The historical Mammoth review identifies unusual hyperlink syntax as a compatibility concern.[^historical] |
| Revisions and secondary content | Included/excluded text for insertions, deletions, hidden runs, text boxes, headers, footers, notes, and comments. Trace HTML and raw text separately through the consumer; text boxes already have a Mammoth parsing path.                |
| Package identity                | Main-document/style relationships, non-default paths, namespace variants, duplicate normalized part names, and missing/invalid required parts.                                                    |
| Resource and I/O boundaries     | Measured compressed/decompressed limits, entry/node/depth counts, deterministic cleanup, no external URL/file loading, and no executable-content evaluation.                                      |
| Partial extraction              | Distinguish usable text with limitations from empty documents and extraction failure. Preserve outward warnings and failure reasons; retain new parser diagnostics internally unless an explicit compatibility decision permits exposure.                                      |

### Resource budgets and maintenance responsibility

Before judging a project-owned candidate, define the supported workload and derive provisional budgets from identified representative documents and the current Mammoth baseline. Record compressed input size, per-part and total decompressed bytes, entry/node counts, XML depth, style traversal steps, peak memory, and elapsed processing time. Use those observations to propose input/structural caps and memory/time acceptance thresholds with a stated headroom rationale; the metadata reader's 256 KiB cap is not a substitute. The project maintainer must accept the proposed budgets and support envelope before candidate results are classified as passing.

Map every cap to cases below, at, and above its boundary, with expected limitation or failure outcomes. Check memory/time thresholds on representative and adversarial cases under a recorded runtime and measurement setup. A candidate must stay within the accepted budgets or terminate with the defined outcome. Any later budget or support-policy revision needs a recorded rationale and renewed checks of affected cases. No numeric budgets have been selected or measured yet.

The code ownership hypothesis above does not assign ongoing maintenance responsibility. Before selecting a project-owned reader, record explicit acceptance by the project maintainer for dependency/security updates, editor-compatibility regressions and corpus upkeep, unsupported-content and diagnostic decisions, and future resource-budget changes. That acceptance is pending; the reader is not ready for selection without it.

## Compatibility Decisions

These decisions govern evaluation and any later implementation. They preserve the current integration mechanics; they do not establish that a replacement meets the contract.

```text
DOCX -> existing dispatcher -> extractDocxEvidence(path)
                                -> evidence -> existing Codex rename flow
                                -> reason   -> existing deterministic fallback
```

1. Preserve the integration boundary shown in the diagrams. Keep `.docx` dispatch, the asynchronous `extractDocxEvidence(path)` entry point, and its `DocumentTitleEvidence | { reason: string }` result. Preserve metadata fallback behavior, title ranking and weak-title rules, normalization, deduplication, limits of four titles/eight headings/800 lead-text characters, and `tocCandidates` as the existing heading projection. Keep prompt construction, CLI options, Codex execution settings, batching/retries, and deterministic rename fallback unchanged. Adapt replacement internals inside the DOCX adapter without adding a public API or requiring a full HTML converter.

2. Use a compatibility-first rewrite acceptance rule. Recommend proceeding only when comparison against the current Mammoth integration demonstrates equivalent useful evidence, accepted resource handling, a focused maintainable implementation, feasible complete removal, and accepted maintenance responsibility. If the rewrite cannot meet those requirements, defer it explicitly and record the unmet criteria. Narrowing the research to a rewrite does not establish that it is ready to implement.

3. Preserve existing content contributions. Use the current integration's normalized evidence and extraction outcomes as the baseline for supported documents. Retain relevant text-box content, table/list order, heading/style mappings, field results, and observed revision/hidden-text inclusion rules. Do not introduce a new visible-content-only policy or pre-exclude secondary content. Conversely, parsing a feature in Mammoth does not require reproducing it unless it affects the evidence or extraction outcome; trace both APIs through the consumer before deciding. Any unsupported-content outcome that differs from the baseline must be recorded and accepted explicitly.

4. Preserve separate heading and body outputs. The reader supplies ordered heading signals and body/raw text separately; table/list structure may stay internal unless a named comparison case demonstrates a need for richer output. Apply the existing consumer normalization to those outputs, including removing blank lines before the lead-text helper. Do not change lead-text semantics to match the helper's name or force HTML-only secondary content into the body stream.

5. Preserve outward diagnostics and use truthful provenance. Keep existing metadata warnings, `docx_no_lead_text`, and the conditions producing `docx_no_title_signal` or `docx_extract_error`. Detailed new parser diagnostics remain internal initially; usable evidence must not automatically acquire new prompt warnings, and existing failures must not silently become partial successes. A replacement must use an accurate `metadata.extractor` identity, with the exact value and expected prompt difference recorded. Additional outward warning codes or changed failure conditions, including those introduced by resource limits, require their own deliberate compatibility decision.

## Pending Validation

The policy above is settled for this investigation; the following evidence and concrete mappings remain pending:

- Trace the minimum corpus through current HTML, raw-text, metadata, and evidence stages. Record which content and style variations contribute to each output and whether omissions affect extraction outcomes. Preserve independent expected results for synthetic cases as well as the Mammoth baseline.
- Compare complete normalized evidence, including candidate ordering, headings/TOC candidates, author/metadata fields, lead text, warnings, and failure reasons. Add targeted cases for blank lines, table/list boundaries, text boxes, notes, revisions, and style mappings. Establish whether the separate heading/body outputs preserve these results without a richer reader interface.
- Compare resulting prompt payloads, including warning arrays, metadata, and filename identity. Permit only specifically recorded intentional differences, such as the chosen extractor label; do not exclude entire metadata or diagnostic fields from comparison.
- Use stubbed batch/thread checks to verify dispatcher routing, prompt construction, execution-option forwarding, retries/batching, and reason propagation into the existing fallback flow. Live model-generated title comparisons are not required to establish these integration mechanics. The current source map identifies the dispatcher, prompt projection, and rename analyzer roles.
- Record the exact extractor label, internal-to-existing diagnostic mappings, and any accepted support/resource-related departures. The resource budgets, maintenance acceptance, Node/distribution checks, and reproducibility records required elsewhere in this research also remain pending.

No candidate validation, comparison spike, or implementation has started. Settling compatibility policy alone does not justify accepting the rewrite or marking the research complete.

## Minimum Comparison Corpus

The following is the minimum proposed comparison coverage. Existing fixtures and assertions provide seeds; a complete comparison over this matrix has not been run. Each listed variation needs an identifiable case and expected handling, although one fixture may exercise several independently asserted variations. Unsupported-content cases establish an explicit limitation or failure policy rather than a promise to support every DOCX feature.

| Category                        | Minimum cases                                                                                                                                                                                      | Evidence state                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Existing evidence               | All seven DOCX fixtures: metadata-rich, heading-rich, weak-heading, no-heading, table-heavy, hyperlink-heavy, and alternate-editor. Preserve the existing title-evidence assertions.               | Fixtures exist; full baseline/candidate comparison pending.                              |
| Metadata and part discovery     | Existing missing/malformed metadata, non-default metadata paths, UTF-16, dot-segments, and percent-escaped paths; add non-default main-document/style parts and namespace variants.                | Metadata tests exist; content-discovery cases pending.                                   |
| Text and order                  | Split runs, Unicode and preserved spaces, symbol characters, tabs/breaks, lists, and paragraphs before/inside/after tables or content controls.                                                                       | Dedicated comparison cases pending.                                                      |
| Heading styles                  | Standard headings, custom/localized names, inherited styles, default/embedded style mappings, outline levels, missing definitions, and cyclic inheritance.                                                                          | Dedicated comparison cases pending.                                                      |
| Links and fields                | Visible hyperlink text and complex fields with quoted/unquoted targets; distinguish displayed results from instruction text.                                                                       | Hyperlink fixture exists; targeted field cases pending.                                  |
| Revisions and secondary content | Insertion/deletion, hidden text, and representative text-box, header/footer, note, and comment content with a stated include/exclude policy.                                                       | Dedicated comparison cases pending.                                                      |
| Failure and resource bounds     | Invalid ZIP/XML, missing required parts, duplicate normalized part names, external targets, a body above the metadata reader's 256 KiB cap, and cases at/below/above each proposed resource limit. | Some metadata failure/no-fetch tests exist; content and resource-boundary cases pending. |

Compare the candidate reader against the current Mammoth integration using the same identified corpus. Record versions, expected content policy, normalized evidence and prompt payloads, diagnostics/failure outcomes, and resource observations. Compare title ordering, headings/TOC candidates, author and metadata fields, lead text, and fallback behavior; do not use nonempty output, byte-identical HTML, or matching generated model titles as a substitute.

Classify every difference as equivalent under the stated normalization, intentional and justified (including truthful extractor-identity changes), or unresolved regression. Record the rationale and expected result before treating an intentional difference as acceptable. Unresolved consequential differences prevent selection of that candidate; missing cases remain pending evidence.

## Decision Criteria and Research Exit

### Evidence needed to judge rewrite feasibility

Assess the proposed rewrite against these requirements. Candidate experiments and package-installation checks may use an isolated evaluation artifact; recommending implementation does not require completing the repository migration first. Deferral must identify unmet requirements rather than imply that the rewrite criteria passed.

1. Establish evidence quality using the minimum corpus and comparison method. State the supported DOCX subset, explicit limitations, and any consequential difference from the current best-effort contract.
2. Verify malformed-input and external-I/O behavior, measure resource handling against the accepted budgets above, and record relevant regressions or unresolved limits.
3. Verify the executable candidate under the Node.js runtime contract (`>=22.23.0`), including representative built ESM/CJS integration. Use relevant managed application cases when evaluating repository filesystem integration; an isolated candidate may use a focused harness with recorded inputs and outcomes. Keep pure parsing checks in unit coverage. Bun source tests alone do not establish Node compatibility.[^testing]
4. Demonstrate a Mammoth-free isolated packed candidate through fresh installations with supported package managers, inspecting its resolved dependency tree. Show that existing Mammoth consumers, including the historical spike, can migrate or retire; record the proposed handling and remaining repository migration work. Account for any independent Argparse/`sprintf-js` paths.
5. Assess maintenance cost, retained dependencies, licenses/provenance, and update responsibility. Recommending the rewrite requires the project maintainer's explicit acceptance described above. Recommend proceeding or deferring using the observed benefits, limitations, and remaining risk.

### Research outcome

After validation, record whether the proposed rewrite meets the requirements, any unmet criteria, and the remaining implementation work. A supported recommendation may justify a separate implementation plan. Research completion does not mean the replacement has shipped.[^doc-policy]

### Shipping acceptance after selection

The later implementation plan must carry these checks through the final integrated product:

1. Preserve the accepted evidence and fallback contract, use accurate extractor provenance, and pass affected managed tests plus Node.js checks of the CLI and built ESM/CJS entry points.
2. Verify migration or retirement of the historical spike and confirm no Mammoth dependency or runtime import remains in source, scripts, tests, declarations, the lockfile, or the installed tree. Explanatory historical references may remain.
3. Test fresh installations of the final packed product with supported package managers and verify complete Mammoth removal. Record any independent retained Argparse/`sprintf-js` paths rather than imply that all such packages disappeared.
4. Record final resource-boundary outcomes, regression results, maintenance acceptance, and any remaining limitations in the implementation record before claiming shipping acceptance or dependency remediation.

The research remains `draft`. No candidate implementation has been evaluated, no comparison spike has started, and neither the research decision requirements nor shipping acceptance checks have passed.

## Historical Context

- The [October dependency refresh](../plans/jobs/2026-10-16-v0.2.1-canary.2-dependency-refresh.md) records the advisory motivation and validation of the existing dependency set. Its test results are not replacement compatibility evidence.
- The archived [March Mammoth upgrade review](archive/research-2026-03-17-package-upgrade-risk-inquirer-mammoth.md) provides historical context on hyperlink handling and external-file defaults. This research evaluates replacement rather than reopening that upgrade review.

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
