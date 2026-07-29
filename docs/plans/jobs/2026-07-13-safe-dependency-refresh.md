---
title: "Safe dependency refresh"
created-date: 2026-07-13
status: completed
agent: Codex
---

## Goal

Refresh the reviewed low-risk dependency set, update the public Codex SDK
baseline for `v0.1.6-canary.1`, and keep Node 26 types and TypeScript 7 outside
this maintenance scope.

## Scope

- Update runtime dependencies:
  - `@openai/codex-sdk` from `^0.144.1` to `^0.144.3`
  - `fast-xml-parser` from `5.9.3` to `5.10.0`
- Update development dependencies:
  - `@types/node` from `25.9.4` to `25.9.5`
  - `tsdown` from `0.22.4` to `0.22.7`
- Refresh `bun.lock`.
- Update the Codex SDK baseline in `README.md` and
  `docs/guides/cli-action-tool-integration-guide.md` to `0.144.3` for
  `v0.1.6-canary.1`.
- Defer `@types/node@26.1.1` and TypeScript `7.0.2` as separate baseline and
  toolchain migrations.

## Review Findings

- Candidate packages were reviewed for publication age, registry integrity,
  publisher continuity, lifecycle scripts, published-content changes, and
  transitive dependency expansion.
- `@openai/codex-sdk@0.144.3` keeps the same published JavaScript and
  TypeScript declarations as `0.144.2`. The package advances its version and
  matching `@openai/codex` dependency, whose launcher JavaScript is also
  unchanged apart from versioned platform package references.
- `@types/node@25.9.5` stays on the current Node 25 type line and retains the
  same `undici-types` 7.x dependency range. The Node 26 type line remains a
  separate runtime-baseline decision.
- `tsdown@0.22.7` adds TypeScript 7 compatibility and warning suppression,
  includes two build-output fixes from `0.22.5`, and updates the declaration
  generation stack. Build output and CJS/ESM entry points therefore require
  explicit validation.
- `fast-xml-parser@5.10.0` updates `is-unsafe`,
  `path-expression-matcher`, and `xml-naming`. The parser adapts to the
  tree-shakeable `is-unsafe` 2.x context exports without changing the XML and
  HTML detection rule sets, but the runtime XML path still requires focused
  DOCX metadata, malformed XML, and entity-handling coverage.
- The reviewed package tarballs carry registry integrity signatures and do not
  introduce dependency install lifecycle scripts.

## Implementation

- Updated the dependency targets in `package.json`.
- Installed the reviewed dependency set and refreshed `bun.lock`.
- Updated the public Codex SDK baseline to `0.144.3` for
  `v0.1.6-canary.1`.
- Kept `@types/node@26.1.1` and TypeScript `7.0.2` deferred; they remain the
  only direct dependencies reported by the final outdated check.

## Verification

- `bun install --frozen-lockfile` passed without lockfile changes.
- `bun run lint` passed.
- `bun run format:check` passed across 688 files.
- `bun run build` passed with `tsdown@0.22.7` and generated ESM, CJS, and
  declaration outputs.
- Focused Codex adapter and DOCX/XML metadata coverage passed: 80 tests across
  5 files, with 0 failures.
- Full `bun test` passed: 1,517 tests across 206 files, with 0 failures.
- The built CJS library loaded successfully under Node.js.
- The built ESM CLI reported `0.1.6-canary.1` under Node.js.
- `bun audit` reported no vulnerabilities.
- `git diff --check` passed.
- The final outdated check reports only the deferred `@types/node@26.1.1` and
  TypeScript `7.0.2` major upgrades.
