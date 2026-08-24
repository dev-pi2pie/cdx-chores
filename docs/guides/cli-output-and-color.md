---
title: "CLI Output And Color"
created-date: 2026-08-22
status: completed
agent: codex
---

## Goal

Explain how `cdx-chores` uses stdout, stderr, color, and diagnostic-label
emphasis so terminal users and automation can rely on the same plain-text
contract.

Color is a presentation enhancement. Plain text is canonical: removing ANSI
sequences from styled output must recover the same wording, spacing, and line
breaks produced when color is disabled.

## Diagnostic Presentation

The shared diagnostic roles style only the label or heading. Message bodies,
remediation text, bullets, and help remain outside that emphasis.

| Role    | Representative label | Eligible terminal style     | Typical stream |
| ------- | -------------------- | --------------------------- | -------------- |
| error   | `error:`             | bold standard red label     | stderr         |
| warning | `Warning:`           | bold standard yellow label  | stderr         |
| notice  | `Tip:`               | standard cyan, without bold | stderr         |

For example, an eligible terminal may emphasize `error:` in this output, but
the option name and help remain normal text:

```text
error: unknown option '--codex-timeout'

Usage: cdx-chores [options] [command]
```

Warnings follow the same boundary:

```text
Warning: legacy Codex timeout option is deprecated.
Use --codex-docs-timeout <duration> instead.
```

Only `Warning:` is bold yellow. The warning body and follow-up instruction are
not colored or bold. `Tip:` is cyan but deliberately non-bold.

The palette uses the standard ANSI red, yellow, and cyan roles. It does not
select explicit bright-color variants. A terminal theme may still render bold
text with a brighter appearance.

## When Color Appears

Color appears on a target stream only when all of these conditions are true:

- runtime color is enabled
- `NO_COLOR` is absent from the environment
- the global `--no-color` option was not supplied
- the target stream is a TTY

Stdout and stderr are evaluated independently. Redirecting stderr makes
diagnostics written to stderr plain even if stdout remains attached to a TTY:

```bash
cdx-chores rename batch ./photos --dry-run 2>diagnostics.log
```

The resulting `diagnostics.log` contains canonical plain text without ANSI
sequences.

## Disable Color Explicitly

Use the global option when disabling color for one invocation:

```bash
cdx-chores --no-color rename batch ./photos --dry-run
```

Use the conventional environment variable when disabling color for a shell,
script, or calling process:

```bash
NO_COLOR=1 cdx-chores rename batch ./photos --dry-run
```

The presence of `NO_COLOR` disables color; its value is not interpreted.

These controls remove ANSI styling only. They do not change canonical text,
stream routing, warning cardinality, help content, exit behavior, or command
workflow.

## Stdout, Stderr, And Automation

Human-readable command results normally use stdout. Diagnostics, warnings,
and Interactive tips use stderr when their owning command defines them there.
Redirect stderr when you want to keep the command result visible while saving
diagnostic text separately:

```bash
cdx-chores rename batch ./photos --dry-run 2> diagnostics.log
```

Structured and machine-oriented output remains plain data and must not store
ANSI presentation. Styling is applied only while rendering eligible terminal
text; it does not enter JSON, saved plans, generated documents, SQL-only
output, or other artifacts.

## Domain-Owned Presentation

The shared diagnostic roles do not recolor every terminal surface. Version
branding, transient progress, TUI controls and hints, doctor reports, tables,
SQL review, font `Info:` rows, highlights, and command-specific remediation
retain their existing renderer ownership. Raw operational failures without a
semantic label also remain unlabeled.

This boundary keeps the global contract narrow: shared error, warning, and
notice labels are consistent, while feature-specific reports may preserve
their own established information hierarchy.
