---
title: "Close cancelled PDF-native lifecycle direction"
created-date: 2026-07-29
status: completed
agent: codex
---

## Goal

Close the unadopted native PDF command direction without treating it as completed implementation, preserve its research and planning as historical context, and remove obsolete ownership claims from current Markdown-to-PDF documentation.

## Lifecycle Decision

- use `cancelled` rather than `blocked` because the documented implementation route is no longer expected to resume
- keep all implementation checklist items unchecked because no implementation phase began
- archive the cancelled research and plan because neither remains a primary working reference
- require future PDF-native work to start with fresh research and a new plan
- remove the unshipped backend-license guide because it does not describe a current user-facing contract and guides do not have a historical archive location

The cancelled status does not assert that every historical backend observation was incorrect. It records that the proposed product direction, backend mapping, and implementation plan were not adopted and must not be treated as current guidance.

## Archived Lifecycle Documents

Research:

- `docs/researches/archive/research-2026-02-25-pdf-backend-comparison-for-merge-split-and-image-workflows.md`

Plan:

- `docs/plans/archive/plan-2026-03-11-pdf-cli-workflows-implementation.md`

Both documents include a `2026-07-29` historical review and preserve their original proposal details for traceability.

## Related Current-Document Corrections

- updated the completed May 6 Markdown-to-PDF research and implementation plan so they no longer identify the cancelled PDF-native plan as a current owner
- updated the completed May 7 profiles/fonts research and implementation plan to label both archived PDF-native documents as cancelled historical context
- updated those four documents' `modified-date` because the lifecycle meaning of their related-document guidance changed
- removed the unshipped `docs/guides/pdf-backend-license-guidance.md` draft
- retained its historical backend and licensing discussion in the archived research
- removed the deleted guide from the current Markdown PDF profile-helper and template-helper related-doc lists
- updated the March creation record and May guide-status audit to explain the guide's later removal
- preserved all March job records and rewrote their traceability links to the archive destinations

## Validation

- [x] both archive destination files exist
- [x] both original paths are absent
- [x] both archived documents have `status: cancelled`
- [x] the plan's implementation checklist remains unchecked
- [x] all exact old-path references are removed
- [x] relative Markdown links to the moved documents resolve through their archive locations
- [x] no job records moved
- [x] the unshipped backend-license guide is removed
- [x] no current Markdown helper guide links to the removed guide
- [x] historical job records explain why the earlier guide draft no longer exists
- [x] local Markdown links across changed files resolve outside intentional fenced examples
- [x] `git diff --check` passes

## Outcome

- the cancelled PDF-native research and plan are now historical archive documents
- the current Markdown-to-PDF lifecycle area no longer presents the cancelled plan as an active implementation owner
- the unshipped backend-license guide no longer occupies the current user-facing guide area
- the archived research remains the historical owner of the backend and licensing discussion
- future PDF-native work has a clear lifecycle boundary: create new research and planning instead of reopening these documents
