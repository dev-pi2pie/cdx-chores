---
title: "PDF.js 6.3 Extractor Lifecycle Enhancement"
created-date: 2026-09-01
status: in-progress
agent: codex
---

## Goal

Execute the phased [PDF.js 6.3 extractor lifecycle enhancement
plan](../plan-2026-09-01-pdfjs-dist-6-3-extractor-lifecycle.md) while preserving
the document-title evidence contract, Node `22.23.0` runtime floor, package
version `0.1.8-canary.2`, and Tsdown `node22` target.

## Starting State

- Branch: `dev`
- Clean starting commit / `PHASE1_BASE`:
  `2df804dee16f3e7a1e28385c02c4551941ee041f`
- Development tooling: Bun `1.4.0`
- Current development runtime: Node `26.5.0`
- Declared runtime floor: Node `>=22.23.0`
- Initial PDF.js dependency and installed resolution: `^6.2.108` / `6.2.108`
- Target PDF.js dependency and resolution: `^6.3.289` / `6.3.289`

## Phase 1: Baseline And Contract Freeze

Status: `completed`

### Evidence

- The unchanged metadata-rich, no-text, and invalid-PDF fixtures preserved
  metadata, outline, page-count, first-page-text, and fail-closed outcomes.
- Runtime inspection confirmed `PDFDocumentLoadingTask.destroy()` and
  `PDFPageProxy.cleanup()` are public functions, while
  `PDFDocumentProxy.destroy()` is absent. The extractor currently retains only
  the document proxy and therefore performs neither effective task destruction
  nor page cleanup.
- The current source-depth standard-font candidates work only from the source
  tree. Tsdown preserves those relative traversals in ESM and CJS output, where
  both candidates resolve above the installed package boundary. Phase 2 owns
  replacement with Node package resolution while preserving the missing-font
  fallback.
- The `6.3.289` package identifies Mozilla's PDF.js repository and the existing
  PDF.js maintainer group, declares Node `>=22.13.0 || >=24`, retains optional
  `@napi-rs/canvas@^1.0.0`, and publishes no install scripts. These boundaries
  match `6.2.108` and cover the repository's Node `22.23.0` floor.
- The published tarball matched SHA-1
  `9e46d89489782a479f58d674ae5ddde8481aaa17` and SHA-512 integrity
  `ZHjSVpDa3D6izMq8/04lvkhkATUmL9px6ChPaXc1k6nU2Mrhlg1/7F0bdUqCwUjw3NsPTfPZsMDUU6ZIcRaeQw==`.
  An isolated, script-disabled npm installation verified registry signatures
  and attestations for `pdfjs-dist@6.3.289`, optional
  `@napi-rs/canvas@1.0.8`, and its environment-selected platform package; the
  PDF.js attestation includes SLSA provenance for the Mozilla release tag.
- The target contains its modern and legacy builds, declarations, and all 16
  standard-font assets. Across `6.2.108` and `6.3.289`, the used declarations
  remain compatible: `getDocument`, loading-task `destroy`, document
  `getMetadata`, `getOutline`, and `getPage`, plus page `getTextContent` and
  `cleanup` retain their accepted surfaces.
- Exact Node `22.23.0` extracted the target fixture through the `6.3.289`
  legacy build with 4 pages, metadata title, 1 outline item, and 127 text
  items. The target modern build instead directed Node consumers to the legacy
  build and failed because `Promise.try` is unavailable at the declared floor.
  The legacy build therefore remains the accepted Node integration.

### Validation

- `bun test test/document-rename/adapters/title-evidence.test.ts` — 9 passed,
  0 failed, 42 assertions.
- `./node_modules/.bin/tsc --noEmit` — passed.
- `npx --yes node@22.23.0 --version` — reported `v22.23.0`.
- The plan's installed `6.2.108` exact-Node extraction smoke — passed with 4
  pages and 127 first-page text items.
- The same smoke against the reviewed `6.3.289` legacy tarball — passed with
  metadata, outline, page-count, and text evidence.
- `npm audit signatures` in an isolated, script-disabled target installation —
  the exact PDF.js package, optional canvas package, and selected platform
  package had verified registry signatures and attestations.

Sanitized package and provenance commands:

```bash
npm view pdfjs-dist@6.3.289 name version repository maintainers \
  dist.integrity dist.shasum dist.signatures dist.attestations engines \
  optionalDependencies --json
npm pack pdfjs-dist@6.3.289 --json
shasum -a 1 pdfjs-dist-6.3.289.tgz
openssl dgst -sha512 -binary pdfjs-dist-6.3.289.tgz | openssl base64 -A
PDFJS_PACKAGE_ROOT="/tmp/pdfjs-dist-6.3.289/package"
rg --files "$PDFJS_PACKAGE_ROOT/standard_fonts"
rg -n "getDocument|destroy|cleanup|getMetadata|getOutline|getPage|getTextContent" \
  "$PDFJS_PACKAGE_ROOT/types/src/display/api.d.ts"
npm install --ignore-scripts
npm audit signatures --json --include-attestations
```

The isolated install used a package manifest containing only exact dependency
`pdfjs-dist@6.3.289`. Package paths above replace the temporary extraction
location.

Exact Node-floor target smoke shape, run once with the legacy entry and once
with the modern entry:

```bash
PDFJS_ENTRY="file:///tmp/pdfjs-dist-6.3.289/package/legacy/build/pdf.mjs" \
npx --yes node@22.23.0 --input-type=module -e "const { readFile } = await import('node:fs/promises'); const pdfjs = await import(process.env.PDFJS_ENTRY); const task = pdfjs.getDocument({ data: new Uint8Array(await readFile('test/fixtures/docs/metadata-rich.pdf')) }); try { const doc = await task.promise; const metadata = await doc.getMetadata(); const outline = await doc.getOutline(); const page = await doc.getPage(1); try { const text = await page.getTextContent(); console.log(JSON.stringify({ pages: doc.numPages, metadataTitle: metadata.info?.Title, outlineItems: outline?.length ?? 0, textItems: text.items.length })); } finally { page.cleanup(); } } finally { await task.destroy(); }"
```

The modern run replaced only `legacy/build/pdf.mjs` with `build/pdf.mjs` and
failed at unavailable `Promise.try` after instructing Node consumers to use the
legacy build.

### Review

- `PHASE1_TIP`: `16316956`.
- Exact evidence range: `2df804de..16316956`.
- The first review requested sanitized reproduction commands and correction of
  audit wording. Those accepted findings landed in `c364a89d`.
- The widened documentation review found one low-severity clarity issue about
  the verified package set; `16316956` identifies that set without recording
  platform-specific machine details.
- Final documentation and focused supply-chain reviews of the exact range found
  no remaining actionable issue.
- This ledger-only closeout records the already-reviewed semantic range and is
  included in later cumulative rollout review.

### Gate

- Decision: **Continue** to Phase 2.
- Constrain Phase 2 to loading-task and first-page lifecycle ownership,
  cleanup-error suppression, redundant `worker: null` removal, installed
  standard-font resolution, and focused regression coverage on `6.2.108`.
- Retain the legacy build and Node `22.23.0` floor. Defer unrelated API-minor,
  parser-option, rendering, and type-cleanup work.

## Phase 2: Lifecycle And Asset Resolution On PDF.js 6.2.108

Status: `completed`

- `PHASE2_BASE`: `2e331088`.
- `PHASE2_TIP`: `b9099979`.

### Implementation And Contracts

- The extractor now retains `PDFDocumentLoadingTask`, cleans an acquired first
  page in an inner `finally`, and destroys the loading task in the outer
  `finally`. Page cleanup precedes task destruction on success and first-page
  failure; task destruction also runs when document or page loading fails.
- Page-cleanup and task-destruction errors are suppressed after extraction so
  they cannot replace evidence, warnings, or fail-closed reasons.
- Redundant `worker: null` was removed. Published lifecycle types define the
  narrow internal loader seam without changing the package's public exports.
- Standard fonts now resolve from `pdfjs-dist/package.json` through Node module
  resolution, derive a trailing-slash `standard_fonts/` file URL, verify its
  accessibility, and preserve the cached `undefined` fallback.
- Repeated real and loader-backed extraction preserves evidence and performs
  ordered page cleanup followed by task destruction.
- The dependency remained `pdfjs-dist@6.2.108` throughout Phase 2.

### Validation

- `bun test test/document-rename` — 18 passed, 0 failed, 71 assertions.
- `./node_modules/.bin/tsc --noEmit` — passed.
- `bun run lint` — passed.
- `bun run format:check` — passed.
- `bun run build` — passed; embedded package version remained
  `0.1.8-canary.2` and all Tsdown targets remained `node22`.
- Current Node imported built ESM and CJS outputs and resolved the installed
  standard-font directory from both bundle entry depths.
- Exact Node `22.23.0` imported built ESM and CJS outputs, resolved standard
  fonts from both bundle entry depths, and extracted the installed `6.2.108`
  fixture with 4 pages and 127 first-page text items.
- `git diff --check` — passed.

### Review

- Exact range: `2e331088..b9099979`.
- Initial maintainability review requested alignment of the plan's active
  boundary. Initial test review requested stronger evidence, URL, access-
  fallback, page-load failure, and repeated-lifecycle assertions.
- Accepted fixes landed in `b9099979`; the widened maintainability, test, and
  focused trust-boundary reviews found no remaining actionable issue.
- This ledger-only closeout records the already-reviewed semantic range and is
  included in later cumulative rollout review.

### Gate

- Decision: **Continue** to Phase 3.
- Constrain Phase 3 to `pdfjs-dist@6.3.289`, the reviewed lockfile resolution,
  installed-package verification, cumulative validation, and lifecycle
  closeout. Do not change extractor behavior to accommodate the update.

## Phase 3: Upgrade, Cumulative Validation, And Closeout

Status: `pending`
