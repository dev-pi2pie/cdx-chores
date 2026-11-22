---
title: "Code Quality Review"
created-date: 2026-11-22
status: draft
agent: codex
---

## Scope

This review covers `src/`, `test/`, and `scripts/` at `bfb3e23c`. It records behavior and test gaps, module boundaries that could be easier to maintain, and places where Node or JavaScript built-ins could simplify the code. The security findings are based on source inspection.

## Findings

| Finding | Evidence and direction | Code |
| --- | --- | --- |
| CSV path containment · P2 | Replay checks path strings and misses symlinked parents. Validate the actual parents of both endpoints against the canonical working directory. Path-based preflight requires parents to stay stable through the rename. Decide whether concurrent parent replacement is in scope and, if so, require race-resistant containment during the move. Share a segment-aware lexical check that accepts names such as `..draft`, rejects cross-volume paths, and preserves each caller’s rule for accepting the root itself. | [CSV replay](../../src/cli/rename-plan-csv.ts#L67), [file I/O](../../src/cli/file-io.ts#L24) |
| Markdown PDF remote assets · P2 | The preflight misses stylesheet contents reached through local HTML stylesheet links. Evaluate whether supported WeasyPrint versions can enforce the remote-asset opt-in at the asset-loading boundary. | [Asset preflight](../../src/cli/markdown-pdf/template-assets/remote-policy.ts#L180), [renderer invocation](../../src/cli/markdown-pdf/render.ts#L217) |
| Markdown fence parsing | The title and code scanners can close a fence on a shorter marker. Heading and table counts also include matching lines inside fences. Apply the settled behavior below. | [Title scanner](../../src/cli/markdown-pdf/profile/signals.ts#L180), [code scanner](../../src/cli/markdown-pdf/profile/signals.ts#L263), [signal collection](../../src/cli/markdown-pdf/profile/signals.ts#L348) |
| Codex cancellation coverage | A fixed delay can abort before the child starts, and the fixture records only the last PID. Wait for `config/read` before aborting and verify that every launched child exits. | [Discovery transport tests](../../test/codex-info/transport.app.test.ts#L313) |
| Inline prompts | Path and text prompts duplicate terminal setup, cancellation, and teardown. Share the session lifecycle, keep completion logic in each prompt, and use `Set` for path suggestion deduplication. | [Path prompt](../../src/cli/prompts/path-inline.ts#L242), [text prompt](../../src/cli/prompts/text-inline.ts#L253) |
| Image framing | PNG, WebP, and JPEG use independent streaming parsers in one file. Extract them behind the existing factory and preserve output bytes, chunk handling, and sink backpressure. | [Image framing](../../src/cli/video-frames/image-framing.ts#L49) |
| Markdown PDF test mocks | One installer owns session, authoring, and rendering registrations and counters. Split those registrations by service behind the existing harness entry point. | [Mock installer](../../test/markdown-pdf/interactive/mock-action.ts#L96) |
| Test-runner structure | Launch preflight shares a module with output draining and process-group shutdown. Extract preflight while preserving the distinction between a rejected launch and a spawn failure. | [Process runner](../../scripts/testing/execution/process.ts#L187) |
| CRC-32 built-in | PNG framing and three fixture generators calculate CRC-32 manually. Sample checksums matched `node:zlib.crc32`. Compare generated fixture bytes before replacing the custom implementations. | [PNG profile chunks](../../src/cli/video-frames/profile-chunks.ts#L38), [DOCX fixtures](../../scripts/generate-docx-fixtures.mjs#L69), [data-extract fixtures](../../scripts/generate-data-extract-fixtures.mjs#L164), [data-query fixtures](../../scripts/generate-data-query-fixtures.mjs#L190) |

## Settled Decisions

### Fenced code and document structure

Use one fence scanner for title, heading, table, and code signals. Title detection and heading and table counts consider only lines outside fenced code blocks. Code signals continue to use language labels from opening fences. Preserve the current heading and table heuristics outside fences.

Use the renderer’s Pandoc Markdown input mode as the reference for fence recognition. Top-level opening and closing fences allow up to three leading spaces. A closing line uses the same marker character and at least as many markers as the opening line. Only spaces or tabs may follow the closing run. A candidate opener without a valid close before end of input leaves its lines available for ordinary signal collection. [Pandoc input mode](../../src/cli/markdown-pdf/render.ts#L168)

A checked example with one real heading and a fenced shell snippet containing a `#` comment and a pipe currently produces two headings and one table row. The expected result is one heading, zero table rows, and `sh` as the code language. This keeps code examples from inflating layout suggestions and project report metrics. [Layout signals](../../src/cli/markdown-pdf/template-codex/recipe-signals.ts#L104), [project report](../../src/cli/markdown-pdf/project-codex/report.ts#L109)

Use a focused fixture with a shorter marker and a same-length marker followed by a language label inside the fence. Place heading and table lookalikes inside the fence and the real title and table after the valid close. Assert the selected title, heading count, table count, and code language. Cover an unclosed fence separately so its following heading remains visible to the signal collectors.
