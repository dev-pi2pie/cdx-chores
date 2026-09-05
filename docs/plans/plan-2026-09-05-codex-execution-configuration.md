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

This plan adopts the completed research contract. Implementation is underway;
phase completion is tracked below and in the unified job record.
The shipped timeout policy remains owned by its existing guide and plan.

## Starting State

The 2026-09-05 inventory uses SDK `0.153.4`. All current Codex request runners
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
  current invocation; do not read, merge, or rewrite Codex configuration ourselves.
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
for configuration discovery on each process invocation. Do not snapshot user
configuration or claim inheritance from a parent desktop/terminal selection.

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
following the existing `--codex-timeout` pattern. For example, after implementation:

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

## Implementation Phases

Each phase starts unchecked. When implementation begins, create one unified job
record at `docs/plans/jobs/YYYY-MM-DD-codex-execution-configuration.md`, dated for
the execution start, and link it from this plan. Use sections for Phases 1–5 to
record changes, validation commands/results, exact reviewed `base..tip` ranges,
findings and resolutions, and remaining work. The plan owns intended outcomes and
checklists; the job record owns execution evidence.

Commit validated, coherent changes and review each phase's full commit range
before advancing. After review fixes, verify and re-review the expanded range
from the same phase base. Check off outcomes only when their required evidence
passes; close each phase after its findings are resolved. Keep the unified job
`in-progress` until all five phases finish, then mark it and the plan completed.
Only checked outcomes have completed implementation evidence.

### Phase 1: Shared Policy And SDK Mapping

- [ ] Recheck the installed SDK type and argument behavior against `0.153.4`.
- [ ] Implement shared validation/defaults and reusable command option helpers.
- [ ] Extend the shared factory while preserving all existing factory settings.
- [ ] Verify constructor/thread arguments for defaults, individual and combined
      overrides, executable override coexistence, and separate invocations.
- [ ] Verify that execution settings emit no service-tier or fast-mode override.
- [ ] Verify SDK-generated arguments with a synthetic executable fixture using
      the existing path override, without credentials or provider requests.

Exit evidence: focused validation and factory tests pass; Node runtime and lazy
SDK import behavior remain intact. No public command adoption is claimed yet.

### Phase 2: Rename Adoption

- [ ] Register options in `src/cli/commands/rename/codex-options.ts` and wire
      `src/cli/commands/rename.ts`, including the compatibility alias.
- [ ] Carry settings through file/batch actions, analyzer dispatch, adapter request
      types, and injectable thread factories.
- [ ] Verify mixed image/document routing, batch retries, partial failures, no
      automatic effort fallback, and unchanged timeout precedence.
- [ ] Verify that execution options alone do not enable an analyzer.

Exit evidence: command and action/adapter tests cover the same selections across
every eligible batch and attempt, with existing rename fallback behavior intact.

### Phase 3: Direct Data And Markdown Adoption

- [ ] Wire `data query codex` and `data stack` through their action and runner types.
- [ ] Wire the three Markdown Codex commands through CLI/action option conversion,
      preparation services, profile orchestration, project phases, and repairs.
- [ ] Keep direct embedded header/shape suggestions default-only.
- [ ] Verify deterministic and prepared-artifact paths make no additional Codex
      requests merely because execution settings are present.
- [ ] Inspect failure formatting for configuration errors. In particular, stack
      currently treats generic `invalid_request_error` as a schema failure;
      avoid attributing all provider/model/effort rejections to output schemas.
      Preserve existing sanitized error/report surfaces and schema shapes.

Exit evidence: direct command tests and workflow tests prove propagation and
visible failure handling without changing saved artifact contracts.

### Phase 4: Interactive Adoption

- [ ] Register options on explicit `interactive` in `src/cli/commands/index.ts`.
- [ ] Extend session construction and the rename/data/Markdown dispatch seams
      using the existing timeout startup-and-propagation pattern.
- [ ] Cover every request owner in the inventory, including header mapping,
      source shape, rename cleanup, project phases, and template repair.
- [ ] Verify regeneration and repeated menu visits retain selections, while a
      separate Interactive session starts with its own settings.
- [ ] Preserve consent prompts and prepared-output write/recovery lifecycles.

Exit evidence: Interactive tests exercise custom session settings and default
entry behavior, with no configuration leakage across sessions.

### Phase 5: Validation And Documentation Closeout

- [ ] Complete the validation matrix below and record commands/results in the
      unified job record.
- [ ] Add `docs/guides/codex-execution-configuration.md` as the canonical shipped
      option/default/scope guide, with examples for model/provider/effort and
      failures followed by a manual rerun with an explicit supported selection.
      Do not imply automatic setting changes or hidden retries. Link to the
      existing timeout guide for its policy.
- [ ] Update relevant rename, data-query, data-stack, Markdown helper and
      Interactive guides, the CLI integration guide, and README discovery links.
      Keep unsupported surfaces explicit and existing PDF `--profile` terminology.
- [ ] Record any live compatibility evidence separately with the exact tested
      SDK/model/provider and request capability; argument tests alone must not
      be described as backend compatibility validation.
- [ ] Close the implementation plan only after adopted paths and documentation
      are complete. Research remains completed and linked as the decision source.

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

## Related Research

- [Codex execution configuration](../researches/research-2026-08-21-codex-execution-configuration.md)

## Related Job Records

- [Codex execution configuration implementation](./jobs/2026-09-05-codex-execution-configuration.md)

## Related Plans

- [Codex request timeout contract implementation](./plan-2026-08-21-codex-request-timeout-contract.md)

## Related Guides

- [Codex timeouts, retries, and recovery](../guides/codex-timeouts-retries-and-recovery.md)
