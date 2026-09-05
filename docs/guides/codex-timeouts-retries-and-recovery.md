---
title: "Codex Timeouts, Retries, And Recovery"
created-date: 2026-08-22
modified-date: 2026-09-05
status: completed
agent: codex
---

## Goal

Help readers choose the correct Codex request control and understand where it
applies. Timeouts, retries, semantic repair, and Interactive regeneration are
related, but they do not share one lifecycle or one CLI option.

## Choose The Right Control

| If you want to...                                   | Use                                                | Ownership                        |
| --------------------------------------------------- | -------------------------------------------------- | -------------------------------- |
| bound each Codex request attempt                    | `--codex-timeout <duration>`                       | shared request policy            |
| override image or document rename requests          | rename scoped timeout option                       | analyzer-specific request policy |
| repeat a failed rename analyzer batch               | `--codex-images-retries` or `--codex-docs-retries` | rename workflow execution        |
| correct an invalid generated Markdown PDF candidate | the helper's existing repair path                  | semantic recovery                |
| ask again after reviewing an Interactive result     | the workflow's regeneration or revision step       | user-controlled recovery         |

There is no generic `--codex-retries` option. A timeout limits one attempt;
retry and recovery behavior remains owned by the workflow that initiated the
request.

Model, provider, and reasoning selection is configured independently; see
[Codex Execution Configuration](codex-execution-configuration.md). Changing a
timeout does not change those settings, and retrying does not select another
model, provider, or effort.

## Where The Shared Option Is Available

`--codex-timeout <duration>` is command-local. It is accepted by these shipped
surfaces:

| Surface                     | What the value controls                                          |
| --------------------------- | ---------------------------------------------------------------- |
| `rename file`               | each enabled image or document analyzer request attempt          |
| `rename batch`              | each enabled analyzer request attempt for every sequential batch |
| `batch-rename`              | the same behavior as the `rename batch` compatibility alias      |
| `data query codex`          | each Codex SQL-drafting request attempt                          |
| `data stack --codex-assist` | each Codex advisory request attempt                              |
| `md pdf-profile codex`      | each profile-drafting request attempt                            |
| `md pdf-template codex`     | the initial template request and each separate repair request    |
| `md pdf-project codex`      | each profile, template, and repair request independently         |
| `interactive`               | every current Codex request in that explicit Interactive session |

`--codex-timeout` belongs to the selected command; it is not a global option.

✅ Correct:

```bash
cdx-chores interactive --codex-timeout 2m
```

❌ Incorrect:

```bash
cdx-chores --codex-timeout 2m
```

The root-level form is rejected. If the option is omitted, Interactive mode
uses the 30-second default and does not prompt for timeout configuration.

## Duration Syntax

Use one positive integer followed immediately by a supported unit:

```text
1ms
500ms
30s
2m
10m
```

The supported units are lowercase `ms`, `s`, and `m`. New duration-based CLI
options accept at most `10m` (`600000ms`) per request attempt. Bare numbers,
zero, negatives, decimals, whitespace, uppercase units, compound values such
as `1m30s`, repeated occurrences of the same option, and values above `10m`
are rejected before the command action begins.

## Timeout Meaning

Every effective value is a deadline for one Codex request attempt. It is not a
whole-command, batch, project, or total-retry budget.

For one sequential rename analyzer, approximate worst-case elapsed time is:

```text
batch count x (retries + 1) x per-attempt timeout
  + retry delays
  + local processing
```

A Markdown PDF project similarly gives each profile, template, and repair
request its own timeout window. Interactive regeneration or revision creates a
new request with the same session value; it does not consume a shared session
budget.

## Rename Shared And Scoped Timeouts

Rename exposes a shared value plus analyzer-specific overrides:

```bash
cdx-chores rename batch ./assets \
  --codex \
  --codex-timeout 2m \
  --codex-images-timeout 45s \
  --dry-run
```

The image timeout resolves in this order:

```text
--codex-images-timeout
  -> --codex-images-timeout-ms
  -> --codex-timeout
  -> 30-second default
```

The document timeout uses the equivalent document options:

```text
--codex-docs-timeout
  -> --codex-docs-timeout-ms
  -> --codex-timeout
  -> 30-second default
```

A scoped duration option and its legacy millisecond spelling cannot be supplied
together for the same analyzer. Image and document scoped values may be used
together, and either may override the shared value only for its own analyzer.

Timeout options configure requests; they do not enable Codex. Rename still
requires `--codex`, `--codex-images`, or `--codex-docs`. Likewise,
`data stack --codex-timeout 2m` does not enable `--codex-assist`.

## Legacy Rename Millisecond Options

These rename options remain functional during the current compatibility phase:

```text
--codex-images-timeout-ms <ms>
--codex-docs-timeout-ms <ms>
```

Supplying either option writes one consolidated warning to stderr. When the
value fits the new duration grammar and 10-minute maximum, the warning provides
an exact replacement:

```text
Warning: legacy Codex timeout option is deprecated.
Use --codex-docs-timeout 30000ms instead of --codex-docs-timeout-ms.
The legacy option remains supported during the current compatibility phase.
```

Legacy millisecond values are not newly capped at 10 minutes during the
compatibility phase. If an existing value cannot migrate unchanged, the warning
asks for a positive integer duration of `10m` or less instead of silently
changing the legacy behavior.

Removal is not scheduled by this guide. The legacy options remain supported for
at least one stable compatibility release and may be removed only at a
separately approved breaking boundary with migration evidence.

## Retry, Repair, And Regeneration

Rename retries remain analyzer-specific and batch-specific:

```text
--codex-images-retries <count>
--codex-docs-retries <count>
```

Each count is the number of retries after the initial request for one batch.
Every retry receives the same effective per-attempt timeout. Existing retry
delays, sequential ordering, partial-result retention, and deterministic
fallback behavior are unchanged.

Markdown PDF repair is semantic recovery from a generated candidate that does
not satisfy the helper contract. It is a separate request with the same timeout
value, not a generic transport retry.

Interactive revision and regeneration are explicit user choices. The session
value survives backtracking and is reused for each newly requested attempt, but
the CLI does not add automatic retry or a timeout prompt to the workflow.

## Timeout Failure Information

When the underlying error preserves a reliable timeout cause, the CLI can
identify that an analyzer or helper exhausted its per-attempt deadline. An
ordinary abort or unknown SDK error remains on the workflow's existing generic
failure path.

Timeout-specific information does not change exit behavior, retained partial
results, deterministic fallback, recovery choices, saved plans, generated
artifacts, or report schemas.

Diagnostic color is presentation-only. For the stdout, stderr, ANSI, and
plain-text contract, see [CLI Output And Color](cli-output-and-color.md).
