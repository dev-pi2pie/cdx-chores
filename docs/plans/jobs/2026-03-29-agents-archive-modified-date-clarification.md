---
title: "Clarify AGENTS archive modified-date policy"
created-date: 2026-03-29
status: completed
agent: codex
---

## Goal

Clarify how `modified-date` should behave when documents are moved into archive locations and links are rewritten only for archive-path maintenance.

## What Changed

- updated `AGENTS.md` date guidance so `modified-date` means the last substantive content revision
- clarified that archive moves alone do not require a `modified-date` change
- clarified that archive-only link rewrites do not require a `modified-date` change
- clarified that substantive content edits made during an archive pass still require updating `modified-date`
- clarified that historical labeling for archived links is required in guides and other user-facing reference docs, not in archived docs or job-record traceability links

## Files

- `AGENTS.md`

## Verification

- reviewed the existing date-policy and archive-link wording in `AGENTS.md`
- patched only the policy sections needed to resolve the archive-date ambiguity raised in review discussion
