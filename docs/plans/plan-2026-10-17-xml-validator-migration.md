---
title: "XML Validator Migration"
created-date: 2026-10-17
status: active
agent: codex
---

## Goal and Scope

Replace the seven deprecated `XMLValidator.validate` calls with syntax validation through `fast-xml-validator@1.4.2`, retaining `fast-xml-parser@5.11.2` for parsing. Preserve DOCX extraction diagnostics, optional metadata fallback, and test-report errors while recording the replacement's stricter input rules.

Implementation is underway. The unified job record tracks phase outcomes and verification. The research remains `draft` while implementation and application/distribution evidence is incomplete.

Scope includes the new production dependency, an internal validation helper, the five caller files identified in the research, the DOCX package verifier, and focused regression coverage. Parser replacement, other deprecated parser options, business-rule validation, public APIs, unrelated dependency updates, and a package-version bump are outside this change.

## Execution Record

Use the [unified job record](jobs/2026-10-17-xml-validator-migration.md) for all three phases. Record the execution baseline, phase outcomes, verification results, and remaining limitations there. Keep intended steps and acceptance criteria in this plan.

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

The research's seven added package versions and three published-notice gaps are the reviewed dependency cost. Recheck the actual lockfile and installed consumer tree during execution; retain known limitations in the job record. Package-install success alone does not resolve missing notices or establish licensing completeness.

## Phase 1: Dependency and Caller Migration

- [x] Record the execution baseline in the unified job record, mark that record `in-progress`, and mark this plan `active`. Keep the research in `draft` pending application-verification evidence.
- [x] Add exact-pinned `fast-xml-validator@1.4.2` to production dependencies and update `bun.lock`. Preserve the parser pin and unrelated dependency versions; explain any necessary resolution differences from the research snapshot.
- [x] Add the internal helper and replace all seven validation calls across `src/docx/xml.ts`, `src/adapters/docx/ooxml-metadata-parser.ts`, `src/adapters/docx/ooxml-part-discovery.ts`, `scripts/testing/reports/report-files.ts`, and `scripts/testing/reports/report-validation.ts`.
- [x] Add `fast-xml-validator` to `scripts/docx-candidate/package-inspect.mjs`'s explicit reader dependency list. Keep runtime dependencies external in existing ESM/CJS builds.

**Exit:** all identified callers use the shared policy, caller error handling remains intact, and the manifest/verifier declare the new runtime dependency. No `XMLValidator` import or validation-overload workaround remains in source or scripts.

Phase 1 is complete. Focused verification and commit-range review are recorded in the [unified job record](jobs/2026-10-17-xml-validator-migration.md#phase-1-dependency-and-caller-migration).

## Phase 2: Behavior Verification

- [ ] Add helper regressions for valid/malformed XML, repeated calls after failures, declaration-order tolerance, multiple-root policy, and the stricter control-character/name checks.
- [ ] Extend existing DOCX content tests with expected migration differences and error translation. Reuse ampersand, reference, CDATA, namespace, resource-budget, and runtime fixtures to verify retained behavior.
- [ ] Verify malformed optional core/application metadata and malformed discovery parts still permit their existing fallbacks, including through the integrated DOCX reader.
- [ ] Extend report-reader tests to preserve the exact malformed-XML error and existing declaration, root, count, and identity rules for both reporting functions.
- [ ] Run the managed unit and application suites (`bun run test:unit`, `bun run test:integration:app`), type checking, lint, and formatting checks. Resolve any additional input differences explicitly in tests and the execution record rather than silently changing frozen expectations.

**Exit:** existing behavior checks pass and every observed migration difference has an intentional expected result. Record commands and outcomes in the job record; standalone validator probes do not substitute for integration coverage.

## Phase 3: Distribution and Closeout

- [ ] Build the product and verify ESM/CJS loading, TypeScript declarations, and child/worker/parser assets on the primary Node runtime and minimum Node 22.23.0.
- [ ] Run the existing full frozen-output comparison (`node scripts/docx-candidate/launch.mjs`) and resource measurement harness (`node scripts/docx-candidate/measure-launch.mjs`). Confirm that added module loading preserves the existing deadline and memory budgets.
- [ ] Run `node scripts/docx-candidate/package-check.mjs` for fresh npm/Bun installations and the existing built-format/runtime consumer matrix. Verify the new dependency resolves within each fresh installation without source-tree fallbacks.
- [ ] Check actual dependency resolution, published notices, and package-manager audit results. Resolve notice gaps and audit findings or record explicit maintainer acceptance with rationale in the job record before adoption closeout. Record any failed or unrun checks accurately.
- [ ] Update the job record and research with implementation evidence and actual compatibility results. Add a concise behavior note to current DOCX documentation if required by the implemented changes; keep execution details in the job record.

**Exit:** required application, resource, build, and installed-product checks pass, and notice/audit findings are resolved or explicitly accepted as above. Mark the plan and job record complete only after their work is finished; close the research only when the linked implementation evidence supports its conclusions. Unrun required checks or unaccepted dependency findings leave the plan incomplete.

## Related Research

- [XML validator migration: dependency footprint and compatibility](../researches/research-2026-10-17-xml-validator-migration.md).

## References

- [Published validator API and option types](https://github.com/NaturalIntelligence/fast-xml-validator/blob/335fcafafea64d9f651756c44836fc5c9efe1b0d/src/fxv.d.ts).
- [Published-version validator implementation](https://github.com/NaturalIntelligence/fast-xml-validator/blob/335fcafafea64d9f651756c44836fc5c9efe1b0d/src/SyntaxValidator.js).
