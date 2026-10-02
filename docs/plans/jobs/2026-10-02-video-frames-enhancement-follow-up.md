---
title: "Video Frames Enhancement Follow-Up"
created-date: 2026-10-02
status: in-progress
agent: codex
---

## Scope and Checkpoints

Reopened the [implementation plan](../plan-2026-09-30-video-frames-implementation.md) and [frame research](../../researches/research-2026-09-30-video-frames.md) for color/output enhancements. The separate [color research](../../researches/research-2026-10-02-video-frames-color-space-preservation.md) is the primary design reference for current color-preservation rules and feasibility. The frame research owns the wider feature contract and historical color context. Phase 10 owns implementation and focused acceptance; Phase 11 owns integrated verification, documentation and final closure.

The [original implementation record](2026-10-01-video-frames-implementation.md) remains completed for Phases 1–9. Its checked tasks, results and acceptance history are preserved. The plan is active and both researches are in-progress; no Phase 10 or Phase 11 task is accepted by this preparation.

| Phase | Responsibility | State |
| --- | --- | --- |
| 10 | Verified source-color/profile path, capacity-disclosure removal, destination/collision/review wording across all modes and focused review | Implementation pending |
| 11 | Independent color/integrated verification, regressions, current docs, privacy audit and final review | Pending Phase 10 acceptance |

## Planning Evidence

Code review found an explicit BT.709-to-sRGB transfer conversion in the color planner and fixed RGB tags in the encoder configuration. A small synthetic neutral limited-range BT.709 YUV420P grayscale check used constant chroma values of 128 and known luma patches. At luma 32, the production image-plan path produced RGB 34 while matrix/range conversion alone produced RGB 19; black and white endpoints remained 0 and 255. These observations establish the transfer choice's effect, not a validated correction or viewer equivalence.

The [color research](../../researches/research-2026-10-02-video-frames-color-space-preservation.md) records the preservation direction and open encoder/profile questions. Correction and profile support remain unverified; Phase 10 must establish accepted/rejected paths before implementation.

Code review also confirmed capacity information, singular destination wording shared by frame sets/sequences, a one-frame custom-folder choice and `Keep current` path labels. Existing-file choices say `Keep existing images` while review says `Stop on filename conflict`; review also exposes internal mode values and a generic destination label. The frame research records consistent destination, path-hint, collision and review wording across all three modes. This finding is code-based; revised prompts remain unimplemented and untested.

Publication setup already uses recursive folder creation. The destination contract now explicitly separates complete single-image file paths from multi-image folders and filename patterns, with missing-folder creation during confirmed export. This clarification adds no implementation or native verification claim.

Private processing outcomes: local existing-export pipeline comparison **passed**; source preservation **passed**; source-color-preserving correction **not tested**; viewer appearance equivalence **not tested**. Private inputs, derived images and inspection details stay local and are not verification fixtures or public correctness evidence.

## Documentation Checkpoint

Reopened the research/plan, preserved the original acceptance and added unchecked Phases 10–11. Feature rules and color feasibility have separate research owners. The destination work has separate single-file and folder/pattern tasks, with missing-folder creation and validation timing defined in research. New plan tasks use short sentences without semicolons. Collision/review scope remains across all modes. The usage guide describes shipped behavior. Runtime code is unchanged.

Ownership wording now identifies the color research as the primary design reference for color preservation. The frame research retains a short historical note explaining the original intent and conversion checks' limits. Both documents link that boundary, and neither claims a verified replacement path. Documentation review found no material ownership conflicts.

A wording refinement makes the earlier approach's implemented and checked status explicit and identifies the new research as investigation of a different preservation path. Historical color verification was not repeated for this edit.

The color research now defines a preservation approach with matching ICC profiles for PNG/JPG/WebP and a source/profile/encoder support matrix. Broad questions and the QuickTime paragraph were removed, with verification and privacy requirements consolidated under the evidence gate. Profile generation and encoder support remain unverified. Documentation review found no material issues. Link/anchor, lifecycle, privacy, checklist and diff checks passed.

The accepted/rejected source and encoder/profile matrix requirement remains in color research and is linked from the plan. Documentation review found no material gaps in the destination clarification. Local links, anchors, lifecycle wording, privacy boundaries and preserved acceptance checklists passed integrity checks, and `git diff --check` passed. All nine Phase 10 tasks and seven Phase 11 tasks remain unchecked, and implementation and integrated acceptance are unstarted.

## Related Research

- [Video Frame Selection, Frame Sets, and Sequence Export](../../researches/research-2026-09-30-video-frames.md)
- [Video Frames Color Space Preservation](../../researches/research-2026-10-02-video-frames-color-space-preservation.md)
