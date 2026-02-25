---
title: "Codex-assisted image batch rename and action tool integration plan"
created-date: 2026-02-25
modified-date: 2026-02-25
status: completed
agent: codex
---

## Goal

Add a Codex-assisted batch image renaming workflow (as an optional enhancement to `rename batch`) and document a consistent integration pattern for commands/actions that orchestrate external tools in `cdx-chores`.

## Why This Plan

Current `rename batch` behavior is deterministic and useful, but image-heavy workflows often need better semantic naming (for example, concise subject-based titles). This is a good fit for optional Codex assistance:

- deterministic fallback remains available
- AI-assisted naming improves usability for large image folders
- `--dry-run` preview already provides a safe review surface

At the same time, the codebase now has multiple command/action flows that wrap system tools (`pandoc`, `ffmpeg`) and internal utilities. A lightweight action integration guide will reduce design drift when new chores are added.

## Execution Checklist By Phase

### Phase 1: Planning and Integration Design (Completed)

- [x] Define Codex-assisted rename mode scope (image inputs only vs general files)
- [x] Define CLI UX for optional Codex rename mode (flags, prompt flow, fallback behavior)
- [x] Add/confirm `src/adapters/codex/**` integration boundary (no direct SDK calls from action modules)
- [x] Design prompt/response contract for image rename title generation
- [x] Define offline/unauthenticated fallback behavior and clear user messaging
- [x] Define cost/latency guardrails (batch size, timeout, retries, sampling)
- [x] Write and maintain action/tool integration guide for future chores

### Phase 2: Codex-Assisted Batch Rename MVP (Completed)

- [x] Extend `rename batch` plan/implementation approach with Codex-assisted title generation stage
- [x] Document how interactive mode should expose the Codex-assisted rename option
- [x] Add visible progress feedback while Codex title generation is running
- [x] Add automated tests for Codex fallback messaging path (deterministic unit test via injected suggester)

### Phase 3: Reliability and Scope Controls (Completed)

- [x] Tune Codex request settings for better success odds (timeout/network-enabled thread settings)
- [x] Add user-tunable Codex request controls (timeout, retries, batch size)
- [x] Define scoping controls for rename batch (regex include/exclude, extension filters)
- [x] Define behavior for unsupported/non-static/oversized files in Codex-assisted mode (skip Codex assist, still rename deterministically)

### Phase 4: Capability Messaging and Follow-Up Tracking (Completed for Current MVP)

- [x] Add/update `doctor`/capability messaging only if needed for Codex-backed features (evaluated as not needed for current MVP behavior)
- [x] Create follow-up implementation job(s) after scope and UX decisions are settled

## In Scope

- Planning Codex-assisted rename behavior for batch image directories
- Defining architecture boundaries for `@openai/codex-sdk` integration
- UX planning for CLI and interactive mode behavior (including preview and fallback)
- Documentation for action/tool integration patterns used in this repository

## Out of Scope

- Production-hardening/full rollout of Codex-assisted rename in this plan (MVP/prototype implementation may be completed under this plan)
- Shipping image content analysis or metadata extraction beyond planning/design
- Expanding Codex SDK into a general workflow router in this plan
- Billing/cost telemetry implementation

## Proposed Feature Shape (Draft)

### Rename pipeline (target shape)

1. Enumerate files and collect metadata (existing behavior)
2. Filter/identify supported image files (new rule)
3. Generate base title:
   - deterministic fallback (existing slug from filename)
   - optional Codex-assisted semantic title (new)
4. Normalize and slugify title (existing utilities)
5. Compose final filename with prefix + datetime + title
6. Preview (`--dry-run`) and apply

### UX principles

- Codex assistance must be opt-in (flag and/or interactive prompt)
- deterministic mode remains default
- preview is strongly encouraged before apply for AI-generated names
- failures should degrade gracefully to deterministic naming (configurable)

## Implementation Notes (Planned Boundaries)

- `src/cli/actions/rename.ts` should orchestrate rename flow, not call `@openai/codex-sdk` directly
- Codex integration should live behind an adapter boundary (for example, `src/adapters/codex/rename-titles.ts`)
- prompt/response parsing and retry logic should be isolated from CLI formatting/output
- file filtering and image metadata helpers (if added) should remain separate from the Codex adapter

## Documentation Deliverable (Included)

This plan includes a supporting guide document:

- `docs/guides/cli-action-tool-integration-guide.md`

Purpose:

- define the recommended command -> action -> adapter/tool flow
- show where to place external-tool wrappers and future Codex SDK adapters
- reduce ambiguity when adding new chores commands

## Status Notes

- MVP Codex-assisted rename has been implemented as an opt-in mode on `rename batch` / `batch-rename` via `--codex`.
- Interactive mode now prompts whether to enable Codex-assisted image titles.
- Current behavior is best-effort:
  - supported image files are sent to a Codex adapter in a batch
  - deterministic rename fallback is used when Codex is unavailable or times out
  - a user-facing note reports fallback usage
- A 30-second Codex timeout is currently used to prevent rename flows from hanging while improving success odds versus the earlier 15-second timeout.
- Users can override Codex rename request behavior via CLI flags on `rename batch` / `batch-rename`:
  - `--codex-timeout-ms`
  - `--codex-retries`
  - `--codex-batch-size`
- Codex thread settings for rename title generation currently use:
  - `modelReasoningEffort: low`
  - `networkAccessEnabled: true`
  - `webSearchMode: disabled`
- Non-supported files (or files outside the image extension list) currently remain in the batch rename flow and use deterministic naming only.
- `rename batch` / `batch-rename` now supports batch scoping controls:
  - `--match-regex`
  - `--skip-regex`
  - `--ext` (repeatable and comma-separated)
  - `--skip-ext` (repeatable and comma-separated)
- Codex-assisted rename now prefilters eligible image inputs before calling Codex:
  - skips GIFs (treated as likely non-static for assist)
  - skips oversized local images (keeps deterministic rename path)
  - still renames all scoped files deterministically when no Codex title is available
- Real-image dry-run was exercised against `examples/playground/images/*` in the current environment and still fell back due timeout/abort (`The operation was aborted.`), but now displays live progress feedback before fallback.

## Risks and Mitigations

- Risk: AI-generated names are inconsistent or noisy
  - Mitigation: keep deterministic default, require preview-first UX, apply slug/length normalization
- Risk: SDK/auth/network failure breaks rename flow
  - Mitigation: degrade to deterministic naming and surface clear messages
- Risk: action modules become coupled to SDK/client details
  - Mitigation: enforce adapter boundary and typed result contract
- Risk: Codex-assisted rename expands into a broad router project prematurely
  - Mitigation: scope this plan to image batch rename only

## Follow-up Jobs

- Job: prototype Codex-assisted image title generation adapter with mocked responses
- Job: implement `rename batch` optional Codex mode + `--dry-run` preview UX
- Job: add tests for fallback behavior when Codex is unavailable
- Job: add docs examples for image-folder rename workflows
- Job: add configurable Codex timeout/retry/batch-size flags or config defaults
- Job: investigate local Codex CLI auth/environment issues when suggestions consistently abort in this environment
- Job: add regex include/exclude and extension-filter scoping for rename batch
- Job: define/document non-static/large file Codex-assist skip rules with deterministic rename fallback

## Related Plans

- `docs/plans/plan-2026-02-25-initial-launch-lightweight-implementation.md`
- `docs/plans/plan-2026-02-25-cli-actions-modularization.md`

## Related Research

- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`
