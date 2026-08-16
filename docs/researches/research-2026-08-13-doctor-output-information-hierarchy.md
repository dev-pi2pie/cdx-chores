---
title: "Doctor Output Information Hierarchy"
created-date: 2026-08-13
modified-date: 2026-08-16
status: in-progress
agent: codex
---

## Goal

Research a clearer human-output hierarchy for `cdx-chores doctor` without
hiding actionable remediation, weakening existing probes, or destabilizing
machine-readable output.

The current direction is a compact default view, a detailed human view, and the
existing structured JSON view. All three should project the same inspected
evidence without forcing human-oriented summary states into the JSON contract.
This document does not authorize implementation yet.

## Prior Dependency

The [Markdown PDF page-number configuration plan][page-number-plan] is complete
and no longer blocks this research. Its only continuing constraint here is that
the existing `doctor --json` field meanings remain stable while the human
information hierarchy changes.

This doctor research owns the new structure. It remains `in-progress` until its
current-output inventory, visibility mapping, public-safety audit, and
representative fixtures are complete; no implementation plan should begin
before that evidence is recorded.

## Current Behavior

The human command currently prints:

- platform and Node.js version
- Pandoc, FFmpeg, and WeasyPrint availability and versions
- every top-level capability
- every Markdown PDF renderer capability and minimum version
- fontconfig discovery and coverage state
- every DuckDB-backed data format and extension state
- Codex configuration, session, and drafting readiness

This is useful diagnostic evidence, but successful runs are long. Routine
success can obscure the few lines that require user attention.

The current view can repeat one detected condition across the tool,
top-level-capability, and detailed-capability sections. Those lines are useful
evidence, but a compact view should express the workflow impact once and render
one relevant action.

The current implementation also has behavior that must not be lost in a
compact view:

- missing tools include installation guidance
- missing but installable DuckDB extensions include an explicit install
  command
- unsupported or unverified Markdown PDF dependencies carry meaningful state
- `doctor --json` exposes the complete structured result for automation and
  deeper inspection

The design problem is therefore not simply to print fewer lines. It is to make
the default view easier to scan while preserving every actionable condition.

## Design Principle

```text
Compact output hides routine evidence, never workflow impact, action, or
uncertainty.
```

A successful low-level probe may be collapsed into a workflow summary. A
limitation, unavailable workflow, unknown result, install opportunity, or
state-derived remediation must remain visible in the compact view.

This distinction applies whenever a base workflow remains usable while a
supported child capability is limited, or when one missing dependency affects
several workflows. Compact output must preserve the affected workflow states
and actions without repeating the same underlying condition for every
low-level capability.

The information layers are:

```text
inspection facts
  -> normalized internal doctor report
     |-> legacy JSON evidence projection
     |-> detailed human evidence projection
     `-> workflow impacts + typed actions -> compact human projection
```

Inspection facts remain authoritative. The normalized internal report may add
derived workflow impacts and typed actions, but the first JSON projection owns
only the already-inventoried evidence fields. Human views derive their hierarchy
from the internal report; they do not parse rendered strings or become a
replacement source of truth. Shape-preservation tests must prove that extracting
the internal report does not add, remove, or reinterpret JSON fields.

## Candidate View Model

### Default compact view

The default view should answer three questions quickly:

1. Which user workflows are available, limited, unavailable, or unknown?
2. Which non-ready conditions affect the user rather than only internal
   evidence?
3. Which detected actions can improve the current environment?

Possible shape:

```text
cdx-chores doctor

1 issue · 1 action

Markdown
  DOCX: ready
  PDF: unavailable — WeasyPrint is missing

Video: ready
Data query: ready
Fonts: ready
Codex-assisted data query: ready

Actions:
  Install WeasyPrint: brew install weasyprint

Run `cdx-chores doctor --details` for versions and capability evidence.
```

This example is directional copy, but its hierarchy is intentional. It avoids a
global `Ready` or `Blocked` judgment because doctor does not know which workflow
the user intends to run. It also keeps Markdown DOCX separate from Markdown PDF
and describes the inspected Codex state as data-query-specific rather than
claiming global Codex readiness.

### Detailed human view

The detailed view should carry forward the current evidence-oriented
information, including:

- platform and runtime versions
- individual command availability and versions
- the complete capability list
- per-capability Markdown PDF renderer status and minimums
- individual font support probes
- DuckDB runtime, format, loadability, and installability details
- Codex configuration, session, and drafting state
- install suggestions and other remediation

No detailed-view flag exists today; the root command currently exposes only
`--json`. The current command inventory has no shared `--verbose`, `--details`,
or other root-level human-detail convention. Rename preview uses `detailed` only
as a value of its feature-specific `--preview-skips` option. This research
therefore selects `--details`: it describes a deliberate information view
rather than debug logging or internal execution verbosity.

The intended help entry is `--details  Output detailed human-readable
evidence`. `--details` and `--json` are mutually exclusive. The parser should
reject the combination before running probes, write the standard option error
and help to stderr, and exit `1`, consistent with existing command-line parser
errors. Silently choosing one view would make an ambiguous command appear
successful.

Detailed output semantically preserves every current human evidence category
and its stable ordering; it does not promise byte-for-byte compatibility. It
must also render every already-computed section when DuckDB is unavailable
instead of retaining the current early return that suppresses data-query Codex
evidence. Help and usage guides should change only after implementation accepts
this command contract.

### Structured JSON view

`doctor --json` is the current automation surface. Its payload currently
contains `generatedAt`, platform and Node.js facts, tool inspections, Markdown
PDF requirements and renderer capabilities, data-query runtime and format
facts, Codex readiness, font probes, and the flat capability map.

Before claiming compatibility, research must inventory the exact nested fields,
booleans, status values, optional details, and tests. A human-output redesign
should not silently rename, remove, regroup, or reinterpret those existing
values. In particular, human workflow states must not change the meaning of
current capability booleans or renderer statuses.

The first implementation should leave the JSON payload unchanged. If future
automation needs normalized workflow summaries or advisory objects, those
additive fields need their own compatibility and versioning review. Compact
rendering does not justify expanding the automation contract by itself.

Field ownership for the first implementation is:

| Owner                     | Data                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------ |
| inspection layer          | existing tool, requirement, renderer, query, Codex, font, and capability facts       |
| internal projection layer | derived workflow state, typed conditions, typed actions, and affected-workflow links |
| legacy JSON serializer    | only the current JSON evidence fields and meanings                                   |
| detailed human renderer   | all current evidence categories plus existing remediation                            |
| compact human renderer    | workflow state, sanitized condition summaries, and deduplicated actions              |

## Workflow State And Action Model

Availability and action are separate dimensions.

| Workflow state | Meaning                                                               | Compact behavior                                     |
| -------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| `ready`        | The inspected workflow is usable without a detected limitation        | Collapse to one success line                         |
| `limited`      | The base workflow is usable, but a supported scoped capability is not | Show the affected capability and relevant action     |
| `unavailable`  | The inspected workflow cannot run                                     | Show the unavailable workflow and required action    |
| `unknown`      | Availability or compatibility could not be determined                 | Show the uncertainty and safest next diagnostic step |

Actions are separately classified as:

| Action class  | Meaning                                                           |
| ------------- | ----------------------------------------------------------------- |
| `recommended` | The workflow remains usable, but a detected improvement is useful |
| `required`    | The action is necessary for the affected workflow to run          |

No action object is needed when the state is self-explanatory and there is no
safe next step. Multiple workflow impacts may reference one typed condition and
one deduplicated action.

Workflow composition follows these rules:

- `unavailable` when a base workflow precondition is missing or unsupported
- `unknown` when base workflow availability cannot be established safely
- `limited` when the base workflow is ready but at least one inspected,
  supported child capability is unavailable or unverified
- `ready` when the base workflow and every inspected supported child capability
  are ready

Group headings such as `Markdown` do not receive a synthetic state. Their child
workflow lines carry the state. This prevents a ready DOCX path from hiding an
unavailable PDF path.

`blocked` is not a default environment-wide state. A missing dependency can
make one workflow unavailable without blocking unrelated workflows or the CLI
as a whole. A future explicit health-check contract may introduce broader
policy, but compact presentation should not imply it.

## Advisory And Remediation Rules

Compact output should retain advice only when it is derived from current
evidence and gives the user a relevant next step.

Always retain in compact output:

- an install command for a detected missing and installable DuckDB extension
- an installation hint for a missing required tool
- a supported upgrade hint for an installed but unsupported dependency
- a configuration or authentication action required by an otherwise selected
  feature
- a probe failure or unknown result whose uncertainty affects readiness
- a safety, permission, or environment constraint that changes what the user
  can do next

Do not add generic advice that is unrelated to detected state. Doctor should
not become a tips carousel.

Compact output is workflow-first: render workflows in the stable order defined
below, then render one `Actions` section. Each action has a stable action ID,
class, sanitized message, optional public command, and affected workflow IDs.
Deduplicate by action ID rather than rendered text or command text, merging the
affected workflows. When one action affects several workflows, list those
workflow names once under that action.

Required actions sort before recommended actions. Within each class, sort by
the first affected workflow's stable order and then by action ID. The headline
issue count is the number of unique typed conditions that remain visible in
compact output; the action count is the number of deduplicated user-visible
action records. Detailed and JSON views may retain every individual evidence
entry.

## Workflow Aggregation

Compact output should aggregate evidence at a user-facing workflow boundary,
not simply truncate the current list or group everything that shares a tool.

Initial grouping to evaluate:

| Compact workflow            | Evidence that may collapse when successful                         | Evidence that must expand                                                     |
| --------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Markdown DOCX               | Pandoc availability                                                | Missing Pandoc and its installation action                                    |
| Markdown PDF                | Pandoc, WeasyPrint, and satisfied renderer capability groups       | Base unavailability, advanced limitations, unknown state, and relevant action |
| Video                       | FFmpeg-backed convert, resize, and GIF operations                  | Missing FFmpeg or an operation-specific limitation                            |
| Data query                  | Core formats, DuckDB runtime, and loadable extension formats       | Unavailable runtime, unloadable formats, and extension installation actions   |
| Codex-assisted data query   | Configured support, session availability, and data-query readiness | Configuration, authentication, environment, or underlying data-query action   |
| Font discovery and coverage | Available fontconfig probes                                        | Missing selected support or unknown coverage                                  |

The final mapping must avoid double-reporting one condition under multiple
workflows. One detected issue may list several affected workflows, but compact
output should render its remediation once. A general `Codex` summary remains
out of scope until doctor assesses all Codex-backed workflows rather than only
data-query drafting readiness.

### Initial composition matrix

This doctor-level matrix settles how common evidence shapes compose. The exact
feature fixtures remain a research closeout requirement.

| Evidence shape                                   | Compact result                                             | Action behavior                                     | Detailed and JSON behavior               |
| ------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| Base workflow and supported children satisfied   | Workflow `ready`                                           | No action                                           | Preserve complete evidence               |
| Base dependency missing or unsupported           | Affected workflow `unavailable`                            | One required action when a safe step exists         | Preserve the exact dependency evidence   |
| Base workflow cannot be verified                 | Affected workflow `unknown`                                | Show the safest diagnostic step when one exists     | Preserve the unverified evidence         |
| Base workflow ready; supported child non-ready   | Parent workflow `limited`; affected child shown separately | Action applies only to the affected child           | Preserve each child capability result    |
| Optional scoped workflow missing but installable | Parent `limited`; scoped workflow `unavailable`            | One required install action for the scoped workflow | Preserve installability and command      |
| One upstream condition affects several workflows | Each affected workflow keeps its own state                 | Render one shared issue and deduplicated action     | Preserve every underlying evidence entry |
| Configuration or session missing                 | Only the dependent workflow becomes `unavailable`          | Required configuration or sign-in action            | Preserve independent readiness facts     |

Feature-specific matrices should be recorded as fixtures and visibility maps,
not expanded into this structural contract.

## Exit-Code Boundary

The current doctor action reports detected missing, unsupported, and unknown
states in its output but does not derive a nonzero exit code from those health
states. Nonzero behavior currently comes from ordinary command-level failures,
not from workflow availability states.

Presentation-only work should preserve that behavior. Inspected unavailable,
limited, and unknown workflows remain report data and do not themselves produce
a nonzero exit code. Probe or command-level failures retain the existing
failure behavior. A future status-driven health check would be a separate CLI
compatibility contract with focused exit-code tests and shell-automation
documentation; it must not arrive implicitly with compact rendering.

## TTY And Redirected Output

The first implementation should use one deterministic compact human format for
TTY and redirected output. Automatically switching detail based on TTY can make
captured logs differ from an interactive run and complicate support.

Color may continue to depend on terminal capabilities, but information content
should remain stable. This is content stability, not a promise that whitespace,
ordering, or every byte of human output is a permanent automation contract.
`doctor --json` remains the intended automation surface.

## Compatibility Boundary

The redesign should preserve:

- the existing probe implementations and dependency-selection rules
- one structured evidence report with typed workflow impacts and remediation
- the meaning of inventoried `doctor --json` fields unless an additive or
  breaking change is separately reviewed
- current public install commands, including DuckDB extension installation
- no new exposure of local secrets, resolved paths, or raw errors
- Node.js runtime compatibility even though Bun remains the development and
  test tool

The redesign should avoid:

- duplicating probe logic inside compact and detailed renderers
- deriving compact status by parsing already-rendered strings
- treating optional recommendations as invisible success
- turning every optional tool into a global warning
- claiming global readiness for a broad family when only one workflow was
  assessed
- silently changing exit codes as a side effect of presentation work
- introducing a general notification framework solely for doctor output

Existing public-safety behavior needs an explicit audit rather than a blanket
compatibility claim. Current detail fields may carry environment-derived paths
or raw error text from Codex and DuckDB inspection. New compact advisories must
use typed, sanitized messages and commands instead of forwarding raw detail
strings. Whether existing detailed and JSON fields should be redacted is a
separate compatibility decision. Tests should cover secrets, override paths,
raw errors, and public install commands for every changed surface.

The current fields requiring that audit are:

- `query.detail`, which can contain a raw DuckDB runtime error
- `query.formats.sqlite.detail` and `query.formats.excel.detail`, which can
  contain raw extension load, permission, cache, or network errors
- `queryCodex.detail`, which can contain SDK import errors, authentication
  guidance, or a resolved Codex override path

The first redesign applies sanitization only to the new compact projection.
Detailed output preserves the current detail behavior, and JSON remains
unchanged. Any redaction of those existing surfaces requires a separate
compatibility review. Compact tests must prove that secrets, resolved paths, and
raw errors do not pass through, while approved public install commands and
state-derived guidance remain visible.

The current human implementation also exits its rendering path early when the
DuckDB runtime is unavailable, so the later data-query Codex section is not
printed even though JSON construction has already recorded that state. The
visibility inventory must classify this as existing behavior and decide whether
the detailed projection preserves it or fixes the omission deliberately.

## Research Evidence Needed

Before this research can become an implementation plan, record:

- an inventory of current doctor JSON fields, human sections, exit behavior,
  and tests
- a public-safety audit of current Codex and DuckDB detail fields
- the exact existing DuckDB installability states and remediation commands
- representative compact output for all-ready, limited, unavailable, and
  unknown workflows, including multiple impacts from one condition
- a mapping from each current human line to compact, detailed, and JSON
  visibility
- validation and completion of the initial condition-to-workflow matrix without
  duplicate or contradictory messages
- representative action grouping, stable ordering, and headline counts for one
  condition affecting several workflows and for several independent actions
- compatibility expectations for scripts that currently consume human output,
  even though JSON is the intended automation surface
- focused tests proving actionable install tips remain visible in compact mode
- focused tests proving base workflow readiness remains distinct from scoped
  capability limitations

## Possible Implementation Shape After Research

If the direction is accepted, a later plan will likely separate:

1. extraction of the current structured evidence report without changing JSON
2. typed workflow-impact and remediation projection
3. compact human rendering
4. detailed human rendering
5. workflow aggregation and shared-condition deduplication
6. JSON shape-preservation tests
7. public-safety tests, guide updates, and lifecycle closeout

That plan should use focused checkpoints and exact commit-range review. It
should remain separate from the completed Markdown PDF plan.

## Revised Direction

The current direction is:

- make compact human output the eventual default
- provide the current evidence categories through a detailed human view selected
  by `--details`
- reject `--details` with `--json` as an ambiguous view combination
- keep `doctor --json` unchanged as the automation surface
- summarize fully satisfied workflows rather than broad technical families
- distinguish workflow availability from recommended or required actions
- group repeated low-level limitations by their underlying condition while
  retaining full evidence in detailed and JSON views
- always display detected remediation, including dependency and DuckDB
  extension install commands, once in compact output
- use state-derived recommendations rather than generic advice
- preserve current health-state exit behavior and deterministic human content
  across TTY and redirected output
- keep raw environment details out of new compact advisories

These are research conclusions awaiting their evidence inventory and
representative fixtures. The document remains `in-progress`; no implementation
plan should begin until those records are present and the contract receives a
focused documentation review.

## Related Plans

- [Markdown PDF page-number configuration plan][page-number-plan] — completed
  prior dependency. It no longer governs this research beyond the stable
  `doctor --json` compatibility boundary.

## Guides Potentially Affected

- [Markdown PDF Usage][markdown-pdf-usage] — documents top-level doctor and
  `doctor --json`.
- [Interactive Markdown PDF Usage][markdown-pdf-interactive-usage] — directs
  users to top-level doctor before rendering.
- [Data Query Usage][data-query-usage] — explains format readiness,
  installability, and DuckDB remediation.
- [Data Query Codex Usage][data-query-codex-usage] — documents configured,
  authenticated, and ready-to-draft states.
- [Data DuckDB Usage][data-duckdb-usage] — defines the extension inspection and
  installation contract that compact top-level doctor must preserve.

The dedicated `data duckdb doctor` command is not part of this output redesign
unless later evidence deliberately expands the scope. Its guide is relevant
because it owns the extension-state and installation-remediation contract, not
because this research proposes changing that command.

## Reference

- [Documentation Policy](../../DOCUMENTATION_POLICY.md)

[page-number-plan]: ../plans/plan-2026-08-12-markdown-pdf-page-number-configuration.md
[markdown-pdf-usage]: ../guides/markdown-pdf-usage.md
[markdown-pdf-interactive-usage]: ../guides/markdown-pdf-interactive-usage.md
[data-query-usage]: ../guides/data-query-usage.md
[data-query-codex-usage]: ../guides/data-query-codex-usage.md
[data-duckdb-usage]: ../guides/data-duckdb-usage.md
