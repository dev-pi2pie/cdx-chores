---
title: "Codex request timeout contract implementation"
created-date: 2026-08-21
modified-date: 2026-08-21
status: active
agent: codex
---

## Goal

Implement the first coherent Codex request-timeout contract for `cdx-chores`:

- add one reusable duration parser and timeout resolver
- expose the shared `--codex-timeout <duration>` option on rename commands
- add duration-based image and document timeout overrides for rename
- preserve the existing millisecond-only rename flags during a compatibility
  period with exact migration notices
- classify exhausted request timeouts clearly without changing rename's current
  retry, partial-result, fallback, or exit behavior
- add the shared option to the first explicit non-rename Codex command wave
- add one session-owned timeout to explicit Interactive mode and thread it
  through every current Interactive Codex request path

This plan proves the shared contract through `rename` before applying it to
explicit direct Codex commands and then Interactive mode. Each adoption layer
remains a separate reviewed phase.

## Why This Plan

The related research found that most Codex requests use a 30-second
`AbortSignal.timeout(...)`, but only rename exposes public timeout controls.
Those controls currently:

- use analyzer-specific millisecond flags
- parse through raw `Number(value)` conversion
- coexist with per-batch retry controls
- do not distinguish an exhausted timeout clearly from other Codex failures

The research also settled that timeout and retry have different ownership:

```text
timeout = shared request-boundedness policy
scoped timeout = workflow-specific override
retry = workflow-owned execution behavior
repair = semantic recovery, not generic retry
```

The implementation should establish that boundary incrementally instead of
changing every Codex-backed command in one unreviewable slice.

## Starting State

Current rename command surfaces include:

```text
--codex-images-timeout-ms <ms>
--codex-images-retries <count>
--codex-images-batch-size <count>
--codex-docs-timeout-ms <ms>
--codex-docs-retries <count>
--codex-docs-batch-size <count>
```

The timeout options are registered for:

- `rename file`
- `rename batch`
- the top-level `batch-rename` compatibility alias

Current action and adapter seams already pass numeric `timeoutMs` values through
the file/batch actions, analyzer router, and image/document Codex adapters. The
adapters apply the timeout independently to every request attempt. The shared
batch executor performs `retries + 1` attempts per sequential batch and adds a
short delay between attempts.

The implementation should preserve those numeric internal seams. Duration
strings belong at the public CLI boundary and should be normalized before action
execution.

The explicit `interactive` command currently has no timeout option. Interactive
Codex paths are also uneven: data-stack review supplies a fixed timeout, while
rename, data-query, header-mapping, source-shape, rename-cleanup, and Markdown
PDF authoring paths use action, adapter, or phase defaults. Interactive
regeneration creates another request with another timeout window.

## Research Questions Resolved For This Plan

| Research question | Recommendation adopted by this draft plan |
| --- | --- |
| Maximum accepted duration | Use a 10-minute (`600_000ms`) per-attempt maximum. This is a validation bound, not a whole-command SLA. Revisit only with evidence from legitimate bounded workflows. |
| Initial duration grammar | Accept positive integer `ms`, `s`, and `m` only. Do not add hours, decimals, compound values, bare numbers, or case-insensitive aliases. |
| First non-rename direct wave | Add `--codex-timeout <duration>` to `data query codex`, `data stack --codex-assist`, `md pdf-profile codex`, `md pdf-template codex`, and `md pdf-project codex`. Keep embedded suggestion flags default-only in this plan. |
| Markdown PDF project semantics | Apply one shared value independently to every profile, template, and repair request attempt. Do not add phase-specific timeout flags without later evidence. |
| Legacy rename removal boundary | Keep both legacy flags for at least one stable compatibility release. Remove them no earlier than a separately approved breaking release, such as the next accepted minor boundary, with migration evidence recorded first. |
| Timeout failure preservation | Add one narrow internal `timeout | aborted | other` classifier. Do not redesign every existing public result or report schema. |
| Interactive helper alignment | Use rename as the reference helper contract. Interactive data and Markdown helpers receive the same normalized session value through numeric `timeoutMs` seams, use the shared default and classifier, and retain workflow-owned retry or repair behavior. |

These decisions close the research questions for planning purposes. They remain
proposed behavior until their owning phases are implemented and verified.

## Settled Contract

### Shared And Scoped Options

Add to `rename file`, `rename batch`, and `batch-rename`:

```text
--codex-timeout <duration>
--codex-images-timeout <duration>
--codex-docs-timeout <duration>
```

Keep during the compatibility period:

```text
--codex-images-timeout-ms <ms>
--codex-docs-timeout-ms <ms>
```

Timeout options do not enable Codex analysis. Routing remains owned by
`--codex`, `--codex-images`, and `--codex-docs`.

### Duration Grammar

The draft implementation contract accepts:

```text
<positive-integer><unit>
```

Initial units:

- `ms`
- `s`
- `m`

Examples:

```text
1ms
500ms
30s
2m
10m
```

The initial maximum is 10 minutes (`600_000ms`). This gives bounded local Codex
requests substantially more room than the current default without allowing one
request attempt to wait for hours. A later evidence-backed plan may change that
maximum.

Reject:

- a missing unit, such as `30`
- zero or negative values
- decimal values
- whitespace inside or around the duration token
- uppercase or unknown units
- compound values such as `1m30s`
- values that overflow safe integer conversion
- values above the configured 10-minute maximum
- repeated occurrences of the same timeout option

Parsing should use a strict grammar before numeric conversion, validate the
multiplied millisecond result with `Number.isSafeInteger`, and throw a Commander
`InvalidArgumentError` that names the offending option.

### Timeout Meaning

Every effective timeout is a **per Codex request attempt** deadline.

It is not:

- a whole-command deadline
- a batch deadline
- a total retry budget
- a Markdown PDF project budget
- an SDK transport retry setting

For one sequential rename analyzer, approximate worst-case elapsed time remains:

```text
batch count × (retries + 1) × per-attempt timeout
  + retry delays
  + local processing
```

### Rename Precedence

Resolve image requests as:

```text
new --codex-images-timeout
  -> legacy --codex-images-timeout-ms
  -> shared --codex-timeout
  -> built-in 30-second default
```

Resolve document requests as:

```text
new --codex-docs-timeout
  -> legacy --codex-docs-timeout-ms
  -> shared --codex-timeout
  -> built-in 30-second default
```

Rules:

- a shared timeout may be combined with a scoped timeout
- the scoped timeout overrides the shared value only for its analyzer
- new and legacy scoped options for the same analyzer conflict and fail before
  action execution
- image and document scoped options may be used together
- action-tool and package callers may continue passing the existing normalized
  numeric `codexImagesTimeoutMs` and `codexDocsTimeoutMs` fields
- internal numeric fields do not themselves trigger CLI deprecation notices

### Compatibility Notice

When a user explicitly supplies either legacy CLI flag:

- keep the flag functional
- emit exactly one consolidated notice per command invocation
- write the notice to stderr
- preserve the command's normal exit status and fallback behavior
- include an exact duration-based replacement when the legacy value satisfies
  the new duration grammar and maximum
- otherwise explain that the legacy value cannot migrate unchanged and must be
  reduced or normalized before using the duration-based flag
- do not print again for each analyzer batch or retry attempt
- do not announce a removal release yet

Example for one legacy flag:

```text
Warning: --codex-docs-timeout-ms is deprecated.
Use --codex-docs-timeout 30000ms instead.
The legacy option remains supported during the current compatibility phase.
```

When both legacy flags are supplied, one notice should list both replacements.

### Retry Contract

Do not add `--codex-retries`.

Keep:

```text
--codex-images-retries <count>
--codex-docs-retries <count>
```

Only clarify their help text:

```text
Retry count after the initial Codex image-title request, per batch
Retry count after the initial Codex document-title request, per batch
```

Timeouts remain retryable under the existing rename batch executor. Every retry
attempt receives the same resolved scoped or shared timeout. This plan does not
change retry counts, delays, ordering, partial suggestion retention, or fallback
behavior.

## Public Help Contract

The relevant command help should communicate the lifecycle directly:

```text
--codex-timeout <duration>
    Timeout for each Codex request attempt (for example: 30s, 2m)

--codex-images-timeout <duration>
    Override the per-attempt timeout for Codex image-title requests

--codex-docs-timeout <duration>
    Override the per-attempt timeout for Codex document-title requests

--codex-images-timeout-ms <ms>
    Deprecated millisecond-only image timeout; use --codex-images-timeout

--codex-docs-timeout-ms <ms>
    Deprecated millisecond-only document timeout; use --codex-docs-timeout
```

The help for `rename file`, `rename batch`, and `batch-rename` must remain in
parity.

The same base option should then appear on the first explicit direct-command
wave:

```text
data query codex --codex-timeout <duration>
data stack --codex-assist --codex-timeout <duration>
md pdf-profile codex --codex-timeout <duration>
md pdf-template codex --codex-timeout <duration>
md pdf-project codex --codex-timeout <duration>
interactive --codex-timeout <duration>
```

For `data stack`, the option configures the request only when
`--codex-assist` is active; it does not imply that flag. For explicit
Interactive mode, the option establishes one session default and does not add a
timeout prompt to each workflow. Starting Interactive mode with no arguments
continues to use the built-in 30-second default.

Selecting a data or Markdown Codex helper inside Interactive mode follows the
same boundary as rename: the Interactive parent supplies one normalized shared
value, the helper accepts a numeric `timeoutMs`, and each request attempt applies
that value without implicitly enabling Codex or changing workflow-owned retry or
repair behavior.

## Implementation Architecture

### Shared CLI Timeout Module

Add a focused module under `src/cli/options/`, preferably
`src/cli/options/codex-timeout.ts`, that owns:

- `DEFAULT_CODEX_REQUEST_TIMEOUT_MS`
- `MAX_CODEX_REQUEST_TIMEOUT_MS`
- strict duration parsing and millisecond normalization
- repeated-option detection for the new duration options
- pure shared/scoped/legacy timeout resolution
- resolved source metadata used for conflicts and diagnostics
- exact legacy replacement formatting

Keep this module free of Commander command registration and output side effects.
It may throw `InvalidArgumentError` for option-value failures, but it should
return notice data rather than write to stderr itself.

### Command-Boundary Normalization

Update `src/cli/commands/rename.ts` to:

- register the three new duration options through one shared option helper
- keep the legacy options visible and marked deprecated in help
- retain separate raw values for new and legacy scoped options until conflicts
  are checked
- reject same-analyzer new/legacy conflicts before invoking an action
- consolidate legacy notices and write them once through the command runtime
- normalize all accepted public values to milliseconds
- pass only normalized numeric values into action options
- preserve `rename batch` and `batch-rename` parity by continuing to use their
  shared command configurator

The command boundary, not the action or adapter, owns whether a value came from
a deprecated CLI spelling.

### Action And Analyzer Resolution

Extend the file and batch action options with one optional shared numeric field:

```ts
codexTimeoutMs?: number;
```

Keep the existing scoped numeric fields:

```ts
codexImagesTimeoutMs?: number;
codexDocsTimeoutMs?: number;
```

Resolve effective values after Codex analyzer routing is known and before the
analyzer request begins:

```text
image = codexImagesTimeoutMs ?? codexTimeoutMs ?? 30_000
docs  = codexDocsTimeoutMs  ?? codexTimeoutMs ?? 30_000
```

Pass the effective numeric value through `runRenameCodexAnalysis` into every
batch attempt. Do not make the timeout option implicitly activate an analyzer.

### Timeout Failure Classification

Add a narrow shared classifier for exhausted request timeouts:

- expose only the internal kinds `timeout`, `aborted`, and `other`
- recognize a preserved `TimeoutError` name through a bounded error/cause chain
- do not classify every `AbortError` as a timeout
- avoid string matching against arbitrary SDK error messages
- retain the original generic failure path when the SDK does not preserve a
  reliable timeout cause

For rename, classification should improve the final analyzer fallback summary
after configured retries are exhausted. It must not change whether partial
suggestions are retained, whether deterministic fallback continues, or whether
the command exits successfully.

The message should identify:

- image or document analyzer
- effective per-attempt duration
- that configured attempts were exhausted when retries were enabled

Do not expand this phase into a repository-wide Codex error taxonomy migration.

### Direct Command Adoption

After rename and the shared classifier are stable, reuse the same command option
helper and normalized numeric seam in the five explicit direct command surfaces
selected above.

Rules:

- the option remains command-local rather than root-global
- supplying a timeout never enables an optional Codex mode
- direct actions and prepared services continue to receive numeric
  `timeoutMs` values
- Markdown PDF project orchestration forwards the same value independently to
  profile, template, and application-repair requests
- no direct command gains phase-specific timeout overrides
- header-mapping, source-shape, and other embedded suggestion flags remain
  default-only until a later direct-surface review

### Interactive Session Ownership

Register `--codex-timeout <duration>` on the explicit `interactive` command in
`src/cli/commands/index.ts`. Do not introduce a root-level option or a new prompt.

Extend the Interactive entry contract with one normalized optional
`codexTimeoutMs` value and carry it as session state. Prefer an explicit
Interactive session/options object over placing timeout state inside path-prompt
configuration or mutating the shared CLI runtime.

Thread the session value to current Interactive Codex paths:

- rename image and document analysis
- rename cleanup suggestion
- data query drafting
- data stack review
- header-mapping suggestions
- source-shape suggestions
- Markdown PDF profile, template, and project authoring

The session value:

- applies independently to every request attempt
- survives menu routing, review, revision, and backtracking
- is reused for user-triggered regeneration without creating automatic retry
- is not persisted in recipe identity or generated artifacts
- defaults to 30 seconds when omitted or when Interactive mode starts through
  the no-argument entry

Each workflow keeps its existing recovery behavior. Timeout classification may
improve the message, but this plan does not invent one universal retry menu.

### Interactive Helper Reference Contract

Use rename's Codex analyzer boundary as the reference implementation shape for
Interactive data and Markdown helpers:

```text
Interactive session --codex-timeout
  -> normalized codexTimeoutMs
  -> selected helper's optional numeric timeoutMs seam
  -> shared 30-second default when omitted
  -> one AbortSignal timeout per request attempt
  -> shared timeout | aborted | other classification
  -> helper-owned fallback, repair, or user-controlled regeneration
```

Rules:

- do not add separate Interactive data or Markdown timeout parsers
- do not add helper-local default constants when the shared constant applies
- replace the fixed Interactive data-stack timeout with the shared session value
  and default
- keep rename image/document retry controls specific to rename
- keep Markdown template repair and project phase ownership specific to Markdown
- keep data and Markdown helper activation explicit in their existing flows
- do not add `dataTimeoutMs`, `markdownTimeoutMs`, or per-helper timeout prompts
  without later evidence for a scoped override

## Lifecycle Flow

```text
Commander parses public timeout options
  -> strict duration and repeated-option validation
  -> same-analyzer new/legacy conflict validation
  -> one legacy notice, if needed
  -> normalize accepted values to milliseconds
  -> resolve enabled Codex analyzer routes
  -> resolve scoped > shared > default timeout
  -> run one Codex batch attempt with that timeout
       -> success: retain suggestions
       -> failure with retries left: wait, then retry with the same timeout
       -> exhausted timeout: report timeout-specific fallback context
       -> other exhausted failure: preserve generic fallback context
  -> continue existing deterministic rename preview/apply lifecycle
```

Later adoption phases reuse the same primitives:

```text
explicit direct command
  -> command-local --codex-timeout
  -> normalized numeric action/prepared-service seam
  -> one timeout window per request attempt

explicit Interactive command
  -> session-local --codex-timeout
  -> Interactive session state
  -> selected Codex-assisted workflow
  -> one timeout window per request attempt or user-triggered regeneration
```

## Phased Implementation

### Phase 1: Duration Parser And Pure Resolver

Implement and unit-test the shared timeout module before changing command
registration.

Status: completed.

Tasks:

- [x] Create the Phase 1 job record and mark this plan `active` when
      implementation begins.
- [x] Add `src/cli/options/codex-timeout.ts` as the side-effect-free timeout
      contract module.
- [x] Define the 30-second default and proposed 10-minute maximum constants.
- [x] Implement strict positive-integer `ms`, `s`, and `m` parsing.
- [x] Normalize accepted durations to safe integer milliseconds.
- [x] Reject missing units, zero, negatives, decimals, whitespace, uppercase or
      unknown units, compound durations, overflow, and above-maximum values.
- [x] Add repeated-option detection without relying on last-value-wins behavior.
- [x] Implement pure shared/scoped/legacy resolution with source metadata.
- [x] Implement exact legacy replacement formatting.
- [x] Preserve legacy numeric input semantics outside the new grammar and cap;
      produce a non-exact migration explanation for those values.
- [x] Add focused unit tests for accepted values, rejected categories,
      boundaries, precedence, conflicts, source metadata, and replacement text.

Verification:

- [x] Run `bun test test/cli-options-codex-timeout.test.ts`.
- [x] Confirm the parser and resolver use Node-compatible APIs and do not depend
      on Bun runtime globals.
- [x] Record the focused command, result, and Phase 1 review range in the job
      record.

Gate:

- [x] Parser and resolver tests pass before any rename command registration is
      changed.

### Phase 2: Rename Command Surface And Compatibility

Add the new options and deprecation path to `rename file`, `rename batch`, and
`batch-rename`.

Status: not started.

Tasks:

- [ ] Create the Phase 2 job record.
- [ ] Register `--codex-timeout <duration>` on `rename file`, `rename batch`,
      and `batch-rename` through one shared command-option helper.
- [ ] Register `--codex-images-timeout <duration>` and
      `--codex-docs-timeout <duration>` on the same surfaces.
- [ ] Keep `--codex-images-timeout-ms` and `--codex-docs-timeout-ms`
      functional and label both as deprecated in help.
- [ ] Preserve distinct raw new and legacy scoped values until conflict checks
      and notice construction finish.
- [ ] Reject new/legacy conflicts for the same analyzer before invoking an
      action.
- [ ] Build one consolidated stderr notice for one or both explicitly supplied
      legacy flags.
- [ ] Include exact duration-based replacements in the notice.
- [ ] Normalize accepted public values to numeric milliseconds before action
      execution.
- [ ] Resolve the shared and scoped CLI values at the command boundary and map
      the effective image/document values into the existing scoped numeric
      action fields so the new flags are functional in this phase.
- [ ] Clarify both retry help descriptions as counts after the initial attempt,
      per batch.
- [ ] Keep `rename batch` and `batch-rename` help and routing in parity.

Verification:

- [ ] Add command-registration tests for accepted, invalid, repeated, and
      conflicting timeout options.
- [ ] Assert invalid and conflicting invocations do not call the action.
- [ ] Assert legacy-only invocations retain their prior effective numeric value.
- [ ] Assert shared-only and scoped-over-shared invocations reach the existing
      image/document numeric action fields with effective values.
- [ ] Assert one or both legacy flags produce exactly one stderr notice without
      changing the exit status.
- [ ] Inspect `rename file`, `rename batch`, and `batch-rename` help output.
- [ ] Record focused results and the Phase 2 review range in the job record.

Gate:

- [ ] All three command surfaces expose a functional shared/scoped contract and
      preserve the legacy compatibility path before the shared action seam is
      introduced in Phase 3.

### Phase 3: Action Routing And Retry Preservation

Thread the shared numeric timeout through file and batch actions and resolve
effective analyzer values.

Status: not started.

Tasks:

- [ ] Create the Phase 3 job record.
- [ ] Add the optional normalized `codexTimeoutMs` seam to rename file and batch
      action options.
- [ ] Preserve the existing numeric `codexImagesTimeoutMs` and
      `codexDocsTimeoutMs` action fields for programmatic callers.
- [ ] Resolve image timeout as scoped value, then shared value, then the
      30-second default.
- [ ] Resolve document timeout through the same scoped/shared/default order.
- [ ] Resolve values only for enabled analyzer routes; timeout options must not
      enable Codex analysis.
- [ ] Pass each effective timeout through `runRenameCodexAnalysis` to the image
      and document suggesters.
- [ ] Preserve the same resolved timeout on every retry attempt for one batch.
- [ ] Add mixed image/document coverage with shared and differing scoped values.
- [ ] Verify `batch-rename` routes the same normalized values as `rename batch`.

Verification:

- [ ] Run focused rename file, image, document, and auto-routing tests.
- [ ] Assert shared-only values reach both enabled analyzers.
- [ ] Assert each scoped value overrides only its own analyzer.
- [ ] Assert action-level numeric scoped inputs remain warning-free and valid.
- [ ] Assert timeout flags without a Codex routing flag do not run an analyzer.
- [ ] Assert retry count, delay, batch order, partial suggestions, and fallback
      behavior remain unchanged.
- [ ] Record focused results and the Phase 3 review range in the job record.

Gate:

- [ ] Existing rename behavior is unchanged except for the new resolved timeout
      inputs and already-approved command notices.

### Phase 4: Timeout-Specific Fallback Information

Add bounded timeout-cause recognition and use it in rename analyzer summaries.

Status: not started.

Tasks:

- [ ] Create the Phase 4 job record.
- [ ] Define the narrow internal failure kinds `timeout`, `aborted`, and
      `other` without changing public report schemas.
- [ ] Add a bounded shared timeout classifier that recognizes a preserved
      `TimeoutError` through an error/cause chain.
- [ ] Keep ordinary `AbortError` and unknown SDK errors out of timeout-specific
      classification.
- [ ] Avoid arbitrary SDK message string matching.
- [ ] Include the analyzer and effective per-attempt duration in exhausted
      timeout fallback information.
- [ ] Include attempt-exhaustion context when retries were configured.
- [ ] Preserve the current generic failure summary when the cause is unknown.
- [ ] Preserve partial suggestions from successful batches when another batch
      exhausts its timeout attempts.
- [ ] Keep classifier wording and metadata reusable by later direct and
      Interactive phases rather than embedding rename-only policy in the shared
      helper.

Verification:

- [ ] Add focused direct, wrapped-cause, abort, and generic error tests.
- [ ] Test exhausted timeout behavior with zero and multiple retries.
- [ ] Test partial-result retention alongside one exhausted timeout batch.
- [ ] Assert output artifacts, deterministic fallback, and exit behavior are
      unchanged.
- [ ] Record focused results and the Phase 4 review range in the job record.

Gate:

- [ ] Timeout-specific information is reliable and bounded without becoming a
      repository-wide Codex error taxonomy rewrite.

### Phase 5: Explicit Direct Command Adoption

Apply the stable shared contract to the selected non-rename direct commands.

Status: not started.

Tasks:

- [ ] Create the Phase 5 job record.
- [ ] Reuse the shared duration option helper in the data and Markdown command
      registrations; do not copy parsing or maximum logic.
- [ ] Add `--codex-timeout <duration>` to `data query codex` and thread the
      normalized value through the existing action/runner seam.
- [ ] Add `--codex-timeout <duration>` to `data stack` for
      `--codex-assist` requests without implying or enabling assist mode.
- [ ] Add `--codex-timeout <duration>` to `md pdf-profile codex` and thread it
      through the prepared profile request.
- [ ] Add `--codex-timeout <duration>` to `md pdf-template codex` and apply the
      same value to the initial request and any application-repair request.
- [ ] Add `--codex-timeout <duration>` to `md pdf-project codex` and apply the
      same value independently to profile, template, and repair requests.
- [ ] Keep all existing 30-second defaults when the option is omitted.
- [ ] Keep embedded header-mapping and source-shape suggestion flags out of the
      direct-command wave.
- [ ] Keep existing action/prepared-service numeric `timeoutMs` injection seams
      supported and warning-free.
- [ ] Reuse the shared timeout classifier for direct user-facing failures where
      the preserved cause is reliable.
- [ ] Avoid adding timeout fields to diagnostic report schemas in this phase.

Verification:

- [ ] Add command/help tests for all five direct surfaces.
- [ ] Assert invalid duration values fail before source inspection, Codex work,
      or artifact planning.
- [ ] Use injected runners to assert each direct action receives the normalized
      millisecond value.
- [ ] Assert `data stack --codex-timeout` does not enable `--codex-assist`.
- [ ] Assert Markdown PDF template repair reuses the same per-attempt value.
- [ ] Assert Markdown PDF project profile, template, and repair requests each
      receive the same shared value without sharing one total budget.
- [ ] Run focused data-query, data-stack, Markdown profile/template/project, and
      shared timeout regression tests.
- [ ] Inspect direct command help after a Node-target build.
- [ ] Record focused results and the Phase 5 review range in the job record.

Gate:

- [ ] Every selected direct command uses the same parser, default, maximum,
      per-attempt meaning, and reliable failure classification before
      Interactive session threading begins.

### Phase 6: Interactive Session Timeout

Add one session-owned timeout to explicit Interactive mode and thread it through
all current Interactive Codex request paths.

Status: not started.

Tasks:

- [ ] Create the Phase 6 job record.
- [ ] Add `--codex-timeout <duration>` to the explicit `interactive` command
      through the shared option helper.
- [ ] Keep the no-argument Interactive entry on the 30-second built-in default.
- [ ] Do not add a root-level option or a timeout prompt inside individual
      workflows.
- [ ] Extend the Interactive entry contract with one normalized optional
      `codexTimeoutMs` session value while preserving existing implementation
      injection seams used by tests.
- [ ] Introduce a narrow Interactive session/options object rather than storing
      timeout state in path-prompt configuration or mutating `CliRuntime`.
- [ ] Pass the session value through data, Markdown, and rename Interactive
      handler boundaries.
- [ ] Use the rename action/analyzer `timeoutMs` forwarding shape as the
      reference for data and Markdown helper seams; do not create another parser
      or resolver inside Interactive modules.
- [ ] Thread the value to rename image/document analysis and rename-cleanup
      suggestions.
- [ ] Thread the value to data-query drafting and replace the fixed data-stack
      Interactive timeout with the session value plus the shared default.
- [ ] Thread the value to header-mapping and source-shape suggestions.
- [ ] Thread the value to Markdown PDF profile, template, and project candidate
      preparation.
- [ ] Remove helper-local Interactive timeout constants wherever the shared
      default and session value now own the same behavior.
- [ ] Keep optional numeric `timeoutMs` seams consistent across rename, data,
      and Markdown helpers.
- [ ] Apply the same value independently to every Markdown PDF phase and repair
      request.
- [ ] Preserve the value through review, revision, backtracking, and
      user-triggered regeneration.
- [ ] Keep regeneration user-controlled and do not add automatic retry.
- [ ] Keep the timeout out of saved recipe identity and generated artifacts.
- [ ] Reuse timeout-specific failure information within each workflow's current
      recovery posture instead of inventing one universal recovery menu.

Verification:

- [ ] Add `interactive --help` and duration-parser integration tests.
- [ ] Assert explicit Interactive mode stores and forwards the normalized value.
- [ ] Assert the no-argument Interactive entry retains the default.
- [ ] Assert one session value resolves to the same milliseconds in rename,
      data, and Markdown helper requests.
- [ ] Assert omitted session values use the same shared 30-second constant rather
      than helper-local defaults.
- [ ] Extend Interactive harness coverage for rename, cleanup, data query, data
      stack, header mapping, source shape, and Markdown PDF authoring.
- [ ] Assert backtracking and revision preserve the session value.
- [ ] Assert regeneration creates a new request with the same per-attempt value
      and no automatic retry.
- [ ] Assert Markdown PDF project requests receive independent timeout windows.
- [ ] Assert timeout-specific messages preserve each workflow's existing
      fallback, return, or retry choices.
- [ ] Run the cumulative Interactive suites plus direct-command regression tests.
- [ ] Record focused results and the Phase 6 review range in the job record.

Gate:

- [ ] Every current Interactive Codex request path uses the session value or the
      shared default through the rename-reference helper contract, with
      backtracking and recovery behavior verified, before public documentation
      closeout.

### Phase 7: Documentation And Closeout

Update public documentation only after behavior and help output are verified.

Status: not started.

Tasks:

- [ ] Create the Phase 7 validation and closeout job record.
- [ ] Update `README.md` rename examples and flag notes.
- [ ] Update `docs/guides/rename-common-usage.md` with shared and scoped timeout
      examples.
- [ ] Update `docs/guides/rename-scope-and-codex-capability-guide.md` with the
      timeout precedence and analyzer-routing boundary.
- [ ] Update the relevant data-query and data-stack guides with the shared
      direct-command option and per-attempt meaning.
- [ ] Update Markdown PDF direct-helper guides with shared profile, template,
      project, and repair semantics.
- [ ] Update Interactive guidance with the session-owned option, default,
      backtracking, regeneration, and no-automatic-retry behavior.
- [ ] Document per-request-attempt meaning and batch/retry runtime
      multiplication.
- [ ] Document exact legacy replacements and compatibility-period behavior.
- [ ] State explicitly that timeout flags do not enable Codex analysis.
- [ ] Update the relevant release note or changelog selected for the
      implementation release; do not invent a release target in this plan.
- [ ] Link all phase job records from the plan or final closeout record.
- [ ] Update the related research with implementation evidence, plan/job links,
      and an evidence-backed final status.
- [ ] Run the cumulative focused suite, lint, format check, full tests, and
      build.
- [ ] Inspect final command help for all three direct rename surfaces.
- [ ] Perform a final named-range review of the complete implementation slice.
- [ ] Mark this plan `completed` only after every completion criterion is
      satisfied and recorded.

Verification:

- [ ] Record exact focused and repository-wide validation commands and results.
- [ ] Confirm guides describe shipped behavior rather than plan-only syntax.
- [ ] Confirm public records contain no machine-specific paths or local-only
      smoke details.
- [ ] Confirm release-note wording describes deprecation without claiming that
      legacy removal is already scheduled.

Gate:

- [ ] Do not close the plan or research until implementation, validation, help,
      public documentation, and traceability evidence agree.

## Test Plan

### Parser And Resolver Tests

Add a focused test file such as:

```text
test/cli-options-codex-timeout.test.ts
```

Cover:

- `1ms`, `500ms`, `30s`, `2m`, and `10m`
- exact maximum boundaries in every supported unit where representable
- missing, zero, negative, decimal, whitespace, uppercase, unknown, compound,
  overflowing, and above-maximum values
- repeated shared and scoped options
- shared-only resolution
- image- and document-scoped overrides
- legacy-only resolution
- legacy-scoped-over-shared resolution
- same-analyzer new/legacy conflicts
- independent image/document scoped values
- exact legacy replacement text

### Rename Command And Action Tests

Extend or add coverage around:

- `test/cli-actions-rename-file.test.ts`
- `test/cli-actions-rename-batch-codex-images.test.ts`
- `test/cli-actions-rename-batch-codex-docs.test.ts`
- `test/cli-actions-rename-batch-codex-auto.test.ts`
- command-registration/help tests for `rename file`, `rename batch`, and
  `batch-rename`

Assert:

- the shared value reaches both enabled analyzers
- a scoped value overrides only its analyzer
- both scoped values may differ
- existing action-level numeric fields remain valid
- legacy flags emit one stderr notice
- both legacy flags produce one consolidated notice
- new/legacy same-analyzer conflicts prevent action invocation
- timeout flags alone do not enable an analyzer
- retries receive the same effective timeout on every attempt
- aliases expose and route the same options

### Explicit Direct Command Tests

Extend focused command-wiring and action tests around:

- `test/cli-command-data-query-codex.test.ts`
- `test/cli-command-data-query-codex-validation.test.ts`
- `test/cli-actions-data-query-codex.test.ts`
- `test/cli-command-data-stack/options.test.ts`
- `test/cli-actions-data-stack/codex-assist.test.ts`
- `test/cli-actions-md-to-pdf-profile-codex-command-wiring.test.ts`
- `test/cli-actions-md-to-pdf-template-codex/command-state.test.ts`
- `test/cli-actions-md-to-pdf-project-codex-command-wiring.test.ts`
- focused Markdown PDF template/project phase tests

Assert:

- every selected direct command uses the shared duration parser
- normalized values reach existing numeric action/prepared-service seams
- omitted values preserve existing defaults
- optional Codex modes are not enabled by timeout options
- template repair and project phases reuse the same value independently
- embedded suggestion modes remain unchanged

### Interactive Session Tests

Extend the Interactive command and harness coverage around:

- `test/cli-interactive-rename.test.ts`
- `test/cli-interactive-rename-cleanup-codex.test.ts`
- `test/cli-interactive-routing-data-query-codex-single.test.ts`
- `test/cli-interactive-data-stack/codex-review.test.ts`
- `test/cli-interactive-routing-data-query-headers.test.ts`
- `test/cli-interactive-routing-data-query-source-shape.test.ts`
- `test/cli-interactive-markdown-pdf/codex-authoring.test.ts`
- `test/cli-interactive-markdown-pdf/lifecycle.test.ts`

Assert:

- explicit `interactive --codex-timeout` creates one normalized session value
- the no-argument entry retains the default
- every current Interactive Codex path receives the session value
- rename, data, and Markdown helpers receive the same normalized milliseconds
  through optional numeric `timeoutMs` seams
- omitted values resolve through the shared 30-second constant rather than
  helper-local Interactive constants
- review, revision, and backtracking preserve it
- regeneration uses another per-attempt window without automatic retry
- the value is absent from saved recipe identity and generated artifacts
- workflow-specific recovery remains intact

### Failure Tests

Extend shared-adapter and rename-analyzer tests to cover:

- direct `TimeoutError`
- a timeout preserved in `cause`
- an ordinary `AbortError`
- an unrelated error
- exhausted timeout with zero retries
- exhausted timeout after multiple retries
- partial suggestions from another batch retained alongside a timeout fallback

### Validation Commands

Run focused validation after each phase, then the full repository lane:

```bash
bun test test/cli-options-codex-timeout.test.ts
bun test test/cli-actions-rename-file.test.ts \
  test/cli-actions-rename-batch-codex-images.test.ts \
  test/cli-actions-rename-batch-codex-docs.test.ts \
  test/cli-actions-rename-batch-codex-auto.test.ts \
  test/adapters-codex-shared.test.ts \
  test/adapters-codex-document-rename-titles.test.ts
bun test test/cli-command-data-query-codex*.test.ts \
  test/cli-actions-data-query-codex*.test.ts \
  test/cli-command-data-stack/*.test.ts \
  test/cli-actions-data-stack/*.test.ts
bun test test/cli-actions-md-to-pdf-profile-codex*.test.ts \
  test/cli-actions-md-to-pdf-template-codex/*.test.ts \
  test/cli-actions-md-to-pdf-project-codex*.test.ts \
  test/cli-actions-md-to-pdf-project-codex/*.test.ts
bun test test/cli-interactive-rename*.test.ts \
  test/cli-interactive-routing-data-query*.test.ts \
  test/cli-interactive-data-stack/*.test.ts \
  test/cli-interactive-markdown-pdf/*.test.ts
bun run lint
bun run format:check
bun test
bun run build
```

After the build, inspect command help without making Codex requests:

```bash
node dist/esm/bin.mjs rename file --help
node dist/esm/bin.mjs rename batch --help
node dist/esm/bin.mjs batch-rename --help
node dist/esm/bin.mjs data query codex --help
node dist/esm/bin.mjs data stack --help
node dist/esm/bin.mjs md pdf-profile codex --help
node dist/esm/bin.mjs md pdf-template codex --help
node dist/esm/bin.mjs md pdf-project codex --help
node dist/esm/bin.mjs interactive --help
```

Use `examples/playground/` for any isolated manual CLI artifacts. Do not create
ad-hoc scratch directories at the repository root.

## Checkpoints And Review Slices

Keep phases independently reviewable:

1. shared parser/resolver and focused unit tests
2. rename command surface, conflicts, notices, and help
3. action routing and retry-preservation tests
4. timeout classification and fallback summaries
5. explicit data and Markdown direct-command adoption
6. Interactive session ownership, propagation, and recovery validation
7. guides, release note, research closeout, and final validation receipt

At each checkpoint:

- verify only the phase-owned behavior first
- run the cumulative focused suites for every adoption layer completed so far
- record exact commands and results in the phase job record
- review the named checkpoint diff before starting the next phase
- do not mix later-phase adoption or unrelated refactors into the slice

## Risks And Mitigations

### Flag Source Loss

Risk: normalizing new and legacy options too early can hide conflicts or emit
incorrect warnings.

Mitigation: preserve raw CLI source fields until conflict validation and notice
construction finish; pass only normalized values into actions afterward.

### Warning Duplication

Risk: warnings emitted in adapters or retry loops can repeat for every batch.

Mitigation: emit compatibility notices only at the command boundary and exactly
once per invocation.

### Unit Ambiguity

Risk: accepting bare numbers can silently reinterpret old millisecond habits.

Mitigation: require explicit lowercase units for new options and keep legacy
millisecond flags as exact compatibility inputs.

### Runtime Multiplication

Risk: users may interpret `--codex-timeout 2m` as a two-minute whole-command
budget even when batches and retries multiply elapsed time.

Mitigation: use “per request attempt” consistently in help, warnings, guides,
and timeout messages; keep retry controls analyzer-specific.

### Misclassification

Risk: treating every abort as a timeout can hide user cancellation or other SDK
failures.

Mitigation: classify only preserved timeout causes and keep the generic fallback
for unknown errors.

### Programmatic Compatibility

Risk: CLI migration logic can accidentally deprecate existing numeric action
inputs used by tests or package consumers.

Mitigation: deprecate only the public legacy flag spellings; keep normalized
numeric action fields supported.

### Direct Command Scope Drift

Risk: a shared parser can encourage adding timeout flags to every embedded
suggestion mode before their command semantics are reviewed.

Mitigation: limit Phase 5 to the five explicit direct surfaces named by the
resolved research decision; keep embedded suggestion flags default-only.

### Interactive Session Loss

Risk: passing timeout values as isolated handler arguments can lose the setting
during revision, backtracking, or regeneration.

Mitigation: establish one explicit Interactive session/options owner, thread it
through handler boundaries, and assert preservation with the existing harness.

### Interactive Helper Contract Drift

Risk: data and Markdown helpers can keep or introduce their own timeout
constants, parsing, or error wording after rename establishes the shared
contract.

Mitigation: treat rename as the reference forwarding shape, reuse the shared
parser/default/classifier, keep optional numeric `timeoutMs` helper seams, and
test equal effective values across rename, data, and Markdown.

### Interactive Prompt Clutter

Risk: exposing the shared setting as a prompt in every Codex-assisted workflow
can make common Interactive paths noisy and inconsistent.

Mitigation: use one option on the explicit `interactive` command, retain the
default for the no-argument entry, and add no timeout prompts in this plan.

### Accidental Persistence

Risk: session-level timeout state can leak into recipe identity, reports, or
generated artifacts despite being execution policy.

Mitigation: keep the value in ephemeral Interactive session state and add
artifact-shape assertions for Markdown PDF and data workflows.

## Non-Goals

This plan does not implement:

- direct `--codex-timeout` flags on embedded header-mapping, source-shape, or
  deterministic rename-cleanup command surfaces
- a root-level global CLI option
- timeout prompts inside individual Interactive workflows
- separate Interactive data or Markdown timeout options without an
  evidence-backed scoped-override need
- `--codex-retries`
- new retry behavior or retry-delay changes
- total command or phase timeout budgets
- Markdown PDF phase-specific timeout overrides
- config-file or environment-variable timeout sources
- report-schema timeout metadata
- default timeout changes
- removal of the legacy rename millisecond flags
- a repository-wide Codex failure taxonomy rewrite

## Completion Criteria

The plan is complete when:

- [ ] All three new duration options are available on every direct rename
      command surface and alias in scope.
- [ ] Strict duration validation and the 10-minute cap are verified.
- [ ] Scoped-over-shared precedence is verified for both analyzers.
- [ ] Same-analyzer new/legacy conflicts fail before action execution.
- [ ] Legacy flags retain behavior and emit one exact migration notice.
- [ ] Timeout flags do not enable Codex analysis.
- [ ] Retry behavior and per-attempt timeout forwarding remain unchanged.
- [ ] Exhausted timeouts receive safe, specific fallback information.
- [ ] The five selected explicit direct commands expose the shared option and
      preserve their existing defaults when it is omitted.
- [ ] Markdown PDF profile, template, project, and repair requests use the same
      configured value as independent per-attempt windows.
- [ ] Explicit Interactive mode owns one session timeout and every current
      Interactive Codex request path receives it.
- [ ] Interactive rename, data, and Markdown helpers use the same normalized
      numeric timeout seam, shared default, per-attempt meaning, and narrow
      failure classifier.
- [ ] No superseded helper-local Interactive timeout constant remains where the
      shared session contract owns the value.
- [ ] The no-argument Interactive entry preserves the 30-second default.
- [ ] Interactive backtracking and regeneration preserve the value without
      adding automatic retry or persistent artifact fields.
- [ ] Focused tests, full tests, lint, format check, and build pass.
- [ ] Public help and rename, data, Markdown PDF, and Interactive guides
      describe the shipped contract.
- [ ] Release-note impact and the future legacy-removal boundary are recorded.
- [ ] Phase job records contain exact validation receipts and review ranges.
- [ ] The related research is updated with implementation evidence and an
      accurate final status.

## Related Research

- [cdx-chores Codex Request Timeout Contract](../researches/research-2026-07-05-codex-timeout-configuration.md)
