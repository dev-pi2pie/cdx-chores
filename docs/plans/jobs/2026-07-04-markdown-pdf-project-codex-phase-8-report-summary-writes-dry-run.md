---
title: "Markdown PDF project Codex phase 8 report, summary, writes, and dry run"
created-date: 2026-07-04
modified-date: 2026-07-05
status: completed
agent: codex
plan: ../plan-2026-07-04-markdown-pdf-project-codex-helper.md
---

## Scope

Implement Phase 8 of the `md pdf-project codex` plan.

This phase turns the already validated in-memory project helper into an
action-level workflow that can print a concise summary, persist an advisory
report, write project bundle files, and honor dry-run report-only behavior. It
does not add render-feed integration coverage; Phase 9 owns that broader smoke
and integration layer.

This job was reopened because the implementation and injected-runner coverage
landed before live Codex write and render-smoke evidence was recorded. The
reopened pass restored the project helper to the same direct read-only Codex
workspace contract as the successful direct profile and template helpers, then
recorded sanitized write-smoke and render-smoke evidence.

## Implementation Notes

- Added `report.ts` with the `markdown-pdf-codex-project-report` JSON artifact.
- Marked project reports as `advisoryOnly: true`.
- Recorded project, profile, and template IDs without persisting the raw output
  directory from the internal identity object.
- Recorded generated project artifacts as bundle-relative paths.
- Recorded public-safe input summaries, intent, font hints, cover-image
  metadata, phase modes, final decision mode, unsupported directions, fallback
  reasons, validation results, and follow-up render command arguments.
- Kept replay placeholders such as `<input.md>` and `<output.pdf>` in the
  follow-up render command when no concrete Markdown input or output PDF exists.
- Added `summary.ts` for concise CLI output covering signal mode, final
  decision, output directory, generated artifacts, report path, validation
  failures, and follow-up render command.
- Added `write-project.ts` for normal project bundle writes and report-only
  diagnostic writes.
- Wired `actionMdPdfProjectCodex` through command normalization, signal
  collection, output planning, profile phase, template phase, project
  validation, summary printing, dry-run report writes, normal bundle writes,
  and no-usable report-only failure handling.
- Added report-only output writability mode so dry-run and no-usable diagnostic
  reports can be written without requiring replacement of bundle files.
- Kept generated profile, template, stylesheet, and managed asset paths reserved
  during report-only planning so diagnostic reports cannot overwrite them.
- Added non-CLI runner injection for profile and template Codex phases so
  action-level tests can cover Codex-assisted branches without live Codex.
- Followed up on phase code review by redacting free-form report text before it
  is persisted, including raw intent, font hints, phase warnings, fallback
  reasons, unsupported directions, and validation messages.
- Validate report-target writability before normal bundle writes so report
  conflicts fail before writing `profile.yml`, `template.html`, `style.css`,
  or managed assets.
- Write requested project reports only after successful normal bundle writes so
  stale reports cannot describe a usable project when later bundle writes fail.
- Reused one unsupported-direction collector for both CLI summary and report
  output.
- Serialized managed asset report entries from accepted synthesis bindings and
  matching planned asset metadata instead of assuming a first asset.
- Kept project report managed-asset serialization cover-image specific until
  additional managed asset roles exist.
- Added an explicit report-writability helper so report-only planning and
  writer-side rechecks share the same named policy.
- Extended free-form report redaction to path-shaped relative resource tokens,
  non-web scheme URLs, and alternate loopback forms.
- Followed up on final phase review by applying the same free-form diagnostic
  redaction to terminal summaries and no-usable-project error messages.
- Followed up on final security review by using project public-path display for
  project summary, completion, and output/report validation errors.
- Redacted managed-asset read failure diagnostics before surfacing them as CLI
  errors.
- Added opt-in public display and diagnostic sanitization hooks for safe write
  helpers, then used them for project report, bundle file, and managed asset
  writes.
- Followed up on final security confirmation by sanitizing early project-Codex
  input and base-profile read or parse failures at the project boundary.

## Tests

- Added `test/cli-actions-md-to-pdf-project-codex/action-write.test.ts`.
- Covered dry-run report-only writes in an existing project output directory.
- Covered dry-run report-only path collisions against reserved project artifact
  paths.
- Covered normal deterministic project bundle writes.
- Covered cover-image metadata and managed asset report redaction.
- Covered persisted report schema fields including `artifactType`, `version`,
  `advisoryOnly`, identities, files, and follow-up render arguments.
- Covered persisted follow-up render command display text and shell quoting.
- Covered `<input.md>` and `<output.pdf>` replay placeholders in report output.
- Covered no-usable project behavior that writes only the advisory report and
  leaves `profile.yml`, `template.html`, and `style.css` unwritten.
- Covered the non-dry-run no-usable-project report branch without partial
  bundle writes.
- Covered summary and error-output redaction for sensitive free-form
  diagnostics.
- Covered public-safe summary, completion, output validation, and report
  validation path displays even when absolute display mode is requested.
- Covered managed-asset read failures without leaking local source paths from
  OS diagnostics.
- Covered symlinked managed asset source rejection without writing stale
  reports.
- Covered late report and bundle write failures without leaking local target
  paths after preflight.
- Covered late bundle write failures without leaving behind reports that
  describe a usable project.
- Covered missing Markdown input, unreadable base profile, and malformed base
  profile failures without leaking local paths.
- Covered report privacy assertions against raw local paths, temporary paths,
  scheme URLs, and loopback references.
- Covered field-level report redaction for persisted intent, phase diagnostics,
  unsupported directions, project fallback reason, and validation messages.
- Covered report redaction for POSIX paths, file-scheme URLs, non-web scheme
  URLs, Windows paths, UNC paths, path-shaped relative resource tokens, and
  loopback references.
- Covered report output conflicts before normal bundle writes and verified
  existing reports are not replaced.
- Covered command-layer `--dry-run --keep-codex-report` report generation.
- Covered command-layer dry-run report generation before deterministic
  no-usable-project failures, including explicit external report output.
- Covered command-layer direct `md pdf-profile codex` no-usable failure report
  generation.
- Covered command-layer public display for explicit external report paths and
  follow-up render command replay placeholders.

## Live Smoke

Live smoke used real Codex helper calls, kept generated manual artifacts under
`examples/playground/md-pdf/smoke/`, and recorded sanitized pass/fail evidence
without adding these smoke cases to the regular test suite.

Setup:

```bash
mkdir -p examples/playground/md-pdf/smoke
```

Project write smoke for multilingual font behavior:

```bash
node dist/esm/bin.mjs md pdf-project codex examples/playground/md-pdf/cjk-font-smoke.md \
  --intent "multi-language PDF project for Traditional Chinese, English, readable headings, and stable page numbers" \
  --font-hint "English body text should use a readable Latin serif font" \
  --font-hint "Japanese body text should prefer Hiragino Mincho or an equivalent Japanese Mincho serif font" \
  --font-hint "Traditional Chinese body text should use Noto Serif CJK TC or an equivalent Traditional Chinese serif font" \
  --font-hint "code blocks should use a dedicated monospace font such as JetBrains Mono" \
  -o examples/playground/md-pdf/smoke/project-cjk \
  --keep-codex-report \
  --overwrite
```

Project write smoke for cover image behavior:

```bash
node dist/esm/bin.mjs md pdf-project codex examples/playground/md-pdf/tool-cover-smoke.md \
  --intent "cover page uses the cover image first, then title and document info; keep body page numbers readable" \
  --cover-image examples/playground/md-pdf/assets/tool-cover-sample.jpg \
  -o examples/playground/md-pdf/smoke/project-cover \
  --keep-codex-report \
  --overwrite
```

Combined project write smoke for multilingual content, cover image, and page
numbers:

```bash
node dist/esm/bin.mjs md pdf-project codex examples/playground/md-pdf/cjk-font-smoke.md \
  --intent "multi-language report with a cover image, cover page first, readable Traditional Chinese and English fonts, and visible page numbers after the cover" \
  --font-hint "English body text should use a readable Latin serif font" \
  --font-hint "Japanese body text should prefer Hiragino Mincho or an equivalent Japanese Mincho serif font" \
  --font-hint "Traditional Chinese body text should use Noto Serif CJK TC or an equivalent Traditional Chinese serif font" \
  --font-hint "code blocks should use a dedicated monospace font such as JetBrains Mono" \
  --cover-image examples/playground/md-pdf/assets/tool-cover-sample.jpg \
  -o examples/playground/md-pdf/smoke/project-cjk-cover-pages \
  --keep-codex-report \
  --overwrite
```

Manual render smoke for visual inspection of the combined bundle:

```bash
node dist/esm/bin.mjs md to-pdf \
  -i examples/playground/md-pdf/cjk-font-smoke.md \
  --profile examples/playground/md-pdf/smoke/project-cjk-cover-pages/profile.yml \
  --template examples/playground/md-pdf/smoke/project-cjk-cover-pages/template.html \
  --css examples/playground/md-pdf/smoke/project-cjk-cover-pages/style.css \
  -o examples/playground/md-pdf/smoke/project-cjk-cover-pages/output.pdf \
  --overwrite
```

Current sanitized live-smoke result:

- Direct `md pdf-profile codex` multilingual smoke passed with four repeated
  `--font-hint` flags for English body, Japanese body, Traditional Chinese
  body, and code monospace.
- Direct `md pdf-template codex` cover-image smoke passed with an adapted
  cover-media template and one managed cover asset.
- `md pdf-project codex` multilingual/font write smoke passed with
  `codex-assisted` project mode, final decision `adapted`, adapted profile
  phase, deterministic template phase, zero managed assets, and a project
  report.
- `md pdf-project codex` cover-image write smoke passed with
  `codex-assisted` project mode, final decision `adapted`, adapted profile
  phase, adapted template phase, one managed cover asset, and a project report.
- Combined `md pdf-project codex` write smoke passed with multilingual content,
  repeated font hints, cover image, and page-number intent. The generated
  profile enabled body page numbers and selected dedicated body/code font
  entries; the generated template used the managed cover image.
- Manual `md to-pdf --profile --template --css` render replay from the combined
  project bundle passed and wrote a PDF.
- PDF inspection reported a two-page A4 document. Rendered page previews were
  generated outside the repository for visual smoke inspection.
- Smoke outputs remained under the ignored
  `examples/playground/md-pdf/smoke/` tree.

## Verification

- `bunx tsc --noEmit`
  - Passed.
- `bun test test/cli-actions-md-to-pdf-project-codex/action-write.test.ts`
  - Passed: 17 tests.
- `bun test test/cli-actions-md-to-pdf-project-codex/*.test.ts`
  - Passed: 77 tests, 1172 assertions.
- `bun test test/cli-actions-md-to-pdf-commands.test.ts --test-name-pattern "md pdf-project codex"`
  - Passed: 7 tests, 92 assertions.
- `bun run format:check`
  - Passed after formatting new source and test files.
- `bun run lint`
  - Passed.
- `bun run build`
  - Passed.
- `git diff --check`
  - Passed.
- Docs privacy scan for raw local paths, private temporary paths, local resource
  tokens, scheme URLs, and loopback references
  - Passed with no matches.
- `bun test`
  - Passed: 1458 tests, 7862 assertions.
- Live `md pdf-project codex` write smoke for multilingual/font project output
  - Passed.
- Live `md pdf-project codex` write smoke for cover-image project output
  - Passed.
- Live combined `md pdf-project codex` write smoke for multilingual content,
  cover image, and page-number intent
  - Passed.
- Manual render smoke
  - Passed.

## Artifact Safety

- Persisted reports use bundle-relative paths for project artifacts.
- Local input paths are recorded through the public path display helper.
- Cover-image sources are recorded as basenames with `redacted: true`.
- Follow-up render commands use repo-relative paths when available and
  placeholders when no concrete replay path should be persisted.
- Manual live-smoke artifacts belong under `examples/playground/md-pdf/smoke/`
  so later cleanup has one clear target.
- This job record records only repository-relative paths and sanitized command
  results.
