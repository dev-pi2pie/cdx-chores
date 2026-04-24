---
title: "Fix data stack fixture and union review findings"
created-date: 2026-04-24
status: completed
agent: codex
---

Addressed the second branch review pass for the `data stack` implementation.

What changed:

- added the committed `json-array-basic` fixtures to `scripts/generate-data-stack-fixtures.mjs`
- added the committed `csv-union` fixtures to `scripts/generate-data-stack-fixtures.mjs`
- updated the fixture generator snapshot test so `reset` coverage includes every committed stack fixture family
- rejected duplicate names in `--union-by-name` mode before name-based row alignment
- added action coverage for duplicate header names in union-by-name CSV stacking
- documented that union-by-name requires unique names in each source because name-based alignment is otherwise ambiguous
- rejected duplicate output names before JSON materialization so strict delimited stacks cannot silently drop repeated columns
- added action coverage for duplicate CSV headers with `.json` output
- documented the JSON output duplicate-name restriction

Why:

- `reset` deleted the default fixture tree and regenerated only part of the committed fixture set
- union-by-name alignment used a name-to-index map, so duplicate header names could silently drop later duplicate columns
- JSON object materialization used one object key per column name, so duplicate output names could silently overwrite earlier values

Verification:

- `bun run format`
- `bun test test/cli-actions-data-stack.test.ts test/data-stack-fixture-generator.test.ts`
- `bun run lint`
- `bun run format:check`
- `bun test test/cli-actions-data-stack.test.ts test/cli-command-data-stack.test.ts test/data-stack-input-router.test.ts test/data-stack-fixture-generator.test.ts`
- `bun run build`

Related Plans:

- `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`
- `docs/plans/plan-2026-04-23-data-stack-interactive-mixed-source-followup.md`

Related Research:

- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`
