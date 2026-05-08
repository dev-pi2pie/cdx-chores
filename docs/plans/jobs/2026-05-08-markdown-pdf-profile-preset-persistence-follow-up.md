---
title: "Markdown PDF profile preset persistence follow-up"
created-date: 2026-05-08
status: completed
agent: codex
---

## Goal

Record the current `md pdf-template` and `md pdf-profile` preset behavior, tighten public guide wording, and keep preset persistence as an intentional follow-up instead of an undocumented surprise.

## Completed Work

- Updated [Markdown PDF Usage](../../guides/markdown-pdf-usage.md) with explicit profile, template, CSS, and `--no-default-css` override behavior.
- Clarified that `md pdf-template init --preset <name>` writes a complete editable recipe snapshot whose preset choices are baked into generated CSS.
- Clarified that `md pdf-profile init --preset <name>` currently stores values derived from the preset, not the preset name itself.
- Documented the accepted CSS generic family names for profile font stacks: `serif`, `sans-serif`, and `monospace`.

## Deferred Follow-up

`md pdf-profile init --preset <name>` should be revisited in a later implementation slice. The likely fix is to persist preset identity in the profile and teach `md to-pdf --profile <path>` to consume that preset when normalizing render options.

Current behavior is deterministic but partial:

- Profile generation preserves derived page and ToC settings.
- Profile generation does not preserve the preset identity.
- Preset-specific CSS can be lost on a later `md to-pdf --profile <path>` run unless the user passes the same `--preset` again.

This is a product-contract follow-up, not a silent docs-only cleanup. It needs schema, guide, and regression-test coverage before changing runtime behavior.

## Verification

- Documentation-only change.
- Checked guide wording against current implementation in `src/cli/markdown-pdf/recipe.ts`, `src/cli/markdown-pdf/profile/materialize.ts`, and `src/cli/markdown-pdf/profile/defaults.ts`.

## Related Guide

- [Markdown PDF Usage](../../guides/markdown-pdf-usage.md)

## Related Plan

- [Markdown to PDF Profiles, Fonts, and Page Chrome Implementation](../plan-2026-05-07-markdown-to-pdf-profiles-fonts-and-page-chrome-implementation.md)
