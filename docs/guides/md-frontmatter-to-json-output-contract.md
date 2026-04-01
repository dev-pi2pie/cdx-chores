---
title: "MD Frontmatter to JSON Output Contract"
created-date: 2026-02-26
modified-date: 2026-04-01
status: completed
agent: codex
---

## Goal

Document the output contract for `cdx-chores md frontmatter-to-json`, including the default wrapper shape, `--data-only`, and `--pretty` formatting behavior.

## Command Summary

Command:

- `cdx-chores md frontmatter-to-json --input <path>`

Supported frontmatter types:

- YAML (`---`)
- TOML (`+++`)
- JSON (`;;;` or leading JSON object block)

## Default Output Shape (Wrapper)

By default, the command emits a wrapper object with:

- `frontmatterType`: `"yaml" | "toml" | "json"`
- `data`: parsed frontmatter object

Example:

```json
{
  "frontmatterType": "yaml",
  "data": {
    "title": "Release Notes",
    "draft": false,
    "tags": ["cli", "markdown"],
    "version": 2
  }
}
```

## `--data-only` Output Shape

Use `--data-only` to emit only the parsed frontmatter object (no wrapper metadata).

Example:

```json
{"title":"Release Notes","draft":false,"tags":["cli","markdown"],"version":2}
```

## `--pretty` Formatting

`--pretty` is the common formatting flag for JSON-like output in `cdx-chores`.

- Default (flag mode): compact JSON
- With `--pretty`: indented JSON (2 spaces)
- Interactive mode prompt defaults to pretty-print = `true`

Example (`--pretty --data-only`):

```json
{
  "title": "Release Notes",
  "draft": false,
  "tags": [
    "cli",
    "markdown"
  ],
  "version": 2
}
```

## File Output vs Stdout

- Default output destination is stdout
- Use `--output <path>` to write JSON to a file
- `--overwrite` is required to replace an existing file

If `--output` is provided without a path value in interactive mode (using the default file destination choice), the implementation derives:

- `<input>.frontmatter.json`

Example:

- `notes.md` -> `notes.frontmatter.json`

## Error Expectations

### Missing frontmatter

The command exits with an error if no frontmatter block is found.

Expected behavior:

- non-zero exit
- clear message indicating no frontmatter was found in the input markdown file

### Invalid or unparseable frontmatter

The command exits with an error if a frontmatter block is present but cannot be parsed into an object.

Expected behavior:

- non-zero exit
- clear message indicating frontmatter parse failure

## Compatibility Notes

- The default wrapper shape is the current output contract.
- `--data-only` is supported for pipeline-heavy usage (`jq`, shell scripts).
- Future metadata fields may be added to the wrapper output; scripts that require only parsed fields should prefer `--data-only`.

## Historical Plans

- `docs/plans/archive/plan-2026-02-26-md-frontmatter-to-json-command.md`
