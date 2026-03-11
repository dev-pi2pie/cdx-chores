---
title: "Apply interactive data query plan review follow-ups"
created-date: 2026-03-11
status: completed
agent: codex
---

## Goal

Address the review findings on the interactive `data query` plan by removing contract ambiguity around source binding, prompt sequencing, SQL-error recovery, and `Codex Assistant` intent-entry behavior.

## What Changed

- updated the interactive query plan to bind every selected input source to the logical SQL table name `file`
- removed the duplicated `formal-guide` source-selection prompt so source selection stays in the shared introspection-first flow
- added explicit SQL-error recovery expectations for `manual`, `formal-guide`, and `Codex Assistant`
- revised the `Codex Assistant` intent-entry contract to use a dedicated multiline prompt with `Shift+Enter` newline support where available
- added guaranteed multiline submit fallbacks through `Ctrl+D` and `Meta+Enter`
- added checklist items and risk language so the implementation plan now covers those constraints directly

## Verification

- reviewed the interactive plan sections for consistency between design contract, scope, risks, and phase checklist
- searched the repository for an existing multiline interactive prompt rule and did not find one for `data query` intent entry
- confirmed the current interactive prompt stack is built on single-line `@inquirer/prompts` input flows
- confirmed the current prompt handlers do not already bind `Ctrl+D` or `Meta+Enter`, while `Ctrl+C` remains reserved for prompt abort

## Related Plans

- `docs/plans/plan-2026-03-10-data-query-interactive-flow-implementation.md`
- `docs/plans/plan-2026-03-10-data-query-codex-cli-drafting.md`

## Related Research

- `docs/researches/research-2026-03-09-data-query-scope-and-contract.md`
