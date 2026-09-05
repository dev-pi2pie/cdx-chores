---
title: "Codex Execution Configuration"
created-date: 2026-08-21
modified-date: 2026-09-05
status: in-progress
agent: codex
---

## Goal

Research one configuration contract for Codex helper model selection, provider
selection, reasoning effort, and timeout integration, plus read-only discovery
of Codex configuration and reported model capabilities.

The execution contract is implemented through Phases 1–4 of the linked plan;
validation and reviewed commit ranges are recorded in the
[unified job record](../plans/jobs/2026-09-05-codex-execution-configuration.md).
Research is reopened for the `codex-info` discovery extension. Its command and
output direction is accepted; runtime default resolution and provider/catalog
behavior still require the Phase 5 evidence described below. The separate timeout
contract remains an existing integration boundary.

## Execution State After Phases 1–4

All current helpers use the shared read-only thread factory in
`src/adapters/codex/shared.ts`.

| Setting          | Current behavior                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Model            | Inherited unless an adopted command supplies an explicit override                         |
| Provider         | Inherited unless an adopted command supplies an explicit override                         |
| Reasoning effort | Defaults to `low`; adopted commands can supply an explicit recognized effort              |
| Request timeout  | Shared 30-second per-request-attempt default; CLI overrides on supported command surfaces |

Embedded suggestion paths without an adopted timeout option retain the shared
default.

### SDK Capability Evidence

The original SDK review used `@openai/codex-sdk` 0.149.1. A follow-up review on
2026-09-04 inspected the installed 0.153.3 package's `dist/index.d.ts` option
types and `dist/index.js` argument construction. `codex --version` reported
`codex-cli 0.153.3`; its `exec --help` output confirmed the CLI selectors.

On 2026-09-05, the same option types and argument mappings were rechecked against
the installed SDK 0.153.4. `codex --version` reported `codex-cli 0.153.4`, and
`exec --help` confirmed the same selectors. The integration mappings below,
accepted reasoning values, and SDK profile-selection limitation remain unchanged.

| Selection        | SDK 0.153.4 integration                                                    |
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

Implemented explicit overrides on adopted command surfaces:

```text
--codex-model <model>
--codex-provider <provider-id>
--codex-reasoning-effort <effort>
```

The implementation plan records the exact adopted surfaces and retained-default
paths. `--codex-timeout <duration>` remains owned by the separate timeout contract;
execution options do not change its behavior.

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
- Accept the SDK 0.153.4 values: `minimal`, `low`, `medium`, `high`, `xhigh`,
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

### Service Tier

Service-tier selection remains inherited from Codex configuration. This
implementation sends no service-tier or fast-mode override. Reasoning effort is
configured independently.

### Command Scope And Recovery

- Use command-local options on adopted surfaces, including the explicit
  `interactive` command; do not introduce root-global options.
- These options configure existing Codex requests and do not enable Codex.
- Interactive overrides follow the existing timeout session pattern: validate
  startup options once, retain them for that session, and pass them to each
  request. Add no configuration picker or per-step override. Timeout remains
  independently enforced per request attempt.
- Resolve explicit selections once per command or interactive session and
  preserve them through retries, repair requests, and regeneration. Omitted
  model/provider values remain delegated to Codex configuration loading.
- Preserve existing workflow-owned fallback, partial-result, and exit behavior.
  Such fallback must not hide a Codex failure or retry with different execution
  selections.

## Codex Information Discovery

### Command And Output Direction

Use `codex-info` as a read-only command group. Phase 5 introduces:

| Command                        | Default human output                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `cdx-chores codex-info`        | Configured model/provider, catalog recommendation when reported, and helper reasoning default |
| `cdx-chores codex-info models` | Model IDs, reported reasoning efforts, and configured/recommended markers                     |

Both commands offer `--details` and `--json`; summary is the default and needs no
flag. Reject `--details --json` before discovery. Details expand descriptions,
reported input modalities, effort descriptions, catalog reasoning defaults, and
configuration context. JSON exposes a curated, versioned report from the same
discovery result. Use explicit labels such as "Configured model", "Catalog
recommended model", "Catalog reasoning default", and "Helper reasoning default";
never use an unqualified "default" field or marker. The plan defines the JSON
field names and missing-value semantics shared by every view.

The broader name leaves room for `codex-info providers`. Listing provider IDs is
a future extension pending a verified enumeration source; it is separate from
showing the selected provider ID in the initial summary. No Interactive menu
entry, selection picker, or configuration mutation is introduced by this phase.

### Discovery Evidence And Integration

The reviewed SDK `0.153.4` has thread creation/resumption methods but no model-list
or configuration-read method. Keep helper execution on that SDK. A separate,
bounded CLI app-server client is the proposed discovery integration.

Official app-server documentation provides `model/list` with pagination,
`supportedReasoningEfforts`, `defaultReasoningEffort`, `isDefault`, and other
model metadata. `isDefault` denotes a catalog recommendation. `config/read`
returns configuration after Codex resolves its layers.[^app-server]

On 2026-09-05, TypeScript schemas generated by CLI `0.153.4` confirmed these model
fields, `ConfigReadParams.cwd`, and nullable `model`, `model_provider`, and
`model_reasoning_effort` configuration fields. This is protocol evidence; it does
not establish runtime resolution for an omitted model or completeness for a
custom provider. Treat the app-server integration as version-sensitive and verify
its behavior against the installed executable before closing Phase 5.

Use Codex configuration resolution for the invocation's working directory.
Execution requests continue to delegate their configuration loading to Codex;
the discovery report must not become an execution configuration snapshot or an
execution prerequisite. Do not implement a parallel TOML loader or read private
catalog-cache files as a public contract.

### Environment And Configuration Location

The tool currently takes the Codex configuration/state directory from the
invocation environment through `CODEX_HOME`. When unset, Codex uses its normal
home-directory default (`~/.codex`). The variable names the directory containing
`config.toml`, not an arbitrary configuration filename.[^config-location]
`CDX_CHORES_CODEX_PATH` independently selects the executable.

In the current repository, `startCodexReadOnlyThread()` supplies no SDK environment
override; SDK `0.153.4` inherits the process environment. The local
`resolveCodexHome()` helper is used for the authentication-file signal check; it
is not a configuration loader. Phase 5 discovery must use the same invocation
environment basis as execution, preserving unrelated child environment entries
and avoiding parent-environment mutation or module-level caching. Discovery
reports the invocation working directory (`runtime.cwd`), also used for child
startup and `config/read`; it does not predict project configuration loaded by
helpers using different workflow-specific working directories. Verify unset,
custom, and edge-case home values against actual Codex behavior instead of
assuming the local signal check defines CLI semantics.

A follow-up schema inspection on 2026-09-05 confirmed that CLI `0.153.4`'s
`InitializeResponse.codexHome` is the server's absolute home directory. This is
the proposed report path source. Phase 5 must corroborate it with real-executable
fixtures using isolated default/custom homes and distinct synthetic configuration
values; use `config/read` values/origins to confirm the selected configuration.
Derive home-source classification from the launch environment and those verified
CLI rules. Child-environment capture alone proves forwarding, not config resolution.

Show the verified effective absolute Codex home and whether Codex selected it
through `CODEX_HOME` or its normal fallback in discovery details and JSON. Do not
label a supplied-but-ignored empty value as an environment-selected home. Establish
empty, whitespace, and relative-path behavior from CLI evidence; fail discovery
without a report if the effective path/source cannot be determined or Codex rejects
the value. This describes configuration for this invocation.
Test successive invocations with different homes so a previous location cannot
leak into later discovery or helper execution.

A tool-owned configuration file has not been implemented. Its filename, schema,
and precedence belong to separate future work; this plan adds neither a
`codex.home` file setting nor another home-directory CLI option.

Phase 6 will create `docs/guides/environment-variables.md` as the central guide to
implemented environment controls. It will cover ownership, accepted values,
defaults, precedence, command scope, and examples, with README discovery and
links to the existing path-prompt and color guides. Codex authentication entries
must distinguish this tool's signal checks from credential handling by Codex.
Future file-based settings must not be presented as available configuration.

### Selection And Capability Meaning

Keep these facts separate in the report:

- Configured model/provider: values returned by Codex for the inspected context.
- Catalog recommended model: the entry marked `isDefault`, when one is reported.
- Catalog reasoning default: each model's reported suggested effort.
- Helper reasoning default: this tool's existing `low` request policy.

An absent configured model/provider is unspecified, not proof of a particular
resolved choice. Do not mark the catalog recommendation as the effective helper
default without verified resolution evidence. Preserve a configured model that
is missing from the catalog, with its capabilities unknown.

Label the list as Codex-reported model metadata. In particular, do not claim a
custom provider exposes or accepts every listed model. Empty or missing reasoning
metadata means support is unknown, not that reasoning is disabled. Display
reported effort values even when they are outside the execution SDK's accepted
set; discovery does not extend that set or change the helper default.

Discovery makes no generation request and supplies no compatibility verdict for
image input, structured output, or reasoning. It does not add fallback, change
execution settings, or maintain a repository-owned capability registry. Only
curated configuration/model fields enter human or JSON output; raw configuration,
provider definitions, and authentication material do not.

### Discovery Failures

Both initial commands require successful configuration and catalog reads.
Failure of either read fails the invocation with a sanitized error and no partial
report, including JSON. Do not convert a catalog request error into "unknown".
A successful empty catalog or missing optional metadata is a valid report:
retain the configured selection and label absent capabilities as unknown. Custom
providers receive the same rule; their IDs do not justify swallowing errors.

### Evidence Still Required

Phase 5 must verify the version-specific protocol and lifecycle, omitted versus
explicit model/provider configuration, project context, catalog recommendation
semantics, custom-provider catalog limitations, and default/custom `CODEX_HOME`
consistency between discovery and execution. Record unknowns explicitly
when the protocol cannot resolve them. Record the CLI version, initialization
exchange, request parameters, and observed response structure in sanitized
protocol fixtures and job evidence. Separately verify pagination, missing
metadata, failure handling, and consistent summary/details/JSON projections.
Close this discovery research when these findings and the resulting supported
report contract are recorded in the unified job; implementation tests alone must
not be presented as live provider compatibility evidence.

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
4. Distinguish SDK argument/propagation tests from live provider compatibility
   evidence. Verify failure reporting for unsupported capabilities and invalid
   runtime combinations, including rejection of default and explicit reasoning
   efforts without automatic effort fallback. Do not claim universal provider
   compatibility.
5. Verify the discovery contract through Codex's version-specific protocol,
   preserving the distinction between configuration, catalog recommendations,
   and actual request compatibility. Keep discovery independent of execution.

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

- [Codex execution configuration implementation](../plans/plan-2026-09-05-codex-execution-configuration.md)
- [Codex request timeout contract implementation](../plans/plan-2026-08-21-codex-request-timeout-contract.md)

## References

[^providers]: [Custom model providers](https://learn.chatgpt.com/docs/config-file/config-advanced#custom-model-providers)

[^profiles]: [Codex configuration profiles](https://learn.chatgpt.com/docs/config-file/config-advanced#profiles)

[^app-server]: [Codex App Server: models and configuration APIs](https://learn.chatgpt.com/docs/app-server)

[^config-location]: [Codex configuration and state locations](https://learn.chatgpt.com/docs/config-file/config-advanced#config-and-state-locations)
