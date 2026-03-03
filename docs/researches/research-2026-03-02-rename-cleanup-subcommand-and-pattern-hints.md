---
title: "Rename cleanup subcommand and pattern hints"
created-date: 2026-03-02
modified-date: 2026-03-03
status: draft
agent: codex
---

## Historical Note

This research captures the early cleanup option exploration.
Later follow-up work removed cleanup `--style uid`, narrowed `--style` to `preserve` / `slug`, and introduced collision-only conflict strategies instead.

## Goal

Define a new `rename cleanup` command family that can normalize messy existing filenames by targeting known pattern fragments such as dates, timestamps, and serial-like counters, while deciding how much of that flow should be deterministic versus analyzer-assisted.

## Milestone Goal

Choose a safe first scope for `rename cleanup` that:

- reuses the existing rename plan/apply safety model
- handles common machine-generated names such as macOS screenshot / recording timestamps
- supports cleaner output styles such as slugified names or UID-based names
- avoids overloading the current rename template system with a second, different problem

## Key Findings

### 1. `rename cleanup` is a different workflow from `rename batch` templating

Current `rename` functionality is centered on generating a new target name from:

- a prefix
- timestamp/date placeholders
- stem
- serial placeholders
- optional Codex title suggestion for supported file types

That is a constructive naming workflow.

`rename cleanup` is different:

- start from an existing filename
- detect noisy or machine-generated fragments
- selectively normalize or remove those fragments
- optionally restyle the remaining name

Implication:

- `rename cleanup` should be a separate subcommand, not just another `--pattern` mode bolted onto `rename batch`

### 2. The existing plan/apply pipeline is the right safety contract

The repo already has a strong rename safety boundary:

- compute planned renames
- preview / write plan CSV
- optionally apply later through `rename apply`

The current rename implementation boundary now lives under `src/cli/actions/rename/`, with separate `batch.ts`, `file.ts`, and `apply.ts` entrypoints over shared helper modules.

That same model fits cleanup well.

Recommended rule:

- `rename cleanup` should produce the same kind of replayable rename plan artifact as other rename flows
- `rename apply` should remain the only write step for batch cleanup unless the user explicitly chooses immediate apply later

Implication:

- cleanup can be added without inventing a second rename-application contract

### 3. Hints map naturally to the existing placeholder vocabulary, but they should not behave like output templates

The proposed hint names:

- `{date}`
- `{timestamp}`
- `{serial}`

fit the mental model users already have from rename templates.

But they play a different role here:

- in `rename batch`, placeholders describe what to output
- in `rename cleanup`, hints describe what to detect and normalize in the input filename

That distinction matters because detection can be ambiguous.

Implication:

- keep the shared token vocabulary for familiarity
- document clearly that cleanup hints are input-pattern selectors, not output-template fragments

### 4. Hints should be required in v1

The user suggestion is directionally right: hinting narrows the cleanup operation to a known pattern family.

That is important because filename cleanup is easy to overreach on.

Examples:

- `2026-03-02 at 4.53.04 PM`
- `IMG_1234`
- `Screenshot 2026-03-02 at 4.53.04 PM`
- `Screen Recording 2026-03-02 at 4.53.04 PM`

Without a hint, the command has to infer which tokens are noise versus intentional content.
That is risky for a file-renaming CLI.

Recommended v1 rule:

- require at least one hint family
- allow multiple hints, for example `timestamp,date`
- keep any future automatic analysis opt-in

This gives the command a safer default posture.

### 5. Analyzer-assisted pattern detection should be a follow-up, not the baseline

The idea of letting Codex analyze current naming patterns is plausible, but it is a different feature layer:

- collect filename examples
- infer common fixed and variable segments
- propose likely cleanup rules
- ask the user to confirm

That can be useful in interactive mode, especially for mixed folders.
But it is not necessary to land the first deterministic cleanup pass.

Implication:

- v1 should be deterministic and hint-driven
- analyzer-assisted suggestion can later become:
  - an interactive helper
  - or a `--analyze` / `--suggest-hints` mode

### 6. macOS screenshot and recording names are a strong design anchor for the timestamp hint family

The example:

- `2026-03-02 at 4.53.04 PM`

captures a real pattern family seen in Apple-generated filenames, often combined with leading labels such as:

- `Screenshot`
- `Screen Recording`

This is a good anchor because it exposes the kinds of cleanup decisions the command needs:

- should `at` be removed?
- should dotted time be normalized to colon-free compact time?
- should `PM` be converted to 24-hour output?
- should the timestamp be kept, reformatted, or dropped?

Implication:

- the first timestamp-hint contract should include normalization rules for at least one well-defined family of human-readable timestamp input

### 7. Output style should be explicit and small at first

There are at least three output-style directions in the request:

- preserve existing words but clean the noisy fragment
- slugify into a sane kebab-case filename
- generate UID-like names

The repository already has a small, deterministic slugifier in `src/utils/slug.ts`.
It also already uses short UUID slices for plan artifact naming in `src/cli/rename-plan-csv.ts`.

That suggests a practical first style set:

- `preserve`
- `slug`
- `uid`

Where:

- `preserve` keeps remaining words as close as possible to the input, only normalizing the targeted fragments and separators
- `slug` applies the existing kebab-case cleanup style
- `uid` generates a unique stable-looking basename and preserves the original extension

Implication:

- do not start with many naming styles
- make the style explicit and predictable

### 8. Cleanup should stay deterministic even when timestamps are reformatted

The command will need a clear decision about whether a matched timestamp-like fragment is:

- removed entirely
- preserved but normalized
- converted into the current rename timestamp shape

The safest initial posture is:

- match the hinted pattern
- normalize it into one canonical output shape
- keep the transform deterministic and documented

Example:

- input: `Screenshot 2026-03-02 at 4.53.04 PM.png`
- hint: `{timestamp}`
- style: `slug`
- possible canonical result: `screenshot-20260302-165304.png`

This keeps the timestamp signal while making the filename shell-friendly and consistent.

### 9. `--hint` should stay singular and repeatable

The current CLI already uses singular repeatable selectors such as:

- `--ext`
- `--skip-ext`

That makes `--hint` a better fit than `--hints`.

Recommended rule:

- keep the flag name as `--hint`
- accept `--hints` as a compatibility alias for user ergonomics and typo tolerance
- allow repeated usage, for example `--hint timestamp --hint date`
- also allow comma-separated input if that matches the existing option collector style

Implication:

- the flag stays consistent with the rest of the CLI
- users who instinctively type `--hints` do not get blocked
- the command surface stays simple without introducing a second pluralized convention

### 10. Detection and transformation should stay separate

The user intent behind:

- detect timestamp-like input
- keep it
- normalize it
- or remove it

is real, but that should not be encoded into the hint itself.

The research already treats hints as input selectors.
That should remain true.

Recommended rule:

- `--hint timestamp` means "look for timestamp-family fragments"
- whether the matched fragment is kept or removed should be controlled by a separate option

Practical v1 shape:

- default matched timestamp behavior: preserve in canonical normalized form
- explicit removal: a dedicated option such as `--timestamp-action remove`
- interactive mode should ask the keep-vs-remove question separately from output style

Implication:

- hints stay easy to reason about
- output behavior remains explicit instead of overloading one flag with two jobs

### 10a. `date` and `timestamp` should be disjoint in v1

The temporal hint families need a clean boundary so users can predict what will match.

Recommended v1 rule:

- `timestamp` matches date-plus-time fragments
- `date` matches date-only fragments
- a full timestamp should match `timestamp`, not `date`

Practical examples:

- `2026-03-02 at 4.53.04 PM` -> `timestamp`
- `2026-03-02` -> `date`

Implication:

- users can choose the narrower temporal cleanup they intend
- mixed temporal behavior does not depend on hidden overlap rules

### 10b. `serial` needs concrete v1 patterns

`serial` should not mean "anything numeric".
The first version needs a small explicit pattern family.

Recommended v1 serial patterns:

- standalone zero-padded counters such as `001`, `0023`, `000045`
- parenthesized copy-style counters such as `(1)`, `(2)`, `(12)`
- trailing dash/space/underscore counters such as `-01`, `_02`, ` 003` when they appear as a terminal fragment

Explicitly out of scope for v1:

- camera-style stems such as `IMG_1234`
- camera-style stems such as `DSC01234`
- arbitrary embedded numbers that are not acting as a trailing serial fragment

Implication:

- implementers have a narrow rule set to build and test
- users are less likely to see surprising numeric cleanup

### 11. `uid` output should prefer an explicit marker-based shape

Reusing the current rename-plan artifact feel is a good instinct because it reduces mental burden.
But cleanup has an additional requirement:

- generated IDs should be easy to detect and remove later

That matters more here than visual similarity to the existing rename-plan artifact naming.

Recommended rule:

- prefer a marker-based file UID shape such as `uid-<token>`
- do not use a fresh random UUID slice as the cleanup basename default
- derive `<token>` deterministically so repeated planning yields the same target
- use a stable, regex-friendly alphabet and fixed length

Practical example direction:

- `uid-7k3m9q2x4t.png`

Where:

- the `uid-` marker makes the fragment easy to detect and clean safely
- the token is derived deterministically from stable source identity rather than new randomness per run

Implication:

- the user gets a compact and recognizable shape
- the cleanup flow stays predictable
- advanced future modes can still add explicit `timestamp+uid`, `random`, `ulid`, or hash-algorithm variants later

Recommended token contract:

- alphabet: Crockford-style base32 without ambiguous letters
- output casing: lowercase
- allowed output characters: `0-9`, `a-h`, `j-k`, `m-n`, `p-t`, `v-z`
- default token length: `10`

Why this contract:

- lowercase base32 is compact, shell-friendly, and visually calmer in filenames
- excluding ambiguous letters such as `I`, `L`, `O`, and `U` improves readability
- length `10` gives more collision headroom than `8` while staying short enough for filenames

Recommended example:

- `uid-7k3m9q2x4t.png`

Recommended regex anchor:

- `uid-[0-9a-hjkmnp-tv-z]{10}`

Recommended detection rule:

- UID cleanup detection should be case-insensitive so previously generated mixed-case variants are still recognized safely

### 11a. Candidate `uid` formats should optimize for detectability, not just brevity

If cleanup is expected to detect and optionally remove generated `uid` fragments later, the shape should be intentionally recognizable.

Three practical candidate directions:

1. shortest

- shape: `<token>`
- example: `7K3M9Q2X`
- pros:
  - shortest visible basename
  - easy to read and copy
- cons:
  - weak regex detectability without context
  - higher false-positive risk
  - not a good cleanup anchor by itself

2. easiest to regex-clean

- shape: `uid-<token>`
- example: `uid-7k3m9q2x4t`
- pros:
  - trivial to detect and remove safely
  - low false-positive risk
  - explicit to users and future tooling
- cons:
  - slightly longer
  - less visually similar to current rename-plan artifacts

3. deterministic and preview-stable

- shape: `<timestamp>-uid-<token>`
- example: `20260303T101530Z-uid-7k3m9q2x4t`
- pros:
  - easy regex detection
  - stable preview/apply behavior when `<token>` is hash-derived
  - preserves sortability and some human context
- cons:
  - longest of the three
  - may feel redundant when the file already has a meaningful timestamp elsewhere

Recommended direction:

- for cleanup-generated file UIDs, prefer a marker-based format over bare short hex
- make `uid-<token>` the default shape
- allow `<timestamp>-uid-<token>` later as an optional style when timestamp context is important

Example safe regex anchors:

- `uid-[0-9a-hjkmnp-tv-z]{10}`
- `\\d{8}T\\d{6}Z-uid-[0-9a-hjkmnp-tv-z]{10}`

Implication:

- future cleanup can target generated IDs precisely
- the design avoids relying on ambiguous bare hex fragments such as `[a-f0-9]{8}`

### 12. macOS labels should survive, and conflicts should be handled by the planner

Labels such as:

- `Screenshot`
- `Screen Recording`

should be treated as meaningful surviving words, not removable boilerplate.

The real issue is collision risk after timestamp cleanup.
That should not be delegated to the operating system.

Recommended rule:

- preserve those labels by default
- detect name collisions during planning
- default conflict behavior should be to skip conflicting rows with an explicit reason
- future options may add explicit conflict strategies such as appending a serial or UID

Implication:

- cleanup preserves recognizable file intent
- conflict handling stays inside the existing preview/apply safety model

### 13. Cleanup should accept a path and auto-detect file versus directory

The follow-up question about scope is important.
Directory-only cleanup would be awkward because the same cleanup logic clearly applies to one file too.

Recommended v1 rule:

- `rename cleanup <path>` accepts either a file or a directory
- when the path is a file, plan cleanup for that one file
- when the path is a directory, run batch cleanup for files inside it
- `--recursive` remains an explicit toggle for directory traversal
- directory names themselves are not renamed in v1

Implication:

- the command keeps one cleanup mental model
- users do not have to choose between separate `file` and `batch` variants for the same operation
- recursive traversal is supported without expanding scope into directory renaming

### 14. File mode and directory mode should have explicit option behavior

Auto-detecting the path type is useful, but only if the CLI contract stays strict.

Recommended v1 rule:

- when `<path>` resolves to a file:
  - cleanup plans exactly one rename candidate
  - `--recursive` and `--max-depth` are invalid
  - directory-scoped filtering options should be invalid rather than silently ignored
  - dry run writes the standard rename plan CSV with one executable row
  - non-dry-run applies the one rename immediately
- when `<path>` resolves to a directory:
  - cleanup evaluates files inside that directory only by default
  - subdirectories are traversed only with `--recursive`
  - directory entries themselves are never rename targets in v1
  - preview and dry-run behavior follow the current batch rename safety model

Recommended directory-scoped options:

- `--recursive`
- `--max-depth`
- `--match-regex`
- `--skip-regex`
- `--ext`
- `--skip-ext`
- `--preview-skips`

Implication:

- the command remains predictable in both modes
- invalid option combinations fail early instead of being half-applied
- the implementation can share one entrypoint without blurring single-file and batch semantics

## Implications or Recommendations

### Recommendation A. Add a single `rename cleanup <path>` entrypoint

Recommended command family:

```bash
cdx-chores rename cleanup ./screenshots --hint timestamp --dry-run
cdx-chores rename cleanup ./screenshots/shot.png --hint timestamp --dry-run
cdx-chores rename cleanup ./screenshots --hint timestamp --style slug --dry-run
```

This should be its own action path rather than a `rename batch --cleanup ...` overload.
The command should auto-detect whether `<path>` is a file or directory.

Why:

- the mental model is different
- the prompting flow will be different
- the validation surface is different
- the same cleanup rules should work for one file or many files
- the future analyzer-assisted mode will also fit more naturally here

### Recommendation B. Require `--hint` in v1

Recommended v1 contract:

- `--hint <value>` is required
- accepted first values: `date`, `timestamp`, `serial`
- repeated or comma-separated values are allowed
- keep the flag name singular as `--hint`, not `--hints`
- accept `--hints` as a parsing alias, but document only `--hint`

This keeps the transform intentionally scoped and lowers the risk of destructive "cleanup" guesses.

### Recommendation C. Keep v1 deterministic and non-Codex by default

Recommended v1 behavior:

- no automatic pattern inference
- no silent AI-assisted cleanup
- optional future interactive suggestion mode may propose hints, but must still resolve to explicit user-confirmed rules

This is a safer fit for a rename command whose main trust boundary is predictability.

### Recommendation D. Start with three output styles

Recommended initial styles:

- `preserve`
- `slug`
- `uid`

Suggested semantics:

- `preserve`: keep surviving words and order as much as possible, just clean the targeted fragments and separators
- `slug`: route the surviving content through `slugifyName(...)`
- `uid`: replace the basename with a generated identifier and keep the extension

Recommended default:

- default `--style` should be `preserve`

For `uid`, the CLI should decide whether the identifier is:

- visually similar to current rename-plan identifiers
- but stable across repeated dry runs

The practical v1 answer is:

- use `uid-<token>` as the default shape
- derive the token deterministically rather than generating fresh randomness per run
- use lowercase Crockford-style base32 with a default length of `10`

Future advanced options can expose explicit `random`, `ulid`, or hash-family variants later.

If timestamp context is useful later, `<timestamp>-uid-<token>` is still a compatible extension path.

### Recommendation E. Preserve normalized timestamps by default, remove them only explicitly

Recommended v1 contract:

- if `--hint timestamp` matches a supported timestamp family, preserve it in canonical normalized form by default
- if the user wants to remove it, require an explicit option
- do not encode keep-vs-remove behavior into the hint name itself

This keeps cleanup deterministic while avoiding a destructive default.

### Recommendation F. Reuse the current rename plan CSV contract

Cleanup results should still:

- preview safely
- write the same replayable rename plan artifact shape
- apply through `rename apply`

That preserves one operational model across rename features.

### Recommendation G. Preserve macOS screenshot / recording labels by default

Recommended v1 contract:

- keep `Screenshot` and `Screen Recording` as surviving words
- handle resulting collisions in the planner, not by relying on OS auto-renaming
- default conflicting rows to skipped-plan output with an explicit reason

## Proposed Command Shape

Conservative v1:

```bash
cdx-chores rename cleanup ./screenshots --hint timestamp --dry-run
cdx-chores rename cleanup ./screenshots/shot.png --hint timestamp --dry-run
cdx-chores rename cleanup ./photos --hint serial --style preserve --dry-run
cdx-chores rename cleanup ./captures --hint timestamp,date --style slug --dry-run
cdx-chores rename cleanup ./captures --hint timestamp --timestamp-action remove --dry-run
cdx-chores rename cleanup ./captures --hint timestamp --recursive --max-depth 1 --dry-run
cdx-chores rename cleanup ./captures --hints timestamp --dry-run
```

Possible later analyzer-assisted shape:

```bash
cdx-chores rename cleanup ./captures --analyze --dry-run
```

Possible interactive prompt sequence:

1. Choose target path
2. Choose hint families
3. Choose matched-fragment action for supported families such as timestamp keep vs remove
4. Choose output style
5. Preview planned renames
6. Save/apply through the existing plan flow

## Example Transform Directions

Timestamp hint plus slug style:

```text
Screenshot 2026-03-02 at 4.53.04 PM.png
-> screenshot-20260302-165304.png
```

Timestamp hint plus preserve style:

```text
Screen Recording 2026-03-02 at 4.53.04 PM.mov
-> Screen Recording 20260302-165304.mov
```

Timestamp hint plus uid style:

```text
Screenshot 2026-03-02 at 4.53.04 PM.png
-> uid-7k3m9q2x4t.png
```

Serial hint plus slug style:

```text
scan 001 final.pdf
-> scan-final-001.pdf
```

These are example directions, not final output contracts.

## Preferred Direction

Current preferred direction:

- add a new `rename cleanup <path>` subcommand with file/directory auto-detect
- require explicit hint families in v1
- keep v1 deterministic
- support `preserve`, `slug`, and `uid` output styles
- default `--style` to `preserve`
- preserve normalized timestamps by default and remove them only explicitly
- preserve macOS screenshot / recording labels by default
- support recursive directory traversal behind an explicit toggle
- use `uid-<token>` as the default UID style, with a deterministic lowercase base32 token of length `10`
- reuse the current rename plan/apply artifact flow
- defer analyzer-assisted naming-pattern inference until after the deterministic contract is stable
- defer `--hint uid` cleanup detection from v1 unless a stronger immediate use case appears

## Resolved Decisions

1. `uid` should use the default shape `uid-<token>`, where `<token>` is a deterministic lowercase Crockford-style base32 token of length `10`, stable across repeated previews rather than freshly random per run.
2. A matched timestamp fragment should be preserved in normalized form by default and removed only when the user explicitly requests removal.
3. macOS-style labels such as `Screenshot` and `Screen Recording` should survive cleanup by default.
4. Cleanup should support recursive directory traversal in v1 behind an explicit `--recursive` toggle.
5. Cleanup should accept either a file or directory path, but v1 should still only rename files, not directories.
6. File mode and directory mode should reject incompatible option combinations instead of silently ignoring directory-scoped flags for single-file cleanup.
7. `date` and `timestamp` should be disjoint in v1: `date` is date-only, `timestamp` is date-plus-time.
8. `serial` should start with a small explicit trailing-counter pattern family, not a broad numeric matcher.
9. `--style` should default to `preserve`.
10. `--hint uid` should be deferred from v1 unless a stronger immediate use case appears.

## Related Plans

- `docs/plans/plan-2026-03-03-rename-cleanup-v1-implementation.md`

## Related Research

- `docs/researches/research-2026-03-01-rename-timestamp-format-and-template-ux.md`
- `docs/researches/research-2026-02-28-interactive-large-rename-preview-ux-research.md`
- `docs/researches/research-2026-02-27-rename-pattern-router-and-docs-ux-v1.md`

## References

- `src/command.ts`
- `src/cli/actions/rename/index.ts`
- `src/cli/actions/rename/batch.ts`
- `src/cli/actions/rename/apply.ts`
- `src/cli/rename-template.ts`
- `src/cli/rename-plan-csv.ts`
- `src/utils/slug.ts`
- `docs/guides/rename-common-usage.md`
