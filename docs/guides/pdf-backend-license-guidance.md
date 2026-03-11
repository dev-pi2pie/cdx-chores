---
title: "PDF Backend License Guidance"
created-date: 2026-03-11
status: draft
agent: codex
---

## Goal

Clarify how `cdx-chores` should describe and handle license-sensitive PDF backends in user-facing documentation.

## Core Guidance

`cdx-chores` may rely on external PDF tools that are installed in the user's environment.

Important distinction:

- `cdx-chores` may detect or invoke a user-provided tool
- that does not automatically remove the license obligations attached to that tool

The safe documentation position is:

- do not claim that a user-installed third-party tool is automatically safe for every use case
- do not claim that `cdx-chores` bundles or installs a license-sensitive backend when it does not
- do state clearly that users or operators remain responsible for checking and complying with the applicable third-party license terms

## Recommended Product Wording

Use wording close to this in PDF command help and guides when a backend is license-sensitive:

> This workflow may use a third-party PDF backend that is installed separately from `cdx-chores`. Availability depends on your environment. You are responsible for checking and complying with the applicable backend license terms.

Avoid wording like:

- "User-installed means there is no license issue"
- "Because `cdx-chores` does not bundle it, license restrictions do not apply"
- "This tool is always safe for commercial use"

## Backend Positioning

### Permissive-first defaults

Prefer documenting these as the lower-risk default path:

- `pdfcpu`
- `qpdf` when later supported
- `ImageMagick` as a lower-priority optional tool

### License-sensitive backends

Document these as license-sensitive and environment-dependent:

- `mutool`
- `pymupdf4llm`

## Command-Help Expectations

For any PDF command that may use a license-sensitive backend:

- state whether the backend is user-provided
- state that availability depends on the environment
- state that users or operators are responsible for checking the applicable license terms

For `pdf to-images`, also state explicitly:

- v1 extracts embedded images
- v1 does not render pages

## Scope Note

This guide is documentation guidance only.

It is not legal advice.
