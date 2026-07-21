---
title: "Markdown PDF Interactive Mode Phase 1 prepared services"
created-date: 2026-07-21
status: in-progress
agent: codex
plan: ../plan-2026-07-21-markdown-pdf-interactive-mode.md
---

## Goal

Implement Phase 1 of the Markdown PDF Interactive Mode plan by extracting
prepare-once renderer and generated-artifact service boundaries while keeping
the shipped direct commands compatible.

Phase base: `f80bf87d9abb683ffcd13fdb537eaa214b25720d`.

## Implementation Checklist

- [ ] Extract prepare and render/commit services from `actionMdToPdf`.
- [ ] Preserve bundle discovery, explicit-role precedence, warnings, Profile
      normalization, title signals, code options, and renderer behavior.
- [ ] Expose prepared Profile, Template, and Project generation results.
- [ ] Separate prepared report payloads from report writes.
- [ ] Separate stable prepared artifact identity and bundle-relative paths from
      physical destination binding.
- [ ] Add writers for the exact accepted prepared artifacts.
- [ ] Keep direct command output, errors, defaults, and overwrite behavior
      compatible.
- [ ] Add focused prepare-once and direct-command regression coverage.
- [ ] Pass focused and repository validation.
- [ ] Review the exact Phase 1 commit range and resolve actionable findings.

## Verification

Pending implementation.

## Review

Pending a validated Phase 1 commit range.

## Artifact Safety

No durable Profile, Template, Project, report, HTML, or PDF artifacts should be
created by the automated Phase 1 verification path. Renderer and writer tests
must use isolated temporary fixtures and injected runners.

## Related Research

- [Markdown PDF Interactive Mode](../../researches/research-2026-07-03-markdown-pdf-interactive-mode.md)
