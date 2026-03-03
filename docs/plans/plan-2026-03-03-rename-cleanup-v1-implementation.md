---
title: "Rename cleanup v1 implementation"
created-date: 2026-03-03
modified-date: 2026-03-03
status: active
agent: codex
---

## Goal

Implement a safe first version of `rename cleanup` that can normalize existing filenames by matching explicit hint families, previewing the result through the existing rename plan CSV flow, and applying the same safety posture across single-file and directory cleanup.

## Why This Plan

The existing rename commands solve constructive naming:

- `rename file`
- `rename batch`
- `rename apply`

The cleanup workflow is different:

- start from an existing basename
- detect known noisy fragments
- remove or normalize those fragments explicitly
- restyle the remaining name without guessing too broadly

The research direction is now concrete enough to implement:

- `rename cleanup <path>` auto-detects file vs directory
- `--hint` is the canonical selector flag, with `--hints` accepted as an alias
- supported v1 hint families are `date`, `timestamp`, and `serial`
- `date` and `timestamp` are disjoint in v1:
  - `date` = date-only fragments
  - `timestamp` = date-plus-time fragments
- `uid` should default to `uid-<token>` using a deterministic lowercase Crockford-style base32 token of length `10`
- timestamps are preserved in normalized form by default and removed only when explicitly requested
- `--style` defaults to `preserve`

## User Experience Targets

- single-file cleanup should feel as predictable as `rename file`
- directory cleanup should feel as predictable as `rename batch`
- dry runs should always emit the standard replayable rename plan CSV
- file mode should reject directory-only flags instead of silently ignoring them
- cleanup should preserve meaningful macOS labels such as `Screenshot` and `Screen Recording`
- generated UID names should be easy to detect and easy to clean later

## Scope

### CLI surface

- add `rename cleanup <path>` to the rename command family
- add `--hint <value>` as a repeatable and comma-separated selector
- accept `--hints <value>` as a parsing alias
- support v1 output styles:
  - `preserve`
  - `slug`
  - `uid`
- default `--style` to `preserve`
- support explicit timestamp keep/remove behavior through a dedicated option
- support file-or-directory auto-detection at the action entrypoint

### Cleanup detection and transformation

- detect and normalize at least one well-defined timestamp family:
  - macOS `Screenshot ... at ...`
  - macOS `Screen Recording ... at ...`
- support `date`, `timestamp`, and `serial` hint-driven cleanup
- keep `date` and `timestamp` disjoint in v1:
  - `timestamp` matches date-plus-time fragments
  - `date` matches date-only fragments
- use a small explicit `serial` family in v1:
  - standalone zero-padded trailing counters such as `001`, `0023`, `000045`
  - parenthesized copy-style trailing counters such as `(1)`, `(2)`, `(12)`
  - trailing dash/space/underscore counters such as `-01`, `_02`, ` 003`
- do not treat camera-style stems such as `IMG_1234` or `DSC01234` as `serial` in v1
- preserve surviving words by default
- support slugification through the existing slugifier
- support deterministic `uid-<token>` generation

### Batch and single-file behavior

- single-file cleanup plans exactly one rename candidate
- directory cleanup plans file renames inside the target directory
- recursive traversal remains opt-in
- directory names are not rename targets in v1
- collision handling stays inside the planner/preview flow

### Safety and reporting

- reuse the current rename plan CSV contract
- reuse the current preview/apply messaging model where practical
- skip conflicting planned names with explicit reasons rather than relying on OS auto-renaming

## Out Of Scope

- renaming directory names
- analyzer-assisted hint suggestion or automatic cleanup inference
- introducing a broad generalized filename grammar parser for every possible naming convention
- changing existing `rename-plan-*` CSV naming behavior
- changing `rename file`, `rename batch`, or `rename apply` semantics outside the cleanup feature
- adding config-file defaults for cleanup rules

## Proposed v1 CLI Contract

### Command shape

```bash
cdx-chores rename cleanup <path> --hint <family> [options]
```

### Core options

- `--hint <value>`
- `--hints <value>` alias for `--hint`
- `--style preserve|slug|uid`
- `--timestamp-action keep|remove`
- `--dry-run`

### Default behavior

- default `--style`: `preserve`
- `--timestamp-action` applies only when `--hint timestamp` is active in v1
- `date` fragments are preserved in v1

### Directory-only options

- `--recursive`
- `--max-depth`
- `--match-regex`
- `--skip-regex`
- `--ext`
- `--skip-ext`
- `--preview-skips`

### Mode rules

- if `<path>` is a file:
  - plan exactly one candidate
  - reject directory-only options
  - dry run writes one standard rename plan CSV
  - non-dry-run applies the rename immediately
- if `<path>` is a directory:
  - evaluate only files in that directory by default
  - descend into subdirectories only with `--recursive`
  - never rename directories in v1

## Deterministic UID Contract

### Final v1 rule

When `--style uid` is selected, the basename should become:

```text
uid-<token>
```

and the original extension should be preserved.

### Hash algorithm and encoding

- hash algorithm: `SHA-256`
- digest encoding: lowercase Crockford-style base32
- default emitted token length: `10`

### Exact hash input

Hash the following UTF-8 payload:

```text
rename-cleanup-uid-v1\0<normalized-real-source-path>
```

Where `<normalized-real-source-path>` means:

- start from the source file path that is being planned for cleanup
- resolve it to a real absolute path
- normalize path separators to `/`
- do not include cwd-relative formatting
- do not include current time, mtime, or random values

Why this input:

- repeated dry runs for the same source file produce the same token
- the token does not depend on the shell cwd the user happened to run from
- the version prefix leaves room for future algorithm changes without silent drift
- the implementation does not need to read file contents to create the UID

### Collision rule

- generate the default 10-character token first
- if two planned cleanup targets still collide under `uid-<token>` in the same run, extend from the same encoded digest deterministically before giving up:
  - first fallback length: `13`
  - second fallback length: `16`
- if the target still conflicts after deterministic widening, keep the planner behavior explicit:
  - skip the row
  - record a conflict reason

This keeps the flow deterministic while making accidental truncation collisions extremely unlikely.

## Proposed Implementation Shape

Recommended source target structure:

```text
src/cli/actions/rename/
  cleanup.ts            # cleanup action entrypoint and mode dispatch
  cleanup-detect.ts     # hint matchers and fragment extraction
  cleanup-transform.ts  # preserve/slug/uid output shaping
  cleanup-uid.ts        # deterministic uid token generation helpers
```

Notes:

- exact filenames can still be simplified during implementation if a smaller boundary emerges
- the main requirement is to keep cleanup logic separate from existing constructive rename-template rendering
- the action should still reuse shared rename plan CSV writing and apply helpers rather than inventing a parallel pipeline

## Phase Checklist

### Phase 1: Freeze the cleanup contract

This phase is not for reopening the research decisions.
It exists to codify them into implementation-facing rules and ensure the CLI surface matches the settled contract exactly.

- [x] codify final CLI option names for:
  - [x] `--style`
  - [x] `--timestamp-action`
- [x] codify `--hint` parsing behavior:
  - [x] repeatable
  - [x] comma-separated
  - [x] `--hints` alias
- [x] codify v1 hint family set:
  - [x] `date`
  - [x] `timestamp`
  - [x] `serial`
- [x] codify disjoint temporal matching:
  - [x] `date` = date-only
  - [x] `timestamp` = date-plus-time
- [x] codify the v1 serial matcher family:
  - [x] zero-padded trailing counters
  - [x] parenthesized copy-style counters
  - [x] trailing dash/space/underscore counters
- [x] codify default style behavior:
  - [x] `preserve`
- [x] codify file-mode validation rejects directory-only options
- [x] codify directory names remain out of scope
- [x] codify `--hint uid` as deferred from v1

### Phase 2: Add CLI entrypoint and validation

- [x] add `rename cleanup <path>` to `.command("rename")` in `src/command.ts`
- [x] parse `--hint` and `--hints` into one normalized internal list
- [x] add cleanup-specific option validation
- [x] reject invalid combinations such as:
  - [x] file path with `--recursive`
  - [x] file path with `--max-depth`
  - [x] file path with directory-scoped filters
- [x] ensure help text stays concise and documents only the essential contract

### Phase 3: Build cleanup detectors and transformers

- [ ] add timestamp-family detection for the agreed macOS patterns
- [ ] add date-family detection rules needed by v1
- [ ] keep `date` and `timestamp` matching disjoint
- [ ] add serial-family detection rules for the agreed v1 patterns
- [ ] keep hints as selectors only, separate from transformation behavior
- [ ] implement timestamp keep/remove handling
- [ ] implement style transforms:
  - [ ] `preserve`
  - [ ] `slug`
  - [ ] `uid`
- [ ] preserve macOS labels such as `Screenshot` and `Screen Recording`

### Phase 4: Add deterministic UID generation

- [ ] add a deterministic token generator for `uid-<token>`
- [ ] hash the payload `rename-cleanup-uid-v1\0<normalized-real-source-path>` with `SHA-256`
- [ ] use lowercase Crockford-style base32 output
- [ ] use token length `10`
- [ ] derive the token from normalized real absolute source path so repeated dry runs are stable across cwd changes
- [ ] add deterministic widening fallback lengths for collision handling:
  - [ ] `13`
  - [ ] `16`
- [ ] confirm generated basenames preserve the original extension

### Phase 5: Integrate with rename planning and reporting

- [ ] add cleanup planning for single-file mode
- [ ] add cleanup planning for directory mode
- [ ] reuse the standard rename plan CSV writer
- [ ] reuse `rename apply` for dry-run replay flow
- [ ] keep single-file non-dry-run behavior immediate, consistent with current `rename file`
- [ ] add conflict detection and skipped reasons for:
  - [ ] unchanged names
  - [ ] duplicate target basenames within the same run
  - [ ] target-path conflicts against existing files where applicable
- [ ] ensure preview output remains understandable in both single-file and directory mode

### Phase 6: Documentation and examples

- [ ] update `README.md` with one or two cleanup examples
- [ ] update rename guide material if cleanup is user-facing in this phase
- [ ] document:
  - [ ] canonical `--hint`
  - [ ] accepted `--hints` alias
  - [ ] `uid-<token>` format
  - [ ] lowercase token output plus case-insensitive detection guidance for future compatibility
  - [ ] file-vs-directory mode behavior
  - [ ] directory names not being renamed in v1
  - [ ] disjoint `date` vs `timestamp` behavior
  - [ ] concrete v1 serial matcher scope

### Phase 7: Tests and verification

- [ ] add unit tests for cleanup hint detection
- [ ] add unit tests for deterministic UID generation
- [ ] add unit tests for timestamp keep/remove behavior
- [ ] add unit tests proving `date` and `timestamp` are disjoint
- [ ] add unit tests for the agreed v1 serial matcher patterns
- [ ] add unit tests for style transforms:
  - [ ] `preserve`
  - [ ] `slug`
  - [ ] `uid`
- [ ] add action-level tests for single-file cleanup:
  - [ ] dry run
  - [ ] apply
  - [ ] invalid directory-only flags
- [ ] add action-level tests for directory cleanup:
  - [ ] flat mode
  - [ ] recursive mode
  - [ ] filter interaction
  - [ ] conflict skips
- [ ] run verification:
  - [ ] `bunx tsc --noEmit`
  - [ ] focused `bun test` runs for cleanup-related tests
  - [ ] one or more manual dry-run smoke checks in `examples/playground/`

## Completion Criteria

- `rename cleanup <path>` works for both file and directory paths through one entrypoint
- `--hint` is the documented flag and `--hints` works as an alias
- file mode rejects directory-only options with explicit errors
- supported v1 hint families work deterministically without analyzer assistance
- `date` and `timestamp` are disjoint in behavior
- `serial` behavior is limited to the documented v1 trailing-counter patterns
- `uid` style emits `uid-<token>` with a deterministic lowercase base32 token of length `10`
- the deterministic UID token is derived from `SHA-256("rename-cleanup-uid-v1\\0" + normalized real source path)`
- default `--style` is `preserve`
- dry-run cleanup writes the same replayable rename plan CSV contract used elsewhere
- directory names remain untouched
- tests cover both hint detection and user-facing action behavior

## Related Research

- `docs/researches/research-2026-03-02-rename-cleanup-subcommand-and-pattern-hints.md`
- `docs/researches/research-2026-03-01-rename-timestamp-format-and-template-ux.md`
- `docs/researches/research-2026-02-28-interactive-large-rename-preview-ux-research.md`
- `docs/researches/research-2026-02-27-rename-pattern-router-and-docs-ux-v1.md`
