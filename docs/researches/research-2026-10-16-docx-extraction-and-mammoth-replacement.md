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

## Resource Isolation and Content-Support Contract

This section separates runtime accounting from document compatibility. The maintainer accepted the Phase 2 design, initial-reader scope, and validation method: one fresh extraction process per admitted request and baseline-led content handling. The diagrams describe the agreed target rather than implemented behavior. Agreement authorizes the initial reader slice, while resource enforcement belongs to Phase 4 and final numeric budgets/support acceptance belong to Phase 6.

### Memory accounting alternatives

Node reports RSS for the whole process, including its worker threads. Moving parsing into a worker therefore leaves caller allocations in the same RSS reading.[^node-memory] Subtracting an initial reading cannot reliably attribute subsequent caller allocations or garbage collection to extraction.

```text
Shared Node process
+-------------------------------------------+
| Caller / application allocations          |
| Supervisor main thread                    |
| Parser worker                             |
+-------------------------------------------+
                     |
                     v
              Combined process RSS
```

| Approach | Benefit | Limitation |
| --- | --- | --- |
| Shared-process RSS | Small supervision surface | Caller activity can change the result for the same document. |
| RSS increase from an initial reading | Avoids charging all pre-existing memory | Caller allocations and collection still affect the apparent extraction cost. |
| Separate extraction process | Gives the extraction runtime its own accounting and termination boundary | Adds runtime startup, communication, memory, packaging, and cleanup costs. |

A Node child process has its own memory and V8 instance, with a communication channel to its parent.[^node-child] The proposed design uses one extraction process per request, with a supervisor main thread and a parser worker inside it. This keeps a sampling event loop separate from potentially blocking parsing, without requiring an external process-inspection command. A persistent pool would introduce another lifecycle and memory-retention policy and is outside the initial design.

```text
Caller process                       Extraction process [DESIGN]
+------------------------+           +-----------------------------+
| Admit / start deadline |  bounded  | Supervisor main thread      |
| Read with byte cap     |  request  | - sample this process's RSS |
| Bound communication    |---------->| - supervise parser worker   |
|                        |           |              |              |
| Validate result        |<----------|              v              |
| Confirm child exit     |  bounded  | Parser worker               |
+------------------------+  response | - ZIP/XML/content reading   |
                                     +-----------------------------+
                                     <------- RSS budget ---------->

Deadline scope: input read + startup + communication + extraction + validation
Return boundary: result/failure and confirmed process cleanup
```

The RSS scope includes the extraction process's Node runtime, supervisor, parser worker, and decompression allocations. Caller memory is outside that scope, but input/result transport can still allocate in the caller. Request size, response size, and active-request concurrency therefore need separate bounds. A per-request RSS threshold is not an application-wide memory budget.

RSS sampling can miss brief peaks and can observe an overshoot only after allocation. A separate process improves attribution and containment but does not establish a kernel-enforced memory ceiling. Worker engine limits alone are insufficient because they exclude external data such as `ArrayBuffer`s.[^node-worker-limits] A hard OS memory guarantee would require separate platform-specific investigation and is outside the proposed portable guard.

### Deadline, transport, and termination contract

The processing deadline starts after admission, before opening/reading input or launching the child. It includes bounded input reading, startup, transfer, parsing, result receipt, decoding, and schema validation. A busy request starts no extraction and enters no queue. Shutdown has a separate grace/escalation policy; measure complete API latency through confirmed closure so cleanup costs remain visible.

Use `spawn(process.execPath, [fixedPackagedChildPath])` without a shell, detachment, inherited runtime arguments, or document-selected code. The worker also uses a fixed packaged entry, an empty `execArgv`, and no evaluated source. Resolve assets relative to packaged modules and use the package directory as the child working directory. Allow only required system-root/temporary-directory variables and `NO_COLOR`; exclude `NODE_OPTIONS`, `NODE_PATH`, credentials, proxies, and caller-selected loaders. Document relationships remain inert: no external target loading or executable-content evaluation. The existing adapter owns normalization, title ranking, and outward failure mapping.

| Boundary | Proposed contract |
| --- | --- |
| Input | Read the path in capped chunks after admission; an early size check never replaces actual-byte counting. Do not perform an unrestricted read/copy before supervision. |
| Request | One fixed-version byte frame with bounded metadata length and document length, followed by validated limits and DOCX bytes. No document-derived executable names, module paths, or URLs. |
| Result | One byte-framed UTF-8 JSON success containing document facts, or a fixed internal failure code. Validate exact schema, strings/collections, actual byte counts, and end-of-frame; reject extra frames, trailing bytes, malformed UTF-8, and truncation. |
| Standard streams | Reserve stdout for the framed protocol and ignore stderr rather than accumulating unbounded diagnostic output. Report fixed internal startup/protocol failures without transporting raw exception text. |
| Allocation | Validate declared lengths before receiver payload assembly/decoding, independently count received bytes, and obey write backpressure. Stream buffering thresholds are not byte ceilings. |
| Memory | Include child runtime, supervisor, worker, decompression, and result encoding in child RSS. Bound caller input/result buffers separately; do not subtract an initial RSS reading. Transfer only an exact dedicated input buffer to the worker. |
| Admission | One active extraction per internal supervisor owner; reject a concurrent request without queuing. This is not an aggregate limit across separately loaded package instances or caller workers. |
| Sampling | Sample child RSS before worker creation, periodically, after parser completion, and before publishing a result. Above-limit fails; exactly-at-limit passes. |
| Parent loss | Keep input open after the complete request as a liveness signal. Premature EOF/error cancels work; normal result flushing and child closure do not wait for another request. |
| Completion | Freeze one outcome, stop input/parser work, confirm child `close`, remove timers/listeners, and release admission once. Result receipt or `child.killed` alone does not prove cleanup. |

Framed byte streams are preferred to Node object IPC because an IPC message has already been deserialized before a handler can validate its size.[^node-child] The receiver can reject an oversized frame declaration before assembling its payload. The child still owns encoding allocations, and RSS remains sampled rather than a hard allocation ceiling. Complete facts need their own output bound because headings may repeat body content and JSON escaping can expand it; reject overflow explicitly instead of silently truncating facts.

```text
Start request
     |
     v
Bounded read --> launch child --> transfer --> extract --> validate bounded facts
     |                    |                   |                 |
     +--------------------+-------------------+-----------------+
                          |
                    Success or failure
                          |
              Stop parser / close communication
                          |
                    Confirm child exit
                          |
                Return one defined outcome

Timeout / cancellation / crash / invalid response
     `--> terminate child --> bounded escalation --> confirm exit --> failure
```

On timeout, cancellation, protocol failure, stream error, or excessive RSS, freeze failure and request termination immediately; escalate from TERM to KILL after the grace period where supported. Await `close`, including stdio closure. A valid result followed by failed cleanup is an infrastructure failure. Portable Node cannot guarantee both a fixed API return deadline and confirmed exit under arbitrary OS termination failure. An unconfirmed close must remain a distinct validation failure with retained process ownership/admission capacity, rather than a passing timeout result. Final acceptance must state this limitation and separately assess processing, cleanup, and total latency.

| Additional provisional proposal | Starting value | Reason to validate |
| --- | --- | --- |
| Active requests | 1 per supervisor owner, no queue | Bound process accumulation; current rename extraction is sequential. |
| Request metadata / result JSON | 4 KiB / 8 MiB | Keep protocol metadata small while allowing complete facts; measure escaping/repetition expansion. |
| RSS sampling | 10 ms plus transition samples | Observe the isolated process without process-table commands; brief peaks can still be missed. |
| Processing / child RSS | 5 seconds / 256 MiB | Reassess the Phase 1 proposals with input reading and the new process boundary included. |
| TERM grace / total cleanup target | 250 ms / 1 second | Exercise graceful stop, escalation, and confirmed closure. |
| Complete API target | 6 seconds | Include processing and cleanup; not an OS-failure guarantee. |

These values supplement the [structural proposals](#resource-budgets); none is accepted by design agreement alone. Tests must cover caller-memory independence, startup failure, a blocked parser, deadline expiry, sampled-RSS overshoot, cancellation, malformed/oversized messages, early exit, parent disconnection, and no activity after completion. Controlled observations establish below/at/above threshold policy; real-process measurements establish runtime feasibility. Install offline positive controls inside the actual parsing process/worker before parser imports. Passing checks in an unguarded helper alone do not establish the packaged path's behavior.

### Font-encoded symbols and compatibility

Ordinary Unicode in `w:t` is text. A `w:sym` element instead supplies a font and character code that require mapping. Mammoth uses `dingbat-to-unicode`, retries an `F0`-prefixed character using its low-byte form, and omits an unmapped symbol with a converter warning.[^mammoth-body] The current rename adapter does not copy those converter messages into prompt warnings. A candidate must compare resulting evidence and reasons, not only converter diagnostics.

```text
DOCX text content
       |
       +-- w:t: ordinary Unicode ------> preserve text
       |
       `-- w:sym: font + character code
                      |
                      v
                 Mapping lookup
                  /          \
               Found        Unmapped
                 |              |
                 v              v
          Preserve Unicode   Apply the agreed
                             unsupported-symbol policy
```

| Policy | Benefit | Compatibility cost |
| --- | --- | --- |
| Omit every unmapped symbol with an internal diagnostic | Keeps otherwise usable extraction available | A smaller mapping set can lose characters the baseline preserves. |
| Fail extraction for every unmapped symbol | Makes unsupported input explicit | Can reject useful metadata/headings/body because of one unrelated glyph; this is an intentional behavior change. |
| Classify baseline behavior and preserve its useful mappings | Aligns support with the existing evidence contract | Requires identified mapping cases, a data/dependency ownership choice, and explicit decisions for remaining gaps. |

The recommended research policy is the third option. Do not infer that a glyph is decorative from its font or position alone. The classification below happens in research/tests; it does not introduce runtime dispatch to Mammoth.

```text
Identified font/code case
            |
      Baseline behavior?
        /           \
   Converts        Omits
      |              |
      v              v
Preserve mapping   Omission may preserve behavior
or record a gap    Verify evidence and reason;
                  retain internal diagnostic

Invalid font/code data --> establish explicit diagnostic/outcome expectations
```

Prefer the standalone `dingbat-to-unicode` mapper already used by Mammoth over a small owned table, with adoption deferred to Phase 5.[^dingbat-mapper] Its pinned `js-1.0.1` source has 1,061 mapping rows across Symbol, Webdings, Wingdings, Wingdings 2, and Wingdings 3, and no runtime dependencies.[^dingbat-pinned] The manifest declares BSD-2-Clause, but the pinned source/package lacks a license notice; a notice on mutable upstream main is insufficient exact-version proof. Resolve provenance and notice obligations before adoption, or reopen the mapping choice. Do not copy the data to bypass that question. Phases 2–3 add no mapping dependency; complete Mammoth removal remains mandatory.

| Symbol input | Required baseline outcome |
| --- | --- |
| Ordinary Unicode in `w:t` | Preserve independently of font mapping. |
| Recognized font/code | Preserve the mapped Unicode; font comparison is case-insensitive but does not trim whitespace. |
| Uppercase `F0` prefix | Retry the low-byte code as Mammoth does; lowercase `f0` does not receive that retry. |
| Unknown font/code or absent/invalid character | Omit with an internal diagnostic; preserve resulting evidence and empty-content reason. |
| Partially valid hexadecimal character | Preserve the mapper's identified permissive parsing unless a specific departure is accepted. |
| Missing font attribute | Preserve conversion failure, including when other text or usable metadata exists. |

Converter warnings remain internal: they do not become prompt warnings. A missing-font conversion failure maps to the existing `docx_extract_error`; omission alone does not cause failure when usable evidence remains. This policy preserves the baseline distinctions instead of failing every unsupported glyph.

Add independent cases for mapped/unmapped fonts and codes, prefixed encodings, malformed attributes, and symbols in headings, lead text, and otherwise usable metadata-only evidence. When the baseline maps a character and the candidate cannot, classify it as a gap until the mapping is implemented or a case-specific departure is accepted. When both omit it, verify complete evidence and prompts before accepting the omission. Keep detailed diagnostics internal unless an outward change is specifically accepted.

### Style maps, notes, and support boundaries

Embedded style maps require an evidence projection, including rules that can create, merge, separate, or suppress headings. Invalid grammar is ignored with an internal diagnostic, preserving Mammoth's later valid/default rules and unchanged outward warnings. Valid grammar that the candidate cannot project remains a compatibility gap; do not silently ignore it or count a blanket unsupported-input failure as equivalent. Scope decisions require identified evidence/prompt comparisons rather than assumptions about visual formatting.[^mammoth-style-reader]

| Heading-affecting feature | Required behavior |
| --- | --- |
| `p.StyleId` | Case-sensitive style-ID match. |
| `p[style-name='…']` and prefix `^=` | Case-insensitive style-name matching. |
| Rule order | First matching embedded rule precedes defaults. |
| `h1`–`h6` and `:fresh` | Preserve level and paragraph separation. |
| Reused heading path and `:separator('…')` | Preserve merged heading text and literal separators. |
| Nested paths, run mappings, and table mappings | Preserve headings generated inside ordinary paragraphs, nested targets, or tables. |
| Empty target and `!` | Preserve unwrapping or subtree suppression, including whether note references are gathered. |

Phase 3 includes direct paragraph rules `p.StyleId => hN:fresh` and `p[style-name='…'] => hN:fresh` for its identified embedded-map case. Prefix selectors, nested/run/table paths, merging/separators, unwrapping, and suppression remain Phase 5 obligations. This does not require arbitrary HTML rendering, but all heading text/order and content-presence effects must be accounted for before full compatibility can pass.

Mammoth snapshots note references from the main-document HTML traversal, then renders that list once.[^mammoth-html] It does not recursively resolve references discovered inside notes. Preserve note-body heading evidence after main-document headings, duplicate references, reference labels such as `[1]`, and exclusion of note bodies from raw text. Do not deduplicate reader heading facts: the adapter applies its first-four-heading ranking before deduplication. Self/mutual note cycles therefore do not imply failure or recursive expansion. Missing main-document referenced notes fail conversion, whereas nested missing references are not resolved; eager parsing of malformed unused note content can still fail.

```text
Main-document traversal
          |
          +--> ordered main headings / raw text
          |
          `--> snapshot referenced notes [A, A, B]
                              |
                              v
                    render A, then A, then B
                              |
                    append note heading facts
                              |
                 nested references are not expanded
```

Bound note parsing and snapshot traversal structurally; do not add recursive expansion merely to reject cycles. Preserve metadata-only, empty-document, and non-text reason distinctions using an internal content-presence fact if necessary. Usable metadata never rescues a content-conversion failure. New diagnostics stay internal and retain the existing adapter's outward reason/warning policy.

### Contract decisions and required evidence

| Decision | Required evidence before acceptance |
| --- | --- |
| Process topology and memory scope | Same document under different caller memory loads; actual supervised-process RSS and startup costs. |
| Deadline and shutdown bounds | Blocked-parser and startup/communication cases, bounded termination, complete API latency, and confirmed cleanup. |
| Transport and concurrency bounds | Oversized input/result rejection, explicit active-request limits, and no uncontrolled child accumulation. |
| Symbol mapping ownership and unsupported policy | Font/code coverage, complete evidence/prompt comparisons, diagnostic mappings, and dependency/provenance review. |
| Style-map and note support | Grammar, ordering, cycle/expansion, and failure-boundary cases through separate heading/raw streams. |
| Final workload and runtime budgets | Independent below/at/above enforcement, representative/adversarial measurements, and the packed candidate's Node/npm/Bun matrix. |

The [plan](../plans/plan-2026-10-16-docx-reader-and-mammoth-replacement.md) separates design agreement, reader construction, resource isolation, content compatibility, and complete candidate validation. Agreement on the design authorizes an implementation scope; it does not accept unmeasured numeric limits or select the replacement. Remaining consequential gaps can justify deferral at the selection gate.

The separate [contract corpus](../../scripts/docx-baseline/corpus/contract/index.ts), [manifest](../../test/document-rename/fixtures/docx-baseline/contract-manifest.json), and [complete captures](../../test/document-rename/fixtures/docx-baseline/contract.json) retain 33 additional baseline cases: 11 symbol, 9 style-map, and 13 note cases. Independent assertions cover content, ordering, converter diagnostics/failures, evidence, and prompts. Overlapping rules prove first-match precedence; repeated note headings prove ordering and ranking before deduplication. Self/mutual-cycle observations run only through bounded Node children; runner termination is never relabeled as an adapter extraction reason. The original 70 semantic and 21 structural expectations remain unchanged. These observations establish contract inputs, not candidate compatibility or resource enforcement.

### Initial reader scope

Design agreement authorizes a private, inline buffer-to-facts reader for trusted evaluation inputs and a test-only adapter comparison. Reuse the current ZIP/XML infrastructure and extract pure metadata/evidence assembly where needed; preserve current production behavior. Reader facts contain ordered heading levels/text, a separate raw stream, optional metadata, internal diagnostics, and content presence. Keep duplicate heading facts and leave ranking/normalization in the adapter. No process supervisor, symbol dependency, public exports, or dispatch changes belong to this slice.

| Initial comparison group | Identified cases |
| --- | --- |
| Existing evidence | All seven existing DOCX fixture seeds. |
| Heading semantics | `heading-custom-id-standard-name`, `heading-inherited`, `heading-embedded-map`. |
| Mixed ordering | `text-table-content-control-order`, `secondary-textbox-order`. |
| Empty/non-text reasons | `empty-valid`, `empty-image-only`, `empty-table-only`, `empty-line-break-only`. |
| Metadata boundaries | `metadata-title-only`, `metadata-author-only`, `metadata-conversion-failure`. |
| Invalid content | `malformed-invalid-zip`, `malformed-main-xml`, `malformed-missing-main`. |

These 22 cases must preserve complete evidence and prompt payloads except extractor identity: `docx-reader+ooxml` when metadata is available, otherwise `docx-reader`, replacing the corresponding `mammoth+ooxml`/`mammoth` value. Synthetic inputs retain independent assertions. Record source footprint, helper changes, difficult semantics, and remaining enforcement/content/packaging work before deciding continue, constrain, or defer. Remaining original/contract/resource cases are untested candidate obligations, not implicitly supported input. The inline reader is unguarded evaluation code; the child/worker boundary and its enforcement tests belong to Phase 4.

### Initial reader assessment

The [private reader](../../src/docx/reader.ts) and [comparison harness](../../scripts/docx-candidate/launch.mjs) match all 22 identified cases for ordered heading facts, separate raw text, metadata, content presence, complete evidence, and complete prompts. The sole outward difference is the agreed extractor identity. Built ESM/CJS entries also pass under Node, including the minimum supported runtime. These checks use the inline evaluation path rather than an installed or supervised candidate.

| Responsibility | Initial footprint / finding |
| --- | --- |
| Package/content reader | 336 lines in five private modules: orchestration, ordered XML, body traversal, direct heading rules, and facts types. |
| Rename policy | 113-line shared assembly extracted from the existing adapter; ranking and warning/reason policy remain there. |
| Existing package/metadata helpers | One package read; pure metadata-from-parts helper; fixed embedded-style-map opt-in retaining default behavior and the existing part cap. |
| Evaluation harness/tests | 321 lines for case selection, test-only adapter, complete comparisons, temporary builds, and application assertions. |
| Difficult semantics demonstrated | Deferred text-box ordering, direct style mapping without inherited-heading promotion, and HTML-content presence separate from usable text. |

The existing package helper still skips parts above 256 KiB; this is an initial-slice limitation, not the proposed content budget. Image presence is inferred from internal relationship references without validating media bytes. Restricted style maps and unsupported symbol/note/field paths do not establish broader compatibility. Raw parser exceptions are not returned as diagnostics; initial failure codes stay internal. Mammoth remains the production extractor, and all frozen production baseline captures still match after helper extraction.

| Remaining work | Estimated scope |
| --- | --- |
| Phase 4: isolation | Substantial: supervisor, child/worker assets, bounded framing, input reading, admission, sampled RSS, deadline/cancellation, cleanup, and fault observations. |
| Phase 5: content | Substantial: heading-affecting style projection, mapper provenance/adoption, note snapshots/duplicates/failures, remaining text/discovery/secondary-content cases, and diagnostic mappings. |
| Phase 6: complete validation | Measurements and all-case comparison, required runtime assets in both formats, fresh npm/Bun consumers, installed trees, and maintainer budget/support acceptance. |

The complexity checkpoint supports **continue**: the demonstrated slice remains focused and shares package/metadata/rename policy rather than introducing parallel implementations. This is an initial feasibility result, conditional on phase verification/review; it does not select the replacement. Style-path projection and process lifecycle remain the largest unproved responsibilities. Stop after Phase 3; later expansion must retain the complete corpus and reconsider deferral if those responsibilities exceed the focused reader's benefit.

## Validation Matrix and Method

### Minimum comparison corpus

Existing fixtures and assertions provide seeds. Each variation below needs an identifiable case and expected handling; one fixture may cover several independently asserted variations. The initial-reader assessment above covers only its 22 identified inputs; complete category validation, including the supervised path, remains pending. The retained baseline does not cover every new isolation, font/code, or support-policy decision above. Extend those cases before claiming complete candidate validation under the revised contract. Unsupported-content cases establish a limitation or failure policy rather than a promise to support every DOCX feature.

| Category                         | Minimum cases and questions                                                                                                                                                                                                               | Evidence state                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Existing evidence                | All seven DOCX fixtures: metadata-rich, heading-rich, weak-heading, no-heading, table-heavy, hyperlink-heavy, and alternate-editor. Preserve existing title-evidence assertions.                                                          | Initial slice matched; supervised comparison pending.         |
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
| Extraction time / peak RSS | 5 seconds / 256 MiB | More than 80 / two times the corresponding bounded baseline maxima. Define processing/API timing, shutdown grace, and memory scope under the contract above before candidate measurement or acceptance. |

The [structural cases](../../scripts/docx-baseline/resource-cases.ts) isolate seven exact below/at/above dimensions; some exceed other proposed caps and are not examples of fully supported inputs. Inspector safety ceilings are separate from candidate limits. Candidate enforcement requires independent cap checks with other limits isolated, controlled blocked-parser/process observations for deadline/RSS/shutdown behavior, and real-process measurements. DOCX fixture dimensions alone cannot establish those runtime outcomes. Transport/concurrency cases must also follow the agreed contract. Candidate evidence and maintainer acceptance for that contract remain pending.

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

The retained baseline corpus has 70 semantic cases and 21 structural boundary cases, supplemented by 33 contract cases linked above and from the [unified execution record](../plans/jobs/2026-10-16-docx-reader-and-mammoth-replacement.md). Resource-isolation cases remain required, and the candidate must compare all identified support cases before full validation. Candidate equivalence, concrete support/diagnostic mappings, accepted resource budgets, maintenance acceptance, and both gates require evidence for that contract. Researching the design does not establish candidate or shipping acceptance.

## Related Plans

- [DOCX reader and Mammoth replacement](../plans/plan-2026-10-16-docx-reader-and-mammoth-replacement.md) — ten numbered phases covering contract research, candidate construction and validation, selection, conditional integration/removal, and documentation closeout.

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

[^node-memory]: [Node.js process memory accounting](https://github.com/nodejs/node/blob/v22.23.0/doc/api/process.md#processmemoryusage).

[^node-child]: [Node.js child-process ownership and communication](https://github.com/nodejs/node/blob/v22.23.0/doc/api/child_process.md#child_processforkmodulepath-args-options).

[^node-worker-limits]: [Node.js worker resource limits](https://github.com/nodejs/node/blob/v22.23.0/doc/api/worker_threads.md#new-workerfilename-options).

[^dingbat-mapper]: [Dingbat-to-Unicode mapping library](https://github.com/mwilliamson/dingbat-to-unicode).

[^mammoth-style-reader]: [Mammoth 1.13.0 style-map parser](https://github.com/mwilliamson/mammoth.js/blob/1.13.0/lib/style-reader.js).

[^dingbat-pinned]: [Dingbat-to-Unicode pinned mapping manifest](https://github.com/mwilliamson/dingbat-to-unicode/blob/js-1.0.1/js/package.json), [API](https://github.com/mwilliamson/dingbat-to-unicode/blob/js-1.0.1/js/src/index.ts), and [data generation](https://github.com/mwilliamson/dingbat-to-unicode/blob/js-1.0.1/generate.py).
