---
title: "Remove ineffective dynamic import in interactive data convert"
created-date: 2026-03-20
status: completed
agent: codex
---

## Goal

Remove a build warning caused by an ineffective dynamic import in the interactive data convert flow.

## What Changed

- replaced the dynamic import of `src/cli/actions/shared.ts` in `src/cli/interactive/data/convert.ts` with a normal static import
- kept the runtime behavior unchanged; the change only removes unnecessary chunk-splitting intent that could never take effect because the same module is already statically imported elsewhere

## Verification

- `bun run build`
