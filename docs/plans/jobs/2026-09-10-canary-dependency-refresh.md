---
title: "Dependency refresh for v0.1.9-canary.1"
created-date: 2026-09-10
status: completed
agent: codex
---

## Scope

Refresh the reviewed runtime and development dependencies while preserving
`0.1.9-canary.1`, Node.js runtime compatibility, and the existing package exports.
The README and integration guide identify the updated SDK baseline in their
existing one-sentence style.

## Update checkpoints

- Codex SDK: `0.153.4` → `0.154.0`. Published JavaScript and type declarations
  compare identically; the pinned Codex CLI dependency changes to `0.154.0`.
- Inquirer prompts/search: `8.7.1`/`4.3.2` → `8.7.2`/`4.3.3` together.
- Bun types: `1.4.1` → `1.4.2`; retain Node-only compiler globals.
- Oxfmt/Oxlint: `0.66.0`/`1.81.0` → `0.67.0`/`1.82.0`.
- Tsdown: `0.22.14` → `0.23.0`; no configuration migration was necessary.

All seven updates were applied with the existing pin/range conventions. Lockfile
changes are confined to the updated dependency trees, including their platform
bindings. The package version, Node engine requirement, TypeScript version, and
Node-only compiler globals remain unchanged.

## Validation

- Baseline frozen install, typecheck, and build passed. The existing TypeScript 7
  experimental-API warning is present; no deprecated tsdown configuration warning
  was emitted.
- Baseline audit: no vulnerabilities reported across 276 packages.
- Both baseline and final `bun run test:all` passed under Bun `1.4.1`:

  | Suite | Cases | Assertions | Failures / errors / skipped |
  | --- | ---: | ---: | --- |
  | Unit | 1,246 | 4,798 | 0 / 0 / 0 |
  | Application | 2,038 | 12,853 | 0 / 0 / 0 |
  | Codex | 2 | 68 | 0 / 0 / 0 |
  | Pandoc | 3 | 138 | 0 / 0 / 0 |

- The SDK checkpoint separately passed 85 focused unit tests and the two live
  Codex protocol tests against CLI `0.154.0`.
- The Inquirer checkpoint passed 39 focused tests. Real terminal checks passed
  for built-CLI navigation and Escape cancellation, confirmation whitespace,
  search filtering, empty-result recovery, selection, and Ctrl-C cancellation.
- Final `bun run lint`, `bun run format:check`, and `bunx tsc --noEmit` passed;
  no source formatting changes were needed.
- A fresh build under Node `24.18.0` passed. Declaration output uses inline
  exports with unchanged signatures; a strict NodeNext consumer typecheck passed.
  External module specifiers and runtime export names match the earlier build.
- Built ESM and CJS exports, CSV parsing behavior, embedded version, and CLI
  executable shebang passed under Node `22.23.0` and `24.18.0`. The built CLI
  reports `0.1.9-canary.1` under both versions.
- Fresh-build `npm pack --dry-run --json` contains 16 intended package files,
  including both module formats, declarations, and the CLI entry point.
- Final frozen install made no changes; audit reported no vulnerabilities across
  271 packages; `bun outdated` reported no outdated dependencies.
- `git diff --check` passed.

## Notes and limits

- Managed tests needed process-observation access unavailable in the restricted
  sandbox; they passed when rerun with that access. Bun installation and outdated
  checks similarly needed access to its cache/temporary directory.
- The existing TypeScript 7 experimental-API build warning remains present.
- The local CJS output contained stale hashed chunks from earlier builds because
  its current build configuration does not clean that directory. Packaging was
  verified from a fresh output directory; build-cleaning policy was not changed.
- Full source suites ran with Node `26.5.0` available to subprocesses. Node 22/24
  checks cover the built package separately, not the entire source test matrix.
- Codex validation covers installed-CLI discovery/protocol and adapter tests;
  no paid model-generation request was run.
- This task prepares the canary checkout; it does not tag or publish a release.

## References

- [Contributor testing guide](../../guides/testing.md)
- [CLI action tool integration guide](../../guides/cli-action-tool-integration-guide.md)
- [Codex release notes](https://learn.chatgpt.com/docs/changelog)
- [Inquirer releases](https://github.com/SBoudrias/Inquirer.js/releases)
- [Oxc release notes](https://github.com/oxc-project/oxc/releases/tag/apps_v1.82.0)
- [Tsdown migration notes](https://github.com/rolldown/tsdown/releases/tag/v0.23.0)
