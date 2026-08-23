---
title: "Test Catalog Path Correspondence"
created-date: 2026-08-23
status: draft
agent: codex
---

## Goal

Maintain the canonical lookup from historical test paths to their current
contract owners as the test catalog is reorganized.

This reference records correspondence only after a path move, split, merge, or
removal is accepted. Research and plans own the decision rationale. The unified
implementation job owns execution evidence, validation results, and exact
review decisions.

## Entry Contract

Each accepted path change receives one row:

| Field                   | Meaning                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Reference date          | UTC date on which the new path or retained owner became the accepted repository location |
| Historical path         | Repository-relative path that existed before the accepted change                         |
| Transition              | `moved`, `split`, `merged`, or `removed`                                                 |
| Current owner or owners | Current path or paths that retain the historical contract                                |
| Migration range         | Exact `<base>..<tip>` implementation range                                               |
| Job evidence            | Unified job section containing execution and validation evidence                         |

The reference date supports documentation-currentness review. The exact
migration range remains authoritative when same-day ordering matters.

Use one row per historical path. For a split, list every current owner that
retains part of the historical contract. For a merge or removal, name the
existing test path that retains the contract rather than leaving the current
owner blank. Job evidence should link to the exact unified-job section when a
stable section anchor is available.

Current guides and current reference docs must use the latest accepted paths.
Historical commands and time-bounded wording follow the dated currentness
contract in the related research.

## Correspondence

Current state: no test-catalog path changes have been accepted through the
active research yet.

| Reference date | Historical path | Transition | Current owner or owners | Migration range | Job evidence |
| -------------- | --------------- | ---------- | ----------------------- | --------------- | ------------ |

## Completion Boundary

This reference remains `draft` throughout the initial test-catalog migration,
including after the first correspondence rows are added. It may move to
`completed` only after the final documentation reconciliation confirms that:

- every accepted move, split, merge, and removal has a correspondence row
- every row names its reference date, current owner or owners, exact migration
  range, and job evidence
- current guides and reference docs use the accepted current paths
- every remaining historical path occurrence is intentionally historical
- no accepted historical path remains unclassified

After that initial completion, later isolated migrations may append rows and
update `modified-date` without reopening the reference unless its schema or
currentness contract changes materially.

## Related Research

- [Test Suite Contract, Overlap, And Catalog Review](../researches/research-2026-08-23-test-suite-contract-overlap-and-catalog.md)
