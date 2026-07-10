---
title: "Markdown PDF Interactive Mode"
created-date: 2026-07-03
modified-date: 2026-07-04
status: draft
agent: codex
---

## Goal

Record the deferred product boundary for a possible future Interactive Markdown
PDF mode after the `v0.1.5` stable release review.

Interactive mode should reuse the accepted direct and project contracts:

```text
md pdf-profile codex
md pdf-template codex
md pdf-project codex
md to-pdf
```

It should not invent a second assistant model, and it should not be a blocker for
`v0.1.5-canary.4` or the stable `v0.1.5` release.

This document stays `draft` because the release timing and exact prompt shape are
not committed.

## Deferred Boundary

Interactive Markdown PDF mode should remain future work until:

- `md pdf-project codex` is implemented, verified, and documented for
  `v0.1.5-canary.4`
- the `v0.1.5` stable release review is complete
- the direct profile, direct template, and project folder contracts are stable
  enough for an interactive flow to orchestrate them

This records ordering only. It does not commit a release number or require the
next feature track to be Interactive Markdown PDF mode.

## Relationship To Roadmap

The parent roadmap is [Markdown PDF Codex Helper Roadmap](research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md).

That roadmap should stay lightweight and sequence the layers:

```text
profile-Codex
  -> template-Codex
  -> pdf-project-Codex
  -> Interactive mode
```

This research owns the later Interactive mode details so the roadmap does not
continue accumulating prompt-flow specifics.

## Starting State

Current Markdown PDF work is intentionally direct-CLI first:

- `md to-pdf` renders accepted artifacts deterministically.
- `md pdf-profile codex` drafts reusable profile artifacts.
- `md pdf-template codex` drafts reviewable template/CSS/assets bundles.
- `md pdf-project codex` is the current `v0.1.5-canary.4` target for
  coordinating `profile.yml`, `template.html`, `style.css`, and optional
  `assets/` in one project folder.

Interactive mode should start only after that project contract is stable enough
to be reused instead of redefined.

## Scope

This research covers:

- the deferred boundary for Interactive Markdown PDF mode
- the product rule that Interactive mode reuses direct and project contracts
- a small first-pass interaction shape
- the explicit non-goals for `v0.1.5` and `v0.1.5-canary.4`

This research does not implement:

- prompt wiring
- command routing
- terminal UI behavior
- Codex SDK calls
- PDF rendering changes
- a committed release target
- guide updates for shipped Interactive behavior

## Release Boundary

Interactive Markdown PDF mode should be out of scope for `v0.1.5-canary.4`.

The current ordering is:

| Milestone | Target | Status |
| --- | --- | --- |
| Profile helper | `v0.1.5-canary.2` | completed |
| Template helper | `v0.1.5-canary.3` | completed |
| PDF project helper | `v0.1.5-canary.4` | current target |
| Stable release review | `v0.1.5` | after canary.4 is complete |
| Interactive Markdown PDF mode | future post-`v0.1.5` work | draft, not scheduled |

This keeps the `v0.1.5` story focused:

```text
profile helper
  -> template helper
  -> project folder coordinator
  -> stable release review
```

Interactive mode is a possible later layer after the stable release, not a
prerequisite for it.

## Product Boundary

Interactive mode should be an orchestration UI over existing contracts.

It should not:

- hide Codex inside `md to-pdf`
- generate unreviewed HTML/CSS during rendering
- create a separate profile/schema model
- create a separate template/schema model
- bypass the `md pdf-project codex` folder contract
- make networked Codex assistance mandatory for deterministic rendering

It should:

- gather user choices with prompts
- show deterministic previews before writes or renders
- call the same underlying profile, template, project, and render services used
  by direct commands
- make Codex assistance an explicit opt-in branch
- preserve a clear save/revise/render/cancel loop

## First-Pass Shape

Draft shape:

```text
md -> Markdown PDF entry point
  -> choose Markdown input
  -> choose PDF output
  -> choose render inputs
     - use existing profile/template inputs
     - create or use deterministic starter artifacts
     - explicitly choose assisted project drafting
  -> review resolved inputs and output paths
  -> choose action
     - render now, if supported
     - save artifacts or follow-up command, if supported
     - revise choices
     - cancel
```

This is not a full wizard spec. The exact prompt order can change during
implementation, but the ownership boundary should not. Interactive mode should
reduce decisions into the same stable direct-command inputs that scripts can use.

## Project Assist Role

Once `md pdf-project codex` exists, it should become the clean assisted path for
Interactive users who want one coherent PDF direction.

Interactive project assist should:

- gather input Markdown, intent, font hints, base profile, and cover image paths
- show planned project output paths
- run the project helper through shared services
- present a concise summary of profile and template decisions
- offer the deterministic follow-up render

Project assist should stay behind an explicit assisted-project choice. It should
not automatically render before the user has reviewed the project summary unless
a later implementation adds a confirmed render-now step.

## Direct Helper Branches

Interactive mode can expose direct branches for users who know the artifact they
want, but the first pass does not need to expose every direct helper at once:

| User need | Interactive branch |
| --- | --- |
| reusable render policy only | profile behavior |
| HTML/CSS/assets only | template behavior |
| coordinated profile/template/assets | project assist |
| deterministic final PDF | render action through `md to-pdf` |

This keeps expert direct flows and guided project flows available without
forcing every Interactive session into a Codex-assisted project.

## Open Questions

- Should the first Interactive Markdown PDF flow start under `md -> to-pdf`, or
  should there be a separate `md -> pdf-project` menu entry?
- Should the first implemented Interactive flow support a confirmed render-now
  step, or initially save artifacts only?

## Recommendations

1. Keep Interactive Markdown PDF mode out of `v0.1.5-canary.4` and `v0.1.5`.
2. Keep this research `draft` until a future implementation scope is explicitly
   chosen.
3. Reuse the direct profile, direct template, project, and `md to-pdf` services.
4. Treat `md pdf-project codex` as an explicit assisted path for users who want a
   coherent PDF direction.
5. Keep Codex opt-in and artifact-producing; do not hide assistant work inside
   rendering.
6. Reuse existing interactive menu, path prompt, select, confirm, and review-loop
   utilities before adding prompt primitives.
7. Reuse direct helper diagnostic report behavior instead of adding a separate
   report-control prompt matrix.
8. Require a visible preview/review step before rendering or writing complex
   artifact sets.

## Related Research

- [Markdown PDF Codex Helper Roadmap](research-2026-06-10-markdown-pdf-codex-profile-and-interactive-flow.md)
- [Markdown PDF Project Codex Helper](research-2026-07-03-markdown-pdf-project-codex-helper.md)
- [Markdown PDF Template Codex Helper](research-2026-06-18-markdown-pdf-template-codex-helper.md)
- [Markdown to PDF Profiles, Fonts, and Page Chrome](research-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome.md)
