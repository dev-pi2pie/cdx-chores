---
title: "Rename pattern, smart router, and docs UX v1 research"
created-date: 2026-02-27
modified-date: 2026-03-04
status: completed
agent: codex
---

## Goal

Define a practical v1 design for:

- interactive rename pattern/template selection
- smart Codex assistant routing in interactive mode
- documentation cleanup and compaction for rename usage/capabilities

## Milestone Goal

Produce an implementation-ready baseline that removes redundant interactive prompts, makes template customization clearer, and aligns docs/CLI examples around `cdx-chores`.

## Key Findings

### 1. Interactive rename currently asks Codex image/docs prompts separately

`rename:file` and `rename:batch` currently ask both:

- "Use Codex-assisted image title(s)...?"
- "Use Codex-assisted document title(s)...?"

This creates redundant UX in profile-scoped flows (for example `images` profile) and is the primary smart-router gap.[^1]

### 2. Template customization exists in README but is not reflected in rename capability guide

README documents:

- `Custom filename template (placeholders: {prefix}, {timestamp}, {stem})`

But the rename capability guide does not clearly describe pattern/template usage and placeholder behavior.[^2][^3]

### 3. Current template model is missing important user-level flexibility

Requested design needs include:

- nullable prefix support
- user static literals (brand/author/custom words)
- serial placeholder support (for example `{serial}`)
- simpler date output option (for example `{date}` as `YYYY-MM-DD`)
- deterministic UID placeholder support so `rename file` / `rename batch` can reuse the same `uid-<token>` shape already established by `rename cleanup`

### 4. Profile scope and assistant routing should share one capability model

Interactive routing should not be hardcoded as repeated binary prompts. It should derive available assistant paths from a central extension-capability schema (internal in v1; external config later).

### 5. Docs command examples are inconsistent with desired runtime entrypoint

Some examples still use `bun run src/bin.ts`; user-facing docs should prefer `cdx-chores` for compact, consistent usage.[^2]

## Implications or Recommendations

### A. Pattern/template v1 contract

Presets in interactive mode:

- `default`
- `timestamp-first`
- `stem-first`
- `custom`

Template placeholders in v1:

- `{prefix}` (nullable)
- `{timestamp}` (`YYYYMMDD-HHmmss`)
- `{date}` (default date mode; default config = local)
- `{date_local}` (always local date)
- `{date_utc}` (always UTC date)
- `{stem}`
- `{uid}` (deterministic `uid-<token>` fragment)
- `{serial}` (default counter behavior)

`custom` should allow mixed static text plus placeholders, for example:

- `brand-{date}-{stem}-{serial}`
- `brand-{uid}-{stem}`
- `{timestamp}-{stem}-{serial}`

`{uid}` should reuse the same recognizable marker-based shape as cleanup:

- render as `uid-<token>`, not a bare opaque token
- keep deterministic generation so repeated dry runs for the same source stay stable
- share the same cleanup-friendly fragment family instead of inventing a second UID format for constructive rename flows

### B. Serial token parameters and ordering (v1)

`{serial}` is a parameterized token. Parameters are underscore-separated and order-insensitive:

- `{serial}`
- `{serial_##}`
- `{serial_start_2_##}`
- `{serial_order_path_desc}`
- `{serial_start_2_##_order_mtime_asc}`
- `{serial_order_mtime_desc_start_0_#####}`

Parameter vocabulary:

- width marker: one segment made of `#` characters (`##`, `#####`, etc.)
- start marker: `start_<n>` (default: `start_1`)
- order marker: `order_<value>`

Allowed order values:

- `path_asc` (default)
- `path_desc`
- `mtime_asc`
- `mtime_desc`

Rules:

- parameter order in token does not matter
- `#` count defines minimum serial width
- pre-count planned rename targets first, then enforce width guardrail using:
  - configured minimum width
  - and total serial range width from `start` to final index
- use explicit `mtime_*` naming (not `time_*`) to avoid ambiguity
- for equal `mtime` values, use stable tie-breaker by relative path ascending for deterministic assignment
- static separators and literals are allowed in custom templates

Validation recommendations:

- reject duplicated markers of the same kind in one token (for example two `start_*` values)
- reject unknown serial parameters with clear errors
- require `start_<n>` as a non-negative integer

### C. Remove `none` from assistant-scope selector by splitting decision stages

To avoid a `none` choice in assistant scope:

1. ask one gating question: "Enable Codex assistant?"
2. if enabled, ask one scope selector:
   - `auto`
   - `images`
   - `docs`

`auto` internally enables both analyzers when effective scope includes both docs and images.

### D. Smart router v1 behavior

Use one internal capability schema (not external file yet), conceptually:

- `docs: string[]`
- `images: string[]`

Routing:

- profile-scoped flows narrow available scope defaults
- `auto` resolves from effective extension set (profile + explicit ext union)
- mixed docs+images in `auto` route to both analyzers internally
- avoid asking duplicate codex prompts in rename interactive mode

### E. Prefix-null normalization

When `{prefix}` is empty, normalize separators to avoid malformed names:

- collapse repeated separators (`--`, `__`, `-_`)
- trim leading/trailing separators
- keep deterministic collision handling unchanged

### F. Placeholder parsing and literals (v1)

- braces are reserved for placeholders in v1
- unknown placeholder tokens produce a clear validation error
- no brace-escaping syntax in v1 (deferred)
- static literals remain case-preserving; sanitize only filesystem-invalid/reserved characters

### G. Documentation refactor

1. update `docs/guides/rename-scope-and-codex-capability-guide.md`:
   - include pattern/template section
   - replace wide tables with compact matrix + short scenario list for print/PDF safety
2. add `docs/guides/rename-common-usage.md`:
   - concise day-to-day command examples
   - template presets + custom examples
   - interactive recommendations
3. clean README wording and examples:
   - prefer `cdx-chores ...`
   - link deeper details to guides instead of repeating long tables

## Outcome

This research has now been implemented through the related follow-up plans and jobs:

- interactive rename routing was reduced to the intended single enable/scope flow
- rename docs were compacted into README plus dedicated guides
- general rename templates now support `{uid}` and share the deterministic `uid-<token>` family with `rename cleanup`

The note remains useful as the design rationale, but it is no longer an open draft.

## Finalized v1 Decisions

1. Serial scope:
   - support optionally resetting serial numbering per directory in recursive mode.
   - keep deterministic ordering guarantees within each directory scope.

2. Order keyword strictness:
   - use only `mtime_asc` and `mtime_desc` for modified-time order.
   - reject `time_asc` / `time_desc` aliases in v1.
   - docs/help text should explicitly spell out that `mtime` means modified time.

3. Serial-order controls surface:
   - expose serial-order control as separate CLI and interactive fields.
   - compile those selections into canonical `{serial_...}` token form in the final template pipeline.

## Related Plans

- `docs/plans/archive/plan-2026-02-26-interactive-two-layer-command-menu-refactor.md`
- `docs/plans/plan-2026-02-26-rename-scope-safety-and-flag-redesign.md`
- `docs/plans/archive/plan-2026-03-04-rename-uid-pattern-placeholder.md`

## Related Research

- `docs/researches/archive/research-2026-02-26-rename-doc-title-extraction-and-interactive-pattern-ux.md`

## References

[^1]: `src/cli/interactive.ts`
[^2]: `README.md`
[^3]: `docs/guides/rename-scope-and-codex-capability-guide.md`
