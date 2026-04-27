---
title: "Data stack TypeScript refactor scan"
created-date: 2026-04-27
modified-date: 2026-04-27
status: draft
agent: codex
---

## Goal

Review the current `src/` and `test/` structure after the `data stack` feature work and identify the safest refactor route before the stack surface grows further.

This is research first. It does not approve implementation by itself. A follow-up plan should freeze exact phases before files are moved.

## Scope

This scan focuses on:

- TypeScript files around the shipped `data stack` surface
- tests that now carry most of the data-stack regression contract
- files over roughly 300 lines where size also reflects mixed responsibility
- import and ordering constraints that matter for a behavior-preserving split

This scan does not attempt a broad repo cleanup. Several older non-stack files remain large, but the current feature pressure is in `data stack`.

## Method

Inputs used:

- line-count scan of `src/` and `test/`
- current `data stack` source and test layout
- existing TypeScript refactor research from March
- read-only `ts_structure_planner` review of `src/` and `test/`

Current largest relevant files:

| File | Lines | Refactor signal |
| --- | ---: | --- |
| `test/cli-interactive-routing.test.ts` | 3,957 | Cross-feature routing test with a large stack-specific block |
| `src/cli/interactive/data/stack.ts` | 1,510 | Mixed interactive flow, rendering, artifacts, Codex review, and write loop |
| `test/cli-actions-data-stack.test.ts` | 1,289 | Action tests covering happy paths, validation, schema modes, dry-run, and Codex assist |
| `test/cli-command-data-stack.test.ts` | 881 | Command-layer direct stack and replay coverage in one file |
| `test/data-stack-codex-report.test.ts` | 825 | Patch validation and recommendation application in one file |
| `src/cli/data-stack/plan.ts` | 700 | Artifact schema, identity, parsing, serialization, normalization, and I/O |
| `src/cli/data-stack/codex-report.ts` | 597 | Report schema, patch validation, payload construction, writing, and plan mutation |
| `src/cli/actions/data-stack.ts` | 552 | Option validation, plan preparation, diagnostics rendering, Codex report handling, and output writing |
| `test/data-stack-plan.test.ts` | 536 | Identity, serialization, parse, and I/O coverage in one file |
| `test/helpers/interactive-harness/mocks/action-data.ts` | 324 | Query, extract, preview, and stack action mocks in one helper |

## Key Findings

### 1. Interactive `data stack` is the highest-pressure source file

`src/cli/interactive/data/stack.ts` is the largest source file and now owns too many layers:

- source discovery prompts and matched-file review
- stack review and status rendering
- dry-run plan path validation and persistence
- Codex recommendation checkpointing and edited patch review
- final write, dry-run, revise, cancel, and artifact retention branches

The size is not the only issue. The file mixes state collection, user-facing rendering, artifact lifecycle, and action execution. That makes small UX fixes risky because they can accidentally touch retention or Codex-review behavior.

Recommended target shape:

- `src/cli/interactive/data/stack/index.ts`
- `src/cli/interactive/data/stack/source-discovery.ts`
- `src/cli/interactive/data/stack/review.ts`
- `src/cli/interactive/data/stack/artifacts.ts`
- `src/cli/interactive/data/stack/codex-review.ts`
- `src/cli/interactive/data/stack/write-flow.ts`
- `src/cli/interactive/data/stack/types.ts`

Recommended boundary:

- `index.ts` should expose `runInteractiveDataStack` and little else.
- `source-discovery.ts` should own input format, source kind, pattern, recursion, matched-file review, and discovery options.
- `review.ts` should own stack review, status preview, bounded samples, and replay-tip rendering.
- `artifacts.ts` should own plan path validation, report path persistence, keep/remove prompts, and cleanup.
- `codex-review.ts` should own signal detection, recommendation rendering, edit parsing, and decision collection.
- `write-flow.ts` should own output destination selection, preview preparation, final action selection, write execution, and failure retention behavior.

Keep `runInteractiveDataStack` import-compatible for callers. If the implementation replaces `stack.ts` with a `stack/` folder, move the exported function into `stack/index.ts` in the same change.

### 2. Stack-plan artifacts should be split before the interactive file

`src/cli/data-stack/plan.ts` is a contract-heavy module. It defines public artifact types, identity generation, parsing, stable serialization, artifact normalization, and disk I/O.

This should be split before the interactive flow because action, replay, Codex report, and interactive code all depend on the stack-plan contract.

Recommended target shape:

- `src/cli/data-stack/plan/index.ts`
- `src/cli/data-stack/plan/types.ts`
- `src/cli/data-stack/plan/identity.ts`
- `src/cli/data-stack/plan/parse.ts`
- `src/cli/data-stack/plan/serialize.ts`
- `src/cli/data-stack/plan/io.ts`

Recommended boundary:

- `types.ts` should hold constants, literal unions, and artifact interfaces.
- `identity.ts` should hold timestamp formatting, UID generation, and filename helpers.
- `parse.ts` should hold validation helpers and `parseDataStackPlanArtifact`.
- `serialize.ts` should hold stable field ordering and `serializeDataStackPlanArtifact`.
- `io.ts` should hold read/write file helpers.
- `index.ts` should re-export the existing public surface so current import paths can stay stable.

Do not change the JSON artifact schema or stable field ordering during this split.

### 3. Codex report helpers need a contract split, not a cosmetic split

`src/cli/data-stack/codex-report.ts` is also contract-heavy. It currently owns:

- report artifact constants and types
- recommendation and patch validation
- fact payload construction
- report artifact creation and writing
- applying accepted or edited recommendations into a derived stack plan

Recommended target shape:

- `src/cli/data-stack/codex-report/index.ts`
- `src/cli/data-stack/codex-report/types.ts`
- `src/cli/data-stack/codex-report/validation.ts`
- `src/cli/data-stack/codex-report/artifact.ts`
- `src/cli/data-stack/codex-report/apply.ts`

Recommended boundary:

- `validation.ts` should own patch path validation, executable schema checks, headerless column width checks, and recommendation validation.
- `artifact.ts` should own fact payloads, artifact creation, filename generation, serialization, and writing.
- `apply.ts` should own recommendation decision application and derived-plan lineage.

The highest-risk area is preserving lineage and derived-plan semantics:

- `acceptedRecommendationIds`
- `recommendationDecisions`
- `derivedFromPayloadId`
- remapping `/input/columns` decisions into `duplicates.uniqueBy`

### 4. Direct `data stack` action should become a thin orchestrator

`src/cli/actions/data-stack.ts` now mixes command option validation, plan preparation, dry-run path checks, diagnostics rendering, Codex report output, and materialized output writing.

Recommended target shape:

- `src/cli/actions/data-stack/index.ts`
- `src/cli/actions/data-stack/options.ts`
- `src/cli/actions/data-stack/plan-write.ts`
- `src/cli/actions/data-stack/output-write.ts`
- `src/cli/actions/data-stack/reporting.ts`
- `src/cli/actions/data-stack/run.ts`

Recommended boundary:

- `options.ts` should own option validation and schema-mode option resolution.
- `plan-write.ts` should own plan preparation, fingerprints, artifact path collision checks, and plan writing.
- `output-write.ts` should own output materialization and overwrite behavior.
- `reporting.ts` should own dry-run, diagnostics, and Codex-assist summary rendering.
- `run.ts` should coordinate the direct action.
- `index.ts` should preserve the existing exports used by `src/cli/actions/index.ts` and interactive code.

This split should happen after `plan.ts` and `codex-report.ts` are split so the action can depend on narrower leaf modules.

### 5. Some over-threshold data-stack modules should not be split yet

`src/cli/data-stack/rows.ts` is 321 lines, but it is still cohesive around source parsing, schema alignment, and row normalization. It can stay as one module until there is a concrete format-specific extension.

`src/cli/data-stack/diagnostics.ts` is 282 lines in the current scan and remains focused on duplicate/key diagnostics. Keep it whole unless duplicate policy execution gains more policy modes.

`src/cli/data-stack/prepare.ts`, `src/cli/data-stack/input-router.ts`, and `src/cli/data-stack/materialize.ts` read as focused boundaries and should stay stable during the first refactor wave.

### 6. Non-stack structural hotspots should stay out of the first wave

The scan still shows older large files outside the stack surface, including:

- `src/cli/rename/planner.ts`
- `src/cli/interactive/rename-cleanup.ts`
- `src/cli/actions/rename/codex.ts`
- `src/cli/prompts/path-inline.ts`
- `src/cli/interactive/data-query/sql/formal-guide.ts`
- `src/cli/interactive/data-query/source-shape.ts`
- `src/cli/data-query/codex.ts`
- `src/cli/duckdb/xlsx-sources.ts`
- `src/cli/actions/data-query.ts`
- `src/cli/interactive/data/extract.ts`

These are valid future cleanup targets, but mixing them into the data-stack refactor would make review harder. The existing March TypeScript refactor scan remains the better reference for the broader backlog.

## Test Refactor Findings

### 1. Move stack-specific interactive tests out of the shared routing file

`test/cli-interactive-routing.test.ts` is now nearly 4k lines. Stack-specific cases are clustered roughly from the first `data stack` routing case through the stack overwrite/default-output cases.

Recommended target:

- `test/cli-interactive-data-stack.test.ts`

If this grows quickly, split into:

- `test/cli-interactive-data-stack/discovery.test.ts`
- `test/cli-interactive-data-stack/dry-run-write.test.ts`
- `test/cli-interactive-data-stack/codex-review.test.ts`

Keep the root interactive routing file for cross-feature menu routing and one smoke case per major action. Move detailed stack behavior to stack-owned tests.

### 2. Split direct action tests by behavior

`test/cli-actions-data-stack.test.ts` combines all direct action behavior in one file.

Recommended target:

- `test/cli-actions-data-stack/happy-paths.test.ts`
- `test/cli-actions-data-stack/validation.test.ts`
- `test/cli-actions-data-stack/schema-modes.test.ts`
- `test/cli-actions-data-stack/dry-run-plan.test.ts`
- `test/cli-actions-data-stack/codex-assist.test.ts`

This should happen alongside the source action split so helper extraction follows real seams rather than arbitrary line ranges.

### 3. Split command tests by direct stack, replay, and options

`test/cli-command-data-stack.test.ts` covers direct command execution, replay, schema-mode aliases, duplicate policies, extensionless input format behavior, and command-layer validation.

Recommended target:

- `test/cli-command-data-stack/direct-stack.test.ts`
- `test/cli-command-data-stack/replay.test.ts`
- `test/cli-command-data-stack/options.test.ts`

Replay tests should stay close to stack-plan fixture helpers because replay is the main consumer of the artifact contract.

### 4. Split plan and Codex report unit tests after helper extraction

`test/data-stack-plan.test.ts` and `test/data-stack-codex-report.test.ts` repeat enough fixture setup that a small helper will reduce churn.

Recommended helper:

- `test/helpers/data-stack-test-utils.ts`

Recommended `plan` split:

- `test/data-stack-plan/identity-serialization.test.ts`
- `test/data-stack-plan/parse-io.test.ts`

Recommended `codex-report` split:

- `test/data-stack-codex-report/validation.test.ts`
- `test/data-stack-codex-report/apply.test.ts`

The helper should provide builders for a valid stack plan, union-mode plan, diagnostics, and report artifact. It should not hide the fields that individual tests are asserting.

### 5. Split interactive harness data-action mocks

`test/helpers/interactive-harness/mocks/action-data.ts` now mixes stack, query, extract, preview, and conversion mock behavior.

Recommended target:

- `test/helpers/interactive-harness/mocks/action-stack.ts`
- `test/helpers/interactive-harness/mocks/action-query.ts`
- `test/helpers/interactive-harness/mocks/action-extract.ts`
- keep shared lightweight data preview/conversion mocks in `action-data.ts` or a new `action-data-shared.ts`

Do this only when moving stack interactive tests. Splitting the mock first would create churn without reducing review risk.

## Recommended Refactor Order

1. Split `src/cli/data-stack/plan.ts` and `test/data-stack-plan.test.ts`.
2. Split `src/cli/data-stack/codex-report.ts` and `test/data-stack-codex-report.test.ts`.
3. Split `src/cli/actions/data-stack.ts` and `test/cli-actions-data-stack.test.ts`.
4. Split command-layer stack tests into direct stack, replay, and options coverage.
5. Move stack-specific interactive tests out of `test/cli-interactive-routing.test.ts` and split stack action mocks from the shared data-action mock helper.
6. Split `src/cli/interactive/data/stack.ts` into `stack/` modules.
7. Run a final test-structure review after the source/test splits land.

Why this order:

- stack-plan and Codex-report modules are leaf contracts used by action and interactive code
- action cleanup gives interactive code a cleaner execution surface
- interactive flow is the largest win but has the highest behavior risk
- command-layer tests should be isolated before the larger interactive split so direct/replay contracts stay easy to inspect
- test movement should happen beside the matching source movement, not as one final cleanup batch

## Implementation Constraints

- Preserve stack-plan JSON field ordering and validation semantics.
- Preserve `data stack replay <record>` artifact compatibility.
- Preserve direct CLI default behavior: strict schema matching, explicit output, no silent repair.
- Preserve interactive artifact retention rules:
  - stack plans and Codex reports have separate keep/remove prompts
  - failed writes keep generated artifacts for diagnosis
  - successful writes may remove only the stack-plan artifact when the user declines keeping it
- Avoid cycles between `src/cli/data-stack/*`, `src/cli/actions/*`, and `src/cli/interactive/*`.
- Keep leaf domain modules under `src/cli/data-stack/*`, action wrappers under `src/cli/actions/*`, and prompt orchestration under `src/cli/interactive/*`.
- Do not change public exports from `src/cli/actions/index.ts` during the refactor unless a follow-up plan explicitly approves it.
- Run the existing stack-focused tests after each phase before broadening to the full suite.

## Resolved Decisions

- The first implementation plan should use one phase per source module and pair each source split with the related test split.
- The final phase should include a dedicated test-structure review, because moving tests during each source phase does not replace a final check for duplicate, missing, or poorly grouped coverage.
- `data-stack/plan.ts` and `data-stack/codex-report.ts` should move to folder modules with `index.ts` facades, preserving the original import style where callers import from `../../data-stack/plan` or `../../data-stack/codex-report`.
- Command-layer stack tests should split before the interactive source split. That keeps direct stack and replay behavior visible before the higher-risk interactive refactor starts.
- Broader non-stack hotspots should get a separate updated TypeScript refactor plan after the stack wave lands. They should not be folded into the first data-stack refactor implementation plan.

## Related Plans

- `docs/plans/plan-2026-04-27-data-stack-typescript-refactor-implementation.md`
- `docs/plans/plan-2026-04-25-data-stack-replay-and-codex-assist-implementation.md`
- `docs/plans/plan-2026-04-23-data-stack-interactive-mixed-source-followup.md`
- `docs/plans/plan-2026-04-23-data-stack-mixed-source-input-router-implementation.md`
- `docs/plans/plan-2026-03-19-typescript-structural-refactor-sequencing.md`

## Related Research

- `docs/researches/research-2026-03-19-typescript-refactor-scan.md`
- `docs/researches/research-2026-04-23-data-stack-multi-file-assembly.md`
- `docs/researches/research-2026-04-24-data-stack-replay-and-codex-schema-assist.md`
- `docs/researches/research-2026-04-26-data-stack-artifact-and-codex-contract-cleanup.md`

## References

- `src/cli/interactive/data/stack.ts`
- `src/cli/data-stack/plan.ts`
- `src/cli/data-stack/codex-report.ts`
- `src/cli/actions/data-stack.ts`
- `src/cli/data-stack/rows.ts`
- `test/cli-interactive-routing.test.ts`
- `test/cli-actions-data-stack.test.ts`
- `test/cli-command-data-stack.test.ts`
- `test/data-stack-codex-report.test.ts`
- `test/data-stack-plan.test.ts`
- `test/helpers/interactive-harness/mocks/action-data.ts`
