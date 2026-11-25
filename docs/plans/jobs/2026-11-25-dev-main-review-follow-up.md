---
title: "Dev against main review follow-up"
created-date: 2026-11-25
status: completed
agent: codex
---

Initial review range `c15c6467...74789be5`.

## Markdown PDF automatic titles

The parsed title check now examines inline visibility before removing the metadata block or skipping an earlier H1.

| Case | `74789be5` | `7bc38d1d` |
| --- | --- | --- |
| Matching H1 has a hidden link or inline code | No visible title | Metadata title prints |
| Part of the matching H1 is hidden | Only part of the title prints | Full metadata title prints |
| A child is visible inside an earlier H1 | Later H1 suppresses the metadata title | Metadata title prints |

The 18 raster comparisons matched explicit `show` or `hide` controls on Pandoc 2.0 and 3.9 with WeasyPrint 70.0. The controls include plain matches and fully hidden earlier headings. [AST tests](../../../test/markdown-pdf/direct/ast-title.unit.test.ts) · [Render fixtures](../../../test/markdown-pdf/actions/rendering/ast-render-fixtures.ts) · [User guide](../../guides/markdown-pdf-usage.md#automatic-metadata-titles)

Managed suites passed 2,739 Unit, 2,800 Application, 41 Codex, and 114 Pandoc cases. Build, tracked-file typecheck, lint, formatting, and whitespace checks passed.

## Re-review

Independent review of `c15c6467...7bc38d1d` against `origin/main` found no additional actionable regressions.
