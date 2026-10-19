---
title: "DOCX Extraction Limits and Behavior"
created-date: 2026-10-17
modified-date: 2026-10-17
status: completed
agent: codex
---

## Scope

The internal DOCX reader supplies metadata, ordered text, and headings to the existing document-title ranking policy. Evidence identifies the extractor as `docx-reader`, or `docx-reader+ooxml` when core metadata is available. Reader types and diagnostics are internal, not a public reader API.

Extraction supports text evidence rather than general DOCX conversion: style and numbering rules affect heading/text projection; font symbols use the supported mappings, with unmapped symbols omitted and missing symbol fonts causing extraction failure. Layout rendering, OCR, external content loading, and general DOCX-to-HTML conversion are outside scope.

Referenced footnote and endnote bodies contribute projected headings in main-document reference order; repeated references can repeat heading facts, while nested note references are not recursively expanded. Comment bodies contribute projected headings when a style rule enables comment references. Note and comment bodies are excluded from raw text used for lead text and raw-text title candidates. Missing referenced notes, or missing comments selected by a style rule, fail extraction.

XML syntax validation rejects literal illegal control characters, malformed qualified names (such as `<a:b:c/>`), and XML 1.0 prefixed namespace undeclarations (`xmlns:w=""`). Required-part syntax failures yield `docx_xml_invalid` internally and `docx_extract_error` at the rename boundary; invalid optional metadata can be omitted while body extraction continues.

## Default Limits

These limits apply to semantic DOCX extraction. Staying within the input-size limit does not guarantee extraction: decompression, XML, runtime, or content checks can still fail.

| Area                              | Limit                                                                                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compressed input                  | 8 MiB                                                                                                                                                                 |
| ZIP entries                       | 256 physical entries                                                                                                                                                  |
| Selected decompressed parts       | 1 MiB per part; 4 MiB total                                                                                                                                           |
| XML elements / depth              | 100,000 cumulative elements; depth 64                                                                                                                                 |
| Style / numbering lookup work     | 128 steps per style-rule or numbering lookup                                                                                                                          |
| Request metadata / encoded result | 4 KiB / 8 MiB                                                                                                                                                         |
| Processing deadline               | 5 seconds from admitted input reading through result validation; expiry at equality                                                                                   |
| Sampled memory                    | 256 MiB resident set size (RSS) for the extraction process, including the parser worker and excluding the CLI process; samples every 10 ms and at runtime transitions |
| Termination grace / cleanup       | 250 ms TERM grace; an additional 1-second cleanup target                                                                                                              |
| Complete extraction call          | 6-second target, including processing and cleanup                                                                                                                     |

Resident set size measures the physical memory occupied by the process, including code, the JavaScript heap, and native allocations. Extraction fails when a sample exceeds 256 MiB, but sampling can miss brief spikes between checks; this is not a hard operating-system memory ceiling.

Timing and cleanup values are targets that OS failures can defeat. The Codex model request timeout is separate from the extraction deadline.

## Ownership and Failure Behavior

Each document-title operation reuses one supervisor through its sequential extraction loop. Each supervisor admits one active request with no queue; independent operations have separate budgets. If cleanup cannot confirm input/process settlement, extraction fails and the supervisor retains its admission slot until settlement is confirmed. The operation must not bypass that retained slot by creating a new supervisor for the next file.

| Input / outcome                                | Rename behavior                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| Input at or below 8 MiB                        | Reader attempts extraction within all limits                            |
| Input above 8 MiB through 10 MiB               | CLI admits it; reader rejects it with `docx_extract_error`              |
| Input above 10 MiB                             | CLI skips semantic extraction with `docx_skipped_too_large`             |
| Extraction limit, runtime, or content failure  | `docx_extract_error`; deterministic rename fallback remains available   |
| Readable content without a usable title signal | `docx_no_title_signal`; deterministic rename fallback remains available |

## Platform and Maintenance Scope

Process behavior has been verified on macOS with Node.js. Linux and Windows remain unverified; passing manual process-group checks does not establish product portability.

The repository maintainer owns dependency/security and provenance review, editor/corpus regressions, manual verification commands, and unsupported-content/diagnostic decisions. Reuse applicable verification evidence; repeat checks only for affected changes, failures, or concrete evidence gaps.

## Implementation and Evidence

- [Default limits](../../src/docx/limits.ts), [supervised runtime](../../src/docx/runtime/index.ts), and [CLI size prefilter](../../src/cli/actions/rename/codex/candidates.ts).
- [Evidence assembly](../../src/adapters/codex/document-rename/extractors/docx-evidence.ts) and [regression coverage catalog](test-suite-case-matrices.md#document-rename).
- [Implementation and shipping verification](../plans/jobs/2026-10-16-docx-reader-and-mammoth-replacement.md) and [compatibility follow-up verification](../plans/jobs/2026-10-16-docx-reader-review-follow-up.md).
- [XML validator migration and compatibility evidence](../plans/jobs/2026-10-17-xml-validator-migration.md).
- Historical rationale: [DOCX replacement research](../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md).
