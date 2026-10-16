---
title: "DOCX reader review follow-up"
created-date: 2026-10-16
modified-date: 2026-10-16
status: in-progress
agent: codex
---

## Scope

Address findings from the full DOCX implementation review, `bc6e3e98..9c6f92ef`. Follow-up source baseline: `9c6f92ef9754706f643700980f9e7c78397c2f3b`. The completed [plan](../plan-2026-10-16-docx-reader-and-mammoth-replacement.md), [research](../../researches/research-2026-10-16-docx-extraction-and-mammoth-replacement.md), and [execution record](2026-10-16-docx-reader-and-mammoth-replacement.md) retain their historical results.

The maintainer accepted preserving CDATA as text, including mixed plain text/CDATA that Mammoth could fail to convert. This is an explicit compatibility departure; new expectations must identify it separately from baseline-equivalent fixes. Original frozen captures and accepted resource limits remain unchanged.

## Checklist

- [x] Preserve Strong character-style heading boundaries and embedded-rule precedence.
- [x] Exclude valid vertical-merge continuation content after eager parsing; preserve orphan/restart, column-span, and failure behavior.
- [x] Normalize checkbox content controls through the existing semantic checkbox node.
- [x] Add independent content/evidence/prompt regressions, including the accepted CDATA departure.
- [x] Make package-version verification read-only and enforce measured processing completion through parent validation.
- [x] Reuse the production extractor factory in the candidate fixture; remove the unused metadata-helper option and retired resource inspector, and reconcile affected links.
- [x] Pass focused, routine, built-runtime, comparison, measurement, and packed-consumer verification.
- [x] Review the complete follow-up range, resolve findings, update current references, and confirm temporary cleanup.

## Results

| Check | Result |
| --- | --- |
| Content compatibility / CDATA | [Twenty-one named cases](../../../test/document-rename/fixtures/docx-review-cases.ts): nineteen baseline-compatible and two accepted CDATA departures; original reproductions failed before fixes; content unit and compiled-product evidence/prompt checks passed |
| Verifier corrections | Read-only version preflight and [pure negative checks](../../../test/document-rename/docx-verification.unit.test.ts) passed; parent processing observation follows validation; strict processing deadline and separate complete-API window checked; runtime unit/process regressions passed |
| Simplification / documentation | Production extractor factory reused; obsolete helper option/self-test and unused inspector removed; historical evidence links and routine/manual contract counts clarified; focused adapter checks passed |
| Routine verification | Full unit suite and 2,331 application cases passed; application 219.72 seconds under unchanged 240-second deadline; lint, format, and types passed |
| Built runtime comparisons | 134 historical and 21 follow-up cases per format on primary/minimum Node passed; complete evidence/prompts checked |
| Measurements | Eighteen workloads per runtime passed with idle/loaded callers, strict processing deadline, separate API window, RSS, and lifecycle checks |
| Packed product | Eight fresh npm/Bun × runtime × ESM/CJS public API/bin consumer paths passed; shipping build passed; tracked embedded version unchanged |
| Full-range review | Complete code/test range `9c6f92ef..5f5326e0` reviewed; predicate coverage and merged-span/checkbox regressions strengthened; stale gate wording clarified; no remaining material findings |
| Artifact cleanup | Owned manual and managed-test workspaces removed after settlement; seven historical frozen files unchanged; no smoke artifacts retained |

## Verification and Artifacts

Durable synthetic definitions and independent assertions belong under `test/document-rename/`. Routine checks use the existing managed fixture lifecycle. Manual inputs, builds, packages, consumers, caches, and reports use owned OS temporary storage and are removed after confirmed settlement. Manual commands remain separate from routine application tests; verification uses default cleanup without smoke retention.

```sh
bun run test:unit
bun run test:integration:app
node ./scripts/docx-candidate/launch.mjs
node ./scripts/docx-candidate/measure-launch.mjs
node ./scripts/docx-candidate/package-check.mjs
```

The original follow-up is complete. Earlier platform and validation limitations remain recorded in the [original shipping record](2026-10-16-docx-reader-and-mammoth-replacement.md#phase-9-mammoth-removal-and-shipping-verification). Closing documentation was reviewed separately from the code/test range; raw execution reports remain temporary.

## Additional Review Follow-Up

Address the remaining XML accounting, hyperlink compatibility, and manual harness findings from review of `bc6e3e98..97cdb606`, plus XML character-reference handling found during the follow-up review. Source baseline: `97cdb606`. Earlier results above remain historical; the accepted CDATA departure and resource limits are unchanged.

- [x] Charge each physical XML part once, including failed inspections; preserve safety failures and distinct-entry accounting.
- [x] Preserve empty-ID and unresolved-target hyperlink behavior, with independent evidence and prompt regressions.
- [x] Decode numeric XML references once, preserve literal escapes/CDATA, and reject undeclared named entities without an additional built-in expansion cap.
- [x] Require POSIX process groups before manual execution creates artifacts; remove ineffective Windows handling and redundant options.
- [x] Pass focused, routine, built-runtime, measurement, and packed-consumer checks.
- [x] Review the complete follow-up range and combined implementation, resolve findings, and confirm cleanup.

| Area | Outcome |
| --- | --- |
| XML accounting | Failed scans retain their original charge and failure; focused resource/content and compiled evidence/prompt regressions passed |
| XML references | Five baseline-compatible cases and one additional accepted CDATA-preservation case passed; single-pass decoding and selected-part/result bounds checked |
| Hyperlinks | Twenty-four named cases match historical behavior, including empty/duplicate targets, fragment merging, suppression, unused notes/comments, and explicit empty-anchor fields; focused unit and compiled evidence/prompt checks passed |
| Manual harness | Shared prerequisite rejects unsupported execution before workspaces/children; lifecycle, help, and simulated platform probes passed; ineffective Windows branch and redundant flags removed |
| Routine verification | 1,751 unit and 2,331 application cases passed; application 220.58 seconds under unchanged 240-second deadline; lint, format, types, and shipping build passed |
| Built runtime comparisons | 134 historical and 52 follow-up cases per format on primary/minimum Node passed; complete evidence/prompts checked |
| Measurements / packed consumers | Eighteen workloads per runtime and eight fresh npm/Bun × runtime × format consumer paths passed; deadline, RSS, and lifecycle checks passed |
| Full-range review | `97cdb606..190b54c6` reviewed with integration checks across `bc6e3e98..190b54c6`; empty-anchor field and XML-reference findings fixed; no remaining material findings; closing docs checked separately |
| Artifact cleanup | Owned manual and managed-test workspaces removed after settlement; frozen captures unchanged; no smoke artifacts retained |

## Drawing Relationship Follow-Up

Address drawing relationship failures, duplicate fallback handling, and stale verifier wording from review of `bc6e3e98..dfb748ed`. Source baseline: `dfb748ed`. Earlier results remain historical; accepted content departures and resource limits remain unchanged.

- [x] Preserve eager image-reference failures and projected drawing-hyperlink failures, including empty targets, absent media, suppression, and unused sources.
- [x] Add independent inline/anchored drawing evidence and prompt regressions with source-scoped relationship checks.
- [x] Keep AlternateContent fallback selection in XML parsing and cover nested fallback, absent fallback, and excluded choices.
- [x] Correct current harness/package wording and related coverage references.
- [x] Pass focused, routine, built-runtime, measurement, and packed-consumer verification.
- [x] Review the complete follow-up and combined implementation ranges, resolve findings, and confirm cleanup.

| Area | Outcome |
| --- | --- |
| Drawing relationships | Fifty independently authored cases match historical conversion; twenty-five reproduced failures before fixes; content and compiled evidence/prompt checks passed |
| Fallback ownership / wording | Four historical-equivalent fallback cases passed; duplicate semantic handler removed; shared POSIX preflight and product integrity coverage clarified |
| Routine verification | 1,805 unit and 2,331 application cases passed; application 216.29 seconds under unchanged 240-second deadline; lint, format, types, and shipping build passed |
| Built runtime comparisons | 134 historical and 106 follow-up cases per format on primary/minimum Node passed; complete evidence/prompts checked |
| Measurements / packed consumers | Eighteen workloads per runtime and eight fresh npm/Bun × runtime × format consumer paths passed; deadline, RSS, and lifecycle checks passed |
| Full-range review | `dfb748ed..3912a814` reviewed with DOCX integration checks across `bc6e3e98..3912a814`; redundant fixture builds replaced by one build with bounded batches; no remaining material findings; closing docs reviewed separately |
| Artifact cleanup | Owned manual and managed-test workspaces removed after settlement; temporary builds, runtime cache, and logs removed; frozen captures and dependency versions unchanged; no smoke artifacts retained |

## XML Document Root Follow-Up

Address the multiple-root content XML finding from review of `bc6e3e98..0a7b57c5`. Source baseline: `0a7b57c5`. Earlier results remain historical; accepted content departures, optional metadata policy, and resource limits remain unchanged.

- [x] Reject a second document element while preserving valid declarations, comments, processing instructions, and nested elements.
- [x] Add independent selected-part and complete evidence/prompt regressions; preserve metadata behavior and physical-part accounting.
- [x] Pass focused, routine, built-runtime, and quality checks; update coverage references.
- [x] Review the complete follow-up and combined DOCX ranges, resolve findings, and clean owned artifacts.

| Area | Outcome |
| --- | --- |
| XML root policy / regressions | Eight historical-equivalent cases and seven parser/metadata/accounting tests added; empty/prolog-only rejection covered after review |
| Routine verification | 214 focused, 1,820 unit, and 2,331 application cases passed; application 227.03 seconds under unchanged 240-second deadline; lint, format, types, and shipping build passed |
| Built runtime comparisons | 134 historical and 114 follow-up cases per format on primary/minimum Node passed; complete evidence/prompts checked; frozen captures unchanged |
| Earlier measurement / package evidence | Retained from the drawing follow-up; repeat only if affected boundaries change |
| Full-range review | `0a7b57c5..b58d2f28` and combined `bc6e3e98..b58d2f28` reviewed; rootless-input coverage added; no remaining material findings; closing docs reviewed separately |
| Artifact cleanup | Owned manual and managed-test workspaces settled and removed; temporary builds, runtime cache, inputs, and logs removed; no smoke artifacts retained |

## XML Namespace and CDATA Follow-Up

Address the namespace and trailing-CDATA findings from review of `bc6e3e98..f72dba64`. Source baseline: `f72dba64`. Earlier results remain historical; accepted CDATA text preservation, optional metadata policy, and resource limits remain unchanged.

- [x] Resolve semantic names through namespace bindings, preserving ignored foreign content and valid aliases.
- [x] Preserve CDATA contents as text within XML elements; retain leading and empty trailing sections; reject nonempty trailing CDATA, including whitespace-only content.
- [x] Pass focused, routine, built-runtime, quality, and renewed workload checks; update coverage references.
- [x] Review the complete follow-up and combined DOCX ranges, resolve findings, and clean owned artifacts.

| Area | Outcome |
| --- | --- |
| Namespace / CDATA regressions | Twenty-one historical-equivalent DOCX cases and six parser controls added; fifteen pre-fix failures reproduced; focused checks passed |
| Routine verification | 241 focused, 1,847 unit, and 2,331 application cases passed; application 229.97 seconds under unchanged 240-second deadline; lint, format, types, and shipping build passed |
| Built runtime comparisons | 134 historical and 135 follow-up cases per format on primary/minimum Node passed; complete evidence/prompts checked; frozen captures unchanged |
| Renewed measurements | Eighteen workloads per runtime passed with idle/loaded callers; deadline, RSS, and lifecycle checks passed |
| Earlier packed-consumer evidence | Retained from the drawing follow-up; repeat only if distribution boundaries change |
| Full-range review | `f72dba64..e961a8d8` and combined `bc6e3e98..e961a8d8` reviewed; stale summary and CDATA wording clarified; no remaining material findings; closing docs reviewed separately |
| Artifact cleanup | Owned manual and managed-test workspaces settled and removed; temporary inputs, builds, runtime cache, and logs removed; no smoke artifacts retained |

## XML Attribute Whitespace Follow-Up

Address the attribute-whitespace finding from review of `bc6e3e98..bc9e9d9c`. Source baseline: `bc9e9d9c`. Earlier results remain historical; accepted content departures, resource limits, and frozen captures remain unchanged.

- [x] Normalize literal attribute whitespace before reference decoding while preserving text, literal sections, namespace resolution, and physical-part accounting.
- [x] Add independent parser and complete evidence/prompt regressions; reproduce failures before the fix.
- [x] Pass focused, routine, built-runtime, quality, and renewed workload checks; update coverage references.
- [x] Review the complete follow-up and combined DOCX ranges, resolve findings, and clean owned artifacts.

| Area | Outcome |
| --- | --- |
| Attribute normalization | Literal tab/LF/CR become spaces; CRLF becomes one space; numeric references retain decoded controls and repeated spaces remain distinct |
| Regressions | Twenty-five historical-equivalent DOCX cases and four parser controls added; thirteen pre-fix test failures reproduced; focused checks passed |
| Routine verification | 270 focused, 1,876 unit, and 2,331 application cases passed; application 231.17 seconds under unchanged 240-second deadline; lint, format, types, and shipping build passed |
| Built runtime comparisons | 134 historical and 160 follow-up cases per format on primary/minimum Node passed; complete evidence/prompts checked; frozen captures unchanged |
| Renewed measurements | Eighteen workloads per runtime passed with idle/loaded callers; deadline, RSS, and lifecycle checks passed |
| Earlier packed-consumer evidence | Retained from the drawing follow-up; distribution boundaries unchanged |
| Full-range review | `bc9e9d9c..351481b7` and combined `bc6e3e98..351481b7` reviewed; no remaining material findings; closing docs reviewed separately |
| Artifact cleanup | Owned manual and managed-test workspaces settled and removed; temporary inputs, builds, runtime cache, and logs removed; no smoke artifacts retained |

## Bare Ampersand Follow-Up

Restore the historical literal-ampersand behavior identified by review of `bc6e3e98..0e6f6748`. Source baseline: `0e6f6748`. This narrowly scoped recovery preserves existing entity and structural failures; it is a baseline-compatible correction. Earlier results remain historical; accepted departures, limits, and frozen captures remain unchanged.

- [x] Recover bare ampersands in text and quoted attributes while preserving references, literal sections, attribute whitespace, and physical-part accounting.
- [x] Add independent evidence/prompt regressions and ampersand-heavy cap checks; reproduce failures before the fix.
- [ ] Pass focused, routine, built-runtime, quality, and renewed resource checks; update coverage references.
- [ ] Review the complete follow-up and combined DOCX ranges, resolve findings, and clean owned artifacts.

| Area | Outcome |
| --- | --- |
| Recovery / references | Literal ampersands recovered in values; numeric/predefined references decode once; undeclared semicolon-terminated named references and malformed markup retain failures |
| Regressions | Thirty-five historical-equivalent DOCX cases, four parser controls, and one selected-part cap test added; ten pre-fix failures reproduced |
| Allocation correction | Escaped source is used only for validation; parsing original values avoids synthetic entity expansion; ampersand-heavy at/above-cap runtime checks passed in both formats and runtime lanes |
| Initial verification | 310 focused and 1,916 unit cases passed; lint, format, and types passed; application and runtime checks pending |
