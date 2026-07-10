---
title: Tool Cover Smoke
subtitle: Markdown PDF workflow sample
author: cdx-chores
lang: en
---

# Tool Cover Smoke

This small sample checks a Markdown PDF workflow with a generated cover image,
plain prose, a short feature list, a table, and a code block.

## What It Exercises

- Template-Codex cover image planning
- Markdown-to-PDF rendering with a custom template bundle
- Code-block styling compatibility
- Public-safe playground inputs for manual smoke checks

## Sample Command

```bash
cdx-chores md pdf-template codex examples/playground/md-pdf/tool-cover-smoke.md \
  --intent "tool introduction PDF with a clean editorial cover image" \
  --cover-image examples/playground/md-pdf/assets/tool-cover-sample.jpg
```

## Workflow Notes

| Step | Purpose |
| --- | --- |
| Draft | Generate a reviewable template bundle |
| Inspect | Check the template, CSS, and managed assets |
| Render | Use `md to-pdf` with the generated template and stylesheet |
