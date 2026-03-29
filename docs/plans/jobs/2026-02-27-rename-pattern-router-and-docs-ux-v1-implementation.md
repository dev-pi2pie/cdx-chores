---
title: "Complete rename pattern, smart router, and docs UX v1 implementation"
created-date: 2026-02-27
modified-date: 2026-02-27
status: completed
agent: codex
---

## Goal

Finish the v1 implementation for rename template flexibility, interactive smart router behavior, and docs UX compaction.

## Implemented

- Added interactive smart-router module and extracted reusable branching logic:
  - `src/cli/rename-interactive-router.ts`
  - `src/cli/interactive.ts` updated to consume router helpers
- Added smart-router test coverage:
  - `test/cli-rename-interactive-router.test.ts`
  - covers profile-based `auto` routing, file-extension `auto` routing, and scope overrides (`auto|images|docs`)
- Completed docs refactor:
  - added `docs/guides/rename-common-usage.md`
  - compacted `docs/guides/rename-scope-and-codex-capability-guide.md` for print/PDF-friendly width
  - updated `README.md` command examples to `cdx-chores`
  - cross-linked README and rename guides
- Follow-up interactive rename UX adjustment:
  - serial questions are now shown only when the selected template includes `{serial...}`
  - prefix prompt is now optional and shown only when the selected template includes `{prefix}`
  - interactive serial width wording now clarifies that input expects digit count (for example `2` => `01`)
  - README and rename guides were updated to reflect the revised interactive serial/prefix behavior
- Follow-up CLI alignment adjustment:
  - non-interactive rename commands no longer inject the old implicit `file` prefix when `--prefix` is omitted
  - rename help text now marks `--prefix` as optional
  - regression tests were added for prefix-less rename behavior
- Completed plan tracking updates:
  - `docs/plans/archive/plan-2026-02-27-rename-pattern-router-and-docs-ux-v1-implementation.md`
  - all phase checklist items checked
  - plan status moved to `completed`

## Verification

Automated checks run and passed:

- `bunx tsc --noEmit` ✅
- `bun test` ✅ (`88 pass`, `0 fail`)

Focused smoke check run and passed:

- `bun run src/bin.ts rename batch ./examples/playground/rename-smoke --prefix smoke --pattern "{date}-{stem}-{serial}" --serial-order path_asc --serial-start 1 --serial-width 2 --dry-run` ✅
- output showed deterministic serial ordering and expected `{date}` + serial formatting:
  - `a.txt -> 2026-02-27-a-01.txt`
  - `b.txt -> 2026-02-27-b-02.txt`

## Related Plans

- `docs/plans/archive/plan-2026-02-27-rename-pattern-router-and-docs-ux-v1-implementation.md`

## Related Research

- `docs/researches/archive/research-2026-02-27-rename-pattern-router-and-docs-ux-v1.md`
