---
title: "Guide front matter policy cleanup"
created-date: 2026-05-17
status: completed
agent: codex
---

## Summary

Added explicit guide-document front-matter and status rules to `DOCUMENTATION_POLICY.md`, then normalized current guide metadata so every `docs/guides/*.md` file starts with front matter.

## Changes

- Added a `Guide Documents` policy section covering:
  - guide location
  - required front-matter fields
  - `modified-date` expectations
  - guide-specific status meanings
- Added front matter to data guide docs that previously started directly with body headings:
  - `docs/guides/data-duckdb-usage.md`
  - `docs/guides/data-extract-usage.md`
  - `docs/guides/data-preview-usage.md`
  - `docs/guides/data-query-codex-usage.md`
  - `docs/guides/data-query-interactive-usage.md`
  - `docs/guides/data-query-usage.md`
  - `docs/guides/data-schema-and-mapping-usage.md`
  - `docs/guides/data-source-shape-usage.md`
  - `docs/guides/data-stack-usage.md`
- Preserved `created-date` values from git first-add history where practical.
- Used latest git content history for `modified-date` values where the guide had substantive later updates.
- Normalized `docs/guides/cli-action-tool-integration-guide.md` from `draft` to `completed` because it now reads as accepted operational guidance under the guide policy.
- Kept `docs/guides/pdf-backend-license-guidance.md` as `draft` because most PDF backend positions in that guide are guidance for possible integrations rather than current shipped behavior. Its original metadata shape was preserved without adding `modified-date`, since this cleanup did not substantively revise that guide.

## Verification

- Confirmed all `docs/guides/*.md` files now start with front matter.
- Reviewed guide `status` fields against the new guide status policy; current shipped usage guides are `completed`, while `docs/guides/pdf-backend-license-guidance.md` remains `draft`.
- `awk 'FNR == 1 && $0 != "---" { print FILENAME }' docs/guides/*.md`
- `rg -n "^status:" docs/guides/*.md`
- `git diff --check`

## Related Policy

- `DOCUMENTATION_POLICY.md`
