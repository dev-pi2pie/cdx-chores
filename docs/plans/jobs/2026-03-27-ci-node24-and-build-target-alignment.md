---
title: "Align CI runtimes with Node 24 and build target with engine floor"
created-date: 2026-03-27
modified-date: 2026-03-27
status: completed
agent: codex
---

## Goal

Reduce CI runtime drift around the GitHub Actions Node 20 deprecation and align the package build target with the repository's declared Node support floor.

## Changes

- Updated `.github/workflows/publish-npm-packages.yml` to use `actions/setup-node@v6` with Node `24.14.1`.
- Removed the `npm install -g npm@latest` step from the npm publish workflow so trusted publishing runs on the configured Node runtime directly.
- Updated `.github/workflows/publish-github-packages.yml` to use Node `24.14.1`.
- Replaced `softprops/action-gh-release@v2` in `.github/workflows/release.yml` with a `gh release create` step to avoid the deprecated Node 20 JavaScript action runtime.
- Made the release workflow rerun-safe by checking for an existing release first and updating it with `gh release edit` instead of failing on duplicate tag creation.
- Updated `tsdown.config.ts` build targets from `node20` to `node22` to better match the package engine floor in `package.json`.

## Verification

- `bun run build`
- Manual workflow review of the `release` job branch for `gh release view` -> `gh release edit/create`

## Outcome

- Local build passed with the updated `tsdown` target.
- Publish and release workflows no longer depend on the deprecated `softprops/action-gh-release@v2` action runtime, and the release job can be rerun for the same tag without failing on duplicate release creation.
