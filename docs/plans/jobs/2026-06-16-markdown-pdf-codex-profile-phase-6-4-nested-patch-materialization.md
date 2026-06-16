---
title: "Markdown PDF Codex profile Phase 6.4 nested patch materialization"
created-date: 2026-06-16
status: completed
agent: codex
---

## Scope

Complete Phase 6.4 of the Markdown PDF Codex profile helper by allowing strict accepted patches to write documented nested profile leaves even when the selected raw candidate profile omits their parent container objects.

## Failure Cause

A live run produced an allowed patch for `/cover/fields/title`, but the selected profile had `cover.enabled` without a raw `cover.fields` object. The strict patch enum accepted the path, then the applicator rejected it because it required every intermediate object to already exist.

The same raw-versus-normalized mismatch affected other documented fixed leaves such as `/pdf/content-langs`. Built-in candidates and user base profiles can be sparse while normalization supplies defaults later, so patch application needed a narrow parent-materialization rule.

## Fix

- Added an explicit materializable parent allowlist for fixed non-font profile containers:
  - `/toc`
  - `/pdf`
  - `/cover`
  - `/cover/fields`
  - `/header`
  - `/footer`
  - `/pageNumbers`
  - `/code`
- Kept patch application fail-closed for:
  - unknown paths
  - array parents
  - scalar parents
  - object patch values
  - non-replace operations
  - font-map parent creation
- Kept metadata mutation outside the Codex patch enum.
- Left flexible font-map writes for the dedicated Phase 6.5 font patch contract branch.
- Added prompt policy that local cover images, arbitrary CSS, custom HTML, and template-only layout are unsupported profile directions that should be reported through `unmatched_directions` and warnings instead of invented profile fields.

## Evidence

- `bun test test/adapters-codex-markdown-pdf-profile.test.ts`
  - 10 pass, 0 fail
- `bun test test/cli-actions-md-to-pdf-profile-codex-action.test.ts`
  - 35 pass, 0 fail
- `bun test test/adapters-codex-markdown-pdf-profile.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts`
  - 45 pass, 0 fail
- `bun run format:check`
  - all matched files use the correct format
- `bun run lint`
  - completed successfully
- `bun run build`
  - completed successfully
- `git diff --check`
  - completed successfully
- `bun test`
  - 1171 pass, 0 fail

## Smoke

- `node dist/esm/bin.mjs md pdf-profile codex README.md --intent "clean pdf with a proper cover page, cover should have the title what this doc is for" --dry-run`
  - used `--dry-run` without report flags, so no profile or report artifact was requested
  - sandboxed smoke reached Codex initialization and stopped at the app-server permission boundary before a live Codex response:

```text
Codex Markdown PDF profile helper is unavailable. Codex Exec exited with code 1: WARNING: proceeding, even though we could not create PATH aliases: Operation not permitted (os error 1)
Reading prompt from stdin...
Error: failed to initialize in-process app-server client: Operation not permitted (os error 1)
```

## Artifact Safety

- `git status --short --untracked-files=all` after the smoke run showed only source, test, and documentation changes.
- No generated Markdown PDF profile, Codex report, PDF, local resource, or replay artifact was staged or committed.
