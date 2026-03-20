---
title: "Refine data extract and query boundary wording"
created-date: 2026-03-20
status: completed
agent: codex
---

## Goal

Clarify the current intended boundary between `data extract` and `data query` without changing the command surface.

## What Changed

- updated `README.md` to describe `data extract` as the current shaping/materialization lane with Excel-first strength and `data query` as the more expressive lane for richer transformations
- updated `docs/guides/data-extract-usage.md` to explain that the command is currently most distinctive for Excel-oriented source shaping and that SQL-backed transformations belong in `data query`
- updated `docs/guides/data-query-usage.md` to state more directly that `data query` is the current general-purpose lane when `data extract` is too narrow
- updated `docs/guides/data-query-interactive-usage.md` to reflect the same boundary for interactive workflows

## Verification

- reviewed the updated wording against the current shipped command surface without changing CLI behavior
