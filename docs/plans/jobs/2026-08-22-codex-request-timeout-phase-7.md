---
title: "Codex request timeout Phase 7"
created-date: 2026-08-22
status: in-progress
agent: codex
---

## Goal

Publish the shipped Codex request-timeout contract, update workflow-specific
guidance, and record the diagnostic-color integration boundary defined by
Phase 7 of the
[Codex request timeout plan](../plan-2026-08-21-codex-request-timeout-contract.md).

## Starting Point

Phase 7 execution began from:

```text
24db3b95265ca22bad160be54460df2420e23cfc
```

Phases 1 through 6 are complete and reviewed. The working tree was clean at
this boundary.

## Integration Boundary

The diagnostic-color plan was integrated into `dev` by fast-forward. Its
immutable closeout tip and the later presentation-only guide clarification are:

```text
COLOR_TIP
3dfadaff2ceeb0314aeca907608cf4c3cbec9c97

TIMEOUT_PHASE7_BASE
365a7d40dcc85b133c8316a20eb21cd0c642b0ea
```

Repository ancestry confirms that `COLOR_TIP` is an ancestor of
`TIMEOUT_PHASE7_BASE`. The commit at `TIMEOUT_PHASE7_BASE` has `COLOR_TIP` as
its sole parent. The color slice owns diagnostic presentation; the timeout
slice continues to own timeout semantics, migration wording, public guidance,
and lifecycle records.

## Implementation Boundary

- create one comparison-first canonical guide for timeout, retry, repair, and
  user-triggered regeneration
- keep workflow guides focused on local option placement, routing, and examples
- document the command-local and explicit-Interactive boundaries
- document per-attempt timing, scoped precedence, compatibility behavior, and
  the fact that timeout options do not enable Codex
- inspect the Node-target built help before closing public documentation
- record release impact without inventing an implementation release

## Validation

The bounded Phase 7 Markdown set is:

```text
README.md
docs/guides/codex-timeouts-retries-and-recovery.md
docs/guides/data-extract-usage.md
docs/guides/data-query-codex-usage.md
docs/guides/data-query-interactive-usage.md
docs/guides/data-stack-usage.md
docs/guides/markdown-pdf-codex-profile-helper.md
docs/guides/markdown-pdf-codex-project-helper.md
docs/guides/markdown-pdf-codex-template-helper.md
docs/guides/markdown-pdf-interactive-usage.md
docs/guides/rename-common-usage.md
docs/guides/rename-scope-and-codex-capability-guide.md
docs/plans/plan-2026-08-21-codex-request-timeout-contract.md
docs/plans/jobs/2026-08-22-codex-request-timeout-phase-7.md
```

```text
bun run build
passed

node dist/esm/bin.mjs rename file --help
node dist/esm/bin.mjs rename batch --help
node dist/esm/bin.mjs batch-rename --help
node dist/esm/bin.mjs data query codex --help
node dist/esm/bin.mjs data stack --help
node dist/esm/bin.mjs md pdf-profile codex --help
node dist/esm/bin.mjs md pdf-template codex --help
node dist/esm/bin.mjs md pdf-project codex --help
node dist/esm/bin.mjs interactive --help
all exited 0 and matched the documented command-local option surfaces

node dist/esm/bin.mjs --help
exited 0 without a root-level --codex-timeout option

node dist/esm/bin.mjs --codex-timeout 2m
exited 1 with the expected unknown-option diagnostic

node_modules/.bin/oxfmt --check, applied to every path in the bounded Phase 7 Markdown set
all 14 files passed

Node repository-relative Markdown link validation over the same 14 files:
extract Markdown link targets, skip empty anchors and http/https/mailto targets,
resolve each remaining target from its source document directory, and fail on a missing path
passed

rg -n '/Users/nakolus|subagent|auto_commit_notification|sandbox-exec|BUN_INSTALL_CACHE_DIR|TMPDIR=' <the same 14 files>
passed with no matches

git diff --check
passed
```

The public guides describe the shipped duration grammar, 30-second default,
10-minute duration-option maximum, per-request-attempt meaning, rename
precedence, compatibility behavior, direct-command scope, and explicit
Interactive session boundary. The canonical guide owns the shared definitions;
workflow guides keep local examples and behavior.

## Review

Phase 7 review base:

```text
365a7d40dcc85b133c8316a20eb21cd0c642b0ea
```

The initial exact-range documentation review through `1e81d245` found one
lifecycle inconsistency: the public canonical guide was still marked `draft`.
The finding was accepted and resolved by marking the verified guide
`completed`. No other documentation finding remained. A separate contract
review checked the same range against source and focused tests and found no
actionable mismatch.

The commit containing the accepted lifecycle fix and this widened validation
record defines `TIMEOUT_PHASE7_TIP`. Its final post-commit review must run
before Phase 8 begins. The Phase 8 opening record will cite the immutable full
SHA and review outcome so this record does not attempt to cite its own commit
identifier.

## Release Handoff

No implementation release is selected yet, so no changelog was created or
updated. The selected release notes should later include:

- the new shared and rename-scoped duration options
- the five direct-command and explicit Interactive surfaces
- per-request-attempt semantics and the 30-second default
- the 10-minute maximum for new duration options
- the legacy rename millisecond compatibility warning and migration path
- the command-local boundary and the fact that timeout options do not enable
  Codex

Release wording must not claim that legacy removal is already scheduled. The
legacy options remain supported for at least one stable compatibility release;
removal requires a separately approved breaking boundary with migration
evidence.

Decision gate: pending the final landed
`TIMEOUT_PHASE7_BASE..TIMEOUT_PHASE7_TIP` review. Phase 8 may begin only after
that exact range passes and the result is recorded at the phase transition.
