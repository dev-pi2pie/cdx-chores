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

Status: `in-progress`

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
  and attestations for all three installed packages; the PDF.js attestation
  includes SLSA provenance for the Mozilla release tag.
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
  3 packages with verified registry signatures and 3 with verified
  attestations; 0 vulnerabilities.

### Review

- Pending exact `PHASE1_BASE..PHASE1_TIP` review.

### Gate

- Pending Continue, Constrain, or Stop decision.

## Phase 2: Lifecycle And Asset Resolution On PDF.js 6.2.108

Status: `pending`

## Phase 3: Upgrade, Cumulative Validation, And Closeout

Status: `pending`
