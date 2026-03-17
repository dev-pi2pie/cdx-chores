---
title: "DOCX identifier-free metadata discovery"
created-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Implement the cleaner, narrower DOCX metadata discovery approach that keeps `/_rels/.rels` support but removes OOXML relationship-type URI matching and raw `schemas.openxmlformats.org` literals from runtime code.

## What Changed

- Updated `src/adapters/docx/ooxml-metadata.ts`:
  - removed runtime matching against OOXML relationship-type URI strings
  - added metadata-part discovery via `[Content_Types].xml`
  - kept `/_rels/.rels` as root-package guidance when choosing metadata targets
  - kept fallback support for the standard package parts:
    - `/docProps/core.xml`
    - `/docProps/app.xml`
- Removed `src/adapters/docx/ooxml-identifiers.ts` because the runtime helper no longer needs URI-like identifier constants.
- Updated `test/adapters-docx-ooxml-metadata.test.ts`:
  - kept the no-fetch regression guard
  - added coverage for metadata discovery from non-default package part locations without relationship-type URI matching
- Updated `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`:
  - clarified that OOXML relationship/schema strings remain research/spec background only for this implementation direction
- Updated `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`:
  - changed Phase 3 wording from local URI-identifier handling to identifier-free metadata discovery

## Verification

- `bun test test/adapters-docx-ooxml-metadata.test.ts`
- `bun run build`
- `rg -n "schemas\\.openxmlformats\\.org" src` returns no matches

## Related Plans

- `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`

## Related Research

- `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`
