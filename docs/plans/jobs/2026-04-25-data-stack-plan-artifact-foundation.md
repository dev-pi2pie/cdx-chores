---
title: "Implement data stack plan artifact foundation"
created-date: 2026-04-25
status: completed
agent: codex
---

## Goal

Implement Phase 1 of the data stack replay and Codex assist plan by adding the replayable stack-plan artifact foundation.

## What Changed

- added `src/cli/data-stack/plan.ts` with:
  - v1 stack-plan TypeScript types
  - artifact id, payload id, and filename helpers
  - strict artifact parsing and validation
  - stable JSON serialization
  - read/write helpers with overwrite protection
- covered the full Phase 1 checklist:
  - stack-plan TypeScript types and validation helpers
  - artifact id and payload id generation
  - stable field ordering for JSON serialization
  - parse errors for invalid JSON, wrong artifact type, unsupported versions, missing sections, and invalid nested fields
  - persisted source raw paths, resolved files, traversal settings, input format, header mode, schema mode, exclusions, output format, output path, overwrite intent, duplicate policy, unique key, diagnostics, and fingerprints
  - artifact read/write unit coverage
  - valid and invalid v1 artifact fixture-style coverage
- added `test/data-stack-plan.test.ts` for:
  - artifact identity and filename generation
  - required metadata and command fields
  - stable serialization ordering
  - read/write behavior
  - invalid JSON, wrong artifact type, unsupported version, missing sections, headerless columns, recommendation metadata, and fingerprint validation
- marked Phase 1 complete in the implementation plan

## Review Notes

- `maintainability_reviewer` flagged validation/serialization drift.
  - addressed by adding shared normalization/validation and making serialization order and stringify an already-normalized artifact
- `maintainability_reviewer` flagged drift risk between `acceptedRecommendationIds` and `recommendationDecisions`.
  - addressed by validating that accepted ids match accepted recommendation decisions
- `maintainability_reviewer` flagged the implicit short UID width.
  - addressed by naming `DATA_STACK_PLAN_UID_HEX_LENGTH` and documenting the short timestamp-plus-uid rationale
- `test_reviewer` flagged self-fulfilling serialization coverage.
  - addressed by serializing a deliberately shuffled artifact object
- `test_reviewer` flagged weak read-path and overwrite assertions.
  - addressed by adding file-backed missing-file, wrong-artifact-type, unsupported-version, invalid-JSON, error-code, message, and file-preservation checks
- `test_reviewer` flagged shallow nested validation coverage.
  - addressed by adding recommendation metadata and source fingerprint bound validation tests

## Verification

- `bun test test/data-stack-plan.test.ts`
- `bun run lint`
- `bun run format:check`

## Related Plan

- `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`

## Related Research

- `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`
