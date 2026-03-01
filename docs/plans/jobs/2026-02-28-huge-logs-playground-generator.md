---
title: "Add huge logs playground generator script"
created-date: 2026-02-28
modified-date: 2026-02-28
status: completed
agent: codex
---

## Goal

Add a small Node.js utility under `scripts/` that can seed, clean, and reset a large set of synthetic log files in `examples/playground/huge-logs/` for manual smoke-test workflows.

## Implemented

- Added `scripts/generate-huge-logs.mjs`
- Supports:
  - `seed [--count <n>]`
  - `clean`
  - `reset [--count <n>]`
- Generates many `.log` files under `examples/playground/huge-logs/`
- Uses short synthetic log sentences with timestamps, levels, and service labels
- Intended to support large-list and preview smoke tests without relying on real log data

## Verification

- `node scripts/generate-huge-logs.mjs seed --count 3`
- `node scripts/generate-huge-logs.mjs clean`
- `node scripts/generate-huge-logs.mjs reset --count 2`
