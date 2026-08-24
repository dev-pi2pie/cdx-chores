---
title: "Codex request timeout Phase 1"
created-date: 2026-08-21
status: completed
agent: codex
---

## Goal

Implement and verify the shared, side-effect-free Codex timeout duration parser,
resolver, and legacy migration-message primitives from Phase 1 of the
[Codex request timeout plan](../plan-2026-08-21-codex-request-timeout-contract.md).

## Starting Point

Starting commit: `6636a88bb962946c9e51defbf144c1a7bcd4b995`

The implementation begins from the reviewed timeout research and plan. The
working tree was clean at this boundary.

## Contract Clarification

New duration flags accept positive integer `ms`, `s`, and `m` values up to 10
minutes. Legacy millisecond flags keep their current numeric compatibility
behavior during this phase. A legacy value receives an exact replacement only
when that replacement is valid under the new grammar and maximum; other values
receive a migration explanation instead of an invalid suggested command.

## Intended Changes

- add `src/cli/options/codex-timeout.ts`
- add focused parser, resolver, source, conflict, repeat, and migration tests
- keep the module independent from command registration and output streams

## Validation

```text
bun test test/cli-options-codex-timeout.test.ts
38 pass, 0 fail

bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
passed

node --experimental-strip-types --input-type=module -e <source import smoke>
Node source import and duration parse passed
```

The focused suite covers accepted durations, every rejected grammar category,
the 10-minute boundary, repeated-option rejection, scoped/legacy/shared/default
precedence, source metadata, same-analyzer conflicts, exact replacements, and
non-exact legacy migration explanations. The Node source-import smoke confirms
that the module does not depend on Bun runtime globals.

## Review

Implementation commits:

- `4416256c` — added the timeout contract module, focused tests, compatibility
  clarification, and initial execution record
- `268c3c1d` — derived validation and migration limit wording from the shared
  maximum constant

Review range:

```text
6636a88bb962946c9e51defbf144c1a7bcd4b995..268c3c1d
```

The first correctness and test-quality reviews found no material gaps. The
first maintainability review found that two user-facing messages hardcoded the
10-minute maximum separately from the enforcing constant. The finding was
accepted and fixed in `268c3c1d`. The widened correctness, test-quality, and
maintainability reviews then passed with no remaining material findings.

Decision gate: `Continue`. Phase 1 is complete, and rename command registration
may begin in Phase 2.
