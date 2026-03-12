---
title: "Revise README npm-publish wording and package keywords"
created-date: 2026-03-12
status: completed
agent: codex
---

## Goal

Refresh the npm-facing README wording, remove unnecessary local-link guidance, clarify how `doctor` relates to optional tool and capability checks, and add npm search keywords in `package.json`.

## What Changed

- revised `README.md` to focus on npm installation and post-install verification instead of `npm link`
- added a command overview table that organizes major command groups and important subcommands
- added a capability/dependency table that explains which workflows depend on external tools or environment state and when to use `doctor`
- kept representative command examples while making the dependency and repair path for DuckDB-backed features more explicit
- added npm keywords in `package.json` for CLI, file-processing, DuckDB, markdown, video, and Codex-related discovery

## Verification

- reviewed `README.md` for wording, command names, and dependency guidance against the current CLI surface
- reviewed `package.json` after adding keywords to confirm valid JSON structure
