---
title: "Codex Execution Configuration"
created-date: 2026-08-21
modified-date: 2026-09-05
status: completed
agent: codex
---

## Goal

Research one configuration contract for Codex helper model selection, provider
selection, reasoning effort, and timeout integration, plus read-only discovery
of Codex configuration and reported model capabilities.

The execution contract is implemented through Phases 1–4 of the linked plan;
validation and reviewed commit ranges are recorded in the
[unified job record](../plans/jobs/2026-09-05-codex-execution-configuration.md).
Phase 5 establishes the `codex-info` discovery contract through isolated CLI
observations, recorded protocol replay, and reviewed implementation tests.
Configured-only provider coverage and catalog limitations are explicit conclusions.
Phase 5.5 implements concise human views and shared terminal styling; its focused
verification and Node package smoke evidence are recorded in the same job record.
Research is complete for this scope; Phase 6 still owns shipped-guide updates and
final repository closeout. The separate timeout contract remains unchanged.

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
| `cdx-chores codex-info models` | Provider context, model IDs, reported reasoning efforts, and configured/recommended markers |
| `cdx-chores codex-info providers` | Discoverable provider IDs, their sources, configured marker, and enumeration coverage |

All three commands offer `--details` and `--json`; summary is the default and needs no
flag. Output flags follow the invoked command (`codex-info models --json`);
parent flags do not propagate to children. Reject parent-before-child output flags
and `--details --json` before discovery. Details expand descriptions,
reported input modalities, effort descriptions, catalog reasoning defaults, and
configuration context. JSON exposes a curated, versioned report from the same
discovery result. Use explicit labels such as "Configured model", "Catalog
recommended model", "Catalog reasoning default", and "Helper reasoning default";
never use an unqualified "default" field or marker. The plan defines the JSON
field names and missing-value semantics shared by every view.

Provider discovery is included in Phase 5. Configured IDs come from the returned
`model_providers` definitions; built-in IDs require a verified source for the
installed CLI. Report coverage explicitly if only configured IDs can be enumerated.
Listing identifies configuration choices, not successful authentication or request
compatibility. No Interactive menu entry, selection picker, or configuration
mutation is introduced by this phase.

### Human Presentation Refinement (Phase 5.5)

Phase 5.5 implements the presentation follow-up. The renderer now reduces repeated
context and uses the existing shared color helper and
[output/color contract](../guides/cli-output-and-color.md) for terminal hierarchy.
Discovery conclusions and JSON stay unchanged.

- Overview: retain configured model/provider, helper reasoning default, catalog
  recommendation, and short provider-coverage/catalog-scope notes. Keep configured
  reasoning and invocation context in details; avoid a heading for each field.
- Models: retain provider context, one catalog qualification, IDs, reported
  reasoning efforts, and configured/catalog-recommended markers. Omit the helper
  default, separate recommendation line, and provider-enumeration explanation.
  Catalog metadata does not verify provider support. Preserve an explicit notice
  when the configured model is unlisted and reasoning capabilities are unknown.
- Providers: retain configured selection, IDs, markers, source/coverage, and a
  short credentials/request-support qualification. Share identical source wording
  above the list; use per-entry sources only when needed to distinguish entries.
  Omit model/reasoning context. Empty and unlisted results remain explicit and
  must not imply that an absent provider is unsupported.
- Details: group invocation context and metadata consistently. Omit absent
  optional descriptions; show a separate model value when it differs from the
  displayed catalog ID. Preserve meaningful unknown capabilities/defaults.
- Styling: use restrained bold cyan headings, bold IDs, and literal selection
  markers without success semantics. Escape external strings before adding ANSI.
  The shared helper controls styling per output stream; `NO_COLOR` presence
  (including empty), `--no-color`, disabled runtime color, and non-TTY output
  disable it. Stripping ANSI must recover identical canonical plain text.

The command-specific omissions apply equally to colored and plain human output.
JSON keeps its curated fields and missing-value semantics and receives no styling.
Phase 5.5 records implementation evidence in the unified job record; Phase 6
documents the resulting shipped behavior in the public guides.

### Discovery Evidence And Integration

The reviewed SDK `0.153.4` has thread creation/resumption methods but no model-list
or configuration-read method. Keep helper execution on that SDK. A separate,
bounded CLI app-server client provides the discovery integration.

Official app-server documentation provides `model/list` with pagination,
`supportedReasoningEfforts`, `defaultReasoningEffort`, `isDefault`, and other
model metadata. `isDefault` denotes a catalog recommendation. `config/read`
returns configuration after Codex resolves its layers.[^app-server]

On 2026-09-05, TypeScript schemas generated by CLI `0.153.4` confirmed these model
fields, `ConfigReadParams.cwd`, and nullable `model`, `model_provider`, and
`model_reasoning_effort` configuration fields. This is protocol evidence; it does
not establish runtime resolution for an omitted model or completeness for a
custom provider. The implementation evidence update below records the subsequent
runtime checks and the supported limits of this version-sensitive integration.

Use Codex configuration resolution for the invocation's working directory.
Execution requests continue to delegate their configuration loading to Codex;
the discovery report must not become an execution configuration snapshot or an
execution prerequisite. Do not implement a parallel TOML loader or read private
catalog-cache files as a public contract.

### Provider And Catalog Observations

On 2026-09-05, an isolated CLI `0.153.4` app-server probe compared two temporary
Codex homes using the same synthetic model selection. One omitted `model_provider`;
the other selected a synthetic `probe_proxy` provider with a loopback endpoint.
Only initialization, `config/read`, and `model/list` were requested.

- The first configuration returned a null provider selection and no custom IDs.
- The second returned `probe_proxy` and exposed its ID under `model_providers`.
- Both returned the same six visible catalog models and the same recommendation,
  with no next page. These observations used isolated, unauthenticated setups.

This demonstrates that provider selection need not change the catalog. It does
not establish identical behavior for every provider/account or prove that the
custom backend accepts those models. Codex separately supports a
`model_catalog_json` configuration setting for catalog input.[^catalog]

Use configured definitions as evidence for custom provider IDs and verify built-in
enumeration before claiming complete coverage. Model output must include the
inspected provider context and identify entries as Codex-reported catalog metadata,
not a provider endpoint's verified available-model list. Preserve configured models
that do not appear in the catalog. Do not copy endpoint URLs, headers, credentials,
or auth commands into provider output.

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
the implemented report path source. Real-executable fixtures corroborated it
using isolated default/custom homes and distinct synthetic configuration values;
`config/read` values/origins confirmed the selected configuration. Home-source
classification follows the launch environment and those verified CLI rules.
Child-environment capture alone proves forwarding, not config resolution.

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
curated configuration/model/provider fields enter human or JSON output; raw configuration,
provider definitions, and authentication material do not.

### Discovery Failures

All commands require successful initialization and configuration reads.
`codex-info` and `codex-info models` additionally require a complete model catalog.
`codex-info providers` does not call `model/list`; catalog availability cannot
block provider inspection. Failure of a required read fails that command with a
sanitized error and no partial report, including JSON. Do not convert request
errors into unknown metadata or silently downgrade enumeration coverage after a
failed required provider read. Successful empty catalogs and missing optional
metadata remain valid report states. A source that cannot enumerate built-ins
must return a successful configured-only result (exit 0), including an empty
configured list; this known limitation is distinct from a failed request. Custom providers receive the same failure policy.

### Implementation Evidence Update

Phase 5's isolated CLI `0.153.4` probe is reproducible with
`env CDX_CHORES_RUN_CODEX_DISCOVERY_PROBE=1 bun test test/codex-info/live-protocol.test.ts`.
The sanitized `test/codex-info/fixtures/cli-0.153.4-protocol.json` records the
initialization/configuration shapes and model pagination. Empty and unset homes
fall back; existing relative/symlink paths canonicalize; whitespace is a literal
path and succeeds only when the directory exists. Trusted project configuration
can change the model and its reported origin for that invocation directory.

Installed help and generated request schemas provide no built-in provider-ID
listing. The provider-capabilities method returns booleans only. This establishes
the supported `configured-only` coverage boundary; it does not imply built-in
providers are unavailable. Discovery must use the returned custom map without
inventing missing definitions.

### Verified Scope And Limits

The unified job records Phase 5's completed protocol, environment, command, report,
and lifecycle validation, plus the full reviewed commit range. Recorded protocol
projections are replayed through the real command pipeline in the normal test
suite; the opt-in real-CLI probe remains distinct runtime evidence.

Configured provider definitions are discoverable. Built-in provider-ID enumeration
is not exposed by the inspected CLI surfaces, so coverage remains configured-only.
An omitted configured model/provider stays unspecified; catalog recommendations
do not substitute for either selection. Provider changes need not change the
catalog, and reported metadata does not establish backend compatibility.

Home reporting uses `initialize.codexHome` and the verified environment semantics
for the inspected invocation directory. Existing helper-specific working
directories remain intact. Neither discovery nor its tests introduce effort
fallback, generation requests, or configuration mutations.

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

[^catalog]: [Codex configuration reference: model catalog](https://learn.chatgpt.com/docs/config-file/config-reference)
