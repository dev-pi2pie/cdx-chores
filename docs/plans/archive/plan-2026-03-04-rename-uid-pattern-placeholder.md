---
title: "Add uid placeholder support to rename patterns"
created-date: 2026-03-04
modified-date: 2026-03-04
status: completed
agent: codex
---

## Goal

Add `{uid}` support to `rename file` and `rename batch` `--pattern` templates so constructive rename flows can use the same deterministic `uid-<token>` family already established by `rename cleanup`.

## Why This Plan

Current behavior is inconsistent:

- `rename cleanup` already understands and generates `uid-<token>` values through cleanup-specific helpers
- `rename file` and `rename batch` still reject `{uid}` during template validation
- docs now describe that as a current implementation gap, so the code needs a dedicated follow-up plan

This should be handled as a targeted template-system enhancement, not folded into a broader rename refactor without a concrete contract.

## Current State

Confirmed code-level gaps:

- `src/cli/fs-utils.ts` rejects `{uid}` in `getPreparedRenamePattern(...)`
- `src/cli/fs-utils.ts` does not render a UID token inside `renderBaseNameFromTemplate(...)`
- `src/command.ts` help text does not list `{uid}` in the supported placeholder set
- `src/cli/interactive/rename.ts` custom-template hint copy does not mention `{uid}`
- `src/cli/actions/rename/cleanup-uid.ts` already contains deterministic UID generation, but it is cleanup-only today

Current planner behavior that should be preserved in the first pass:

- batch rename resolves same-run duplicate targets with numeric suffixes
- single-file rename resolves occupied targets with numeric suffixes
- no new conflict-strategy surface is needed for general rename templates in this plan

## Desired Contract

### Placeholder surface

General rename templates should support:

- `{uid}`

Example patterns:

- `{uid}-{stem}`
- `{date}-{uid}-{stem}`
- `{prefix}-{uid}`

### Output shape

`{uid}` should render as:

```text
uid-<token>
```

Constraints:

- keep the marker-based `uid-` prefix
- keep lowercase Crockford-style base32 output
- keep deterministic output for the same source path across repeated dry runs
- do not introduce a second UID format for general rename flows

### Determinism source

Reuse the existing cleanup UID contract as the source of truth:

- same path normalization rule
- same digest algorithm family
- same primary emitted token length

For the first pass, general rename should render the primary deterministic UID basename and continue to rely on the existing rename planner collision behavior when a target name is already taken.

## Scope

- extend rename template validation to accept `{uid}`
- extend rename template rendering to substitute `{uid}`
- extract or share deterministic UID generation so cleanup and general rename do not drift
- update CLI help text and interactive template guidance
- update README and rename guides after runtime support lands
- add focused tests for validation, rendering, determinism, and user-facing help text

## Out Of Scope

- redesigning rename collision handling for all template placeholders
- introducing parameterized UID tokens such as `{uid_16}` or `{uid_ulid}`
- changing cleanup conflict-strategy behavior
- changing cleanup hint matching semantics
- adding brace escaping or a wider template grammar redesign

## Proposed Design

### 1. Extract shared UID generation helpers

Move the deterministic UID logic behind a shared rename-facing helper so both paths use the same core rules.

Preferred direction:

- keep cleanup-specific wrapper behavior where needed
- expose one shared helper that returns the primary deterministic `uid-<token>` basename for a source path
- optionally expose the existing variant list for cleanup-only callers that still need widening fallbacks

Candidate module directions:

- keep `src/cli/actions/rename/cleanup-uid.ts` and extract shared internals into a nearby rename-shared helper
- or rename the file/module so the shared contract is no longer cleanup-branded

Decision rule:

- choose the smaller diff that makes ownership clear and prevents future UID drift

### 2. Extend template validation

Update template validation in `src/cli/fs-utils.ts` so `{uid}` is accepted alongside the existing simple placeholders.

User-facing error text should also include `{uid}` in the allowed placeholder list.

### 3. Extend template rendering

Update `renderBaseNameFromTemplate(...)` so `{uid}` renders from the shared deterministic helper.

Implementation note:

- the current renderer is synchronous, while cleanup UID generation currently depends on async filesystem work
- the first implementation will likely need to precompute UID text per entry during planning, similar to how serial text is prepared before render time

Expected planning impact:

- `planSingleRename(...)` computes one UID value for the source file when `{uid}` is present
- `planBatchRename(...)` computes one UID value per candidate entry when `{uid}` is present
- templates without `{uid}` should not pay extra work

### 4. Preserve existing rename collision behavior

Do not add a new general rename conflict policy in this plan.

First-pass behavior:

- render deterministic `{uid}` output
- keep existing numeric suffix behavior when the planned target collides with another planned or existing file

Rationale:

- this lands `{uid}` support with a narrow, testable change set
- it avoids coupling placeholder support to a broader planner redesign
- cleanup can keep its own widening fallback behavior until there is a stronger reason to unify collision policy too

### 5. Update user-facing docs and help text

After runtime support lands, update:

- `src/command.ts`
- `README.md`
- `docs/guides/rename-common-usage.md`
- `docs/guides/rename-scope-and-codex-capability-guide.md`
- interactive hint copy in `src/cli/interactive/rename.ts`

Docs should then describe `{uid}` as supported in general rename templates, not as a remaining gap.

## Phase Checklist

### Phase 1: Contract and helper extraction

- [x] decide the shared UID helper boundary
- [x] codify the `{uid}` output contract for general rename
- [x] preserve cleanup’s existing contract while sharing the core generator

### Phase 2: Planner implementation

- [x] accept `{uid}` in template validation
- [x] include `{uid}` in allowed-placeholder error text
- [x] precompute UID values during single-file planning when needed
- [x] precompute UID values during batch planning when needed
- [x] render `{uid}` in template substitution
- [x] preserve existing numeric suffix collision behavior

### Phase 3: Tests

- [x] add template-validation coverage for `{uid}`
- [x] add single-file rename coverage for `{uid}` rendering
- [x] add batch rename coverage for `{uid}` rendering across multiple files
- [x] add determinism coverage so repeated planning of the same file yields the same `uid-<token>`
- [x] add help-text or CLI-surface coverage for `{uid}` placeholder listing

### Phase 4: Docs

- [x] update README placeholder lists and examples
- [x] update rename guides to remove the “current gap” wording
- [x] update interactive template prompt copy
- [x] add a job record capturing implementation and verification

## Completion Criteria

- `rename file ... --pattern "{uid}-{stem}"` works
- `rename batch ... --pattern "{uid}-{stem}"` works
- `{uid}` is listed in CLI help and user-facing docs
- cleanup and general rename share one deterministic UID format
- tests cover validation, rendering, and determinism

## Verification

- `bunx tsc --noEmit`
- `bun test test/cli-fs-utils-rename-template.test.ts test/cli-actions-rename-cleanup-uid.test.ts test/cli-ux.test.ts test/cli-interactive-rename.test.ts`

## Related Research

- `docs/researches/archive/research-2026-02-27-rename-pattern-router-and-docs-ux-v1.md`
