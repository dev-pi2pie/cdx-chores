---
title: "Markdown PDF project Codex phase 7 validation and render compatibility"
created-date: 2026-07-04
modified-date: 2026-07-05
status: completed
agent: codex
plan: ../plan-2026-07-04-markdown-pdf-project-codex-helper.md
---

## Scope

Implement Phase 7 of the `md pdf-project codex` plan.

This phase adds project-level validation and render-command compatibility for
the already materialized in-memory profile and template phases. It does not
write project artifacts; Phase 8 owns reports, summaries, dry-run behavior, and
normal writes.

This job was reopened because the original manual smoke used injected Codex
runners. That evidence remains useful for orchestration, but it is not live
Codex smoke evidence.

This job was reopened again for timeout review. The recorded live smoke
validated the direct read-only runner plus timeout combination, but it did not
isolate timeout as the earlier failure cause.

## Reopened Timeout Review

- [x] Re-run the Phase 7 live-smoke matrix with the current Markdown PDF Codex
      timeout defaults as the baseline.
- [x] Temporarily rebuild with only the Markdown PDF profile/template Codex
      timeout constants set back to 30s and rerun the same live-smoke matrix.
- [x] Keep the final committed timeout value aligned with the controlled smoke
      result before any commit.
- [x] Record sanitized evidence that states whether 30s passes with the corrected
      direct read-only runner or whether 120s is required.

## Implementation Notes

- Added `validate-project.ts` to compose existing profile validation,
  template static validation, artifact-boundary checks, and cross-artifact
  compatibility checks.
- Added `render-command.ts` to build a public-safe follow-up
  `cdx-chores md to-pdf --profile --template --css` command.
- Kept render-command paths replayable with repo-relative project paths when
  possible and placeholders such as `<input.md>` and `<output.pdf>` when a raw
  local path should not be persisted.
- Treat validation failures as `no-usable-project` summaries instead of
  silently continuing to a render command.
- Added cross-artifact guards for title-block behavior, text cover behavior,
  and profile-owned font decisions.
- Reused direct template validation for remote URLs, file-scheme URLs, absolute
  local paths, unmanaged assets, ToC hooks, Shiki hooks, and later-render
  template hooks.
- Followed up on the phase code review by sharing bundle-path boundary checks
  with output planning, sharing public path rendering for replay-safe command
  arguments, and making the final phase decision precedence explicit.
- Followed up on the final phase review by moving public path display and shell
  quoting into a shared Markdown PDF Codex helper used by project render
  commands and template reports.
- Removed duplicate project-level ToC and Shiki hook checks because direct
  template static validation already enforces those hooks for every generated
  template before any render command can be produced.
- Split project validation into a result collector and a summary resolver so
  decision precedence, fallback selection, and render-command creation are
  resolved in one place.
- Restored direct Markdown PDF profile/template Codex helper defaults to 30s
  after controlled smoke showed the corrected read-only runner passes the Phase
  7 matrix without requiring 120s.
- Kept the existing TTY progress spinner path and verified progress output
  through focused CLI tests; non-TTY output remains static.
- Restored profile, template, and project live Codex smoke paths to the shared
  direct read-only workspace runner so helpers can inspect local project
  inputs through the same contract as the successful direct helpers.
- Filtered forwarded profile directions from project-level unsupported
  directions once the template phase adapts them, so a handled cover-image
  request is not reported as unsupported.

## Tests

- Added `test/cli-actions-md-to-pdf-project-codex/validation.test.ts`.
- Covered successful deterministic validation and render-command generation.
- Covered repo-relative render-command input paths without raw local path
  disclosure.
- Covered `no-usable-project` validation summaries without render commands.
- Covered unsafe generated CSS resource references.
- Covered managed asset bindings that do not match the project output plan.
- Covered a text-cover compatibility failure where a generated project template
  would otherwise drop a profile-owned cover.
- Covered cover-image validation without disclosing the source asset path in
  the render command.
- Added review follow-up coverage for path placeholders outside the current
  workspace, shell quoting for paths with spaces and single quotes, and
  Windows-style current-working-directory path normalization.
- Added negative compatibility coverage for templates or stylesheets that drop
  profile-owned ToC hooks, Shiki hooks, metadata-title visibility, or
  profile-owned font decisions.
- Tightened validation-summary assertions so deterministic and no-usable paths
  must keep the expected ordered validation-result contract.
- Added direct malformed-plan coverage for project artifact boundaries,
  including profile, template, stylesheet, in-bundle report paths, and invalid
  project-relative bundle paths.
- Added malformed final-profile coverage to prove profile shape and
  normalization failures suppress render-command creation.
- Tightened validation failure assertions so hard failures must produce
  `no-usable-project`, suppress render-command output, and carry the expected
  fallback message.

## Injected-Runner Manual Smoke

This smoke used the existing playground files as review fixtures, not as
regular test fixtures:

- `examples/playground/md-pdf/tool-cover-smoke.md`
- `examples/playground/md-pdf/assets/tool-cover-sample.jpg`
- `examples/playground/md-pdf/cjk-font-smoke.md`

The smoke ran through project signal collection, output planning, profile
phase, template phase, project validation, and render-command creation with
injected deterministic Codex runners. It did not invoke live Codex and did not
write project artifacts.

Sanitized smoke result:

- `tool-cover`: `codex-assisted` project, `document-informed` profile,
  `codex-assisted` template, final decision `adapted`, no failed validations.
- `cjk-font`: `codex-assisted` project, `document-informed` profile,
  `deterministic` template, final decision `adapted`, no failed validations.
- Follow-up render arguments used repo-relative fixture paths, generated
  project-relative artifact paths, and `<output.pdf>`.

An initial smoke attempt used a non-hex test identity suffix and was rejected by
the existing profile identity validator. The final smoke used valid
deterministic hex identity suffixes.

## Live Smoke

Live smoke ran through real Codex helper calls and kept generated manual
artifacts under `examples/playground/md-pdf/smoke/` for later cleanup.

Setup:

```bash
mkdir -p examples/playground/md-pdf/smoke
```

Profile smoke for multilingual font behavior:

```bash
node dist/esm/bin.mjs md pdf-profile codex examples/playground/md-pdf/cjk-font-smoke.md \
  --intent "multi-language PDF profile for Traditional Chinese, English, readable headings, and stable page numbers" \
  --font-hint "English body text should use a readable Latin serif font" \
  --font-hint "Japanese body text should prefer Hiragino Mincho or an equivalent Japanese Mincho serif font" \
  --font-hint "Traditional Chinese body text should use Noto Serif CJK TC or an equivalent Traditional Chinese serif font" \
  --font-hint "code blocks should use a dedicated monospace font such as JetBrains Mono" \
  -o examples/playground/md-pdf/smoke/profile-cjk.yml \
  --keep-codex-report \
  --codex-report-output examples/playground/md-pdf/smoke/profile-cjk.codex-report.json \
  --overwrite
```

Template smoke for cover image behavior:

```bash
node dist/esm/bin.mjs md pdf-template codex examples/playground/md-pdf/tool-cover-smoke.md \
  --intent "cover page uses the cover image first, then title and document info; keep body page numbers readable" \
  --cover-image examples/playground/md-pdf/assets/tool-cover-sample.jpg \
  -o examples/playground/md-pdf/smoke/template-cover \
  --keep-codex-report \
  --overwrite
```

Project dry-run smoke for multilingual/font orchestration:

```bash
node dist/esm/bin.mjs md pdf-project codex examples/playground/md-pdf/cjk-font-smoke.md \
  --intent "multi-language PDF project for Traditional Chinese, English, readable headings, and stable page numbers" \
  --font-hint "English body text should use a readable Latin serif font" \
  --font-hint "Japanese body text should prefer Hiragino Mincho or an equivalent Japanese Mincho serif font" \
  --font-hint "Traditional Chinese body text should use Noto Serif CJK TC or an equivalent Traditional Chinese serif font" \
  --font-hint "code blocks should use a dedicated monospace font such as JetBrains Mono" \
  --dry-run
```

Project dry-run smoke for cover-image orchestration:

```bash
node dist/esm/bin.mjs md pdf-project codex examples/playground/md-pdf/tool-cover-smoke.md \
  --intent "cover page uses the cover image first, then title and document info; keep body page numbers readable" \
  --cover-image examples/playground/md-pdf/assets/tool-cover-sample.jpg \
  --dry-run
```

Sanitized live-smoke result:

These results validated the current runner and timeout combination, but they did
not prove that timeout was the earlier failure cause. The timeout-specific
review below isolates that question.

- Direct `md pdf-profile codex` multilingual smoke passed with four repeated
  `--font-hint` flags for English body, Japanese body, Traditional Chinese
  body, and code monospace.
- The ignored profile report preserved all four font hints, proving repeatable
  `--font-hint` values reached the real Codex request and report output.
- Focused CLI coverage also asserts the same four-hint list reaches direct
  profile prompt facts and the persisted advisory report.
- The generated profile selected separate body font entries for Latin,
  Japanese, and Traditional Chinese text, plus a dedicated code font.
- Direct `md pdf-template codex` cover-image smoke passed with an adapted
  cover-media template and one managed cover asset.
- Project multilingual/font dry-run smoke passed with `codex-assisted` project
  mode, final decision `adapted`, adapted profile phase, deterministic
  template phase, zero managed assets, and no bundle writes.
- Project cover-image dry-run smoke passed with `codex-assisted` project mode,
  final decision `adapted`, adapted profile phase, adapted template phase, one
  managed cover asset, no unsupported-direction line for the handled cover
  request, and no bundle writes.
- Smoke outputs remained under the ignored
  `examples/playground/md-pdf/smoke/` tree.

## Timeout Review Smoke

Controlled timeout smoke reran the same Phase 7 live-smoke matrix twice:

- Baseline build with the previous 120s Markdown PDF Codex helper defaults.
- Comparison build with only the Markdown PDF profile/template helper defaults
  set to 30s.

Sanitized timeout-review result:

- 120s baseline passed for direct profile, direct template, project
  multilingual/font dry-run, and project cover-image dry-run.
- 30s comparison passed for the same four commands with the corrected direct
  read-only runner.
- Direct profile completed in about 11-13 seconds across the two runs.
- Direct template completed in about 14-16 seconds across the two runs.
- Project multilingual/font dry-run completed in about 11-13 seconds across the
  two runs.
- Project cover-image dry-run completed in about 24-32 seconds wall-clock across
  the two runs. This command performs separate profile and template Codex
  requests, so wall-clock time can exceed 30 seconds without violating the
  per-request 30s timeout.
- No timeout abort occurred during the 30s comparison.
- The controlled smoke rejects the earlier timeout hypothesis for the Phase 7
  matrix; 30s is the preferred default for the direct Markdown PDF Codex helper
  requests.

## Verification

- `bun test test/cli-actions-md-to-pdf-project-codex/validation.test.ts`
  - Passed: 16 tests, 145 assertions.
- `bun test test/cli-actions-md-to-pdf-project-codex/*.test.ts`
  - Passed: 58 tests, 571 assertions.
- `bun test test/cli-actions-md-to-pdf-template-codex/bundle-write.test.ts`
  - Passed: 16 tests, 79 assertions.
- `bun test test/adapters-codex-shared.test.ts`
  - Passed: 3 tests, 13 assertions.
- `bun test test/adapters-codex-markdown-pdf-profile.test.ts --test-name-pattern "default Codex runner"`
  - Passed.
- `bun test test/cli-actions-md-to-pdf-profile-codex-action.test.ts --test-name-pattern "default direct Codex runner|progress"`
  - Passed.
- `bun test test/cli-actions-md-to-pdf-profile-codex-action.test.ts --test-name-pattern "input and font hints"`
  - Passed: 1 test, 5 assertions.
- `bun test test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts --test-name-pattern "progress|spinner|Requesting Codex"`
  - Passed: 5 tests, 21 assertions.
- `bun test test/cli-actions-md-to-pdf-project-codex/profile-phase.test.ts --test-name-pattern "read-only|progress"`
  - Passed.
- `bun test test/cli-actions-md-to-pdf-project-codex/template-phase.test.ts --test-name-pattern "read-only|progress"`
  - Passed.
- `bun test test/cli-actions-md-to-pdf-project-codex/command-state.test.ts`
  - Passed: 6 tests, 13 assertions.
- `bun test test/cli-actions-md-to-pdf-project-codex/action-write.test.ts`
  - Passed: 16 tests, 577 assertions.
- `bunx tsc --noEmit`
  - Passed.
- `bun run format:check`
  - Passed after formatting the new source and test files.
- `bun run lint`
  - Passed after removing one unused import.
- `bun run build`
  - Passed.
- `git diff --check`
  - Passed.
- `bun test`
  - Passed: 1428 tests, 7204 assertions.
- Live direct profile, direct template, project multilingual/font dry-run, and
  project cover-image dry-run smoke
  - Passed.

## Artifact Safety

- Phase 7 writes no project artifacts from project orchestration.
- Direct-helper live smoke may write manual smoke outputs under
  `examples/playground/md-pdf/smoke/`.
- Injected-runner smoke used existing playground inputs and injected runners.
- Smoke output recorded only repo-relative paths, generated project-relative
  paths, and placeholders.
- No raw local resource path, temporary path, private URL, or generated
  playground output was added to this record.
