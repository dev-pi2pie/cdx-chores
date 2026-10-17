---
title: "XML Validator Migration"
created-date: 2026-10-17
modified-date: 2026-10-17
status: active
agent: codex
---

## Goal and Scope

Replace the seven deprecated `XMLValidator.validate` calls with syntax validation through `fast-xml-validator@1.4.2`, retaining `fast-xml-parser@5.11.2` for parsing. Preserve DOCX extraction diagnostics, optional metadata fallback, and test-report errors while recording the replacement's stricter input rules.

Phases 1 and 2 are complete. The unified job record tracks the remaining verification and documentation closeout. The research remains `draft`.

Scope includes the new production dependency, an internal validation helper, the five caller files identified in the research, the DOCX package verifier, and focused regression coverage. Parser replacement, other deprecated parser options, business-rule validation, public APIs, unrelated dependency updates, and a package-version bump are outside this change.

Normal npm/Bun dependency installation is outside the copied/vendored third-party workflow for this migration. Dedicated time/memory measurements, supplemental notices, upstream source/archive comparisons, and new verification harnesses are outside scope.

## Execution Record

Use the [unified job record](jobs/2026-10-17-xml-validator-migration.md) for all four phases. Record baselines, outcomes, evidence, and review ranges in compact tables. Keep intended steps and acceptance criteria in this plan.

Commit meaningful validated progress and review each phase's complete baseline-to-tip range. Reuse passing evidence; rerun affected checks only when subsequent changes, failures, or a concrete evidence gap justify it. Phase 4 also includes the full-plan review and separate documentation closeout review.

## Proposed Usage

Add `src/utils/xml-validation.ts` with one internal `isValidXml(xml: string): boolean` helper. Import it directly from runtime callers and development scripts; do not add it to the public utility barrel. The helper owns syntax-validator configuration and translates validation exceptions into `false`; callers retain their existing error and fallback policies.

```ts
import { SyntaxValidator } from "fast-xml-validator";

export function isValidXml(xml: string): boolean {
  try {
    return SyntaxValidator.validate(xml, {
      multipleRoots: true,
      xmlDeclaraion: { optional: true, argPosition: false },
      invalidCharSequence: { comment: false, tagValue: false, attrLt: false },
    }) === true;
  } catch {
    return false;
  }
}
```

Use the public package export. The upstream spelling `xmlDeclaraion` is intentional. `multipleRoots: true` preserves the old validator's acceptance; existing consumer root checks remain authoritative. Declaration-order tolerance is preserved, and optional stricter sequence checks stay disabled. Keep other options at the reviewed version's defaults; do not add subtree skipping or dependency overrides.

Keep budget inspection and input preparation outside the helper. In `src/docx/xml.ts`, inspect the original part first, validate the ampersand-normalized copy, and parse the separately whitespace-normalized original. A `false` result becomes `docx_xml_invalid`; existing root, CDATA, namespace, entity, and resource checks stay in place.

In the two OOXML adapter files, a `false` result keeps metadata unavailable and preserves discovery fallback. In both report readers, it becomes `Malformed test report XML.`; declaration rejection and report structure/count/file checks retain their current placement. Do not replace validation with the deprecated `XMLParser.parse` validation overload.

## Compatibility Contract

Preserve current valid-document outputs and application error boundaries. The input changes are rejection of literal illegal control characters, malformed qualified names such as `<a:b:c/>`, invalid DOCTYPE placement or repetition, and prefixed namespace undeclaration (`xmlns:w=""`) in XML 1.0 where the replacement detects them. The undeclaration rule was identified during Phase 1 verification; XML 1.1 undeclaration and prefixes without declarations remain supported. These are deliberate migration differences, not claims of complete XML conformance; represent them with explicit expected results.

Retain historical ampersand recovery, named/numeric reference boundaries, leading and empty trailing CDATA behavior, nonempty trailing CDATA rejection, and unbound-prefix handling. A validator exception must not leak into `docx_initial_reader_error`. Malformed optional metadata must remain recoverable rather than turning an otherwise readable document into a failure.

The research records seven added package versions and upstream notice observations. Confirm the intended manifest/lockfile changes as part of normal dependency review; notice observations remain research context rather than a separate remediation or acceptance gate for this migration.

## Phase 1: Dependency and Caller Migration

- [x] Record the execution baseline in the unified job record, mark that record `in-progress`, and mark this plan `active`. Keep the research in `draft` pending application-verification evidence.
- [x] Add exact-pinned `fast-xml-validator@1.4.2` to production dependencies and update `bun.lock`. Preserve the parser pin and unrelated dependency versions; explain any necessary resolution differences from the research snapshot.
- [x] Add the internal helper and replace all seven validation calls across `src/docx/xml.ts`, `src/adapters/docx/ooxml-metadata-parser.ts`, `src/adapters/docx/ooxml-part-discovery.ts`, `scripts/testing/reports/report-files.ts`, and `scripts/testing/reports/report-validation.ts`.
- [x] Add `fast-xml-validator` to `scripts/docx-candidate/package-inspect.mjs`'s explicit reader dependency list. Keep runtime dependencies external in existing ESM/CJS builds.

**Exit:** all identified callers use the shared policy, caller error handling remains intact, and the manifest/verifier declare the new runtime dependency. No `XMLValidator` import or validation-overload workaround remains in source or scripts.

Phase 1 is complete. Focused verification and commit-range review are recorded in the [unified job record](jobs/2026-10-17-xml-validator-migration.md#phase-1-dependency-and-caller-migration).

## Phase 2: Behavior Verification

- [x] Add helper regressions for valid/malformed XML, repeated calls after failures, declaration-order tolerance, multiple-root policy, and the stricter control-character/name checks.
- [x] Extend existing DOCX content tests with expected migration differences and error translation. Reuse ampersand, reference, CDATA, namespace, resource-budget, and runtime fixtures to verify retained behavior.
- [x] Verify malformed optional core/application metadata and malformed discovery parts still permit their existing fallbacks, including through the integrated DOCX reader.
- [x] Extend report-reader tests to preserve the exact malformed-XML error and existing declaration, root, count, and identity rules for both reporting functions.
- [x] Run the managed unit and application suites (`bun run test:unit`, `bun run test:integration:app`), type checking, lint, and formatting checks. Resolve any additional input differences explicitly in tests and the execution record rather than silently changing frozen expectations.

**Exit:** existing behavior checks pass and every observed migration difference has an intentional expected result. Record commands and outcomes in the job record; standalone validator probes do not substitute for integration coverage.

Phase 2 is complete. Managed-suite results, the application verification timeout adjustment, and commit-range review are recorded in the [unified job record](jobs/2026-10-17-xml-validator-migration.md#phase-2-behavior-verification).

## Phase 3: Migration Verification

- [ ] Confirm the manifest, lockfile, shared helper, and seven callers match the intended migration without unrelated dependency or public-API changes.
- [ ] Reconcile completed Phase 1–2 tests/build checks and applicable prior package/comparison results with the retained code. Record reusable evidence and any concrete gaps; run only affected checks needed for fixes or uncovered migration behavior.

**Exit:** the migration matches its intended scope, verification evidence covers the affected behavior, and any necessary checks and phase-range review pass. No new harness, consumer-type fixture, or full installation-matrix rerun is required by default.

## Phase 4: Documentation and Closeout

- [ ] Add a concise migration behavior note to the current DOCX reference where needed. Align research evidence links and plan/job wording; keep research `draft` and execution details in the job record.
- [ ] Review the full implementation range from `366059861bb8796c8f136cf2c0337feb4de4e998` through the final implementation tip. Address findings, verify affected fixes, and review the expanded range before recording exact hashes and disposition.
- [ ] Review the documentation closeout separately and validate links, front matter, evidence, checklists, and status consistency.
- [ ] Mark the plan and job record `completed` after Phase 3 and closeout reviews are complete. Keep research `draft` and retain the documents at their current locations.

**Exit:** required migration checks and reviews have recorded outcomes, findings are addressed, and documentation accurately reflects completion.

## Related Research

- [XML validator migration: dependency footprint and compatibility](../researches/research-2026-10-17-xml-validator-migration.md).

## References

- [Published validator API and option types](https://github.com/NaturalIntelligence/fast-xml-validator/blob/335fcafafea64d9f651756c44836fc5c9efe1b0d/src/fxv.d.ts).
- [Published-version validator implementation](https://github.com/NaturalIntelligence/fast-xml-validator/blob/335fcafafea64d9f651756c44836fc5c9efe1b0d/src/SyntaxValidator.js).
