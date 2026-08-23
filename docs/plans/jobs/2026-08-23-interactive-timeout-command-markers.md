---
title: "Interactive timeout command markers"
created-date: 2026-08-23
status: completed
agent: codex
---

## Goal

Make the supported and rejected Interactive timeout command forms easier to
scan without changing the shipped CLI contract.

## Changes

- label the supported form as `✅ Correct` and the rejected root-level form as
  `❌ Incorrect`
- keep the accompanying words so the distinction does not depend on color
- use the same presentation in the canonical timeout guide and the three
  workflow guides that repeat this exact command-placement boundary
- leave conditional warnings, capability tables, and terminal transcripts on
  their existing presentation patterns

## Validation

```text
node_modules/.bin/oxfmt --check <four guides> <job record>
all 5 files passed

git diff --check
passed

focused occurrence check
exactly 4 guide occurrences each of `✅ Correct:` and `❌ Incorrect:`
```

No code tests were run because this change only clarifies existing command
placement and does not change CLI behavior.
