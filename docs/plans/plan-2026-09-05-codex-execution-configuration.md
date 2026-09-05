---
title: "Codex execution configuration implementation"
created-date: 2026-09-05
status: active
agent: codex
---

## Goal

Implement explicit model, provider, and reasoning-effort selection for the
existing Codex helper flows. Omitted model/provider options continue to inherit
Codex configuration; omitted reasoning effort continues to request `low`.

Phases 1–4 implement the settled execution contract. Phase 5 adds `codex-info`
configuration and model discovery; Phase 6 owns final validation and shipped
documentation. The linked research is reopened for discovery evidence. Phase
completion is tracked below and in the unified job record.
The shipped timeout policy remains owned by its existing guide and plan.

## Starting State

This section records the pre-implementation inventory on 2026-09-05 with SDK
`0.153.4`; completed changes are tracked by phase below. All inventoried request runners
reach `startCodexReadOnlyThread()` in `src/adapters/codex/shared.ts`. It lazily
imports the SDK, preserves an optional `CDX_CHORES_CODEX_PATH` override, and sets
read-only sandboxing, approval policy `never`, network access enabled, web search
disabled, and reasoning effort `low`. Model and provider are omitted.

Model and effort map to SDK thread options. Provider selection maps to constructor
configuration: `new Codex({ config: { model_provider: id } })`. The SDK has no
direct profile selector; this plan adds no `--codex-profile` or profile loader.

Current runners accept workflow-specific request objects and injectable runners.
Timeout values already travel through these layers. Execution settings need the
same complete propagation without changing timeout ownership or moving SDK calls
into command handlers.

## Settled Contract

### Options And Validation

Add these three options together on every adopted command:

```text
--codex-model <model>
--codex-provider <provider-id>
--codex-reasoning-effort <effort>
```

- Options are command-local, including on `interactive`, and do not enable Codex.
  Preserve existing analyzer routing, assist flags, and consent prompts.
- Resolve omitted model/provider as absent overrides. Explicit values affect the
  current invocation; execution paths do not read, merge, or rewrite Codex
  configuration themselves. Discovery may ask Codex for resolved configuration
  for display, as specified below.
- Model and provider are opaque, case-sensitive identifiers. Trim surrounding
  whitespace and reject empty explicit values. Do not maintain a model registry
  or accept provider definitions, URLs, credentials, or auth commands as options.
- Accept only `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra`, and
  `persistent`, matching the reviewed SDK type. Require exact lowercase effort
  values and reject empty, whitespace-padded, or unknown values locally.
- Reject repeated occurrences of any one execution option, even with identical
  values, following the existing unique timeout-option pattern.
- Validate explicit values before starting action work, even when Codex is not
  enabled. Valid execution options alone cause no Codex request.
- Apply the same validation to programmatic action inputs. Optional inputs retain
  existing caller behavior; normalized execution settings travel internally.

### Defaults And Failure Behavior

| Input                      | Requested behavior                                 |
| -------------------------- | -------------------------------------------------- |
| No execution options       | Omit model/provider overrides; request `low`       |
| Model only                 | Override model; leave provider resolution to Codex |
| Provider only              | Override provider; leave model resolution to Codex |
| Explicit recognized effort | Request that exact effort instead of `low`         |
| Combined options           | Apply all explicit selections together             |

The `low` default overrides any inherited reasoning setting and is not a cap.
Recognized effort values do not guarantee backend support or effective reasoning
behavior. Codex/provider failures remain visible through each workflow's existing
error, warning, or report path. Preserve partial results, deterministic fallback,
and exit behavior; never change model/provider/effort to recover from a failure.

Existing retries may repeat a request with the same settings. Do not add retries,
omit an effort override, or choose another effort in response to incompatibility,
authentication errors, timeouts, or unrelated failures. Investigating inherited
reasoning behavior is separate diagnostic work before any future fallback design.
This plan exposes neither `inherit` nor `none` as an effort option.

Keep explicit selections stable through batches, retries, repairs, and interactive
regeneration. Omitted model/provider values stay absent; Codex remains responsible
for configuration discovery on each execution process invocation. Do not feed a
discovery report back into execution as a configuration snapshot or claim
inheritance from a parent desktop/terminal selection.

### Existing Boundaries

- Service-tier selection remains inherited from Codex configuration. This
  implementation sends no service-tier or fast-mode override. Reasoning effort
  is configured independently.
- Preserve factory sandbox, approval, network, web-search, and executable-override
  settings. Merge provider configuration with the executable override rather than
  dropping either option. Keep the lazy SDK import for CJS/ESM compatibility.
- Preserve numeric `timeoutMs` propagation, the 30-second fallback, per-attempt
  windows, and existing shared/scoped/legacy timeout precedence. Do not combine
  timeout and execution settings into a new timeout resolver.
- Preserve existing working directories. Most current runners receive
  `runtime.cwd` or a workflow-supplied directory. The disposable
  `runCodexPromptOnly()` utility currently has test callers only; do not route
  active workflows through it as part of this change. Temporary render/output
  directories are not a reason to change Codex configuration discovery.
- Keep execution settings out of model prompts, saved PDF profiles, templates,
  data plans, advisory report schemas, and durable recovery artifacts. Existing
  prepared outputs can be written without making another Codex request.

## Adoption Inventory

### Public Command Scope

| Surface                                                                   | Adoption in this plan                                                                                 |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `rename file`, `rename batch`, `batch-rename` alias                       | All three options, shared by image and document analyzers; existing enable flags remain authoritative |
| `data query codex`                                                        | All three options for drafting                                                                        |
| `data stack`                                                              | All three options for existing `--codex-assist` requests; preserve its dry-run requirement            |
| `md pdf-profile codex`                                                    | All three options for profile requests                                                                |
| `md pdf-template codex`                                                   | All three options for initial and repair requests                                                     |
| `md pdf-project codex`                                                    | One set of options for profile, template, and repair requests                                         |
| `interactive`                                                             | One session-owned selection used by every Codex helper in that session                                |
| Direct `data query --codex-suggest-headers`                               | Retain defaults; no new execution options on the parent query command                                 |
| Direct `data extract --codex-suggest-headers` / `--codex-suggest-shape`   | Retain defaults; no new execution options                                                             |
| Direct `rename cleanup`, deterministic Markdown commands, root invocation | No execution options; existing `--profile` meanings remain unchanged                                  |

Starting Interactive mode through the existing no-command entry retains defaults.
Users supply session overrides through the explicit `interactive` command,
following the existing `--codex-timeout` pattern. For example:

```sh
cdx-chores interactive --codex-model <model> --codex-reasoning-effort medium --codex-timeout 60s
```

Validate and resolve startup options, retain them in the Interactive session, and
pass them through the chosen workflow to every Codex request, retry, repair, or
regeneration. Model/provider omissions delegate to Codex configuration; omitted
effort requests `low`, and timeout retains its 30-second per-attempt default.
Service tier remains inherited. Session settings are not persisted, and a new
session resolves its own settings. Add no configuration picker or per-step
override; existing consent prompts still control whether Codex runs.

Register options on the exact Commander nodes below; do not register them on
their parents or use inherited/global option lookup:

- `src/cli/commands/rename.ts`: the `file` and `batch` children of `rename`, and
  the root `batch-rename` compatibility command, through the shared option helper.
- `src/cli/commands/data/query.ts`: only the `codex` child of `data query`.
- `src/cli/commands/data/stack.ts`: the `stack` child of `data`.
- `src/cli/commands/markdown.ts`: the `codex` child of each of `pdf-profile`,
  `pdf-template`, and `pdf-project` under `md`.
- `src/cli/commands/index.ts`: the explicit `interactive` command.

Assert options in each adopted node's help, including `batch-rename`. They must
be absent from root, `rename`, `data`, `data query`, `data extract`, `md`, Markdown
helper parent, and `md to-pdf` help. Calls to excluded executable
surfaces with these flags must fail as unknown options before action work.

### Request Paths

| Request owner                                                | Propagation and coverage                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `src/adapters/codex/image-rename-titles.ts`                  | Action/analyzer options through every image batch and retry; preserve image attachments                       |
| `src/adapters/codex/document-rename/batch.ts` and `types.ts` | Same policy through document batches, retries, and partial-result handling                                    |
| `src/cli/data-query/runner.ts`                               | Direct drafting and Interactive SQL generation/regeneration                                                   |
| `src/cli/data-stack/codex-assist.ts`                         | Direct assist and Interactive stack review requests                                                           |
| `src/cli/duckdb/header-mapping/suggestions.ts`               | Interactive query/extract suggestions receive the session policy; direct embedded suggestions retain defaults |
| `src/cli/duckdb/source-shape/suggestions.ts`                 | Interactive extract suggestions receive the session policy; direct embedded suggestions retain defaults       |
| `src/cli/actions/rename/cleanup-codex.ts`                    | Interactive cleanup analysis receives the session policy                                                      |
| `src/adapters/codex/markdown-pdf-profile/`                   | Direct and Interactive profile requests, including the project profile phase                                  |
| `src/adapters/codex/markdown-pdf-template/`                  | Direct and Interactive template requests, including project template and repair phases                        |

Recheck this inventory at implementation start. A newly discovered caller must be
assigned explicitly to adopted propagation or retained defaults before closeout.

## Implementation Shape

Use one small execution-settings module for shared types, defaults, and validation,
plus one reusable Commander option-registration module. Proposed locations are
`src/utils/codex-execution.ts` and `src/cli/options/codex-execution-option.ts`.
Keep SDK-dependent types as type-only imports and avoid adding public exports
through `src/utils/index.ts` solely for internal plumbing.

Use an optional `codexExecution` input on action/request/runner seams and a resolved
policy with optional `model` and `provider` plus required `reasoningEffort`.
Commander parsers own duplicate detection and early flag validation. Each public
action entry and Interactive session construction uses the shared resolver before
doing work, including for direct programmatic callers. This resolver is the sole
owner of defaults and combined-policy normalization. Revalidating an already
resolved policy is idempotent and must not change its values.

Exported adapter/service entries also validate direct inputs through that resolver
before invoking a runner; internal stages forward the resolved policy without
per-helper defaults or merges. Injected runners receive the resolved shape only.
The shared factory validates direct calls before SDK startup. Test raw invalid
programmatic inputs at these entry points: none may reach an injected runner or
spawn a Codex process. Older callers omitting the object receive the same default.

Extend the existing factory options object to receive this policy alongside
`codexPathOverride`. Extend injected runner and thread-factory types so tests can
observe execution settings at the same boundaries as production. Do not store
selections in module globals, environment mutations, or a shared mutable client.

Extend `InteractiveSessionOptions` / `InteractiveSession` in
`src/cli/interactive/session.ts` alongside the existing `codexTimeoutMs` field.
Timeout keeps its own parser and per-attempt enforcement; it is not a budget for
the whole session. Pass session execution settings through the
existing rename, data, and Markdown dispatch paths. In Markdown, keep them in the
request preparation path through `codex-service.ts`, profile orchestration,
project phases, and template repairs; regeneration reuses the session policy.
Saving, rebinding, rendering, and recovery of already prepared outputs must not
require these settings to be serialized or start another request.

## Codex Information Discovery Contract

Phase 5 adds `codex-info`, `codex-info models`, and `codex-info providers` as direct
commands in a dedicated registration module. The group without a child displays
a configuration summary; children display model or provider information.
Register `--details` and `--json` on all three nodes, reject their combination before
starting a subprocess, and leave summary as the default. Discovery accepts no
execution model/provider/effort overrides or profile selector.

Output options belong to the invoked node: use `codex-info --json`,
`codex-info models --json`, or `codex-info providers --details`. Parent output
options do not propagate to children. Reject forms such as `codex-info --json
models` or `codex-info --details providers` before discovery, rather than silently
ignoring or inheriting the parent flag. Cover both valid placement and rejection
in command tests; describe the canonical forms in help/examples.

| View                | Summary                                                                                                             | Details                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `codex-info`        | Configured model/provider, separately labeled catalog recommendation, helper reasoning default `low`                | Add working-directory/Codex-home context, Codex version, and reported configuration reasoning value          |
| `codex-info models` | Provider context, model IDs, reported reasoning efforts, configured/recommended markers; retain configured selection even if unlisted | Add display names, descriptions, reported input modalities, effort descriptions, and catalog reasoning defaults |
| `codex-info providers` | Provider IDs, source, configured marker, and enumeration coverage | Add reported display names, context, and coverage limitations; no endpoint/auth details |

`--json` serializes a curated report with a schema version and explicit missing
values, rather than raw app-server responses. Human views and JSON derive from
one normalized result for the requested command. A complete catalog means all pages of
picker-visible entries (`includeHidden: false`); hidden entries are not part of
this first command contract. A configured model absent from that list remains
visible as an unlisted selection with unknown capabilities.

Use separate fields for configuration selections, catalog recommendations,
catalog effort defaults, and the helper effort default. Do not infer an effective
model/provider from nullable configuration fields or equate `isDefault` with a
user selection. Show unspecified/unknown values honestly. Empty or missing
reasoning metadata does not establish lack of reasoning support. Report advertised
effort strings without extending the shared execution parser's accepted values.

### Report Labels And Missing Values

All commands use `schemaVersion: 1` and a `view` discriminator (`summary`, `models`,
`providers`). Common configuration, context, and provider fields retain the same
meaning across views. Model-catalog fields are populated for summary/models;
the providers view uses `models: null`, `catalogRecommendedModelIds: null`, and
`catalogScope: null` to mean not requested. This differs from successful empty
arrays. Human provider views omit model-catalog sections rather than displaying
unrequested data as unknown. Define these core fields and human labels:

| JSON field | Human label | Missing-value meaning |
| --- | --- | --- |
| `configured.model` | Configured model | `null`: unspecified in returned configuration |
| `configured.provider` | Configured provider | `null`: unspecified in returned configuration |
| `configured.reasoningEffort` | Configured reasoning effort | `null`: unspecified in returned configuration |
| `catalogRecommendedModelIds` | Catalog recommended model | `[]`: no recommendation reported; retain multiple IDs if reported |
| `helperReasoningDefault` | Helper reasoning default | Always `low` under the current execution policy |
| `models[].supportedReasoningEfforts` | Supported reasoning efforts | `null`: unknown when upstream omits or supplies an empty effort list |
| `models[].catalogReasoningDefault` | Catalog reasoning default | `null`: unknown when not reported |
| `providers` | Providers | `[]`: no provider entries from the verified sources; inspect `providerCoverage` |
| `providerCoverage` | Provider coverage | `configured-only` or `built-in-and-configured`; never imply unsupported IDs from absence |

The report's `context` contains working directory, Codex version, `codexHome`
(the verified effective absolute home path, not the raw environment string), and
`codexHomeSource` (`environment` when Codex uses `CODEX_HOME` to choose that path,
`default` when Codex uses its normal home fallback). Model-bearing views also contain
`catalogScope: "picker-visible"` and `models` with model IDs and the metadata
listed in the view table; the providers view uses the not-requested nulls above.
Nullable optional metadata uses `null`, not omitted keys. Effort entries retain their reported value and nullable description.
`models: []` means a successful empty visible catalog; `models: null` means the
providers command did not request the catalog. Keep an unlisted configured
selection in `configured`; do not fabricate a catalog entry for it.

Human output renders unspecified configuration as "unspecified", absent catalog
metadata as "unknown", and an empty recommendation list as "none reported".
All views use these same normalized states; no unqualified `default` field or
marker is allowed. Finalize the remaining metadata field names in the Phase 5
report type and fixtures before implementing renderers. Reported capabilities
remain unverified for provider requests.

### Provider Sources And Catalog Scope

Extract custom definitions from `config/read.result.config.model_providers`, a
map keyed by provider ID. Derive normalized report entries: `id` is the map key;
`displayName` comes from the definition's optional `name` (`null` when absent);
`sources` includes `configured` for that map entry and `built-in` only when
corroborated by the verified built-in source; `isConfigured` is the exact match
between the ID and non-null `config.model_provider`. These are report fields,
not expected wire fields on each definition. This marker does not infer the runtime provider when
configuration omits it. Retain an unlisted configured provider in `configured`
without fabricating its definition. Explicitly label omitted selection unspecified.

Verify a built-in enumeration source for the installed executable at the first
checkpoint. Use `providerCoverage: "built-in-and-configured"` only with evidence
covering both sources; otherwise use `configured-only` and explain the limitation
in summary, details, and JSON. Unsupported built-in enumeration is a successful
limited result: after successful configuration/extraction, exit 0 with
`providerCoverage: "configured-only"`, including when the configured map is empty.
Keep this distinct from an actual required-read or transport error, which fails.
Deduplicate exact case-sensitive IDs, retain all
verified source labels, prefer the configured display name on a collision, and
sort IDs deterministically. An observed required-read error must fail the command,
not silently turn full enumeration into configured-only output.

The observed CLI `0.153.4` configuration comparison returned the same model catalog
with an omitted provider and a custom provider selected. Treat the catalog as
Codex-reported metadata, not an automatic filter of models supported by that
provider. Include configured-provider context and a reported-metadata qualification
in both model human views; all JSON views include `configured` and model-bearing
views identify `catalogSource: "codex"` (`null` for providers). Listing a provider
or model does not verify credentials, model access, or request capabilities.

### Integration And Lifetime

Keep execution on the existing SDK. Add a small discovery adapter for the
installed Codex CLI's app-server stdio protocol: initialize, read configuration
for `runtime.cwd`, collect the sources required by the command, then terminate
the owned child. Summary/models read every model page; the providers command
never requests `model/list`. Extract provider metadata from the already-read
configuration and any verified additional built-in source.
Use the same executable selection policy as helper execution, including
`CDX_CHORES_CODEX_PATH`; do not attach to an existing desktop session or daemon.
Keep parsing, report construction, and rendering outside command registration.

Resolve the launch context from the invocation environment, including dynamic
`CODEX_HOME`. When unset, retain Codex's normal home-directory default; never
hardcode a machine-specific configuration path. Forward the same environment
basis to discovery and SDK execution, preserving unrelated variables. Keep any
resolved context local to the invocation; do not mutate the parent environment
or cache a home directory across invocations. Reuse a shared context-resolution
seam where necessary without adding a tool config-file loader or `--codex-home`.
Show the inspected home and its source in `--details` and the JSON context.

Use the app-server `initialize` response's `codexHome` as the effective path;
CLI `0.153.4`'s generated `InitializeResponse` declares it as an absolute path.
Require and validate that field instead of reconstructing the home from
`config/read` or the local auth-signal helper. Establish source classification
from the launch environment and CLI fallback rules verified with the real
executable: use isolated default/custom homes with distinct synthetic config
values, observe `initialize.codexHome`, and corroborate configuration selection
through `config/read` values/origins. Record unset, empty, whitespace, and relative
cases separately. Synthetic child-environment capture proves forwarding only;
it does not prove CLI config resolution. Missing/invalid home metadata or
unestablished source behavior fails discovery under the existing no-report policy.

Discovery describes the `codex-info` invocation directory: use `runtime.cwd`
(the normal CLI entry supplies `process.cwd()`) both as the child launch directory
and as `config/read.cwd`. It does not predict configuration for every eventual
helper directory. Existing workflow-specific working directories remain unchanged;
helpers launched in another directory can load different project configuration.
Environment parity means the same inherited environment basis; configuration
parity is asserted only when the working-directory context also matches.

Verify unset and custom `CODEX_HOME`, two successive invocations using different
homes, and independence from `CDX_CHORES_CODEX_PATH`. Include empty, whitespace,
and relative-path inputs in the protocol evidence: match the child process's
actual resolution or surface a clear error, rather than displaying a different
home based only on the existing authentication-signal helper's trimming rules.
For empty or whitespace values, report `default` only if evidence establishes
that Codex falls back; report `environment` if Codex accepts the value as its home.
For accepted relative paths, report the effective absolute path resolved using
the verified CLI behavior and launch directory. Do not trim or expand values by
assumption. If Codex rejects a value, or effective path/source cannot be established,
fail discovery without a report. Record these cases before finalizing the resolver.
Tests must exercise both discovery and SDK child-environment propagation without
making generation requests or changing the user's real Codex state.

The first Phase 5 checkpoint verifies the `0.153.4` schema and actual read-method
behavior with controlled fixtures. Record the CLI version, generated schema
provenance, JSON-RPC wire convention, initialization parameters/response and
`initialized` notification, `config/read` parameters including `cwd`, and
`model/list` parameters including `includeHidden` and pagination cursors. Retain
sanitized request/response fixtures reflecting the observed field shapes, with
no private configuration or account data. Identify observations from the real
executable separately from simulated error cases. Record omitted/explicit
selections, project configuration discovery, catalog recommendations, and
custom-provider limitations.
When the protocol cannot establish a resolved default or provider-specific catalog,
retain unknown values and a clear source label. No private cache parsing, model
registry, configuration writes, login actions, or generation turns are involved.
Discovery may contact Codex services for catalog metadata; it is not an offline
guarantee or a provider compatibility test.

Use a 30-second overall discovery deadline covering startup, initialization,
configuration reads, and pagination. This is independent of the existing
per-attempt helper timeout and introduces no `--codex-timeout` option here.
Bound response buffering and pagination, correlate JSON-RPC response IDs, and
handle unrelated notifications. Reap the owned child and release streams/timers
on success, error, timeout, and cancellation. Every command requires successful
initialization/configuration and its required provider sources. Summary/models
also require all `model/list` pages; provider listing is independent of that API.
A request, transport, protocol, or resource limit failure in any required read
fails the invocation: exit nonzero through the
existing CLI error path and emit no report on stdout, including in JSON mode.
Do not retain a partial configuration-only or truncated catalog report. A successful
empty catalog or absent optional metadata is valid and uses the missing-value
contract above. Apply the same policy to custom providers; no provider-specific
error is silently converted into missing metadata. Surface sanitized errors;
never print raw configuration or responses.

Only selected IDs and the explicitly listed report fields may enter output.
Provider definitions, credential fields, and arbitrary config layers stay outside
both JSON and human views. Discovery must not become a preflight requirement,
change helper defaults, or supply automatic fallback decisions.

Phase 5 includes provider enumeration with explicit coverage limitations and
adds no Interactive entry or provider-selection/configuration mutation controls.

## Implementation Phases

Each phase starts unchecked. When implementation begins, create one unified job
record at `docs/plans/jobs/YYYY-MM-DD-codex-execution-configuration.md`, dated for
the execution start, and link it from this plan. Use sections for Phases 1–6 to
record changes, validation commands/results, exact reviewed `base..tip` ranges,
findings and resolutions, and remaining work. The plan owns intended outcomes and
checklists; the job record owns execution evidence.

Commit validated, coherent changes and review each phase's full commit range
before advancing. After review fixes, verify and re-review the expanded range
from the same phase base. Check off outcomes only when their required evidence
passes; close each phase after its findings are resolved. Keep the unified job
`in-progress` until all six phases finish, then mark it and the plan completed.
Only checked outcomes have completed implementation evidence.

### Phase 1: Shared Policy And SDK Mapping

- [x] Recheck the installed SDK type and argument behavior against `0.153.4`.
- [x] Implement shared validation/defaults and reusable command option helpers.
- [x] Extend the shared factory while preserving all existing factory settings.
- [x] Verify constructor/thread arguments for defaults, individual and combined
      overrides, executable override coexistence, and separate invocations.
- [x] Verify that execution settings emit no service-tier or fast-mode override.
- [x] Verify SDK-generated arguments with a synthetic executable fixture using
      the existing path override, without credentials or provider requests.

Exit evidence: focused validation and factory tests pass; Node runtime and lazy
SDK import behavior remain intact. No public command adoption is claimed yet.

### Phase 2: Rename Adoption

- [x] Register options in `src/cli/commands/rename/codex-options.ts` and wire
      `src/cli/commands/rename.ts`, including the compatibility alias.
- [x] Carry settings through file/batch actions, analyzer dispatch, adapter request
      types, and injectable thread factories.
- [x] Verify mixed image/document routing, batch retries, partial failures, no
      automatic effort fallback, and unchanged timeout precedence.
- [x] Verify that execution options alone do not enable an analyzer.

Exit evidence: command and action/adapter tests cover the same selections across
every eligible batch and attempt, with existing rename fallback behavior intact.

### Phase 3: Direct Data And Markdown Adoption

- [x] Wire `data query codex` and `data stack` through their action and runner types.
- [x] Wire the three Markdown Codex commands through CLI/action option conversion,
      preparation services, profile orchestration, project phases, and repairs.
- [x] Keep direct embedded header/shape suggestions default-only.
- [x] Verify deterministic and prepared-artifact paths make no additional Codex
      requests merely because execution settings are present.
- [x] Inspect failure formatting for configuration errors. In particular, stack
      currently treats generic `invalid_request_error` as a schema failure;
      avoid attributing all provider/model/effort rejections to output schemas.
      Preserve existing sanitized error/report surfaces and schema shapes.

Exit evidence: direct command tests and workflow tests prove propagation and
visible failure handling without changing saved artifact contracts.

### Phase 4: Interactive Adoption

- [x] Register options on explicit `interactive` in `src/cli/commands/index.ts`.
- [x] Extend session construction and the rename/data/Markdown dispatch seams
      using the existing timeout startup-and-propagation pattern.
- [x] Cover every request owner in the inventory, including header mapping,
      source shape, rename cleanup, project phases, and template repair.
- [x] Verify regeneration and repeated menu visits retain selections, while a
      separate Interactive session starts with its own settings.
- [x] Preserve consent prompts and prepared-output write/recovery lifecycles.

Exit evidence: Interactive tests exercise custom session settings and default
entry behavior, with no configuration leakage across sessions.

### Phase 5: Codex Information Discovery

- [ ] Verify the installed CLI discovery protocol, executable resolution, and
      configuration/catalog behavior; record evidence and unresolved metadata
      explicitly in the research and unified job before finalizing the adapter.
      Capture the initialization/read parameters and sanitized response shapes in
      version-labeled fixtures derived from the installed executable.
- [ ] Preserve dynamic `CODEX_HOME` and the inherited child environment across
      discovery and SDK execution. Verify default/custom homes, successive-call
      isolation, home-value edge cases, independent executable selection, and
      matching home/source fields in details and JSON.
- [ ] Implement a bounded stdio discovery adapter with configuration reads,
      paginated model listing, normalized report types, and subprocess cleanup.
- [ ] Register `codex-info`, `codex-info models`, and `codex-info providers` with
      default summary, `--details`, and `--json`; reject conflicts before discovery.
- [ ] Verify configured and built-in provider sources, coverage labeling, configured
      markers, raw-to-report field mapping, exact-ID deduplication, successful
      configured-only/empty results, and safe provider field selection. Record
      unsupported enumeration capabilities without claiming a complete list.
- [ ] Preserve configuration/recommendation/default distinctions, unknown
      reasoning support, and configured models absent from the visible catalog.
- [ ] Verify one discovery result feeds each output projection, safe field
      selection, custom-provider limitations, and no generation/config writes.
- [ ] Cover startup/response failures, pagination, deadline/cancellation cleanup,
      configuration-success/catalog-failure and reverse-failure cases, valid empty
      results, and command-local help/option behavior. Prove provider listing never calls
      `model/list` and succeeds when that unrelated method would fail. Cover model
      catalogs unchanged by provider selection and view-specific JSON null fields. Recheck execution inheritance and
      defaults remain independent of discovery.
- [ ] Record research conclusions and review this phase's full commit range;
      resolve findings before marking discovery complete.

Exit evidence: protocol fixtures and command/report tests prove accurate scoped
output and bounded lifecycle handling. Runtime observations are labeled separately
from synthetic tests and do not claim provider request compatibility.

### Phase 6: Validation And Documentation Closeout

- [ ] Complete the validation matrix below and record commands/results in the
      unified job record.
- [ ] Add `docs/guides/codex-execution-configuration.md` as the canonical shipped
      option/default/scope guide, with examples for model/provider/effort and
      failures followed by a manual rerun with an explicit supported selection.
      Do not imply automatic setting changes or hidden retries. Link to the
      existing timeout guide for its policy. Include `codex-info` summary,
      model/provider listing, details/JSON views, command-specific discovery
      dependencies, provider coverage, and configuration/catalog limitations.
- [ ] Create `docs/guides/environment-variables.md` as the central guide to
      implemented environment controls. Inventory variables read by this tool
      and relevant inherited dependency variables; explain ownership, accepted
      values, unset/invalid behavior, defaults, precedence, affected commands,
      and portable examples. Cover `CODEX_HOME`, `CDX_CHORES_CODEX_PATH`,
      `CODEX_API_KEY`, `OPENAI_API_KEY`, `NO_COLOR`, and the existing path-prompt
      controls. Verify authentication semantics against the installed SDK/CLI;
      distinguish local auth signals from credentials actually used by Codex.
      Do not document an unimplemented tool config file or `codex.home` setting.
- [ ] Link the environment guide from README and the Codex execution guide.
      Cross-link the existing path-prompt and output/color guides, keeping
      detailed feature behavior in those guides and avoiding conflicting rules.
- [ ] Update relevant rename, data-query, data-stack, Markdown helper and
      Interactive guides, the CLI integration guide, and README discovery links.
      Keep unsupported surfaces explicit and existing PDF `--profile` terminology.
- [ ] Record any live compatibility evidence separately with the exact tested
      SDK/model/provider and request capability; argument tests alone must not
      be described as backend compatibility validation.
- [ ] Close the implementation plan only after adopted paths and documentation
      are complete. Mark the reopened research completed only after Phase 5
      discovery questions have recorded conclusions; retain it as the decision source.

## Validation Matrix

| Boundary                       | Required evidence                                                                                                                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input contract                 | Omission, individual/combined flags, empty identifiers, identifier case preservation, all eight efforts, invalid/case-mismatched/padded efforts, and repeated options                                                   |
| SDK transport                  | Constructor provider mapping, thread model/effort mapping, omitted model/provider keys, exact argument serialization, executable override, preserved factory settings                                                   |
| Direct commands                | Adopted options reach actions; excluded surfaces reject unknown options; flags alone do not trigger Codex                                                                                                               |
| Workflow lifetime              | Image/document batches, retries, partial results, PDF initial/repair/project phases, and regeneration keep the same requested settings                                                                                  |
| Incompatibility                | Synthetic failures for unknown provider, rejected model/effort, missing auth, structured output, and image support remain visible without changed-setting retries; generic failures are not mislabeled as schema errors |
| Timeout regression             | Existing parser/precedence tests, per-attempt signals, and no model/provider/effort-derived timeout changes                                                                                                             |
| Interactive isolation          | Custom session settings reach all nine request owners; separate/default sessions do not inherit previous selections                                                                                                     |
| Request failures and artifacts | Visible sanitized failures, unchanged advisory schemas, and no execution policy in durable outputs                                                                                                                      |
| Discovery output               | Configured/recommended distinctions, absent selections, unlisted models, missing/new effort metadata, JSON field selection, and summary/details consistency                                                             |
| Discovery transport            | Version-specific initialization, cwd/executable selection, pagination, unrelated notifications, malformed responses, bounded buffers/deadlines, cancellation, and child cleanup                                         |
| Discovery isolation            | No generation/config writes, no dependency from execution workflows, unchanged helper defaults, and honest catalog scope under custom providers                                                                         |
| Environment context            | Default/custom/edge-case `CODEX_HOME`, successive-invocation isolation, SDK/discovery environment parity, independent executable override, and accurate home/source reporting                                           |
| Provider discovery | Configured/built-in sources, completeness labels, duplicate IDs, unlisted selections, safe fields, and independence from model-list failures |
| Provider/catalog relationship | Same catalog under different providers, configured context in model output, metadata-only claims, and not-requested versus empty JSON states |

Reuse coverage in `test/codex-adapters/`, rename/data/Markdown command and action
suites, `test/adapters-codex-markdown-pdf-profile/runner-behavior.test.ts`,
and Interactive suites. Add focused cases at the relevant seams
instead of duplicating the entire matrix for every helper. Isolate SDK mocks so
the real-SDK argument fixture cannot accidentally exercise a mock implementation.

Run focused tests and `tsc --noEmit` per adoption phase. At final closeout run
`bun run lint`, `bun run format:check`, `bun run build`, and `bun test`, then verify
Node ESM/CJS package loading and CLI help. Use synthetic inputs and fixtures;
manual scratch artifacts belong in `examples/playground/` and must be cleaned up.
For documentation changes, check formatting, local links, and `git diff --check`.

Environment documentation must be checked against the implemented resolvers and
the installed SDK/CLI behavior, including parser defaults and invalid-value
handling. Keep credential examples synthetic and link to official Codex guidance
for externally owned semantics. Documentation checks do not require live model
requests.

## Related Research

- [Codex execution configuration](../researches/research-2026-08-21-codex-execution-configuration.md)

## Related Job Records

- [Codex execution configuration implementation](./jobs/2026-09-05-codex-execution-configuration.md)

## Related Plans

- [Codex request timeout contract implementation](./plan-2026-08-21-codex-request-timeout-contract.md)

## Related Guides

- [Codex timeouts, retries, and recovery](../guides/codex-timeouts-retries-and-recovery.md)
