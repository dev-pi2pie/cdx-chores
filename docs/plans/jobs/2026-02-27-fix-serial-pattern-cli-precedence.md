---
title: "Fix serial pattern CLI precedence"
created-date: 2026-02-27
status: completed
agent: codex
---

Corrected `rename` CLI serial option precedence so embedded `{serial...}` pattern parameters are honored unless the user explicitly passes override flags.

Why:
- Commander defaults for `--serial-order`, `--serial-start`, and `--serial-scope` were being injected even when the user omitted those flags.
- That caused pattern tokens like `{serial_start_3}` to be normalized back to the CLI default start of `1`.

What changed:
- Removed CLI-layer default injection for serial rename options in `src/command.ts`.
- Clarified help text so the defaults are described without forcing implicit overrides.
- Added a CLI regression test covering `rename batch ... --pattern "{stem}-{serial_start_3}" --dry-run`.
