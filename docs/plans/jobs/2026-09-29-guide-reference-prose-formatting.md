---
title: "Guide and reference prose formatting"
created-date: 2026-09-29
status: completed
agent: codex
---

## Scope

Put prose paragraphs on one source line in the top-level Markdown guides and references. Preserve intentional Markdown breaks, lists, tables, code blocks, links, and document meaning.

## Changes

| Area                   | Files reviewed | Files changed | Prose wraps removed |
| ---------------------- | -------------: | ------------: | ------------------: |
| `docs/guides/*.md`     |             30 |            21 |               1,160 |
| `docs/references/*.md` |              3 |             3 |                  45 |
| **Total**              |         **33** |        **24** |           **1,205** |

The edits join source-line wraps only. Formatting-only changes do not alter guide or reference `modified-date` values under `DOCUMENTATION_POLICY.md`.

## Verification

- Compared each changed file's Pandoc GFM structure before and after reflow, treating a paragraph `SoftBreak` as a space; all 24 structures matched.
- A follow-up scan found no prose paragraphs split across source lines. Its only two raw matches were nested fenced code examples in `docs/guides/markdown-pdf-usage.md`, not prose.
- `git diff --check` passed.
- Independent documentation review found no material issues.
