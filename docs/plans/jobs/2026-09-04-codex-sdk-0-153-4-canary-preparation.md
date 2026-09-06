---
title: "Codex SDK 0.153.4 canary preparation"
created-date: 2026-09-04
status: completed
agent: codex
---

## Changes

- Updated `@openai/codex-sdk` to `^0.153.4` and refreshed its locked Codex
  runtime and platform packages to `0.153.4`.
- Kept the existing package version `0.1.8-canary.4` and `tsdown` `0.22.14`.
- Aligned the README and CLI action integration guide with this canary's SDK
  baseline. Historical job records retain their original versions.

## Validation

- The installed SDK JavaScript entry point and TypeScript declaration file have
  identical SHA-256 hashes before and after the patch update.
- Passed frozen-lockfile installation, lint, formatting, TypeScript checking,
  and the ESM/CJS build. The build retains its TypeScript 7 experimental API warning.
- Node.js smoke checks passed for the CLI version, ESM/CJS imports, and SDK
  initialization; the CLI reports `0.1.8-canary.4`.
- `bun test codex`: 760 passed, 0 failed across 99 files. No authenticated
  model request is included in this validation.
