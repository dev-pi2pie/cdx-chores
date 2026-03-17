---
title: "Align DOCX docs with flag removal decision"
created-date: 2026-03-17
status: completed
agent: codex
---

## Goal

Align the DOCX graduation docs with the decision to remove `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL` when the graduation plan lands, without adding a runtime compatibility phase.

## What Changed

- Updated `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`:
  - removed the one-release compatibility no-op recommendation
  - changed the recommendation to remove the env gate as part of DOCX graduation
  - reframed the remaining compatibility story as a legacy `v0.0.7` usage note only
- Updated `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`:
  - changed the rollout to remove the env gate during default-on graduation
  - removed compatibility-notice work from verification and success criteria
  - added the usage-guide deprecation note as part of the graduation deliverable
- Updated `docs/guides/rename-scope-and-codex-capability-guide.md`:
  - added a DOCX legacy note explaining that older `v0.0.7` guidance required `CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL=1`
  - marked that env-gated usage as deprecated

## Verification

- Reviewed the revised research, plan, and guide docs for consistency of:
  - removal-decision wording
  - absence of a runtime compatibility no-op phase
  - legacy `v0.0.7` deprecation note scope

## Related Plans

- `docs/plans/plan-2026-03-17-docx-metadata-helper-and-flag-graduation.md`

## Related Research

- `docs/researches/research-2026-03-17-docx-experimental-flag-recommendation.md`

## Related Jobs

- `docs/plans/jobs/2026-03-17-docx-flag-graduation-review-followup.md`
