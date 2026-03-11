---
title: "Revise README wording and npm quick start"
created-date: 2026-03-11
modified-date: 2026-03-11
status: completed
agent: codex
---

## Goal

Refresh the package positioning in `README.md` so the opening description stays simple, mentions Codex-assisted use cases, and adds an npm-based quick start for the `cdx-chores` package name.

## What Changed

- revised the opening one-line package description in `README.md`
- added an npm-first quick start using `npm install -g cdx-chores`
- separated local contributor setup into a dedicated `Local Development` section
- aligned the documented Node.js runtime requirement in `README.md` with the current `package.json` engine floor
- verified that `cdx-chores` is currently not present on the npm registry, which supports using the package name in the quick start guidance

## Verification

- reviewed `README.md` after patching
- checked npm registry availability with `npm view cdx-chores name version` and received an `E404 Not Found` response on 2026-03-11
