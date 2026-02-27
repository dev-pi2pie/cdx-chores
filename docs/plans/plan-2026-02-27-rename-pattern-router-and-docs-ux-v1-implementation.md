---
title: "Rename pattern, smart router, and docs UX v1 implementation"
created-date: 2026-02-27
modified-date: 2026-02-27
status: completed
agent: codex
---

## Goal

Implement v1 improvements for rename template flexibility, interactive smart routing, and documentation clarity/compactness.

## Scope

- Add template/pattern capabilities for:
  - nullable prefix behavior
  - date variants (`{date}`, `{date_local}`, `{date_utc}`)
  - serial token with parameters (`#`, `start_<n>`, `order_<value>`)
- Add serial-order controls as dedicated CLI/interactive inputs and compile them into canonical `{serial_...}` template tokens.
- Redesign interactive Codex assistant flow to avoid duplicate prompts and support `auto | images | docs`.
- Introduce internal profile-capability schema for smart router decisions.
- Refactor docs:
  - add `docs/guides/rename-common-usage.md`
  - compact `docs/guides/rename-scope-and-codex-capability-guide.md`
  - update `README.md` command examples to `cdx-chores`.

## Out Of Scope (v1)

- External config files for profile/capability schema.
- Literal-brace escaping in templates.
- Alias support for `time_asc` / `time_desc`.
- New analyzer types beyond existing `--codex-images` and `--codex-docs`.

## Phase Checklist

### Phase 1: Contracts and UX Surface

- [x] Define canonical template grammar updates for serial/date tokens.
- [x] Define serial parameter parser behavior (order-insensitive token params).
- [x] Define canonical serializer for `{serial_...}` token composition.
- [x] Add/confirm CLI options for serial order/start/width and serial scope reset mode.
- [x] Define interactive prompt contract for pattern presets and custom template flow.
- [x] Define interactive assistant routing prompt contract:
  - one enable prompt
  - one scope prompt (`auto | images | docs`) when enabled.

### Phase 2: Template Engine and Rename Planner

- [x] Implement extended placeholder rendering in rename planner.
- [x] Implement prefix-null separator normalization.
- [x] Implement serial width guardrail with planned-target pre-counting.
- [x] Implement serial ordering modes:
  - `path_asc`
  - `path_desc`
  - `mtime_asc`
  - `mtime_desc`
- [x] Implement deterministic tie-breaker for equal mtime (relative path ascending).
- [x] Implement optional serial reset-per-directory behavior for recursive mode.
- [x] Add validation errors for unknown/duplicate serial markers and invalid `start_<n>`.

### Phase 3: Interactive Smart Router

- [x] Add internal extension-capability schema for docs/images routing.
- [x] Implement `auto` scope resolution from effective extension scope.
- [x] Route mixed docs+images `auto` to both analyzers internally.
- [x] Remove duplicated codex-assistant prompts from interactive rename flows.
- [x] Preserve existing fallback-safe behavior for unsupported/weak analyzer cases.

### Phase 4: Documentation Refactor

- [x] Add `docs/guides/rename-common-usage.md` with concise operational examples.
- [x] Update `docs/guides/rename-scope-and-codex-capability-guide.md`:
  - include template/pattern section
  - convert wide tables into compact print/PDF-friendly format.
- [x] Update `README.md` wording and command examples to `cdx-chores`.
- [x] Cross-link README and guides to reduce duplication.

### Phase 5: Tests and Verification

- [x] Add unit tests for template parser/serializer and validation.
- [x] Add planner tests for serial order modes and reset-per-directory behavior.
- [x] Add tests for date placeholders and prefix-null normalization.
- [x] Add interactive-flow tests for smart router prompt branching.
- [x] Run verification:
  - `bunx tsc --noEmit`
  - `bun test`
  - focused rename smoke checks in `examples/playground/`.

## Completion Criteria

- Interactive rename supports preset/custom template flow with canonical serial/date semantics.
- Serial numbering behavior is deterministic, configurable, and covered by tests.
- Interactive assistant routing asks once and resolves scope via schema-driven logic.
- Docs are aligned with implemented behavior and use `cdx-chores` command style.

## Related Research

- `docs/researches/research-2026-02-27-rename-pattern-router-and-docs-ux-v1.md`
