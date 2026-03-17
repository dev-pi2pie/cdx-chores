---
title: "Close DOCX graduation and flag removal work"
created-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Close the DOCX graduation track by removing the last gate-era cleanup leftovers, marking the graduation plan complete, and ensuring active documentation no longer describes DOCX support as currently env-gated.

## What Changed

- Removed leftover gate-era message assertions from:
  - `test/cli-actions-rename-file.test.ts`
  - `test/cli-actions-rename-batch-codex-docs.test.ts`
- Updated `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`:
  - changed plan status to `completed`
  - rewrote the setup/background wording so the env-gated behavior is clearly described as plan-start history
  - closed all Phase 7 checklist items and the Phase 7 deliverable
  - marked `bun test` complete after full-suite verification
- Updated `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`:
  - changed status to `completed`
  - added an outcome update summarizing the shipped default-on DOCX behavior
  - rewrote the gate-era findings in historical tense so they no longer read as current runtime state

## Closure Note

- Active code and active docs no longer present DOCX support as currently env-gated.
- The retained legacy note is the intended guide-level note in `docs/guides/rename-scope-and-codex-capability-guide.md` explaining that older `v0.0.7` guidance required `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1`.

## Verification

- `rg -n "experimental gate|experimental-disabled|env-gated|CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL|docx_experimental_disabled|currently disabled|requires .*DOCX_EXPERIMENTAL|DOCX semantic titles are experimental" src test docs README.md`
- `bun test`
- `bun run build`

## Related Plans

- `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`

## Related Research

- `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`
