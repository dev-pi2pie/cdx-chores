---
title: "CI Action Pins and Runtime Refresh"
created-date: 2026-10-23
status: completed
agent: codex
---

## Scope

Pin the reviewed actions in all three publishing/release workflows and update both publishing runtimes. Preserve package version `0.2.2-canary.1`, Node.js engine requirement `>=22.23.0`, and the absence of a `packageManager` field. This follows the [dependency refresh](2026-10-23-v0.2.2-canary.1-dependency-runtime-refresh.md).

| Action | Previous reference | Reviewed release | Commit SHA |
| --- | --- | --- | --- |
| `actions/checkout` | `v6` | `v7.0.1` | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | `v6` | `v7.1.0` | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| `oven-sh/setup-bun` | `v2` | `v2.2.0` | `0c5077e51419868618aeaa5fe8019c62421857d6` |
| `orhun/git-cliff-action` | `v4` | `v4.9.1` | `a9a95522b26fe6403f7bb24031f21fb573d0f5ff` |

Both publishing workflows select Node.js `24.22.1` instead of `24.18.0` and Bun `1.4.4` instead of `latest`. The prerelease notes action uses git-cliff `v2.14.2` through the pinned action's default; the workflow does not duplicate that version with an override. Release-version comments identify each action pin for future reviews.

## Authentication and Security Boundaries

The npm publish step retains `NODE_AUTH_TOKEN: ""` and OIDC/provenance. setup-node v7 removes its dummy token fallback but still generates an `.npmrc` with a token-variable reference. An explicit empty value remains intentional; npm distinguishes it from an unset variable. GitHub Packages retains its actual `GITHUB_TOKEN` authentication. Local checks do not establish successful GitHub OIDC exchange or registry publication.

Full action SHAs prevent silent changes through moving action tags; they do not independently verify downloaded tools or establish that the action bundle is vulnerability-free. Registry checks against upstream runtime lockfiles found advisory matches in checkout v7.0.1's Undici and setup-node v7.1.0's TOML parser. These dependency matches were not demonstrated exploitable in these workflows; the configured explicit Node version does not use TOML parsing.

Broader work remains deferred: build/publish job separation, permission changes, credential persistence, cache policy, verified binary downloads, automated pin updates, and runner-image policy. In particular, the git-cliff installer downloads its release archive without checksum verification. Triggers, branch validation, release-note selection, registry destinations, and publication channels retain their existing behavior. The workflows still build without running the managed test suites.

## Validation

- `actionlint` passed workflow/expression validation with ShellCheck disabled. With ShellCheck enabled, its only diagnostic is the existing `SC2153` warning about `TAG_NAME` in npm package-metadata verification; the committed workflow produces the same warning. No new diagnostic was introduced.
- Parsed all workflows and compared them against the committed versions after applying only the approved action/runtime substitutions. All nine action references use the reviewed full SHAs; the npm publish token remains exactly an empty string. Triggers, permissions, checkout/fetch configuration, and publication commands match the committed configuration.
- All nine existing release-tooling tests passed across three files, with 154 assertions, using Bun 1.4.4. This was a focused invocation, not the full managed application suite.
- On macOS arm64, frozen dependency installation and the Node-target build passed with Node.js 24.22.1 and Bun 1.4.4, using a generated npm-registry `.npmrc` with `NODE_AUTH_TOKEN` unset. The existing TypeScript 7 experimental-API warning remains.
- With `NODE_AUTH_TOKEN` explicitly empty and isolated npm configuration/cache, `npm pack --dry-run --json --ignore-scripts` passed for `cdx-chores@0.2.2-canary.1` with 35 files. Built ESM/CommonJS loading and CLI version checks passed under Node.js 24.22.1. No package archive was written.
- Documentation links and `git diff --check` passed. No global runtime was changed, and no publication or workflow dispatch was performed. Hosted Linux action execution, GitHub OIDC exchange, and GitHub Packages authentication remain unverified locally.

## Sources

- [Checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0), [setup-bun v2.2.0](https://github.com/oven-sh/setup-bun/releases/tag/v2.2.0), and [git-cliff action v4.9.1](https://github.com/orhun/git-cliff-action/releases/tag/v4.9.1).
- [Node.js 24.22.1 security release](https://nodejs.org/en/blog/release/v24.22.1) and [Bun 1.4.4](https://bun.com/blog/bun-v1.4.4).
- [setup-node dummy-token removal](https://github.com/actions/setup-node/pull/1558) and [npm 11.19.1 environment expansion](https://github.com/npm/cli/blob/v11.19.1/workspaces/config/lib/env-replace.js).
- [GitHub action security guidance](https://docs.github.com/en/actions/reference/security/secure-use) and [git-cliff installer source](https://github.com/orhun/git-cliff-action/blob/a9a95522b26fe6403f7bb24031f21fb573d0f5ff/install.sh).
