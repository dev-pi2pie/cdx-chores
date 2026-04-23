---
title: "Implement data stack phases 3 through 5"
created-date: 2026-04-23
status: completed
agent: codex
---

Implemented the next `data stack` slices after the initial mixed-source direct CLI baseline: the first interactive stack flow, headerless delimited stacking, and strict `jsonl` stacking.

What changed:

- added an interactive `data -> stack` route that stays directory-first and CSV/TSV-only in its first pass
- kept the first interactive stack review boundary explicit, with directory, pattern, traversal, matched-file summary, and output confirmation before write
- added `--no-header` and optional `--columns <name,name,...>` for direct CSV and TSV stacking
- reused the shared `column_<n>` placeholder contract when headerless columns are not supplied explicitly
- rejected headerless column-count mismatches across inputs
- added strict `jsonl` input support as one JSON object per line
- kept first-pass `jsonl` key mismatches as hard failures instead of widening into schema-flex behavior
- preserved `.json` output as one JSON array of row objects for `jsonl` and delimited stack materialization
- expanded focused stack coverage across action, command, interactive routing, and interactive tip tests
- marked the completed Phase 3, Phase 4, and Phase 5 checklist items in the active implementation plan

Why:

- the first interactive stack lane needed to wrap the stabilized direct command before later widening into true mixed-source interactive mode
- headerless CSV/TSV and strict `jsonl` were the next planned feature slices after the initial matching-header delimited baseline
- the stack contract needed regression coverage around headerless schemas, strict `jsonl` row keys, and the new interactive review checkpoint before wider follow-up work starts

Verification:

- `bun test test/data-stack-input-router.test.ts test/cli-actions-data-stack.test.ts test/cli-command-data-stack.test.ts test/cli-ux.test.ts test/cli-interactive-contextual-tip.test.ts test/cli-interactive-routing.test.ts`
- `bun run lint`

Related Plans:

- `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`

Related Research:

- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`
