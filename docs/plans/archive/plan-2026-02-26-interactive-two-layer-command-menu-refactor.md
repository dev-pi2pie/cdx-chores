---
title: "Interactive two-layer command menu refactor"
created-date: 2026-02-26
modified-date: 2026-02-26
status: completed
agent: codex
---

## Goal

Refactor interactive mode command selection so the first menu shows only top-level command groups, and a second menu is used to choose subcommands within a group.

Target first-layer menu:

- `doctor`
- `data`
- `md`
- `rename`
- `video`
- `cancel`

## Why This Plan

`src/cli/interactive.ts` currently presents a mostly flattened list of action entries (for example, `data json-to-csv`, `rename batch`, `video gif`) in one menu. This works, but it mixes categories and actions in a single layer and will get harder to scan as more commands are added.

A two-layer interactive menu aligns better with the CLI command structure described in the architecture research and makes it easier to add related commands later without turning the first screen into a long list.

It also creates a cleaner foundation for upcoming command growth within existing groups (for example, adding more `md` subcommands such as `frontmatter-to-json`).

## Current State (Baseline)

- Interactive mode command selection is a single `select(...)` prompt in `src/cli/interactive.ts`.
- The selected value is a flattened action key (for example, `video:gif`, `rename:apply`).
- Prompt flows and action dispatch logic are implemented in the same function with a long `if` chain.
- Action handlers are already separated (`actionDoctor`, `actionJsonToCsv`, etc.), which reduces refactor risk.

## Proposed UX

### Layer 1 (command group)

- Show only major command groups and utility actions:
  - `doctor`
  - `data`
  - `md`
  - `rename`
  - `video`
  - `cancel`

### Layer 2 (subcommand)

- If the selected layer-1 item has subcommands, show a second `select(...)` prompt for that group.
- Example:
  - `data` -> `json-to-csv`, `csv-to-json`
  - `rename` -> `file`, `batch`, `apply`
  - `video` -> `convert`, `resize`, `gif`
  - `md` -> `to-docx` (and future items such as `frontmatter-to-json`)
- `doctor` runs directly (no second-layer submenu).
- `cancel` exits immediately.
- Second-layer menus should include both `Back` and `Cancel`.

## Design Principles / Constraints

- Preserve existing action behavior and prompts after subcommand selection (only the menu selection flow changes).
- Keep flattened internal action keys (for example, `video:gif`) if that minimizes churn in dispatch logic.
- Do not change flag-driven CLI command behavior; this refactor is interactive-mode-only.
- Keep Node.js runtime compatibility.
- Prefer a typed menu configuration structure over hard-coded duplicated lists to reduce future maintenance.

## In Scope

- Refactor `src/cli/interactive.ts` first-layer selection into a two-layer menu flow.
- Introduce a small menu/group configuration model for interactive choices.
- Preserve current per-action prompt sequences and action calls.
- Maintain `cancel` behavior.
- Add `Back` navigation in second-layer submenus.
- Add/update brief interactive help text labels/descriptions inside menu choices as needed.

## Out of Scope (This Refactor)

- Rewriting all interactive action flows into a separate router module (can be a follow-up).
- Changing path prompt behavior/autocomplete UX.
- Changing command names or action semantics.
- Reworking non-interactive `commander` command definitions.
- Adding new commands.
- Implementing `md frontmatter-to-json` itself (track in a separate plan/job).

## Implementation Strategy

### Phase 1: Define Interactive Menu Group Model

#### Task Items

- [x] Add a typed config structure for interactive menu groups and subcommands (name, value, description).
- [x] Represent top-level groups (`doctor`, `data`, `md`, `rename`, `video`, `cancel`) in one place.
- [x] Map subcommand choices to existing flattened action values (for example, `data` + `json-to-csv` -> `data:json-to-csv`).

#### Phase Deliverable

- [x] Interactive menu choices are data-driven and grouped by command domain.

### Phase 2: Implement Two-Layer Selection Flow

#### Task Items

- [x] Replace the current single flat command `select(...)` with layer-1 group selection.
- [x] Add a layer-2 subcommand `select(...)` for groups that have subcommands.
- [x] Keep direct-run behavior for `doctor` and direct-exit behavior for `cancel`.
- [x] Resolve final selection into the same internal action key format used by the current dispatch code.

#### Phase Deliverable

- [x] Interactive mode routes from group menu -> subcommand menu -> existing action flow.

### Phase 3: Polish UX and Reduce Refactor Risk

#### Task Items

- [x] Add clear submenu messages (for example, `Choose a data command`).
- [x] Add both `Back` and `Cancel` behavior for second-layer menus.
- [x] Preserve or improve choice descriptions for discoverability (especially for `doctor` and common categories).
- [x] Keep prompt wording stable after action selection to avoid accidental UX regressions.

#### Phase Deliverable

- [x] Two-layer menus are predictable and easy to navigate without changing action prompt behavior.

### Phase 4: Manual Verification and Docs Notes

#### Task Items

- [x] Verify first-layer menu shows only top-level entries.
- [x] Verify each submenu maps to the correct existing action flow.
- [x] Verify `doctor` still runs correctly (including JSON prompt).
- [x] Verify `cancel` exits cleanly.
- [x] Verify `rename batch/file/apply` post-action follow-up prompts still behave correctly.
- [x] Record any menu-navigation caveats in a job record.

#### Phase Deliverable

- [x] Refactor is validated and documented with no action-level behavior changes.

## Verification Plan

### Manual Checks

- [x] Run `cdx-chores` with no args and confirm first layer is: `doctor`, `data`, `md`, `rename`, `video`, `cancel`.
- [x] `data` submenu shows `json-to-csv` and `csv-to-json`, and each routes to the correct prompts.
- [x] `md` submenu shows `to-docx` and routes correctly.
- [x] `rename` submenu shows `file`, `batch`, `apply`, and each route matches current behavior.
- [x] `video` submenu shows `convert`, `resize`, `gif`, and each route matches current behavior.
- [x] `doctor` still prompts for JSON output and runs the existing action.
- [x] `cancel` exits without additional prompts.
- [x] Second-layer `Back` returns to the first-layer menu without exiting.
- [x] Second-layer `Cancel` exits interactive mode cleanly.

### Regression Focus

- [x] No prompt flow changes after action selection (path prompts, overwrite confirms, dry-run/apply follow-up).
- [x] No broken internal action keys from submenu mapping.

## Reviewed Decisions (2026-02-26)

1. Second-layer menus should include both `Back` and `Cancel`.
2. Keep `md` as a submenu group (do not auto-run `to-docx`) to support near-term growth, including a planned `md frontmatter-to-json` command.
3. `md frontmatter-to-json` should be planned separately from this interactive menu refactor.
4. Use minimal extraction only for menu selection/submenu navigation; keep the existing action dispatch `if` chain for this refactor to minimize risk.

## Related Research

- `docs/researches/research-2026-02-25-cdx-chores-cli-scope-and-architecture.md`

## Related Plans

- `docs/plans/archive/plan-2026-02-26-md-frontmatter-to-json-command.md`
