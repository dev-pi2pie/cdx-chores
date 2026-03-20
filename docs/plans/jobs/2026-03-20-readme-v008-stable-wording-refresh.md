---
title: "Refresh README wording for v0.0.8 stable release"
created-date: 2026-03-20
status: completed
agent: codex
---

## Goal

Revise `README.md` so the package reads like a formal stable release, reflects the `v0.0.8` data surface, and keeps the command overview concise.

## What Changed

- replaced the launch-phase opening copy in `README.md` with stable-release wording tied to `v0.0.8`
- updated the `data` command overview row to call out `extract` and TSV support without listing every conversion command inline
- added short notes below the command table to enumerate the conversion actions and explain where `data extract` helps with Excel edge cases
- expanded the capability-check section so `data extract` and its optional Codex-backed review steps are represented alongside `data query`
- added `data extract` examples and expanded the data guides list so the README points readers to the newer shaping and mapping documentation

## Verification

- reviewed the current `data` command surface in `src/cli/commands/data.ts`
- reviewed the updated `README.md` after patching for wording, structure, and guide-path accuracy
