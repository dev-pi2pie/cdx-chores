---
title: "Codex Execution Configuration"
created-date: 2026-08-21
modified-date: 2026-09-04
status: completed
agent: codex
---

## Goal

Research one configuration contract for Codex helper model selection, provider
selection, reasoning effort, and timeout integration.

The model, provider, and reasoning-effort contract is settled for implementation
planning. The SDK findings below support this research conclusion; the proposed
options are not implemented. The separate timeout contract is already shipped
and remains an existing integration boundary.

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

### SDK Capability Evidence

The original SDK review used `@openai/codex-sdk` 0.149.1. A follow-up review on
2026-09-04 inspected the installed 0.153.3 package's `dist/index.d.ts` option
types and `dist/index.js` argument construction. `codex --version` reported
`codex-cli 0.153.3`; its `exec --help` output confirmed the CLI selectors.

| Selection        | SDK 0.153.3 integration                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| Model            | `startThread({ model })` forwards `--model`                                |
| Provider         | `new Codex({ config: { model_provider: id } })` forwards a config override |
| Reasoning effort | `startThread({ modelReasoningEffort })` forwards `model_reasoning_effort`  |

Profile selection is outside this contract because the reviewed SDK exposes no
profile selector. Its generic `config` option forwards configuration values, not
the CLI's `--profile` flag. Current Codex profiles use separate configuration
files selected by that flag; the legacy `profile` config key is not a supported
substitute.[^profiles]

This evidence establishes the SDK integration path, not successful requests
against every provider. Supported reasoning values and request capabilities
remain model- and provider-dependent.

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

Proposed explicit overrides:

```text
--codex-model <model>
--codex-provider <provider-id>
--codex-reasoning-effort <effort>
```

These three names describe the settled research contract, not shipped behavior.
`--codex-timeout <duration>` already ships on the command surfaces owned by the
separate timeout contract; it is not a candidate option introduced by this
research.

## Configuration Boundaries

### Model And Provider

- Omit model and provider overrides unless the user supplies them. Inheritance
  means the configuration loaded by the helper's Codex process; selections made
  in a parent terminal or desktop session are not automatically forwarded.
- Apply explicit overrides only to the helper invocation; do not rewrite user
  configuration. A provider-only override retains the inherited model, and a
  model-only override retains the inherited provider.
- Select only existing provider IDs; do not accept provider definitions, base
  URLs, credentials, or authentication commands.
- Leave provider resolution and request compatibility to Codex and the selected
  backend. Successful configuration loading does not prove support for
  structured output, image input, or the requested reasoning effort.
- Surface configuration and request failures without silently switching to an
  inherited or alternative model/provider.

### Reasoning Effort

- Preserve the current helper default: request `low` when
  `--codex-reasoning-effort` is omitted, even if Codex configuration specifies
  another value. An explicit recognized option value takes precedence and is
  forwarded unchanged; `low` is not a cap.
- Accept the SDK 0.153.3 values: `minimal`, `low`, `medium`, `high`, `xhigh`,
  `max`, `ultra`, and `persistent`. Reject empty or unknown explicit values
  locally before starting a Codex request; do not forward arbitrary strings.
- Membership in that set does not guarantee model/provider support or effective
  reasoning behavior. If Codex or the provider rejects the requested effort,
  surface the failure without substituting another effort or automatically
  retrying with the effort override omitted. This applies to both the default
  `low` and explicit user selections.
- For reasoning incompatibility, investigate the selected model/provider's
  behavior with the SDK effort override omitted before introducing inheritance
  controls or fallback. Omission delegates to Codex configuration and model
  defaults; it does not guarantee disabled reasoning or removal of `low`.
  This investigation is separate from automatic request recovery. Authentication
  errors, timeouts, and unrelated failures must not trigger effort changes.
- Keep advanced effort values explicit-only.
- Do not classify task complexity or raise effort automatically.

### Command Scope And Recovery

- Use command-local options on adopted surfaces, including the explicit
  `interactive` command; do not introduce root-global options.
- These options configure existing Codex requests and do not enable Codex.
- Resolve explicit selections once per command or interactive session and
  preserve them through retries, repair requests, and regeneration. Omitted
  model/provider values remain delegated to Codex configuration loading.
- Preserve existing workflow-owned fallback, partial-result, and exit behavior.
  Such fallback must not hide a Codex failure or retry with different execution
  selections.

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

1. Inventory direct commands, aliases, interactive helpers, and embedded request
   paths in the implementation plan. State which receive public options and
   which retain defaults. Account for helpers that use temporary working
   directories, since their project configuration discovery can differ.
2. Introduce one shared execution policy using the SDK mappings above. Preserve
   the shared factory's read-only sandbox, approval, network, and web-search
   settings, and reuse the shipped timeout policy unchanged.
3. Verify inherited defaults, explicit model-only and provider-only overrides,
   combined overrides, input validation, and propagation through retries,
   repairs, and regeneration. Include timeout syntax, precedence, and
   per-attempt regression coverage.
4. Review doctor readiness reporting: `inspectCodexEnvironment()` currently
   looks for OpenAI API-key or `auth.json` signals, and
   `src/cli/doctor/report.ts` uses that signal in `readyToDraft`. Do not treat
   that heuristic as proof of readiness for other provider authentication.
   Keep any diagnostic adjustment focused on the adopted contract.
5. Distinguish SDK argument/propagation tests from live provider compatibility
   evidence. Verify failure reporting for unsupported capabilities and invalid
   runtime combinations, including rejection of default and explicit reasoning
   efforts without automatic effort fallback. Do not claim universal provider
   compatibility.

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

The execution-configuration implementation plan has not yet been drafted. It
should link back to this completed research; the existing plan below owns only
the shipped timeout boundary.

- [Codex request timeout contract implementation](../plans/plan-2026-08-21-codex-request-timeout-contract.md)

## References

[^providers]: [Custom model providers](https://learn.chatgpt.com/docs/config-file/config-advanced#custom-model-providers)

[^profiles]: [Codex configuration profiles](https://learn.chatgpt.com/docs/config-file/config-advanced#profiles)
