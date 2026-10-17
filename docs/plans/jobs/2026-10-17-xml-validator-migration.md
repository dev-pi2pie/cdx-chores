---
title: "XML Validator Migration Execution"
created-date: 2026-10-17
status: in-progress
agent: codex
---

## Scope

Unified execution record for all three phases of the [implementation plan](../plan-2026-10-17-xml-validator-migration.md), based on the [migration research](../../researches/research-2026-10-17-xml-validator-migration.md). Record phase outcomes, verification results, and remaining limitations here as work proceeds.

## Status

Phase 1 implementation and focused verification have passed; commit-range review is pending. Phase 2 has not started. The plan is active, this record is in progress, and the research remains draft. Phase 3 distribution/resource verification and dependency-finding disposition remain pending.

## Phase 1: Dependency and Caller Migration

Baseline: `366059861bb8796c8f136cf2c0337feb4de4e998`.

| Item | Outcome |
| --- | --- |
| Implementation | Pinned validator, shared helper, all seven callers, and reader dependency verifier migrated; no deprecated validator imports remain in source/scripts. |
| Dependency resolution | Seven added package versions match the research; existing package records and parser pin are unchanged. |
| Focused tests | `bun test` across helper, DOCX content/resource/runtime, OOXML metadata, report validation, and suite-selection files: 415 passed, 0 failed. Namespace-policy smoke: 3 passed. |
| Static/build checks | `bun run tsc --noEmit`, `bun run lint`, `bun run format:check`, `bun run build`, and whitespace checks passed. Build retains the existing TypeScript 7 experimental-API warning. |
| Compatibility difference | XML 1.0 prefixed namespace undeclaration now yields `docx_xml_invalid`; the existing fixture expectation and research/plan document this stricter rule. XML 1.1 undeclaration and undeclared prefixes remain accepted by the helper. |
| Review | Pending checkpoint review. |
