---
title: "Markdown PDF Codex profile Phase 6 working-directory hotfix"
created-date: 2026-06-15
status: completed
agent: codex
---

## Scope

Hotfix the Phase 6 `md pdf-profile codex` optional-input and signal-ladder implementation so Codex starts from the caller's repository working directory instead of a disposable prompt directory.

## Working Directory Policy Bug

`actionMdPdfProfileCodex` already passed `runtime.cwd` into the Markdown PDF Codex profile request, but the adapter wrapped the actual Codex call in `runCodexPromptOnly`. That shared prompt-only helper creates a temporary directory and passed that temporary path to `codex.startThread`.

This shadowed the action-level working directory. As a result, direct runs such as:

```bash
node dist/esm/bin.mjs md pdf-profile codex README.md --intent "clean pdf with a proper cover page"
```

could fail before the prompt reached Codex with:

```text
Not inside a trusted directory and --skip-git-repo-check was not specified.
```

The failure was not caused by Markdown input resolution or by the signal ladder. It happened because the adapter started Codex from a temp directory that was neither the project checkout nor a trusted Git repository.

## Fix

- Aligned the Markdown PDF profile Codex adapter with the existing `rename`, `data query`, and `data stack` helper policy.
- Replaced the prompt-only temp-directory runner with `startCodexReadOnlyThread(options.workingDirectory)`.
- Preserved structured-output parsing, timeout behavior, failure classification, and bounded profile decision semantics.
- Added adapter regression coverage proving the default runner starts Codex with the request working directory.

## Evidence

- `bun test test/adapters-codex-markdown-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-md-to-pdf-commands.test.ts test/cli-actions-md-to-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-phase2.test.ts`
  - 75 pass, 0 fail
  - covers the adapter hotfix together with the Phase 6 action, command, profile, and signal/candidate contracts
- `bun test test/adapters-codex-markdown-pdf-profile.test.ts`
  - 7 pass, 0 fail
  - covers bounded prompt construction, request working-directory forwarding, decision parsing, fallback modes, invalid response handling, and unavailable Codex classification
- `bun run format:check`
  - all matched files use the correct format
- `bun run lint`
  - completed successfully
- `git diff --check`
  - completed successfully
- `bun run build`
  - completed successfully
- `node dist/esm/bin.mjs md pdf-profile codex --help`
  - completed successfully and showed the optional `[input]` helper text
- `node dist/esm/bin.mjs md pdf-profile codex --dry-run`
  - completed successfully through the deterministic `basic-default` path without writing a profile
- `node dist/esm/bin.mjs md pdf-profile codex README.md --intent "clean pdf with a proper cover page" --dry-run`
  - sandboxed run no longer failed with the previous trusted-directory error
  - it reached Codex initialization and then failed with a sandbox app-server permission error
  - unsandboxed retry was denied by the approval reviewer because it would disclose README-derived prompt data to external Codex

## Notes

- This fix intentionally does not add `--skip-git-repo-check` to the Markdown PDF helper. The established repository policy is to run Codex helpers from `runtime.cwd` in read-only mode, not from untrusted temporary directories.
- `runCodexPromptOnly` remains available for any future caller that explicitly wants disposable prompt-only execution, but `md pdf-profile codex` should not use it because this helper follows the same user-facing Codex contract as `rename`, `data query`, and `data stack`.
