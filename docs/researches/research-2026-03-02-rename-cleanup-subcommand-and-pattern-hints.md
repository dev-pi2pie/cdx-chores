---
title: "Rename cleanup subcommand and pattern hints"
created-date: 2026-03-02
modified-date: 2026-03-02
status: draft
agent: codex
---

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

## Implications or Recommendations

### Recommendation A. Add `rename cleanup` as a sibling of `rename file` and `rename batch`

Recommended command family:

```bash
cdx-chores rename cleanup ./screenshots --hint timestamp --dry-run
cdx-chores rename cleanup ./screenshots --hint timestamp --style slug --dry-run
```

This should be its own action path rather than a `rename batch --cleanup ...` overload.

Why:

- the mental model is different
- the prompting flow will be different
- the validation surface is different
- the future analyzer-assisted mode will also fit more naturally here

### Recommendation B. Require `--hint` in v1

Recommended v1 contract:

- `--hint <value>` is required
- accepted first values: `date`, `timestamp`, `serial`
- comma-separated or repeated values are allowed

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

For `uid`, the CLI should decide whether the identifier is:

- random
- time-sortable
- or derived from a deterministic hash

That needs a separate small design choice, but it should still remain explicit and documented.

### Recommendation E. Reuse the current rename plan CSV contract

Cleanup results should still:

- preview safely
- write the same replayable rename plan artifact shape
- apply through `rename apply`

That preserves one operational model across rename features.

## Proposed Command Shape

Conservative v1:

```bash
cdx-chores rename cleanup ./screenshots --hint timestamp --dry-run
cdx-chores rename cleanup ./photos --hint serial --style preserve --dry-run
cdx-chores rename cleanup ./captures --hint timestamp,date --style slug --dry-run
```

Possible later analyzer-assisted shape:

```bash
cdx-chores rename cleanup ./captures --analyze --dry-run
```

Possible interactive prompt sequence:

1. Choose target path
2. Choose hint families
3. Choose output style
4. Preview planned renames
5. Save/apply through the existing plan flow

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
-> 01jnxxxxxxx.png
```

Serial hint plus slug style:

```text
scan 001 final.pdf
-> scan-final-001.pdf
```

These are example directions, not final output contracts.

## Preferred Direction

Current preferred direction:

- add a new `rename cleanup` subcommand
- require explicit hint families in v1
- keep v1 deterministic
- support `preserve`, `slug`, and `uid` output styles
- reuse the current rename plan/apply artifact flow
- defer analyzer-assisted naming-pattern inference until after the deterministic contract is stable

## Open Questions

1. Should `uid` be random UUID-derived, ULID-like, or hash-derived from the original filename/path?
2. Should a matched timestamp fragment be preserved in normalized form by default, or removed unless explicitly requested?
3. Should macOS-style labels like `Screenshot` and `Screen Recording` be treated as removable boilerplate under the timestamp hint, or as meaningful surviving words?
4. Should cleanup support recursive directory traversal in v1, or start with flat-directory behavior only?

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
