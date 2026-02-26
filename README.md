# cdx-chores

A CLI tool for daily chores automation and file-processing workflows.

Current launch-phase focus:

- interactive mode + nested CLI commands
- `doctor` dependency/capability checks
- basic data conversions (`json <-> csv`)
- `md -> docx` via `pandoc`
- batch rename with safe preview (`--dry-run`)
- ffmpeg-backed video command wrappers

## Quick Start

Install dependencies:

```bash
bun install
```

Build the package (generates embedded version + bundles with `tsdown`):

```bash
bun run build
```

Run from source (development):

```bash
bun run src/bin.ts --help
```

Start interactive mode (default when no args):

```bash
bun run src/bin.ts
```

Run the built CLI bundle:

```bash
node dist/esm/bin.mjs --help
```

## Examples

Doctor (text):

```bash
bun run src/bin.ts doctor
```

Doctor (JSON):

```bash
bun run src/bin.ts doctor --json
```

JSON to CSV:

```bash
bun run src/bin.ts data json-to-csv -i ./input.json -o ./output.csv
```

CSV to JSON:

```bash
bun run src/bin.ts data csv-to-json -i ./input.csv -o ./output.json --pretty
```

Markdown to DOCX (requires `pandoc`):

```bash
bun run src/bin.ts md to-docx -i ./notes.md -o ./notes.docx
```

Markdown frontmatter to JSON (default wrapper output):

```bash
bun run src/bin.ts md frontmatter-to-json -i ./notes.md --pretty
```

Markdown frontmatter to JSON (data-only for pipelines):

```bash
bun run src/bin.ts md frontmatter-to-json -i ./notes.md --data-only
```

Batch rename preview:

```bash
bun run src/bin.ts rename batch ./images --prefix gallery --dry-run
```

Single-file rename preview (replayable CSV snapshot):

```bash
bun run src/bin.ts rename file ./images/IMG_1024.JPG --prefix gallery --dry-run
```

Codex-assisted batch rename preview (best-effort with deterministic fallback):

```bash
bun run src/bin.ts rename batch ./images --prefix gallery --codex --dry-run
```

Apply an exact dry-run snapshot later:

```bash
bun run src/bin.ts rename apply ./rename-20260225-214012-a1b2c3d4.csv
```

Recursive image rename with depth limit:

```bash
bun run src/bin.ts rename batch ./photos --recursive --max-depth 1 --ext jpg,png,webp --dry-run
```

Custom filename template (placeholders: `{prefix}`, `{timestamp}`, `{stem}`):

```bash
bun run src/bin.ts rename batch ./images --prefix trip --pattern "{timestamp}-{stem}" --dry-run
```

Video to GIF (requires `ffmpeg`):

```bash
bun run src/bin.ts video gif -i ./clip.mp4 -o ./clip.gif --width 480 --fps 10
```

## Dependencies (Launch Phase)

- Required for all commands: Node.js `>= 20` runtime
- Development tooling: Bun
- Optional command dependencies:
  - `pandoc` for `md to-docx`
  - `ffmpeg` for `video` commands

Use `doctor` to check what is available on your machine.
