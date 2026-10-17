---
title: "XML Validator Migration Execution"
created-date: 2026-10-17
status: in-progress
agent: codex
---

## Scope

Unified execution record for all three phases of the [implementation plan](../plan-2026-10-17-xml-validator-migration.md), based on the [migration research](../../researches/research-2026-10-17-xml-validator-migration.md). Record phase outcomes, verification results, and remaining limitations here as work proceeds.

## Status

Phase 1 is complete, including commit-range review. Phase 2 implementation and verification are complete; checkpoint review is pending. The plan is active, this record is in progress, and the research remains draft. Phase 3 distribution/resource verification and dependency-finding disposition remain pending.

## Phase 1: Dependency and Caller Migration

Baseline: `366059861bb8796c8f136cf2c0337feb4de4e998`.

| Item | Outcome |
| --- | --- |
| Implementation | Pinned validator, shared helper, all seven callers, and reader dependency verifier migrated; no deprecated validator imports remain in source/scripts. |
| Dependency resolution | Seven added package versions match the research; existing package records and parser pin are unchanged. |
| Focused tests | `bun test` across helper, DOCX content/resource/runtime, OOXML metadata, report validation, and suite-selection files: 415 passed, 0 failed. Namespace-policy smoke: 3 passed. |
| Static/build checks | `bun run tsc --noEmit`, `bun run lint`, `bun run format:check`, `bun run build`, and whitespace checks passed. Build retains the existing TypeScript 7 experimental-API warning. |
| Compatibility difference | XML 1.0 prefixed namespace undeclaration now yields `docx_xml_invalid`; the existing fixture expectation and research/plan document this stricter rule. XML 1.1 undeclaration and undeclared prefixes remain accepted by the helper. |
| Review | `366059861bb8796c8f136cf2c0337feb4de4e998..8277a7eebd0f07b7ebfe1626596b483bddd71b38`: no material findings. Documentation closeout checked separately. |

## Phase 2: Behavior Verification

Baseline: `3a31f922f2c76fed4775942eab8b658d3c6f1820`.

| Item | Outcome |
| --- | --- |
| Regression coverage | Helper policy/state isolation, exact reader/report diagnostics, XML 1.1 undeclaration and declaration-order tolerance, optional metadata/discovery fallback, and required discovery failure boundaries. |
| Focused tests | `bun test` across the eight affected helper/DOCX/OOXML/report files: 447 passed, 0 failed. |
| Managed suites | `bun run test:unit`: 2061 passed across 191 files. Full managed application rerun: 2331 passed across 299 files, including report validation, fixture checks, and cleanup. Both suites had 0 failures/errors/skips. |
| Fixture adjustment | The first application run passed 2328 cases and failed three runner-entry tests because their copied repository omitted the new helper. Added that file to fixture setup; all three tests then passed, including in the full rerun. |
| Application timing | `bun run test:integration:app` reached its 240-second suite limit with 2330 passing cases and one interrupted video workflow; that workflow passed separately. The full managed rerun used a 300-second execution budget through `RunnerOptions.dependencies.execute` and passed in 233.7 seconds. Default suite policy is unchanged. |
| Static checks | `bun run tsc --noEmit`, `bun run lint`, `bun run format:check`, and whitespace checks passed. |
| Review follow-up | Strengthened relationship fallback coverage to use non-default paths and distinct metadata, so default-path fallback cannot satisfy the assertion. All 3 affected tests and static checks passed; expanded commit-range review pending. |
