---
title: "Markdown PDF render bundle Phase 2 discovery"
created-date: 2026-07-10
status: in-progress
agent: codex
---

## Goal

Implement bounded top-level render-bundle discovery and Codex report
classification without integrating the partial command into rendering yet.

## Scope

Phase 2 covers:

- existing readable directory validation
- direct regular-file discovery without recursion
- case-insensitive profile, template, and stylesheet classification
- deterministic candidate ordering
- generated-name and payload-discriminator report exclusion
- missing, invalid, empty, and no-artifact failures
- focused unit coverage for all supported discovery forms

Conflict resolution and renderer integration remain owned by Phases 3 and 4.
The Phase 1 action guard therefore remains active.

## Implementation Checklist

- [x] Discover top-level regular files only.
- [x] Classify `.yml`, `.yaml`, `.json`, `.html`, and `.css` case-insensitively.
- [x] Sort candidates deterministically within each role.
- [x] Exclude generated Codex report filename patterns.
- [x] Exclude custom-path reports through current payload discriminators.
- [x] Keep malformed reserved reports excluded.
- [x] Keep malformed and unrelated non-report JSON as profile candidates.
- [x] Reject missing, non-directory, empty, and no-artifact bundles.
- [x] Pass the Phase 2 validation gates.
- [ ] Review the Phase 2 commit range and resolve actionable findings.

## Verification

| Command                                              | Result                       |
| ---------------------------------------------------- | ---------------------------- |
| `bun test test/cli-actions-md-to-pdf-bundle.test.ts` | Passed: 17 tests, 0 failures |
| `bun run lint`                                       | Passed                       |
| `bun run format:check`                               | Passed                       |
| `bun run build`                                      | Passed                       |
| `bun test`                                           | Passed                       |
| `git diff --check`                                   | Passed                       |

## Review

The initial review of
`bf9f622942b13fb3d7ff469e792fa0df47c66bc7..d63b65d` requested two changes:

- match only the exact documented discriminator field/value pairs
- bound custom JSON report classification reads and retain oversized JSON as a
  profile candidate

Both changes and inverse-field/oversized-file regression tests were added. The
first rereview then identified that a size check followed by `readFile()` did
not enforce the bound if a file grew between those operations. Classification
now reads at most 64 KiB plus one byte directly and keeps the file as a profile
candidate when the extra byte exists. The expanded Phase 2 range remains
pending final review.

## Related Plan

- [Markdown PDF render bundle directory implementation](../plan-2026-07-10-markdown-pdf-render-bundle-directory.md)

## Related Research

- [Markdown PDF Render Bundle Directory](../../researches/research-2026-07-10-markdown-pdf-render-bundle-directory.md)
