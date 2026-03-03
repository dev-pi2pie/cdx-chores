---
title: "Rename Common Usage"
created-date: 2026-02-27
modified-date: 2026-03-03
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
- `--hint` is the documented flag. `--hints` is accepted as a compatibility alias.
- Supported v1 hints are `date`, `timestamp`, `serial`, and `uid`.
- `uid` in cleanup is a hint/style concept, not a general rename template placeholder. `{uid}` is not supported in `rename file` / `rename batch` `--pattern` templates today.
- When multiple hints are supplied, cleanup applies them sequentially in this v1 order:
  - `timestamp`
  - `date`
  - `serial`
  - `uid`
- `--style` defaults to `preserve`.
- `preserve` keeps readable spaces, `slug` uses kebab-case, and `uid` emits `uid-<token>` while preserving the original extension.
- `uid-<token>` output uses a deterministic lowercase Crockford-style base32 token of length `10`.
- cleanup detects existing `uid-<token>` fragments case-insensitively for compatibility with older or mixed-case variants.
- `timestamp` and `date` are disjoint:
  - `timestamp` matches date-plus-time fragments
  - `date` matches date-only fragments
- `--timestamp-action keep|remove` only applies when `--hint timestamp` is present.
- Directory cleanup is non-recursive by default. Use `--recursive` and optional `--max-depth` to descend.
- Directory names are not rename targets in v1.
- Generated `rename-plan-*.csv` dry-run artifacts are ignored as directory cleanup inputs.

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
- `{serial...}`

Custom template examples:

```text
{date}-{stem}-{serial}
brand-{timestamp}-{stem}
{prefix}-{serial_###_start_1_order_mtime_asc}-{stem}
{timestamp_utc_iso}-{stem}
{timestamp_local_12h}-{stem}
```

Notes:

- `--prefix` is optional in CLI mode; omit it for no prefix.
- Empty `prefix` is allowed; separators are normalized.
- `{uid}` is not a supported template placeholder in current rename patterns. UID-style naming is currently available only through `rename cleanup --style uid`.
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
