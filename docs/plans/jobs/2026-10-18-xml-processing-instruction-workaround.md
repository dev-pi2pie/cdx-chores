---
title: "XML Processing Instruction Compatibility Workaround"
created-date: 2026-10-18
status: in-progress
agent: codex
---

## Scope

Follow up the [XML validator migration](../plan-2026-10-17-xml-validator-migration.md) and its [execution record](2026-10-17-xml-validator-migration.md). The standalone validator mistakes an initial `xml-stylesheet` or other lowercase `xml`-prefixed processing instruction for an XML declaration, rejecting previously readable DOCX content.

Baseline: `b9cd24f2ca16e18ac6236f207b8fbf7766327d88`.

## Changes and Verification

`src/utils/xml-validation.ts` inserts a space after an optional BOM only when the initial processing-instruction target extends the lowercase `xml` prefix. This bypasses the upstream declaration-prefix bug while validating the complete document. Parsing receives the original XML; genuine declarations and caller error policies retain their existing paths. The workaround is tied to the inspected `fast-xml-validator@1.4.2` behavior.

Coverage includes `xml-stylesheet`, `xml-model`, and another `xml`-prefixed target; BOM handling; actual declarations; malformed input; DOCX body/evidence/prompt preservation; compiled Node supervision; and optional metadata recovery. Two corpus cases extend direct observations from 302 to 304; `review-xml-roots-stylesheet-bom` also extends supervised parity from 39 to 40.

| Check                                              | Outcome                                                                                                                                                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regression proof before the fix                    | 349 passed, 9 failed across the three affected unit files; failures reproduced helper, body, and metadata rejection.                                                                                |
| Focused helper/DOCX/OOXML/report checks            | 455 passed across seven files, zero failures.                                                                                                                                                       |
| `bun run test:unit`                                | 2,079 passed across 191 files; report, fixture, settlement, and cleanup checks passed.                                                                                                              |
| Lint, formatting, type checking, build, whitespace | Passed. A formatting adjustment was applied before the passing check. Build retains its existing TypeScript 7 experimental API advisory.                                                            |
| `bun run test:integration:app`                     | 2,357 passed across 300 files, 14,912 assertions, zero failures/errors/skips. Compiled Node observations, report/fixture validation, confirmed settlement, and cleanup passed; no results retained. |

## Review

Full baseline-to-tip code and coverage review is pending. Record exact reviewed hashes and outcomes before closeout.
