# cdx-chores

A CLI tool for daily chores automation and file-processing workflows.

Current launch-phase focus:

- interactive mode + nested CLI commands
- `doctor` dependency/capability checks
- data conversions (`json <-> csv`)
- `md -> docx` via `pandoc`
- batch/file rename with safe preview (`--dry-run`)
- ffmpeg-backed video command wrappers

## Quick Start

Install dependencies:

```bash
bun install
```

Build the package:

```bash
bun run build
```

Link the CLI locally so `cdx-chores` is available on your PATH:

```bash
npm link
```

Check the command:

```bash
cdx-chores --help
```

Start interactive mode (default when no args):

```bash
cdx-chores
```

## Examples

Doctor (text):

```bash
cdx-chores doctor
```

Doctor (JSON):

```bash
cdx-chores doctor --json
```

JSON to CSV:

```bash
cdx-chores data json-to-csv -i ./input.json -o ./output.csv
```

CSV to JSON:

```bash
cdx-chores data csv-to-json -i ./input.csv -o ./output.json --pretty
```

Markdown to DOCX (requires `pandoc`):

```bash
cdx-chores md to-docx -i ./notes.md -o ./notes.docx
```

Markdown frontmatter to JSON (default wrapper output):

```bash
cdx-chores md frontmatter-to-json -i ./notes.md --pretty
```

Batch rename preview:

```bash
cdx-chores rename batch ./images --prefix gallery --dry-run
```

Single-file rename preview (replayable CSV snapshot):

```bash
cdx-chores rename file ./images/IMG_1024.JPG --prefix gallery --dry-run
```

Cleanup an existing filename by normalizing a matched timestamp:

```bash
cdx-chores rename cleanup ./captures/'Screenshot 2026-03-02 at 4.53.04 PM.png' --hint timestamp --style slug --dry-run
```

Cleanup a directory with mixed hint families and recursive traversal:

```bash
cdx-chores rename cleanup ./captures --hint date,serial,uid --recursive --max-depth 1 --dry-run
```

Codex-assisted batch rename preview (auto-routing by eligible file type):

```bash
cdx-chores rename batch ./images --prefix gallery --codex --dry-run
```

Apply an exact dry-run snapshot later:

```bash
cdx-chores rename apply ./rename-plan-20260225T214012Z-a1b2c3d4.csv
```

Recursive image rename with depth limit:

```bash
cdx-chores rename batch ./photos --recursive --max-depth 1 --ext jpg,png,webp --dry-run
```

Custom filename template (placeholders: `{prefix}`, `{timestamp}`, `{timestamp_local}`, `{timestamp_utc}`, `{timestamp_local_iso}`, `{timestamp_utc_iso}`, `{timestamp_local_12h}`, `{timestamp_utc_12h}`, `{date}`, `{date_local}`, `{date_utc}`, `{stem}`, `{serial...}`):

```bash
cdx-chores rename batch ./images --prefix trip --pattern "{date}-{stem}-{serial}" --dry-run
```

Template and serial notes:

- `--prefix` is optional; omit it for no prefix.
- `--codex` is the common smart-routing flag for CLI mode.
- `--codex-images` and `--codex-docs` are explicit analyzer overrides.
- `{uid}` is not a supported `--pattern` placeholder today.
- `{serial...}` in the template enables serial controls.
- Interactive mode asks serial settings only when the chosen template includes `{serial...}`.
- `--serial-width` uses a digit count such as `2` or `4`, not `#`.

Timestamp placeholders:

- `{timestamp}` uses UTC (backward-compatible default).
- `{timestamp_local}` uses local time explicitly.
- `{timestamp_utc}` uses UTC explicitly.
- `{timestamp_local_iso}` uses local time with a numeric offset such as `+0800`.
- `{timestamp_utc_iso}` uses UTC with `Z`.
- `{timestamp_local_12h}` and `{timestamp_utc_12h}` use compact `12hr` output with `AM` / `PM`.
- `--timestamp-timezone local|utc` overrides `{timestamp}` only; explicit placeholders are never rewritten.
- Existing `{timestamp}` users do not need to change anything.
- Route A placeholders are explicit opt-in formats.
- New users should prefer explicit placeholders such as `{timestamp_local}`, `{timestamp_utc}`, `{timestamp_local_iso}`, or `{timestamp_utc_iso}`.

Route A examples:

```bash
cdx-chores rename file ./images/IMG_1024.JPG --pattern "{timestamp_utc_iso}-{stem}" --dry-run
cdx-chores rename batch ./images --pattern "{timestamp_local_12h}-{stem}" --dry-run
```

Video to GIF (requires `ffmpeg`):

```bash
cdx-chores video gif -i ./clip.mp4 -o ./clip.gif --width 480 --fps 10
```

Video resize with aspect-ratio-preserving scale (requires `ffmpeg`):

```bash
cdx-chores video resize -i ./clip.mp4 -o ./clip-small.mp4 --scale 0.5
```

Video resize with explicit dimensions override:

```bash
cdx-chores video resize -i ./clip.mp4 -o ./clip-720p.mp4 --width 1280 --height 720
```

## Rename Guides

- Common operational usage: `docs/guides/rename-common-usage.md`
- Timestamp format matrix: `docs/guides/rename-timestamp-format-matrix.md`
- Scope and Codex capability details: `docs/guides/rename-scope-and-codex-capability-guide.md`

Cleanup notes:

- `rename cleanup <path>` accepts either a single file or a directory.
- `--hint` is the canonical flag; `--hints` is accepted as an alias.
- Supported v1 cleanup hint families are `date`, `timestamp`, `serial`, and `uid`.
- `uid` in cleanup is a cleanup-only hint family for now, not a general rename template placeholder.
- When multiple hint families are selected, cleanup applies them sequentially in v1 order: `timestamp`, then `date`, then `serial`, then `uid`.
- `--style` defaults to `preserve`; the current supported values are `preserve` and `slug`.
- `--style` only formats the surviving basename text after cleanup matching. It does not resolve collisions or synthesize fallback names.
- `serial` cleanup removes only the matched serial fragment and keeps the rest of the basename intact.
- `uid` cleanup removes only the matched `uid-<token>` fragment and keeps surrounding prefix/suffix text intact.
- cleanup detects existing uid fragments case-insensitively for compatibility.
- `timestamp` and `date` are intentionally disjoint: full date-plus-time fragments match `timestamp`, while date-only fragments match `date`.
- `--timestamp-action keep|remove` applies only when `--hint timestamp` is active.
- `--conflict-strategy` currently supports `skip`, `number`, and `uid-suffix`.
- conflict strategy applies only when the cleaned target collides. The first non-conflicting winner keeps the clean basename.
- Directory cleanup is flat by default; use `--recursive` to descend into subdirectories. Directories themselves are not rename targets in v1.
- `skip` keeps the current safe behavior and leaves collided rows as `target conflict`.
- `number` appends `-1`, `-2`, `-3` only for collided targets.
- `uid-suffix` appends `-uid-<token>` only for collided targets.
- Generated `rename-plan-*.csv` dry-run artifacts are ignored as cleanup inputs during directory scans.
- interactive analyzer-assisted cleanup can optionally write a separate advisory report named `rename-cleanup-analysis-<utc-timestamp>Z-<uid>.csv`.

Cleanup option comparison:

| Surface | Current role | Current values / scope |
| ------- | ------------ | ---------------------- |
| `--hint` | choose fragment families to clean | `date`, `timestamp`, `serial`, `uid` |
| `--style` | format surviving text after cleanup | `preserve`, `slug` |
| `--timestamp-action` | keep or remove matched timestamp text | `keep`, `remove` with `--hint timestamp` |
| `--conflict-strategy` | resolve collisions only when the cleaned target conflicts | `skip`, `number`, `uid-suffix` |

## Video Guides

- Resize usage and UX: `docs/guides/video-resize-usage-and-ux.md`

## Dependencies

- Required for all commands: Node.js `>= 20` runtime
- Development tooling: Bun
- Optional command dependencies:
  - `pandoc` for `md to-docx`
  - `ffmpeg` for `video` commands

Use `cdx-chores doctor` to check what is available on your machine.
