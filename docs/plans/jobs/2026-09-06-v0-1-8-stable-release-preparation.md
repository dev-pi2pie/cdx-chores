---
title: "v0.1.8 Stable Release Preparation"
created-date: 2026-09-06
status: completed
agent: codex
---

## Scope

Prepare the curated stable release body and current version wording for
`v0.1.8`, following [release-note policy](../../../RELEASE_NOTES_POLICY.md).
Preparation does not include committing, tagging, or publishing the release.

## Release Evidence

- Previous stable tag: `v0.1.7` at
  `dec25b5244d99618b7ef69d6688dc788ad5044fb`, confirmed against the remote tag.
- Reviewed candidate range:
  `v0.1.7..08751d6578fc1de889f0f8abe3e43696bf993a01` on `dev`.
- Package version is already `0.1.8`; the latest remote canary is
  `v0.1.8-canary.4`. No remote `v0.1.8` tag existed during preparation.
- Curated Codex execution/discovery claims against the
  [execution guide](../../guides/codex-execution-configuration.md) and
  [completed implementation record](2026-09-05-codex-execution-configuration.md).
- Curated PDF extraction claims against the
  [completed lifecycle record](2026-09-01-pdfjs-dist-6-3-extractor-lifecycle.md)
  and current extractor implementation.
- Excluded internal test-runner development and iterative documentation/test
  commits from the publishable body. Current contributor instructions remain in
  the [testing guide](../../guides/testing.md).
- Contributor review found the same author name under two emails, both present
  before this range. Omitted the optional Contributors section rather than
  presenting duplicate acknowledgments or claiming a first contribution.

## Changes

- Added [v0.1.8 release notes](../../../CHANGELOGS/v0.1.8.md) with final shipped
  outcomes and the required trailing stable comparison link.
- Updated README and the CLI integration guide from canary validation wording
  to the `v0.1.8` SDK baseline. Reviewed version references across all guides;
  retained the explicitly historical `v0.0.7` DOCX migration note and current
  external-tool/runtime versions.
- The release generator reads the override from the tagged Git tree. The new
  note must be committed into the eventual release tag to become its CI body.

## Validation

- Generated the candidate body successfully before curating:

  ```sh
  bash scripts/generate-stable-release-notes.sh --mode commit \
    --range v0.1.7..08751d6578fc1de889f0f8abe3e43696bf993a01 \
    --current-tag v0.1.8 --previous-tag v0.1.7 \
    --repository dev-pi2pie/cdx-chores
  ```

- `bun run lint`, `bun run format:check`, `bunx tsc --noEmit`, and
  `bun run build` passed. The build emitted the existing Tsdown warning about
  experimental TypeScript 7 API support.
- `bun run test:all` passed with Bun `1.4.1` and Node `26.5.0`:

  | Suite       | Cases | Assertions |
  | ----------- | ----: | ---------: |
  | Unit        | 1,246 |      4,798 |
  | Application | 2,038 |     12,853 |
  | Codex       |     2 |         68 |
  | Pandoc      |     3 |        138 |

  All suites reported zero failures, errors, and skipped cases. Managed cleanup
  completed with no retained results. The initial sandboxed invocation stopped
  before any suite ran because process observation was unavailable; the full
  rerun outside that restriction passed.

- Built Node ESM and CJS exports passed a deterministic `slugifyName` smoke;
  the built CLI reported `cdx-chores ver.0.1.8`. Help output exposed the
  documented discovery commands and execution flags.
- An isolated Git fixture containing the actual new release body under a
  `v0.1.8` tag returned that body byte-for-byte through the release generator.
  The fixture was removed after verification; repository tags were untouched.
- Changed Markdown passed local-link and fence checks. Both new documents
  passed Oxfmt; release structure and the final comparison URL were verified.
- Final diff review and `git diff --check` passed. No current canary version
  references remain in README or public guides.

The fresh Node checks above used `26.5.0`; they do not represent a new test of
the `22.23.0` minimum. Earlier minimum-version PDF evidence remains in the
linked lifecycle record.

## Outcome

Release preparation is complete and the four-file diff is ready for review.
Changes remain uncommitted. Release tagging and publication are pending.
