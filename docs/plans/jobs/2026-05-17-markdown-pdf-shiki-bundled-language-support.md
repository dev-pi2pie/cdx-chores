---
title: "Markdown PDF Shiki bundled language support"
created-date: 2026-05-17
status: completed
agent: codex
---

## Goal

Correct the Markdown PDF Shiki language contract so `md to-pdf` supports Shiki's bundled language range instead of a small hand-maintained language allowlist.

## Completed Work

- Added a dedicated code-language helper that resolves language IDs and aliases through Shiki bundled language metadata.
- Updated the post-Pandoc highlighter to load the bundled languages detected in the current document.
- Kept no-language and non-bundled-language blocks on the plain code path.
- Added regression coverage for bundled languages outside the smoke fixture set.
- Updated the public guide, research note, and implementation plan wording to reflect the bundled-language contract.

## Related Plan

- [Markdown PDF Shiki code highlighting implementation](../plan-2026-05-17-markdown-pdf-shiki-code-highlighting-implementation.md)

## Related Research

- [Markdown PDF Shiki Code Highlighting](../../researches/research-2026-05-16-markdown-pdf-shiki-code-highlighting.md)

## Related Guide

- [Markdown PDF Usage](../../guides/markdown-pdf-usage.md)
