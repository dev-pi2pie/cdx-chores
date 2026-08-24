---
title: "Codex Execution Configuration"
created-date: 2026-08-21
modified-date: 2026-08-24
status: draft
agent: codex
---

## Goal

Research one configuration contract for Codex helper model selection, provider
selection, reasoning effort, and timeout integration.

The separate timeout contract is implemented and documented. This draft treats
that shipped behavior as an existing integration boundary while it continues to
research model, provider, and reasoning-effort overrides.

## Current State

All current helpers use the shared read-only thread factory in
`src/adapters/codex/shared.ts`.

| Setting          | Current behavior                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Model            | Inherited from Codex configuration                                                        |
| Provider         | Inherited from Codex configuration                                                        |
| Reasoning effort | Forced to `low` for every helper                                                          |
| Request timeout  | Shared 30-second per-request-attempt default; CLI overrides on supported command surfaces |

Embedded suggestion paths without an adopted timeout option retain the shared
default.

The repository currently uses `@openai/codex-sdk` 0.149.1. Its thread options
support per-thread model and reasoning-effort selection. Supported reasoning
values remain model- and provider-dependent.[^reasoning]

A provider ID is a Codex configuration key, such as `company_proxy` for
`[model_providers.company_proxy]`. Provider definitions, authentication, and
model compatibility remain owned by Codex configuration.[^providers]

## Recommended Contract

```text
model: inherit
provider: inherit
reasoning effort: low
timeout: existing shared Codex timeout policy
```

Candidate explicit overrides:

```text
--codex-model <model>
--codex-provider <provider-id>
--codex-reasoning-effort <effort>
```

These three names describe the research direction, not shipped behavior.
`--codex-timeout <duration>` already ships on the command surfaces owned by the
separate timeout contract; it is not a candidate option introduced by this
research.

## Configuration Boundaries

### Model And Provider

- Inherit both values unless the user supplies an override.
- Select only existing provider IDs; do not accept provider definitions, base
  URLs, credentials, or authentication commands.
- Let Codex validate provider existence and model/provider compatibility.
- Fail an invalid explicit override without silently falling back to inherited
  configuration.

### Reasoning Effort

- Keep `low` as the default to preserve current latency and cost behavior.
- Accept the reasoning values exposed by the pinned SDK and let Codex validate
  model/provider support.
- Keep advanced effort values explicit-only.
- Do not classify task complexity or raise effort automatically.

## Shipped Timeout Boundary

The completed timeout research and the
[public timeout guide](../guides/codex-timeouts-retries-and-recovery.md) remain
the sources of truth for duration syntax, precedence, validation, per-request
semantics, and direct/interactive propagation.

Future execution-configuration work must preserve these shipped settings:

- the shared fallback is 30 seconds for each request attempt
- duration-based options accept one positive integer followed by lowercase `ms`,
  `s`, or `m`, with a maximum of 10 minutes per attempt
- `--codex-timeout <duration>` is command-local, including the explicit
  `interactive` command, and is not a root-global option
- rename image and document timeout options remain more specific than the shared
  rename timeout
- every Codex request attempt receives its own timeout window, including requests
  issued during retries, repair phases, and user-triggered regeneration; these do
  not share a whole-command budget
- timeout options configure existing Codex requests and do not enable Codex
- model, provider, reasoning effort, and feature type do not derive a different
  timeout default or timeout ladder

Any implementation plan for this research should re-audit the current direct and
interactive request paths, then reuse the shipped parser, resolver, defaults, and
numeric `timeoutMs` seams instead of introducing another timeout policy.

## Implementation Gates

1. Re-audit current direct and interactive Codex request paths before planning
   implementation.
2. Resolve the candidate model, provider, and reasoning-effort options once into
   a shared execution policy while reusing the shipped timeout policy unchanged.
3. Verify inherited defaults, explicit overrides, invalid runtime combinations,
   and preservation of timeout syntax, precedence, and per-attempt propagation.

## Non-Goals

- provider definitions or credential storage
- a repository-owned model capability registry
- automatic task-complexity classification
- effort-derived or feature-specific timeout defaults
- session lifecycle configuration or management; helper threads follow the
  Codex SDK's normal behavior
- advisory report schema changes

## Related Research

- [Codex timeout configuration](./research-2026-07-05-codex-timeout-configuration.md)

## Related Plans

- [Codex request timeout contract implementation](../plans/plan-2026-08-21-codex-request-timeout-contract.md)

## References

[^reasoning]: [Reasoning effort](https://developers.openai.com/api/docs/guides/reasoning#reasoning-effort)

[^providers]: [Custom model providers](https://learn.chatgpt.com/docs/config-file/config-advanced#custom-model-providers)
