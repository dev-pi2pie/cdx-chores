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
- [ ] Make package-version verification read-only and enforce measured processing completion through parent validation.
- [ ] Reuse the production extractor factory in the candidate fixture; remove the unused metadata-helper option and retired resource inspector, and reconcile affected links.
- [ ] Pass focused, routine, built-runtime, comparison, measurement, and packed-consumer verification.
- [ ] Review the complete follow-up range, resolve findings, update current references, and confirm temporary cleanup.

## Results

| Check | Result |
| --- | --- |
| Content compatibility / CDATA | Twenty named cases: eighteen baseline-compatible and two accepted CDATA departures; nine regressions failed before fixes; content unit and compiled-product evidence/prompt checks passed |
| Verifier corrections | Pending |
| Simplification / documentation | Pending |
| Routine / manual verification | Pending |
| Full-range review | Pending |
| Artifact cleanup | Pending |

## Verification and Artifacts

Durable synthetic definitions and independent assertions belong under `test/document-rename/`. Generated inputs, builds, packages, consumers, caches, and reports use owned temporary storage and are removed after confirmed settlement. Manual commands remain separate from routine application tests; verification uses default cleanup without smoke retention.

```sh
node ./scripts/docx-candidate/launch.mjs
node ./scripts/docx-candidate/measure-launch.mjs
node ./scripts/docx-candidate/package-check.mjs
```

Record outcomes, relevant limitations, and the reviewed follow-up range here; keep raw execution reports temporary.
