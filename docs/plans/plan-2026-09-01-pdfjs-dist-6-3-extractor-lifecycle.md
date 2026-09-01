---
title: "PDF.js 6.3 Extractor Lifecycle Enhancement"
created-date: 2026-09-01
modified-date: 2026-09-01
status: completed
agent: codex
---

## Goal

Upgrade `pdfjs-dist` from `6.2.108` to `6.3.289` while correcting the PDF
document-title extractor's resource lifecycle and installed-package standard-
font resolution without changing its evidence or failure contracts.

## Planning Boundary

Phase 1 accepted the read-only baseline, target-release evidence, and
implementation boundary. Phases 2 and 3 completed the lifecycle, asset-
resolution, dependency, and cumulative validation work. The unified execution
record contains the completed phase evidence and exact review ranges.

Keep `pdfjs-dist/legacy/build/pdf.mjs`. The `6.3.289` modern build requires
JavaScript unavailable at the declared Node `22.23.0` floor and directs Node.js
consumers to the legacy build. This work must not raise the engine floor to
adopt the modern build.

The completed `v0.1.8-canary.2` dependency refresh intentionally deferred
PDF.js. It remains historical context and is not reopened by this enhancement.

## Related Documents

- [v0.1.8-canary.2 dependency and supply-chain refresh](jobs/2026-08-29-v0.1.8-canary.2-dependency-refresh.md)

## Scope

In scope:

- PDF document-title extractor lifecycle and focused regression coverage
- installed `pdfjs-dist/standard_fonts/` resolution
- `pdfjs-dist@6.3.289` provenance and package-surface verification
- exact Node `22.23.0`, current Node, build, focused, and full validation

Out of scope:

- modern PDF.js build, viewer, editor, or page-rendering adoption
- unused API-minor `Map`/`Set` surfaces or broad PDF.js type cleanup
- new parser options such as `isEvalSupported` without separate evidence
- title ranking, warnings, failure reasons, candidate limits, or CLI flags
- package-version, Node-engine, or Tsdown-target changes

## Implementation Rules

- Preserve package version `0.1.8-canary.2`, Node engine `>=22.23.0`, and
  Tsdown target `node22`.
- Freeze behavior and target-release evidence before changing source or tests.
- Correct integration behavior on `pdfjs-dist@6.2.108` before upgrading.
- Treat the current ineffective document-proxy cleanup as baseline evidence,
  not accepted lifecycle behavior.
- In the target lifecycle, attempt first-page cleanup in an inner `finally`,
  then destroy `PDFDocumentLoadingTask` in the outer `finally`. Attempt both on
  success and extraction failure; suppress cleanup errors so they do not
  replace the extractor result.
- Remove redundant `worker: null` configuration without changing Node worker
  behavior.
- Resolve `standard_fonts/` through Node module resolution, not fixed relative
  `node_modules` traversal, while preserving the current missing-font fallback.
- Use published lifecycle types where needed; do not expand into general type
  refactoring.
- Use `npx --yes node@22.23.0` for exact engine-floor smokes and record the
  actual commands and sanitized outcomes in the unified job record.
- Run focused validation and review the exact phase `base..tip` range before
  continuing. Widen and re-review after any review fix.

## Execution Record Strategy

Use one execution record for the complete enhancement:

```text
docs/plans/jobs/YYYY-MM-DD-pdfjs-dist-6-3-extractor-lifecycle.md
```

Create it when Phase 1 begins, using the execution date, and keep it
`in-progress` through the rollout. Record the clean starting commit, package
version, Node floor, initial and target PDF.js resolutions, and one concise
section per phase.

Phase 1 should end in a documentation/evidence checkpoint. Review the exact
clean starting commit through that checkpoint and record the range before
Phase 2. Later phase sections should record observable contracts, focused
validation, exact review range, accepted constraints, and Continue, Constrain,
or Stop decision. Phase 2 must pass on `6.2.108` before Phase 3 changes the
dependency. Complete the record only after Phase 3 closes cumulative
validation and plan lifecycle.

## Phase Checklist

### Phase 1: Baseline And Contract Freeze

Tasks:

- [x] Record `PHASE1_BASE` from the clean starting commit and create the unified
      `in-progress` job record.
- [x] Run the existing metadata-rich, no-text, and invalid-PDF fixture coverage
      without changing source or tests.
- [x] Record that current code retains only `PDFDocumentProxy` and calls its
      nonexistent public `destroy()` method, so loading-task and page cleanup
      are not currently performed.
- [x] Verify `6.3.289` repository, maintainer, integrity, signatures, SLSA
      provenance, Node engine, optional canvas dependency, legacy build, used
      declarations, and standard-font paths.
- [x] Compare the used extraction and lifecycle surfaces across both releases.
- [x] Run exact Node `22.23.0` legacy-build extraction smokes and record the
      modern-build incompatibility as evidence for retaining `legacy/`.
- [x] Update this plan and the job with the accepted evidence, create the
      Phase 1 documentation checkpoint, review `PHASE1_BASE..PHASE1_TIP`, and
      record the gate decision.

Observable contracts:

- metadata, outline, page count, first-page text, and failure classifications
  are the frozen behavior baseline
- current cleanup is ineffective; Phase 2 owns loading-task and page cleanup
- `6.3.289` retains the used APIs, assets, and legacy Node build
- Node `22.23.0` remains the authoritative runtime floor

Validation:

```bash
bun test test/document-rename/adapters/title-evidence.test.ts
./node_modules/.bin/tsc --noEmit
npx --yes node@22.23.0 --version
npx --yes node@22.23.0 --input-type=module -e "const { readFile } = await import('node:fs/promises'); const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'); const task = pdfjs.getDocument({ data: new Uint8Array(await readFile('test/fixtures/docs/metadata-rich.pdf')) }); try { const doc = await task.promise; const page = await doc.getPage(1); try { const text = await page.getTextContent(); if (doc.numPages !== 4 || text.items.length === 0) process.exitCode = 1; } finally { page.cleanup(); } } finally { await task.destroy(); }"
```

Run the same extraction body against the reviewed `6.3.289` tarball's legacy
build before installation by replacing only the module import with its extracted
file URL. Record the sanitized command and result in the job without retaining
the temporary local path.

Gate:

- Continue only when the baseline defect, target package, accepted target
  lifecycle, standard-font boundary, and legacy-build requirement are recorded.
- Constrain Phase 2 to lifecycle and asset resolution; defer unrelated API or
  parser hardening.
- Stop before Phase 2 if `6.3.289` removes a used API or cannot support the
  runtime floor through its legacy build.

### Phase 2: Lifecycle And Asset Resolution On PDF.js 6.2.108

Tasks:

- [x] Mark this plan `active` before the first source or test change.
- [x] Add focused coverage for repeated extraction, loading-task destruction,
      page cleanup on success and extraction failure, cleanup-error suppression,
      and installed-package standard-font resolution.
- [x] Retain `PDFDocumentLoadingTask`; clean up the page in the inner `finally`
      and destroy the task in the outer `finally`.
- [x] Remove `worker: null` and add only the lifecycle types required to make
      ownership explicit.
- [x] Resolve the installed PDF.js package root through Node module resolution
      and derive an accessible trailing-slash `standard_fonts/` file URL.
- [x] Run focused checks, build, and current-Node plus exact Node 22.23 import
      and extraction smokes while the dependency remains `6.2.108`.
- [x] Review the exact Phase 2 `base..tip` range, resolve findings, update the
      unified job section, and record the gate decision.

Observable contracts:

- extracted evidence, warnings, and fail-closed reasons remain unchanged
- page cleanup precedes loading-task destruction on success and failure
- cleanup errors remain non-fatal and do not expose raw PDF.js errors
- standard fonts resolve from the installed package rather than source depth
- built ESM and CJS imports remain Node-compatible

Validation:

```bash
bun test test/document-rename
./node_modules/.bin/tsc --noEmit
bun run lint
bun run format:check
bun run build
npx --yes node@22.23.0 --input-type=module -e "await import('./dist/esm/index.mjs')"
npx --yes node@22.23.0 -e "require('./dist/cjs/index.cjs')"
git diff --check
```

Repeat the Phase 1 PDF extraction smoke with the installed `6.2.108` legacy
build under exact Node `22.23.0`.

Gate:

- Continue only when the lifecycle and asset changes pass on `6.2.108` under
  current Node and exact Node `22.23.0`.
- Constrain Phase 3 to the reviewed dependency update and cumulative checks.
- Stop before upgrading if lifecycle ordering or installed-package asset
  resolution remains ambiguous.

### Phase 3: Upgrade, Cumulative Validation, And Closeout

Tasks:

- [x] Update `pdfjs-dist` to `^6.3.289` with the exact reviewed lockfile
      resolution; preserve package and runtime boundaries.
- [x] Confirm the installed resolution, integrity, legacy build, declarations,
      and standard-font paths match the reviewed target.
- [x] Re-run the Phase 1 and Phase 2 focused contract without changing behavior
      to accommodate the new release.
- [x] Run frozen install, native TypeScript, audits, untrusted-script review,
      lint, formatting, build, full suite, and current-Node smokes.
- [x] Run exact Node `22.23.0` ESM, CJS, CLI, and legacy-build PDF extraction
      smokes through `npx --yes node@22.23.0`.
- [x] Run final `bun outdated`; record new candidates without expanding scope.
- [x] Review the exact Phase 3 and complete-plan `base..tip` ranges, resolve
      findings, and re-review widened ranges.
- [x] Complete the unified job with counts, smokes, audits, outdated state,
      review ranges, and final gate decision; then mark plan and job completed.

Observable contracts:

- `6.3.289` preserves the accepted extraction, cleanup, and asset contract
- the legacy build remains explicit at the Node 22.23 floor
- public CLI behavior and package/runtime support remain unchanged

Validation:

```bash
bun install --frozen-lockfile
./node_modules/.bin/tsc --noEmit
bun audit
bun audit --production
bun pm untrusted
bun run lint
bun run format:check
bun run build
bun test test/document-rename
bun test
node --input-type=module -e "await import('./dist/esm/index.mjs')"
node -e "require('./dist/cjs/index.cjs')"
node dist/esm/bin.mjs --version
npx --yes node@22.23.0 --input-type=module -e "await import('./dist/esm/index.mjs')"
npx --yes node@22.23.0 -e "require('./dist/cjs/index.cjs')"
npx --yes node@22.23.0 dist/esm/bin.mjs --version
git diff --check
bun outdated
```

Repeat the Phase 1 PDF extraction smoke against installed `6.3.289` under
current Node and exact Node `22.23.0`.

Gate:

- Complete only when the target dependency, focused and full checks, runtime
  smokes, unified record, and exact-range reviews are complete.
- Constrain unrelated new dependency candidates to separate review.
- Stop and mark the plan `blocked` if the target cannot preserve the accepted
  extractor or runtime contract.

## Completion Criteria

- [x] All three phase gates and exact review ranges are recorded in the unified
      job.
- [x] Repeated extraction performs page cleanup and loading-task destruction
      without changing user-visible results.
- [x] Standard fonts resolve through the installed package.
- [x] `pdfjs-dist@6.3.289` passes focused, full, audit, build, and exact Node
      `22.23.0` validation.
- [x] The complete implementation range has no unresolved actionable finding.
