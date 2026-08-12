---
title: "Markdown PDF page-number Phase 2 Profile contract"
created-date: 2026-08-12
status: completed
agent: codex
plan: ../plan-2026-08-12-markdown-pdf-page-number-configuration.md
---

## Scope

Encode the Phase 1 renderer-supported page-number and page-chrome value domains
in the shared Markdown PDF Profile contract. This phase covers types, schema
allowlists, validation, normalization, deterministic initialization,
serialization, Codex Profile patch paths, and Project/Profile validation. It
does not generate renderer CSS or change rendered output; those behaviors begin
in later phases.

## Starting Boundary

- Starting commit: `32357fa8`.
- Phase 1 is completed with accepted WeasyPrint `65.1` capability baselines.
- The implementation plan is `active`; related research remains `in-progress`.
- The worktree was clean before Phase 2 began.

## Accepted Value Domains

| Field             | Accepted domain                                                                                        | Zero rule                               |
| ----------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `fontSize`        | `pt` length from `6pt` through `12pt`, with at most one fractional digit                               | invalid                                 |
| `fontWeight`      | `400`, `500`, `600`, or `700`                                                                          | not applicable                          |
| `lineHeight`      | unitless number from `1` through `2`                                                                   | invalid                                 |
| `color`           | six-digit hexadecimal color, case-insensitive                                                          | not applicable                          |
| `separator.width` | `pt` length from `0.25pt` through `2pt`, with at most two fractional digits                            | invalid; omit `separator` to disable it |
| `separator.style` | `solid`                                                                                                | not applicable                          |
| `separator.color` | six-digit hexadecimal color, case-insensitive                                                          | not applicable                          |
| `separator.gap`   | `mm` length from `0mm` through `4mm`, with at most one fractional digit; numeric zero is also accepted | valid                                   |

The shared `style` object is available only under `header` and `footer`.
`pageNumbers` owns sequence, visibility, position, and format; it does not own a
second style object.

## Defaults And Normalization

- Existing Profiles may omit every new field and must retain current behavior.
- `pageNumbers.scope` defaults to `body`.
- `pageNumbers.countFrom` defaults to `document`.
- `pageNumbers.start` and `pageNumbers.increment` default to `1`.
- Literal `start: 0` and separator `gap: 0` must survive parsing,
  normalization, merging, and serialization.
- `start` is a non-negative integer; `increment` is a positive integer.
- `scope: document` with `countFrom: body` is invalid.
- Style fields remain absent when omitted; deterministic initialization does
  not invent page-chrome styling.
- Unknown and invalid fields fail before rendering or Project emission.

## Tasks

- [x] Freeze the renderer-supported domains, defaults, and zero rules.
- [x] Extend core Profile types, schema allowlists, validation, normalization,
      defaults, and deterministic initialization.
- [x] Preserve old-Profile behavior and semantic values through YAML/JSON
      round trips; normalized serialization may emit defaulted fields.
- [x] Extend Codex Profile patch paths and bounded value domains.
- [x] Prove Project/Profile loading and validation use the shared normalized
      contract without a second schema.
- [x] Add boundary, invalid-value, compatibility, and serialization tests.
- [x] Run focused and repository validation.
- [x] Review the exact Phase 2 implementation and evidence commit range and
      resolve every actionable finding.

## Evidence Status

The Phase 1 renderer evidence establishes the accepted domains. Core Profile,
Codex Profile, and Project/Profile integration are implemented, validated, and
accepted by exact-range review.

## Checkpoint Commits

- `3c56e6f3` — Phase 2 job activation and accepted-domain freeze.
- `51883e09` — shared core Profile types, validation, normalization, defaults,
  initialization, serialization behavior, and boundary tests.
- `777fe89c` — Codex Profile patch paths, shared bounded-domain use, Project
  integration, and fail-closed helper-flow tests.
- `e11ce8cd` — Phase 2 validation evidence and provisional verdict.
- `9539327c` — exact inclusive-boundary and Project fail-closed review coverage.

## Validation

- Phase-focused Profile, Codex, and Project tests: 145 passed, 0 failed.
- TypeScript type-check: passed.
- Lint and formatting checks: passed.
- Production build: passed.
- Final reviewed-tip repository suite: 1,890 passed, 0 failed.
- `git diff --check`: passed.

## Exact-Range Review

The exact Phase 2 range `32357fa8..9539327c` was reviewed after the coverage
fix. Maintainability, test-quality, security, and documentation re-reviews
found no remaining material findings.

## Verdict

**Continue.** Existing Profiles retain shipped defaults, new controls
round-trip without coercion, literal zero values are preserved, invalid
contracts fail before output, and Codex and Project flows reuse the shared
Profile contract. Renderer CSS remains unchanged in this phase.

## Related Research

- [Markdown PDF Page-Number Configuration](../../researches/research-2026-08-11-markdown-pdf-page-number-configuration.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](../plan-2026-08-12-markdown-pdf-page-number-configuration.md)
