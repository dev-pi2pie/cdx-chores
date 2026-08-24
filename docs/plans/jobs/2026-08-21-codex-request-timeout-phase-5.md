---
title: "Codex request timeout Phase 5"
created-date: 2026-08-21
status: completed
agent: codex
---

## Goal

Apply the shared duration-based Codex request-timeout contract to the selected
data and Markdown direct commands, as defined by Phase 5 of the
[Codex request timeout plan](../plan-2026-08-21-codex-request-timeout-contract.md).

## Starting Point

Starting commit: `a69f251ffa7b174184a7aed0d86f6ff175c1d529`

Phase 4 is complete and reviewed. The working tree was clean at this boundary.

## Implementation Boundary

- reuse one Commander timeout-option helper across rename, data, and Markdown
  command registration
- add the shared option only to the five approved direct command surfaces
- preserve the 30-second default and existing numeric action or prepared-service
  injection seams
- keep timeout options from enabling optional Codex assistance
- give each Markdown profile, template, project, and repair request its own
  timeout window with the same configured value
- preserve current report schemas, artifacts, recovery behavior, and generic
  failures

## Validation

```text
bun test test/cli-options-codex-timeout.test.ts test/cli-command-rename-timeout.test.ts test/cli-command-data-codex-timeout.test.ts test/cli-command-markdown-codex-timeout.test.ts test/cli-actions-data-query-codex-validation.test.ts test/cli-actions-data-query-codex.test.ts test/cli-actions-data-stack/codex-assist.test.ts test/adapters-codex-failure.test.ts test/adapters-codex-markdown-pdf-template.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts test/cli-actions-md-to-pdf-project-codex/prepared.test.ts
244 pass, 0 fail

bun test test/adapters-codex-failure.test.ts test/cli-actions-data-query-codex.test.ts test/cli-actions-data-query-codex-validation.test.ts test/cli-actions-data-stack/codex-assist.test.ts test/cli-actions-md-to-pdf-profile-codex-action.test.ts
91 pass, 0 fail after review fixes

bun test
2564 pass, 0 fail

bunx tsc --noEmit
bun run lint
bun run format:check
bun run build
git diff --check
passed
```

Focused coverage verifies strict and repeated duration parsing before action
execution, all five direct command/help surfaces, explicit and default numeric
forwarding, data-stack non-activation and replay behavior, template repair,
project profile/template/repair request windows, structural timeout wording,
ordinary abort and generic failure preservation, and unchanged report and
artifact schemas. The Node-target build help was inspected for all five direct
commands. No live Codex request was used.

## Review

Implementation commits:

- `2dfd2656` — centralized Commander timeout-option registration and opened the
  Phase 5 implementation record
- `875722c2` — added direct data-query and data-stack timeout options, routing,
  defaults, failure information, and focused regressions
- `42809bbb` — added direct Markdown profile, template, and project timeout
  routing, repair/phase reuse, failure information, and focused regressions
- `b764e027` — moved the request-failure contract to dependency-neutral utility
  ownership and added explicit default and ordinary-abort regressions

Review range:

```text
a69f251ffa7b174184a7aed0d86f6ff175c1d529..b764e027fa5eb99ccb81cc106e50e3ece4015d35
```

The first correctness review found no material issue. The first test-quality
and maintainability reviews found missing direct default and ordinary-abort
assertions and adapter-owned shared failure metadata. The findings were accepted
and addressed in `b764e027`. The final widened correctness, test-quality, and
maintainability reviews passed with no remaining material findings.

Decision gate: `Continue`. Phase 5 is complete. Every approved direct command
uses the shared strict parser, 30-second default, 10-minute duration-option
maximum, and per-request-attempt meaning. Timeout options do not activate Codex,
repair and project phases receive independent windows, reliable timeouts receive
bounded wording, and existing schemas and generic recovery paths remain intact.
