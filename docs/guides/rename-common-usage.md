---
title: "Rename Common Usage"
created-date: 2026-02-27
modified-date: 2026-02-28
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
cdx-chores rename apply ./rename-20260227-120000-ab12cd34.csv
```

Preview single-file rename:

```bash
cdx-chores rename file ./images/IMG_1024.JPG --prefix gallery --dry-run
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

## Pattern and Template Usage

Preset options in interactive mode:

- `default`: `{prefix}-{timestamp}-{stem}`
- `timestamp-first`: `{timestamp}-{prefix}-{stem}`
- `stem-first`: `{stem}-{timestamp}-{prefix}`
- `custom`: user-defined template

Supported placeholders:

- `{prefix}`
- `{timestamp}`
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
```

Notes:

- `--prefix` is optional in CLI mode; omit it for no prefix.
- Empty `prefix` is allowed; separators are normalized.
- `{serial...}` parameters are order-insensitive.
- Use at most one `{serial...}` placeholder in a template. Multiple serial placeholders are rejected.
- Supported serial order values: `path_asc`, `path_desc`, `mtime_asc`, `mtime_desc`.
- Serial precedence is: explicit `--serial-*` flag override, then embedded `{serial...}` token value, then built-in default.
- Example: `--pattern '{stem}-{serial_start_3}'` starts at `3`, while `--pattern '{stem}-{serial_start_3}' --serial-start 10` starts at `10`.
- If the template does not include `{serial...}`, `--serial-order`, `--serial-start`, `--serial-width`, and `--serial-scope` have no effect.
- Interactive mode asks serial questions only when the selected template includes `{serial...}`.
- Interactive serial width expects a digit count such as `2` for `01`, not `##`.
- Interactive prefix input is optional; leaving it blank means no prefix.

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

- `docs/guides/rename-scope-and-codex-capability-guide.md`
- `README.md`
