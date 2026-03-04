---
title: "Rename Common Usage"
created-date: 2026-02-27
modified-date: 2026-03-04
status: completed
agent: codex
---

## Goal

Provide compact, day-to-day rename usage examples for `cdx-chores`.

## Quick Commands

Preview batch rename:

```bash
cdx-chores rename batch ./images --prefix gallery --dry-run
```

Apply a previously generated plan CSV:

```bash
cdx-chores rename apply ./rename-plan-20260227T120000Z-ab12cd34.csv
```

Preview single-file rename:

```bash
cdx-chores rename file ./images/IMG_1024.JPG --prefix gallery --dry-run
```

Preview single-file cleanup:

```bash
cdx-chores rename cleanup ./captures/'Screenshot 2026-03-02 at 4.53.04 PM.png' --hint timestamp --style slug --dry-run
```

Recursive batch with per-directory serial reset:

```bash
cdx-chores rename batch ./photos \
  --recursive \
  --serial-scope directory \
  --serial-order mtime_asc \
  --serial-start 1 \
  --serial-width 3 \
  --dry-run
```

Preview skipped items with per-item detail:

```bash
cdx-chores rename batch ./photos --dry-run --preview-skips detailed
```

Preview recursive cleanup with bounded traversal:

```bash
cdx-chores rename cleanup ./captures --hint date,serial --recursive --max-depth 1 --dry-run
```

## Cleanup Usage

Use `rename cleanup` when the filename already exists and you want to normalize matched fragments instead of constructing a new name from a template.

Examples:

```bash
cdx-chores rename cleanup ./captures/'Meeting Notes 2026-03-02.txt' --hint date --dry-run
cdx-chores rename cleanup ./captures/'scan_003.pdf' --hint serial --style slug --dry-run
cdx-chores rename cleanup ./captures/'report uid-7k3m9q2x4t final.txt' --hint uid --dry-run
cdx-chores rename cleanup ./captures --hint timestamp --timestamp-action remove --dry-run
cdx-chores rename cleanup ./captures --hint date,uid --match-regex '^Meeting|report' --ext txt --dry-run
```

Notes:

- `rename cleanup <path>` auto-detects file vs directory mode.
- interactive `rename cleanup` now has an optional `Suggest cleanup hints with Codex?` step.
- analyzer-assisted cleanup is currently interactive-only; direct CLI `rename cleanup` remains deterministic.
- analyzer-assisted cleanup can now optionally write a grouped advisory CSV report named `rename-cleanup-analysis-<utc-timestamp>Z-<uid>.csv`.
- `--hint` is the documented flag. `--hints` is accepted as a compatibility alias.
- Supported v1 hints are `date`, `timestamp`, `serial`, and `uid`.
- `rename cleanup`, `rename file`, and `rename batch` now share the same recognizable deterministic `uid-<token>` family.
- When multiple hints are supplied, cleanup applies them sequentially in this v1 order:
  - `timestamp`
  - `date`
  - `serial`
  - `uid`
- `--style` defaults to `preserve`; the current supported styles are `preserve` and `slug`.
- `--style` only formats the surviving basename text after cleanup matching. It does not resolve collisions or generate fallback names.
- `serial` cleanup removes only the matched serial fragment and leaves the rest of the basename intact.
- `uid` cleanup removes only the matched `uid-<token>` fragment and leaves surrounding prefix/suffix text intact.
- cleanup detects existing `uid-<token>` fragments case-insensitively for compatibility with older or mixed-case variants.
- `timestamp` and `date` are disjoint:
  - `timestamp` matches date-plus-time fragments
  - `date` matches date-only fragments
- `--timestamp-action keep|remove` only applies when `--hint timestamp` is present.
- `--conflict-strategy` currently supports `skip`, `number`, and `uid-suffix`.
- conflict strategy applies only when the cleaned target collides. The first non-conflicting winner keeps the clean basename.
- Directory cleanup is non-recursive by default. Use `--recursive` and optional `--max-depth` to descend.
- Directory names are not rename targets in v1.
- `skip` keeps the current safe behavior and leaves collided rows as `target conflict`.
- `number` appends `-1`, `-2`, `-3` only for collided targets.
- `uid-suffix` appends `-uid-<token>` only for collided targets.
- Generated `rename-plan-*.csv` dry-run artifacts are ignored as directory cleanup inputs.

### Analyzer-Assisted Playground Fixtures

Use the dedicated analyzer playground root for manual smoke checks:

- `examples/playground/cleanup-analyzer/`
- `examples/playground/cleanup-analyzer/timestamp-family/`
- `examples/playground/cleanup-analyzer/date-family/`
- `examples/playground/cleanup-analyzer/serial-family/`
- `examples/playground/cleanup-analyzer/uid-family/`
- `examples/playground/cleanup-analyzer/mixed-family/`

Fixture script:

```bash
node scripts/generate-cleanup-analyzer-fixtures.mjs seed
node scripts/generate-cleanup-analyzer-fixtures.mjs clean
node scripts/generate-cleanup-analyzer-fixtures.mjs reset --count-per-family 6
```

Notes:

- the generator keeps each family compact for analyzer smoke tests
- `mixed-family/` includes grouped and nested examples for recursive/manual review
- the fixture tree is separate from `examples/playground/huge-logs/`, which is still the conflict-heavy cleanup fixture
- interactive analyzer-assisted cleanup can optionally export grouped analysis rows from these fixtures into a separate advisory CSV artifact

### Cleanup Option Roles

| Surface | What it controls | Current values / scope | What it does not control |
| ------- | ---------------- | ---------------------- | ------------------------ |
| `--hint` | Which cleanup fragments are matched and cleaned | `date`, `timestamp`, `serial`, `uid` | Text formatting or conflict handling |
| `--style` | How surviving text is formatted after cleanup | `preserve`, `slug` | Matching fragments, generating fresh names, resolving conflicts |
| `--timestamp-action` | Whether matched timestamp text is kept or removed | `keep`, `remove` with `--hint timestamp` | Non-timestamp cleanup behavior |
| `--conflict-strategy` | What happens only when cleaned results collide | `skip`, `number`, `uid-suffix` | Matching or normal text formatting |

### Cleanup Intent Map

| If you want to... | Use... | Example |
| ----------------- | ------ | ------- |
| remove serial fragments from existing names | `--hint serial` | `cdx-chores rename cleanup ./logs --hint serial --dry-run` |
| remove uid fragments but keep surrounding text | `--hint uid` | `cdx-chores rename cleanup ./captures --hint uid --dry-run` |
| keep readable surviving text | `--style preserve` | `cdx-chores rename cleanup ./captures --hint uid --style preserve --dry-run` |
| slugify surviving text | `--style slug` | `cdx-chores rename cleanup ./captures --hint serial --style slug --dry-run` |
| remove timestamp text entirely | `--hint timestamp --timestamp-action remove` | `cdx-chores rename cleanup ./captures --hint timestamp --timestamp-action remove --dry-run` |
| change how conflicts are resolved | `--conflict-strategy skip|number|uid-suffix` | `cdx-chores rename cleanup ./logs --hint serial --conflict-strategy number --dry-run` |

### Advanced: Cleanup First, Then Mark the Clean Winner

Use this two-step flow when you want cleanup to minimize change first, then explicitly add a UID marker to the one clean winner.

Example with the collision-heavy playground:

```bash
cdx-chores rename cleanup ./examples/playground/huge-logs --hint serial --conflict-strategy uid-suffix --dry-run
cdx-chores rename file ./examples/playground/huge-logs/app.log --pattern "{stem}-{uid}" --dry-run
```

Notes:

- Step 1 keeps the first non-conflicting cleaned basename unchanged and applies `-uid-<token>` only to collided rows.
- Step 2 is intentionally a targeted `rename file` call on that clean winner.
- Do not use `rename batch --pattern "{stem}-{uid}"` for the second step unless you want to rename every cleaned file again.
- This sequence is safer than adding `{uid}` first and trying to clean `serial` afterward, because current serial cleanup is intentionally biased toward trailing serial fragments.

## Pattern and Template Usage

Preset options in interactive mode:

- `default`: `{prefix}-{timestamp}-{stem}`
- `timestamp-first`: `{timestamp}-{prefix}-{stem}`
- `stem-first`: `{stem}-{timestamp}-{prefix}`
- `custom`: user-defined template

Supported placeholders:

- `{prefix}`
- `{timestamp}` (UTC, backward-compatible alias)
- `{timestamp_local}` (local time, explicit)
- `{timestamp_utc}` (UTC, explicit)
- `{timestamp_local_iso}` (local ISO-like timestamp with numeric offset)
- `{timestamp_utc_iso}` (UTC ISO-like timestamp with `Z`)
- `{timestamp_local_12h}` (local compact `12hr` timestamp)
- `{timestamp_utc_12h}` (UTC compact `12hr` timestamp)
- `{date}`
- `{date_local}`
- `{date_utc}`
- `{stem}`
- `{uid}`
- `{serial...}`

Custom template examples:

```text
{date}-{stem}-{serial}
brand-{timestamp}-{stem}
{uid}-{stem}
{prefix}-{serial_###_start_1_order_mtime_asc}-{stem}
{timestamp_utc_iso}-{stem}
{timestamp_local_12h}-{stem}
```

Notes:

- `--prefix` is optional in CLI mode; omit it for no prefix.
- Empty `prefix` is allowed; separators are normalized.
- `{uid}` is accepted in general rename templates and renders a deterministic `uid-<token>` fragment.
- `{serial...}` parameters are order-insensitive.
- Use at most one `{serial...}` placeholder in a template. Multiple serial placeholders are rejected.
- Supported serial order values: `path_asc`, `path_desc`, `mtime_asc`, `mtime_desc`.
- Serial precedence is: explicit `--serial-*` flag override, then embedded `{serial...}` token value, then built-in default.
- Example: `--pattern '{stem}-{serial_start_3}'` starts at `3`, while `--pattern '{stem}-{serial_start_3}' --serial-start 10` starts at `10`.
- If the template does not include `{serial...}`, `--serial-order`, `--serial-start`, `--serial-width`, and `--serial-scope` have no effect.
- Interactive mode asks serial questions only when the selected template includes `{serial...}`.
- Interactive serial width expects a digit count such as `2` for `01`, not `##`.
- Interactive prefix input is optional; leaving it blank means no prefix.

### Timestamp Timezone Selection

- `{timestamp}` uses UTC and remains backward-compatible.
- `{timestamp_local}` uses local time explicitly.
- `{timestamp_utc}` uses UTC explicitly.
- `{timestamp_local_iso}` uses local time with a numeric offset such as `+0800`.
- `{timestamp_utc_iso}` uses UTC with `Z`.
- `{timestamp_local_12h}` and `{timestamp_utc_12h}` use compact `12hr` output with `AM` / `PM`.
- Use `--timestamp-timezone local|utc` in CLI mode to override `{timestamp}` behavior. Explicit placeholders (`{timestamp_local}`, `{timestamp_utc}`) are never rewritten by this flag.
- In interactive mode, when a selected template contains `{timestamp}`, a timezone question is asked. Templates with explicit placeholders skip this question.
- Precedence: explicit placeholders > CLI `--timestamp-timezone` / interactive prompt > default UTC.

Migration:

- Existing `{timestamp}` users keep current UTC behavior with no changes needed.
- Route A placeholders are explicit opt-in formats for ISO-like and compact `12hr` output.
- New users should prefer explicit placeholders such as `{timestamp_local}`, `{timestamp_utc}`, `{timestamp_local_iso}`, or `{timestamp_utc_iso}`.

Route A examples:

```bash
cdx-chores rename file ./images/IMG_1024.JPG --pattern "{timestamp_utc_iso}-{stem}" --dry-run
cdx-chores rename batch ./images --pattern "{timestamp_local_12h}-{stem}" --dry-run
```

Reference:

- Detailed placeholder matrix: `docs/guides/rename-timestamp-format-matrix.md`

### Plan CSV Naming

- Plan CSV filenames use ISO 8601 UTC with `Z` suffix: `rename-plan-20260301T091530Z-ab12cd34.csv`
- Filenames remain UTC-based even when rename output uses local timestamps.

## Codex Assistant Usage

Common CLI smart-routing path:

```bash
cdx-chores rename batch ./mixed-folder --codex --dry-run
```

Explicit analyzer-only paths:

```bash
cdx-chores rename batch ./docs --codex-docs --dry-run
cdx-chores rename batch ./images --codex-images --dry-run
```

Flag notes:

- `--codex` is the CLI equivalent of interactive `auto`.
- `--codex` routes eligible files by file type after normal rename filtering.
- `--codex-images` and `--codex-docs` override `--codex` when combined.
- unsupported files remain deterministic rename only.
- `--preview-skips summary` is the default compact dry-run preview mode.
- `--preview-skips detailed` keeps the skipped summary and also shows a bounded per-item skipped section.

Interactive mode now asks once for assistant enablement, then one scope selector:

- `auto`
- `images`
- `docs`

`auto` routes based on effective scope (profile/extensions) and supported analyzers.

## Related Guides

- `docs/guides/rename-timestamp-format-matrix.md`
- `docs/guides/rename-scope-and-codex-capability-guide.md`
- `docs/guides/rename-plan-csv-schema.md`
- `README.md`
