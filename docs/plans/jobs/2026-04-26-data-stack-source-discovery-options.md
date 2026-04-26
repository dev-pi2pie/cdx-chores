---
title: "Data stack source discovery options"
created-date: 2026-04-26
modified-date: 2026-04-26
status: completed
agent: codex
---

## Scope

Completed Phase 13 of `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`.

This job closes the follow-up that made interactive `data stack` source discovery less prompt-heavy. The default path now previews matched files from the selected input format before asking for filename pattern or traversal settings.

## Changes

- Removed the mandatory-feeling `Filename pattern` and traversal prompts from the default directory-source path.
- Added a `Source discovery options` menu from the matched-file preview.
- Kept the normal matched-file checkpoint focused on `Use these files`, `Options`, `Revise sources`, and `Cancel`.
- Moved filename pattern overrides, recursive scan toggling, and input-format changes into source discovery options.
- Kept explicit-file sources on the short path with no pattern or traversal options.
- Preserved no-match recovery by offering source discovery options, source revision, or cancel without allowing a false accept.
- Simplified the Codex checkpoint action label to `Analyze with Codex`.
- Added a colored replay command tip after users choose to keep a stack plan.
- Updated interactive routing coverage for default-pattern preview, options-menu pattern change, recursive toggle, input-format change, no-match recovery, and explicit-file short path.
- Added a fixture for a directory whose name ends in `.csv` to verify source discovery options are based on filesystem kind, not filename extension.
- Updated the guide, research, and implementation plan with the completed Phase 13 flow and status.

## Evidence

```bash
bun test test/cli-interactive-routing.test.ts
```

Result: passed.

The interactive routing coverage verifies that directory sources preview by format default first, filename pattern is only prompted from source discovery options, recursive discovery toggles from the options menu, input format can be changed without re-entering sources, failed previews do not expose `Use these files`, directory/file source-kind checks use filesystem metadata, explicit-file sources skip pattern/traversal controls, kept stack plans show a replay command tip, and final write-time output-exists failures preserve the stack-plan artifact.

## Notes

- The format-default path stores no redundant filename pattern in the stack setup unless the user explicitly overrides it.
- The matched-file preview remains the evidence boundary before schema mode, duplicate/key diagnostics, Codex-powered analysis, or output writing.
