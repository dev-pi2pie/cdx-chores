---
title: "Apply ordered dependency security and maintenance pass"
created-date: 2026-04-23
modified-date: 2026-05-01
status: completed
agent: Codex
---

## Goal

Apply the approved dependency update order, clear the current security concerns, preserve the repo's existing manifest version-style conventions, and verify the full repository still passes its standard checks.

## Scope

- update the approved runtime and tooling dependencies in order
- add the minimal transitive override needed to clear the `mammoth` -> `@xmldom/xmldom` security issue
- refresh `bun.lock`
- rerun audit, lint, format, build, and full tests

## Related Research

- `docs/researches/research-2026-04-01-dependency-upgrade-safety-check.md`
- `docs/researches/research-2026-04-16-canary-dependency-review.md`

## Changes

Updated in the approved order:

1. `fast-xml-parser` -> `5.7.1`
2. `@xmldom/xmldom` override -> `0.8.13`
3. `tsdown` -> `0.21.10`
4. `oxfmt` -> `0.46.0`
5. `oxlint` -> `1.61.0`
6. `@types/bun` -> `1.3.13`
7. `typescript` -> `^6.0.3`
8. `@inquirer/prompts` -> `8.4.2`
9. `@duckdb/node-api` -> `^1.5.2-r.1`
10. `@openai/codex-sdk` -> `^0.123.0`

Additional notes:

- Added a package override for `@xmldom/xmldom: 0.8.13` so the `mammoth` transitive dependency no longer resolves the vulnerable `0.8.11` line.
- Restored caret ranges for packages that previously used caret-style manifest entries after `bun add` rewrote them to exact versions.

## Follow-Up Note

- `2026-04-24`: after the original ordered pass was recorded, `@openai/codex-sdk` was advanced again from `^0.123.0` to `^0.124.0` in `package.json` and `bun.lock`.
- `2026-04-25`: updated `fast-xml-parser` from `5.7.1` to `5.7.2` and `@openai/codex-sdk` from `^0.124.0` to `^0.125.0`.
- Upstream `fast-xml-parser` `5.7.2` records backward compatibility for numerical external entities plus fixes for `attributesGroupName` with `preserveOrder` and a stack overflow on very long tag expressions.
- Upstream `@openai/codex-sdk` `0.125.0` keeps the same direct package shape for this repo: the SDK depends on the matching `@openai/codex` package, and this repo only uses the SDK adapter surface through `Codex.startThread`.
- Verification for the `2026-04-25` follow-up: `bun audit` passed with `No vulnerabilities found`; targeted OOXML/Codex adapter tests passed with `25` passing tests and `0` failures; `bun run build` passed on `tsdown v0.21.10`; `bun test` passed with `786` passing tests and `0` failures.
- This follow-up leaves the rest of the 2026-04-23 dependency pass unchanged.
- No additional verification is recorded in this job note for the `^0.124.0` follow-up; the verification results below remain the results of the original ordered pass.

## Follow-Up Note 2026-05-01

- Updated `@openai/codex-sdk` from `^0.125.0` to `^0.128.0`.
- Updated dev tooling `oxfmt` from `0.46.0` to `0.47.0` and `oxlint` from `1.61.0` to `1.62.0`.
- Left `pdfjs-dist` at `^5.6.205` because `pdfjs-dist@5.7.284` declares `node >=22.13.0 || >=24`, while this package still advertises `node >=22.5.0`.
- Preserved the existing manifest style: caret range for `@openai/codex-sdk`, exact versions for `oxfmt` and `oxlint`.
- Verification for this follow-up: `bun audit` passed with `No vulnerabilities found`; `bun run lint` passed with `0` warnings and `0` errors; `bun run format:check` passed; `bun run build` passed on `tsdown v0.21.10`; focused Codex/PDF/DOCX adapter tests passed with `25` passing tests and `0` failures; full `bun test` passed with `892` passing tests and `0` failures.
- This follow-up leaves the rest of the 2026-04-23 dependency pass unchanged.

## Verification

- `bun audit`
- `bun run lint`
- `bun run format:check`
- `bun run build`
- `bun test`

Results:

- `bun audit` passed with `No vulnerabilities found`.
- `bun run lint` passed with `0` warnings and `0` errors.
- `bun run format:check` passed.
- `bun run build` passed on `tsdown v0.21.10`.
- `bun test` passed with `711` passing tests and `0` failures.

## Residual Risk

- The `@xmldom/xmldom` fix currently relies on a top-level override because `mammoth@1.12.0` still declares a broader transitive range. Revisit this override once `mammoth` publishes a release that naturally resolves to a patched `@xmldom/xmldom` version.
