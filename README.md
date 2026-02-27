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

Codex-assisted batch rename preview (best-effort with deterministic fallback):

```bash
cdx-chores rename batch ./images --prefix gallery --codex-images --dry-run
```

Apply an exact dry-run snapshot later:

```bash
cdx-chores rename apply ./rename-20260225-214012-a1b2c3d4.csv
```

Recursive image rename with depth limit:

```bash
cdx-chores rename batch ./photos --recursive --max-depth 1 --ext jpg,png,webp --dry-run
```

Custom filename template (placeholders: `{prefix}`, `{timestamp}`, `{date}`, `{date_local}`, `{date_utc}`, `{stem}`, `{serial...}`):

```bash
cdx-chores rename batch ./images --prefix trip --pattern "{date}-{stem}-{serial}" --dry-run
```

Serial template note:

- `--prefix` is optional; omit it for no prefix.
- `{serial...}` in the template enables serial controls.
- Interactive mode asks serial settings only when the chosen template includes `{serial...}`.
- `--serial-width` uses a digit count such as `2` or `4`, not `#`.

Video to GIF (requires `ffmpeg`):

```bash
cdx-chores video gif -i ./clip.mp4 -o ./clip.gif --width 480 --fps 10
```

## Rename Guides

- Common operational usage: `docs/guides/rename-common-usage.md`
- Scope and Codex capability details: `docs/guides/rename-scope-and-codex-capability-guide.md`

## Dependencies

- Required for all commands: Node.js `>= 20` runtime
- Development tooling: Bun
- Optional command dependencies:
  - `pandoc` for `md to-docx`
  - `ffmpeg` for `video` commands

Use `cdx-chores doctor` to check what is available on your machine.
