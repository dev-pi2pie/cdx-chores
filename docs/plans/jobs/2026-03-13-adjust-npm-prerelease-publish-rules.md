---
title: "Adjust npm prerelease publish rules"
created-date: 2026-03-13
modified-date: 2026-03-13
status: completed
agent: codex
---

## Goal

Restrict the npm publish workflow so prerelease publishing only accepts `canary*` and `rc*` tags, while keeping package naming aligned with `package.json` instead of applying a GitHub owner scope.

## What Changed

- reviewed `.github/workflows/publish-npm-packages.yml` against `.github/workflows/publish-github-packages.yml`
- confirmed the npm workflow already publishes the package name from `package.json` and does not rewrite it to a `@dev-pi2pie` scope
- updated the npm `push` trigger to ignore `*-alpha*` and `*-beta*` tags so those prereleases do not start the npm workflow
- updated npm prerelease detection to recognize only `rc` and `canary`
- kept an explicit failure for `alpha*` and `beta*` tags during manual dispatch so those prerelease channels remain GitHub Packages only

## Verification

- re-read `.github/workflows/publish-npm-packages.yml` after the edit to confirm stable releases still publish normally
- verified the GitHub Packages workflow remains unchanged and still accepts `alpha`, `beta`, `rc`, and `canary`
