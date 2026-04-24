---
title: "Implement data stack phases 6 through 8"
created-date: 2026-04-23
status: completed
agent: codex
---

Implemented the remaining `data stack` plan phases: guide alignment, interactive default output-path behavior, and explicit recorded follow-up directions.

What changed:

- added `docs/guides/data-stack-usage.md` as the first public guide for direct CLI and interactive `data stack`
- updated the query and extract guides so `stack`, `extract`, and `query` read as complementary lanes
- kept guide examples anchored to `examples/playground/stack-cases/`
- documented the guarded fixture-generator behavior for the tracked playground tree
- added interactive default output-path selection for `data -> stack`
- froze the first shipped default naming rule to the interactive input directory label with stack-specific suffixes such as `.stack.csv`, `.stack.tsv`, and `.stack.json`
- kept interactive stack destination-only backtracking separate from full stack-setup revision
- expanded focused interactive routing coverage for the chosen default-path behavior
- marked Phase 6, Phase 7, and Phase 8 complete in the active implementation plan
- updated the main stack research and plan statuses to completed now that linked implementation evidence exists

Why:

- the stack feature needed a public usage guide before the plan could be considered complete
- interactive stack needed the same default-versus-custom destination ergonomics already used by other interactive data flows
- the remaining follow-up directions needed to be recorded explicitly before closing the plan
- the research doc needed linked implementation evidence before it could move from draft research to completed reference

Verification:

- `bun test test/cli-interactive-routing.test.ts test/cli-interactive-contextual-tip.test.ts test/cli-ux.test.ts`
- `bun run lint`

Related Plans:

- `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`

Related Research:

- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`
