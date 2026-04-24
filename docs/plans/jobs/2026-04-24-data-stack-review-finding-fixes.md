---
title: "Fix data stack review findings"
created-date: 2026-04-24
status: completed
agent: codex
---

Addressed the branch review findings for the `data stack` implementation.

What changed:

- passed `--input-format` overrides into directory candidate discovery so no-pattern directory scans filter to the requested format
- added router regression coverage for a mixed-extension directory using `inputFormat: "json"` without a pattern
- guarded the fixture generator's recursive cleanup path before `rm`
- kept `reset` valid for the committed stack fixture tree
- kept `clean` limited to alternate scratch fixture trees and rejected the default tracked fixture tree
- exposed narrow fixture-generator internals for non-destructive cleanup target policy tests
- added coverage that broad cleanup targets are rejected before recursive removal
- updated the data stack usage guide so fixture cleanup docs mention the scratch-root scope

Why:

- directory scans with `--input-format` could still collect all supported extensions when no `--pattern` was supplied, then fail later as mixed normalized formats
- the fixture generator accepted broad cleanup targets for `clean` or `reset`, making typos too dangerous for a script that calls recursive `rm`

Verification:

- `bun run format`
- `bun test test/data-stack-input-router.test.ts test/data-stack-fixture-generator.test.ts`
- `bun run lint`
- `bun run format:check`
- `bun test test/cli-command-data-stack.test.ts test/data-stack-input-router.test.ts test/data-stack-fixture-generator.test.ts`
- `bun run build`

Related Plans:

- `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`
- `docs/plans/plan-2026-04-23-data-stack-interactive-mixed-source-followup.md`

Related Research:

- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`
