---
title: "Font check test fixture cleanup"
created-date: 2026-07-23
modified-date: 2026-07-23
status: completed
agent: codex
---

## Scope

Align the font-check text-file tests with the shared temporary-fixture lifecycle
so their isolated directories remain under `examples/playground/.tmp-tests/`
but are removed after each test completes.

Production font-check behavior and the shared fixture helper remain unchanged.

## Implementation

- Replace direct `createTempFixtureDir` usage in
  `test/fonts-cli-check-validation.test.ts` with `withTempFixtureDir`.
- Keep the existing `font-check-text-*` and `font-check-invalid-text-*`
  directory prefixes.
- Remove only the confirmed stale font-check fixture directories left by prior
  test runs.

## Validation

- [x] Run the focused font-check validation test.
- [x] Confirm no matching font-check fixture directories remain.
- [x] Run the full repository test suite.
- [x] Confirm the full suite leaves no matching font-check fixture directories.
- [x] Run lint, formatting, and whitespace checks for the changed files.

## Evidence

The focused validation passed with three tests, zero failures, and 34
expectations:

```bash
bun test test/fonts-cli-check-validation.test.ts
```

The full repository suite passed:

```bash
bun test
```

After each test run, a focused directory scan found no
`font-check-text-*` or `font-check-invalid-text-*` directories under
`examples/playground/.tmp-tests/`.

Repository lint, formatting, and whitespace checks passed:

```bash
bun run lint
bun run format:check
git diff --check
```
