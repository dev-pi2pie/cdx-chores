---
title: "Implement data stack phase 1 and phase 2"
created-date: 2026-04-23
status: completed
agent: codex
---

Implemented the first direct CLI slice for `data stack` and recorded the completed Phase 1 and Phase 2 plan items.

What changed:

- added `data stack` as a new direct CLI action under `data`
- introduced `src/cli/data-stack/input-router.ts` to normalize mixed raw file and directory sources into one ordered file list
- froze the first shipped stack slice to matching-header CSV and TSV inputs with explicit output materialization to `.csv`, `.tsv`, or `.json`
- implemented shallow-by-default directory discovery with opt-in `--recursive` and `--max-depth`
- kept directory pattern filtering scoped to directory-expanded candidates while preserving explicit file passthrough
- rejected mixed normalized formats, header mismatches, empty/no-match discovery runs, unsupported stack formats, and explicit output-source conflicts
- added focused router, action, command, and CLI help coverage for the new stack contract
- marked the completed Phase 1 and Phase 2 checklist items in the active implementation plan

Why:

- the mixed-source stack contract needed one owned implementation boundary before interactive work can begin
- Phase 1 needed to move from research wording into actual CLI behavior so later interactive and headerless phases can wrap a stable direct command
- the repo needed direct regression coverage around ordering, traversal, validation, and output rules before widening the feature

Verification:

- `bun test test/data-stack-input-router.test.ts test/cli-actions-data-stack.test.ts test/cli-command-data-stack.test.ts test/cli-ux.test.ts`
- `bun run lint`

Related Plans:

- `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`

Related Research:

- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`
