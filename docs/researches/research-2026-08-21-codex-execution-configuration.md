---
title: "Codex Execution Configuration"
created-date: 2026-08-21
status: draft
agent: codex
---

## Goal

Research one configuration contract for Codex helper model selection, provider
selection, reasoning effort, and timeout integration.

This research depends on the separate timeout research. Keep this document in
`draft` and review it again after that timeout contract is completed; the final
timeout decisions may change the implementation boundary described here.

## Current State

All current helpers use the shared read-only thread factory in
`src/adapters/codex/shared.ts`.

| Setting | Current behavior |
| --- | --- |
| Model | Inherited from Codex configuration |
| Provider | Inherited from Codex configuration |
| Reasoning effort | Forced to `low` for every helper |
| Request timeout | Usually 30 seconds through duplicated helper seams |

The repository currently uses `@openai/codex-sdk` 0.149.0. Its thread options
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
timeout: shared Codex timeout policy
```

Candidate explicit overrides:

```text
--codex-model <model>
--codex-provider <provider-id>
--codex-reasoning-effort <effort>
--codex-timeout <duration>
```

These names describe the research direction, not shipped behavior.

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

## Timeout Dependency

The timeout research remains the source of truth for duration syntax,
precedence, validation, per-request semantics, and direct/interactive
propagation.

This research currently assumes:

- an explicit `--codex-timeout` always wins
- all helpers consume the shared timeout policy
- the shared 30-second fallback remains in place
- no effort-derived or feature-specific timeout ladder is planned here

After the timeout research is completed, review these assumptions and re-audit
all direct and interactive Codex request paths before creating an implementation
plan.

## Implementation Gates

1. Complete and re-review the unified timeout research dependency.
2. Resolve the candidate options once into a shared policy used by direct and
   interactive entry points.
3. Verify inherited defaults, explicit overrides, invalid runtime combinations,
   and timeout precedence.

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

## References

[^reasoning]: [Reasoning effort](https://developers.openai.com/api/docs/guides/reasoning#reasoning-effort)
[^providers]: [Custom model providers](https://learn.chatgpt.com/docs/config-file/config-advanced#custom-model-providers)
