---
title: "DOCX reader review follow-up"
created-date: 2026-10-16
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

Address the remaining XML accounting, hyperlink compatibility, and manual harness findings from review of `bc6e3e98..97cdb606`. Source baseline: `97cdb606`. Earlier results above remain historical; the accepted CDATA departure and resource limits are unchanged.

- [x] Charge each physical XML part once, including failed inspections; preserve safety failures and distinct-entry accounting.
- [x] Preserve empty-ID and unresolved-target hyperlink behavior, with independent evidence and prompt regressions.
- [x] Require POSIX process groups before manual execution creates artifacts; remove ineffective Windows handling and redundant options.
- [ ] Pass focused, routine, built-runtime, measurement, and packed-consumer checks.
- [ ] Review the complete follow-up range and combined implementation, resolve findings, and confirm cleanup.

| Area | Outcome |
| --- | --- |
| XML accounting | Failed scans retain their original charge and failure; focused resource/content and compiled evidence/prompt regressions passed |
| Hyperlinks | Twenty-three named cases match historical behavior, including empty/duplicate targets, fragment merging, suppression, and unused notes/comments; focused unit and compiled evidence/prompt checks passed |
| Manual harness | Shared prerequisite rejects unsupported execution before workspaces/children; lifecycle, help, and simulated platform probes passed; ineffective Windows branch and redundant flags removed |
| Verification | Pending |
| Review / cleanup | Pending |
