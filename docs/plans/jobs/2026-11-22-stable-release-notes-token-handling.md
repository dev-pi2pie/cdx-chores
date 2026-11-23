---
title: "Keep GitHub tokens out of release-note command arguments"
created-date: 2026-11-22
status: completed
agent: codex
---

## Change

The stable release-notes generator passed its GitHub bearer token in a `curl` argument during API lookups. It now sends the authorization header through stdin. Authenticated requests retain `GH_TOKEN` precedence and the `GITHUB_TOKEN` fallback. Requests with neither token remain unauthenticated. A token containing a line break skips API enrichment and uses the existing release-note fallback. [Release notes generator](../../../scripts/generate-stable-release-notes.sh)

## CI Flow

The stable notes step supplies `GH_TOKEN` in the notes job, which has read permissions for repository contents and pull requests. A tagged changelog override returns before API enrichment. On the generated-notes path, the script reads the same environment variable and keeps the header out of `curl` arguments. Prerelease notes use `git-cliff`. The release job receives the selected note body and publishes it separately. [Release workflow](../../../.github/workflows/release.yml)

## Verification

- `bash -n scripts/generate-stable-release-notes.sh` passed.
- All nine release-tooling application tests passed. The existing PR-title test uses a synthetic token and a `curl` stub to verify that the authorization header arrives through stdin and the token stays out of command arguments. [Stable notes tests](../../../test/release-tooling/stable-notes.app.test.ts)
- `bun run lint` and `git diff --check` passed. CI routing was reviewed from the workflow source.
