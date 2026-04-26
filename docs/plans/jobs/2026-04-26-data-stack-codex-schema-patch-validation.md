---
title: "Validate data stack Codex schema patches"
created-date: 2026-04-26
status: completed
agent: codex
---

## Goal

Address the review finding that Codex schema recommendation patches could be accepted even when the deterministic stack preparation path would reject the resulting schema state.

## What Changed

- Reused the existing data stack schema option validation while validating Codex schema patches.
- Rejected `/schema/mode` recommendations that would make headerless plans use `union-by-name`.
- Rejected `/schema/excludedNames` recommendations unless the resulting schema mode is `union-by-name`.
- Rejected excluded-name patches that reference names outside the prepared stack schema.
- Validated recommendation patches sequentially so a recommendation can still switch to `union-by-name` and then apply executable exclusions in the same ordered patch batch.
- Added Codex report regression coverage for valid ordered schema patches and rejected non-executable schema states.

## Follow-up Review Fix

- Updated `/input/columns` patch application for headerless plans so the validation plan's `schema.includedNames` follows the renamed input columns.
- Added regression coverage for an ordered headerless Codex recommendation that renames generated columns and then selects a unique key by the new name.
- Verified the derived plan preserves the patched headerless column names and the accepted `uniqueBy` field.

## Verification

```text
bun test test/data-stack-codex-report.test.ts
bun test test/data-stack-codex-report.test.ts test/cli-interactive-routing.test.ts test/cli-actions-data-stack.test.ts
bun run lint
bun run format:check
bun run build
git diff --check
```

Result: passed. `bun run build` emitted the existing tsdown ineffective dynamic import warning for `src/cli/prompts/path.ts`.

## Related Plans

- `docs/plans/plan-2026-04-26-data-stack-artifact-contract-cleanup.md`
- `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`

## Related Research

- `docs/researches/research-2026-04-26-data-stack-artifact-and-codex-contract-cleanup.md`
- `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`
