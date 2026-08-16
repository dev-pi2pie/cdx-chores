---
title: "Doctor Output Information Hierarchy"
created-date: 2026-08-13
modified-date: 2026-08-16
status: completed
agent: codex
---

## Goal

Research a clearer human-output hierarchy for `cdx-chores doctor` without
hiding actionable remediation, weakening existing probes, or destabilizing
machine-readable output.

The settled direction is a compact default view, a detailed human view, and the
existing structured JSON view. All three project the same inspected evidence
without forcing human-oriented summary states into the JSON contract. Direct
CLI use selects these views with no flag, `--details`, or `--json`; Interactive
mode presents Summary, Details, and JSON as one exclusive selection.
The Phase 1 evidence below closes the research gate and authorizes the linked
active plan.

## Prior Dependency

The [Markdown PDF page-number configuration plan][page-number-plan] is complete
and no longer blocks this research. Its only continuing constraint here is that
the existing `doctor --json` field meanings remain stable while the human
information hierarchy changes.

This doctor research owns the new structure. Phase 1 of the
[implementation plan][doctor-plan] completed the current-output inventory,
visibility mapping, public-safety audit, representative fixtures, and focused
documentation review before production implementation began.

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

### Evidence ownership flow

```text
existing probes
      |
      v
normalized internal doctor report
      |
      |-- inspection facts --------> legacy JSON projection
      |                              existing fields and meanings
      |
      |-- inspection facts --------> detailed human projection
      |                              complete evidence categories
      |
      `-- workflow impacts
          +-- typed conditions
          `-- typed actions -------> compact human projection
                                     states + safe actions
```

Inspection facts remain authoritative. The normalized internal report may add
derived workflow impacts and typed actions, but the first JSON projection owns
only the already-inventoried evidence fields. Human views derive their hierarchy
from the internal report; they do not parse rendered strings or become a
replacement source of truth. Shape-preservation tests must prove that extracting
the internal report does not add, remove, or reinterpret JSON fields.

## Candidate View Model

### Direct CLI view selection and exit behavior

```text
cdx-chores doctor
      |
      v
validate requested view
      |
      |-- --details + --json ------> parser error + help
      |                              no probes, exit 1
      |
      `-- no flag / --details / --json
                    |
                    v
             run inspection once
                    |
                    |-- operational failure --> command error, exit 2
                    |
                    `-- inspection complete
                              |
                              |-- no flag ----> compact human output
                              |-- --details --> detailed human output
                              `-- --json -----> structured JSON output

Health findings remain report data; completed inspection exits 0.
```

### Interactive view selection

Interactive mode should expose the same three projections without translating
the decision into multiple boolean questions:

```text
Interactive mode
      |
      v
select doctor
      |
      v
Choose doctor output
      |
      |-- Summary -----------> compact human output
      |                        workflow readiness + actions
      |
      |-- Details -----------> detailed human output
      |                        versions + capability evidence
      |
      `-- JSON --------------> structured JSON output
                               machine-readable evidence
```

The selector is one closed choice made before the doctor action or any probe
runs. Summary is the first and default-highlighted choice. Details maps to the
same detailed projection as direct `doctor --details`, and JSON maps
to the unchanged automation projection. Because one choice determines the
view, Interactive routing cannot request detailed and JSON output together and
does not need to reproduce Commander's flag-conflict handling.

This replaces the earlier two-state `Output as JSON?` confirmation. Adding a
second confirmation for details would make one three-way decision harder to
scan and would leave the modes asymmetrical.

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
reject the combination in the command-registration layer before invoking the
doctor action or running probes, write the standard option error and help to
stderr, and exit `1`, consistent with existing command-line parser errors.
Silently choosing one view would make an ambiguous command appear successful.

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

Compatibility should be proven with controlled inspector fixtures and a fixed
`runtime.now()` value. Tests should compare the complete structure and meaning,
including field presence, nesting, optional-field omission, nullability, status
values, and serialized key order only where the current contract asserts it.
Host facts sourced directly from the running process should be compared with
explicit runtime expectations unless Phase 1 selects an injection boundary.
This avoids treating the intentionally dynamic `generatedAt` value or detected
host facts as literal cross-run byte equality.

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

### Compact composition flow

```text
inspection facts
      |
      v
map evidence to user workflows
      |
      v
compose workflow state
      |
      |-- ready -------------------> collapse routine success
      |
      `-- limited / unavailable / unknown
                    |
                    v
             create typed issue
                    |
                    v
          attach a safe action when one exists
                    |
                    v
       deduplicate -> sanitize -> order -> count
                    |
                    v
             compact doctor output
```

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
visibility inventory must classify this as existing behavior. The omission is
an accidental rendering cutoff rather than a compatibility guarantee: the
detailed projection should deliberately render the already-computed data-query
Codex section while preserving its evidence meaning and stable section order.

## Research Evidence Requirements

Phase 1 recorded the following evidence before activating production
implementation:

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
- focused test requirements that preserve actionable install tips in compact
  mode
- focused test requirements that keep base workflow readiness distinct from
  scoped capability limitations

## Phase 1 Evidence Closure

The current source and focused tests now provide the evidence required to close
the research gate. This section freezes the compatibility and projection
contract that the implementation plan must follow.

### Current JSON contract inventory

The legacy JSON projection keeps this top-level key order:

```text
generatedAt
platform
nodeVersion
tools
markdownPdf
query
queryCodex
font
capabilities
```

The complete nested ownership is:

| Path                                            | Required shape and meaning                                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generatedAt`                                   | ISO string from `runtime.now()`                                                                                                                            |
| `platform`                                      | `runtime.platform`                                                                                                                                         |
| `nodeVersion`                                   | direct `process.version` string                                                                                                                            |
| `tools.pandoc`, `.ffmpeg`, `.weasyprint`        | `{ name, available, version, installHint }`; `version` is `string \| null`                                                                                 |
| `markdownPdf.ready`                             | basic Pandoc and WeasyPrint readiness, independent of advanced renderer capabilities                                                                       |
| `markdownPdf.requirements.pandoc`               | `{ status, available, version, minimumVersion }`; status is `satisfied`, `missing`, `unsupported`, or `unverified`; minimum is `2.0`                       |
| `markdownPdf.requirements.weasyprint`           | `{ status, available, version }`; status is `satisfied` or `missing`                                                                                       |
| `markdownPdf.rendererCapabilities.renderer`     | `{ name: "weasyprint", available, version }`                                                                                                               |
| `markdownPdf.rendererCapabilities.capabilities` | 15 matrix-ordered entries with `{ id, minimumVersion, fields, status }`; non-satisfied entries also carry `diagnosticConditionId`; `requestedBy` is absent |
| `query.available`                               | DuckDB runtime availability                                                                                                                                |
| `query.detail`                                  | optional raw DuckDB runtime detail; omitted when undefined                                                                                                 |
| `query.formats`                                 | stable order: `csv`, `tsv`, `parquet`, `duckdb`, `sqlite`, `excel`                                                                                         |
| core query formats                              | `{ kind: "core", detectedSupport }`; no loadability, installability, or detail fields                                                                      |
| extension query formats                         | `{ kind: "extension", detectedSupport, loadability, installability, detail? }`; installability is `boolean \| null`                                        |
| `query.runtimeVersion`                          | optional string; omitted when unavailable                                                                                                                  |
| `queryCodex`                                    | `{ configuredSupport, authSessionAvailable, readyToDraft, detail? }`; readiness also requires DuckDB                                                       |
| `font.discovery.fontconfig`                     | `{ command: "fc-list", available, version }`                                                                                                               |
| `font.coverage.fontconfig`                      | `{ command: "fc-query", available, version }`                                                                                                              |

The flat `capabilities` object keeps these 14 ordered boolean keys and current
meanings:

```text
md.to-docx
md.to-pdf
video.convert
video.resize
video.gif
data.query.csv
data.query.tsv
data.query.parquet
data.query.duckdb
data.query.sqlite
data.query.excel
data.query.codex
font.discovery.fontconfig
font.coverage.fontconfig
```

`md.to-docx` follows Pandoc availability. `md.to-pdf` follows basic Pandoc and
WeasyPrint requirements. Core query keys follow DuckDB runtime availability;
SQLite and Excel follow extension loadability; Codex-assisted query follows
`readyToDraft`. Extraction must preserve those meanings rather than deriving
them from the new workflow model.

### Current human visibility inventory

The detailed order remains heading, platform and Node.js, three tool lines,
flat capabilities, Markdown PDF renderer capabilities, font support, data-query
formats, and data-query Codex. Missing tools add their current install hints.
Installable DuckDB extensions add their current generated `Try:` command.

| Existing evidence                        | Compact view                             | Detailed view                            | JSON view                 |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------- | ------------------------- |
| Platform and Node.js                     | omit                                     | preserve                                 | preserve                  |
| Tool success and versions                | collapse into workflow state             | preserve                                 | preserve                  |
| Tool failure and install hint            | typed issue and deduplicated action      | preserve                                 | preserve under `tools`    |
| Flat capabilities                        | replace with workflow projection         | preserve                                 | preserve                  |
| Satisfied renderer entries               | collapse                                 | preserve                                 | preserve                  |
| Non-ready renderer entries               | typed PDF limitation or uncertainty      | preserve                                 | preserve                  |
| Font discovery and coverage              | separate workflow states                 | preserve                                 | preserve                  |
| DuckDB runtime and core formats          | aggregate                                | preserve                                 | preserve                  |
| Extension states                         | retain scoped limitation and safe action | preserve                                 | preserve                  |
| Codex configuration, auth, and readiness | Codex-assisted workflow                  | preserve even when DuckDB is unavailable | preserve                  |
| Raw detail strings                       | forbid                                   | preserve current behavior                | preserve current behavior |

The DuckDB-unavailable early return is an accidental detailed-rendering cutoff.
The corrected detailed view prints the unavailable runtime line and continues to
the already-computed Codex section.

### Public-safety audit

Compact output must not forward these existing raw sources:

- `query.detail`, which may contain runtime, path, permission, or network text
- `query.formats.sqlite.detail` and `.excel.detail`, which may contain extension
  load, cache, permission, download, DNS, or connection text
- `queryCodex.detail`, which may contain SDK errors, resolved override paths,
  authentication guidance, or fallback DuckDB detail
- detected tool and DuckDB version strings when constructing remediation copy

Safe remediation sources are the repository-owned dependency install hints and
the closed SQLite/Excel DuckDB install-command helper. Compact safety fixtures
must inject secret-like values, absolute paths, URLs, permission errors, and
command-looking strings into every raw detail field and prove they do not enter
the projection, while approved hints and commands remain visible.

### DuckDB state and remediation inventory

| Runtime     | Extension loadability | Installability   | Compact action                           |
| ----------- | --------------------- | ---------------- | ---------------------------------------- |
| unavailable | `false` default       | `null` default   | no invented install action               |
| available   | `true`                | `true` or `null` | none                                     |
| available   | `false`               | `true`           | generated extension install command      |
| available   | `false`               | `false`          | no command; typed environment constraint |
| available   | `false`               | `null`           | no command; typed unknown condition      |

The top-level doctor does not expose lower-level installed/loaded distinctions.
Permission, cache, read-only, download, network, and DNS failures constrain
installability; unclassified failures remain unknown.

### Frozen workflow and identity model

Workflows render in this order:

| Workflow ID        | Label                     |
| ------------------ | ------------------------- |
| `markdown.docx`    | Markdown DOCX             |
| `markdown.pdf`     | Markdown PDF              |
| `video`            | Video                     |
| `data.query`       | Data query                |
| `data.query.codex` | Codex-assisted data query |
| `font.discovery`   | Font discovery            |
| `font.coverage`    | Font coverage             |

Closed condition IDs are:

```text
dependency.pandoc.missing
dependency.pandoc.unsupported
dependency.pandoc.unverified
dependency.weasyprint.missing
dependency.ffmpeg.missing
dependency.fontconfig.discovery.missing
dependency.fontconfig.coverage.missing
markdown.pdf.renderer.capability.unsupported
markdown.pdf.renderer.capability.unverified
data.query.runtime.unavailable
data.query.extension.sqlite.unavailable
data.query.extension.excel.unavailable
data.query.codex.unconfigured
data.query.codex.unauthenticated
```

Closed action IDs are:

```text
dependency.pandoc.install
dependency.pandoc.upgrade
dependency.pandoc.verify
dependency.weasyprint.install
dependency.weasyprint.upgrade
dependency.weasyprint.verify
dependency.ffmpeg.install
dependency.fontconfig.install
data.query.extension.sqlite.install
data.query.extension.excel.install
data.query.codex.configure
data.query.codex.authenticate
```

One condition may affect several workflows. One action may merge affected
workflow IDs. Required actions sort before recommended actions; within a class,
the first affected workflow order and then action ID determine order. Issue
count is the number of unique visible condition IDs; action count is the number
of deduplicated visible action IDs. Visible conditions sort by the first
affected workflow's stable order and then by condition ID.

Base unavailability takes precedence over unknown, limited, and ready states.
An unknown base requirement takes precedence over child limitations. A
non-ready optional or advanced child makes an otherwise usable workflow
`limited`, while the affected child condition remains visible.

### Condition-to-workflow and action contract

Safe messages below are typed copy. Values in raw detail fields and detected
version strings must not be interpolated into them.

| Condition ID and evidence                              | Affected workflow state                           | Action                                | Class       | Safe condition/action source                                                      |
| ------------------------------------------------------ | ------------------------------------------------- | ------------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `dependency.pandoc.missing`                            | DOCX and PDF `unavailable`                        | `dependency.pandoc.install`           | required    | `Pandoc is missing`; repository-owned platform install hint                       |
| `dependency.pandoc.unsupported`                        | PDF `unavailable`; DOCX remains `ready`           | `dependency.pandoc.upgrade`           | required    | `Pandoc does not meet the required 2.0 minimum`; requirement minimum              |
| `dependency.pandoc.unverified`                         | PDF `unknown`; DOCX remains `ready`               | `dependency.pandoc.verify`            | recommended | `Pandoc 2.0 or newer could not be verified`; no command                           |
| `dependency.weasyprint.missing`                        | PDF `unavailable`                                 | `dependency.weasyprint.install`       | required    | `WeasyPrint is missing`; repository-owned platform install hint                   |
| `dependency.ffmpeg.missing`                            | Video `unavailable`                               | `dependency.ffmpeg.install`           | required    | `FFmpeg is missing`; repository-owned platform install hint                       |
| `dependency.fontconfig.discovery.missing`              | Font discovery `unavailable`                      | `dependency.fontconfig.install`       | required    | `Fontconfig discovery is unavailable`; repository-owned platform install hint     |
| `dependency.fontconfig.coverage.missing`               | Font coverage `unavailable`                       | `dependency.fontconfig.install`       | required    | `Fontconfig coverage is unavailable`; repository-owned platform install hint      |
| `markdown.pdf.renderer.capability.unsupported`         | PDF `limited`                                     | `dependency.weasyprint.upgrade`       | recommended | `Advanced Markdown PDF features require WeasyPrint 65.1 or newer`; matrix minimum |
| `markdown.pdf.renderer.capability.unverified`          | PDF `limited`                                     | `dependency.weasyprint.verify`        | recommended | `Advanced Markdown PDF compatibility could not be verified`; no command           |
| `data.query.runtime.unavailable`                       | Data query and Codex-assisted query `unavailable` | none                                  | —           | `DuckDB runtime is unavailable`; never forward runtime detail                     |
| `data.query.extension.sqlite.unavailable`, installable | Data query `limited`                              | `data.query.extension.sqlite.install` | required    | `SQLite query support is unavailable but installable`; closed helper command      |
| `data.query.extension.sqlite.unavailable`, constrained | Data query `limited`                              | none                                  | —           | `SQLite query support is unavailable in this environment`                         |
| `data.query.extension.sqlite.unavailable`, unknown     | Data query `limited`                              | none                                  | —           | `SQLite query support could not be verified`                                      |
| `data.query.extension.excel.unavailable`, installable  | Data query `limited`                              | `data.query.extension.excel.install`  | required    | `Excel query support is unavailable but installable`; closed helper command       |
| `data.query.extension.excel.unavailable`, constrained  | Data query `limited`                              | none                                  | —           | `Excel query support is unavailable in this environment`                          |
| `data.query.extension.excel.unavailable`, unknown      | Data query `limited`                              | none                                  | —           | `Excel query support could not be verified`                                       |
| `data.query.codex.unconfigured`                        | Codex-assisted query `unavailable`                | `data.query.codex.configure`          | required    | `Codex support is not configured`; no command                                     |
| `data.query.codex.unauthenticated`                     | Codex-assisted query `unavailable`                | `data.query.codex.authenticate`       | required    | `No Codex authentication session is available`; no command                        |

When both fontconfig probes are missing, the two conditions remain visible but
their shared `dependency.fontconfig.install` action is rendered once with both
affected workflow IDs.

### Combined-condition precedence

Compact projection preserves independent actionable conditions while
suppressing subordinate evidence that cannot change the current next step.

| Combination                                                            | Visible workflow states                           | Visible conditions and actions                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| DuckDB unavailable; Codex otherwise ready                              | Data query and Codex-assisted query `unavailable` | one runtime condition, zero actions                                                                                |
| DuckDB unavailable; Codex unconfigured                                 | both workflows `unavailable`                      | runtime plus unconfigured conditions; configure action; 2 issues, 1 action                                         |
| DuckDB unavailable; Codex configured but unauthenticated               | both workflows `unavailable`                      | runtime plus unauthenticated conditions; authenticate action; 2 issues, 1 action                                   |
| DuckDB unavailable; Codex both unconfigured and unauthenticated        | both workflows `unavailable`                      | runtime plus unconfigured conditions; unauthenticated is suppressed until configuration exists; 2 issues, 1 action |
| DuckDB unavailable with default extension values                       | Data query `unavailable`                          | extension conditions are suppressed because loadability was not independently assessed                             |
| Pandoc missing; WeasyPrint present but advanced capabilities non-ready | DOCX and PDF `unavailable`                        | Pandoc missing only; subordinate renderer conditions and actions are suppressed; 1 issue, 1 action                 |
| Pandoc and WeasyPrint both missing                                     | DOCX and PDF `unavailable`                        | both missing conditions and both required install actions; 2 issues, 2 actions                                     |
| Pandoc unverified; renderer capability non-ready                       | DOCX `ready`, PDF `unknown`                       | Pandoc unverified only; subordinate renderer condition is suppressed; 1 issue, 1 recommended verify action         |
| Base PDF requirements ready; renderer capability non-ready             | PDF `limited`                                     | one renderer condition and one recommended upgrade or verify action                                                |
| DuckDB ready; extension non-ready                                      | Data query `limited`                              | one condition per non-ready extension; action only when installability is `true`                                   |
| Codex configured support is false and auth is false                    | Codex-assisted query `unavailable`                | unconfigured condition and configure action only; authentication is suppressed                                     |

### Controlled fixture contract

Fixtures use a fixed runtime of `platform: "darwin"`,
`now: 2026-08-16T00:00:00.000Z`, and direct `nodeVersion: process.version`.
Unless overridden, controlled inspectors return:

```text
pandoc: available 3.1, install hint "brew install pandoc"
ffmpeg: available 8.0.1, install hint "brew install ffmpeg"
weasyprint: available 68.0, install hint "brew install weasyprint"
fc-list and fc-query: available 2.15.0, install hint "brew install fontconfig"
DuckDB: available, runtime 1.5.0, SQLite and Excel loadable/installable
Codex: configured support and auth session available
```

An available extension input is
`{ installed: true, loaded: true, loadable: true, installable: true }`.
An unavailable extension explicitly sets all four booleans/null values and may
carry a controlled `detail` string. These are inspector inputs; report
construction must retain their JSON-visible values exactly.

| Fixture ID and controlled override                                                                                                                | Exact projection assertions                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `all-ready` — no overrides                                                                                                                        | seven workflows `ready`; issue IDs `[]`; action IDs `[]`; complete canonical legacy JSON equals the controlled report projection                                     |
| `pandoc-missing` — Pandoc `{ available:false, version:null }`                                                                                     | DOCX and PDF `unavailable`; issue IDs `[dependency.pandoc.missing]`; required action IDs `[dependency.pandoc.install]` affecting both workflows                      |
| `weasyprint-old` — WeasyPrint version `65.0`                                                                                                      | PDF `limited`; one renderer-unsupported issue; one recommended WeasyPrint-upgrade action; the 15 detailed/JSON capability entries remain individually unsupported    |
| `pandoc-unverified` — Pandoc version `custom-build`                                                                                               | DOCX `ready`, PDF `unknown`; one Pandoc-unverified issue; one recommended verify action                                                                              |
| `duckdb-unavailable` — `{ available:false, detail:"HOST_PATH /Users/alice/private.db TOKEN_ABC" }`; Codex otherwise ready                         | Data query and Codex-assisted query `unavailable`; one runtime issue, zero actions; forbidden tokens absent from compact projection                                  |
| `sqlite-installable` — SQLite `{ installed:false, loaded:false, loadable:false, installable:true, detail:"HOST_URL https://private.invalid" }`    | Data query `limited`; one SQLite issue; one required install action whose command is exactly `cdx-chores data duckdb extension install sqlite`; forbidden URL absent |
| `excel-constrained` — Excel `{ installed:false, loaded:false, loadable:false, installable:false, detail:"permission denied /Users/alice/cache" }` | Data query `limited`; one Excel issue, zero actions; path and raw error absent                                                                                       |
| `sqlite-unknown` — SQLite `{ installed:false, loaded:false, loadable:false, installable:null, detail:"UNCLASSIFIED_SECRET" }`                     | Data query `limited`; one SQLite issue with the typed unknown message; zero actions; secret absent                                                                   |
| `codex-unconfigured` — Codex `{ configuredSupport:false, authSessionAvailable:true, detail:"OVERRIDE /Users/alice/codex" }`                       | only Codex-assisted query `unavailable`; one unconfigured issue; one required configure action; path absent                                                          |
| `font-discovery-missing` — `fc-list` unavailable, coverage ready                                                                                  | Font discovery `unavailable`, coverage `ready`; one discovery issue; one required fontconfig install action                                                          |
| `multiple-actions` — Pandoc and FFmpeg unavailable; SQLite installable                                                                            | DOCX, PDF, and Video `unavailable`; Data query `limited`; issue count `3`; required actions in order Pandoc install, FFmpeg install, SQLite install                  |
| `duckdb-and-codex-unconfigured` — DuckDB unavailable and Codex configured/auth both false                                                         | both data workflows `unavailable`; issue IDs are runtime then unconfigured; configure is the only action                                                             |
| `pandoc-missing-and-weasyprint-old`                                                                                                               | DOCX and PDF `unavailable`; renderer limitation suppressed; one issue and one required Pandoc-install action                                                         |

Phase 1 freezes these inputs and assertions but does not claim their tests have
already been implemented. Phase 2 implements exact normalized-report and JSON
fixtures, Phase 3 implements compact projection and forbidden-token assertions,
and Phase 4 implements detailed and routing assertions. Detailed and JSON
fixtures must preserve every supplied raw detail exactly; compact fixtures must
contain none of the controlled hostile tokens.

### Injection and module boundary

The proposed Phase 2 split keeps `actionDoctor` as the public orchestration
facade and introduces five internal modules under `src/cli/doctor/`:

- `inspect.ts` — default inspector bundle and one concurrent inspection pass
- `report.ts` — normalized evidence types and pure report construction
- `json.ts` — legacy JSON projection
- `workflow.ts` — closed workflow, condition, action, and compact-safety model
- `render.ts` — detailed and compact human rendering

The inspector bundle owns dependency, DuckDB, and Codex inspection. Markdown
PDF requirement and renderer assessment stay as pure report construction. The
existing `dependencyRunner` option remains supported. `runtime.now()` and
`runtime.platform` remain runtime-owned; `process.version` is asserted against
the running process rather than adding an unnecessary production injection.

Tests should separate action/JSON integration, pure workflow projection, and
Commander routing. Existing action exports remain stable; internal doctor
modules do not become new public package exports.

### Baseline validation evidence

Before production changes, the focused doctor, CLI UX, and Interactive routing
baseline passed 87 tests with zero failures. Existing tests cover broad JSON and
human output, Markdown PDF state mapping, renderer-capability parity,
dependency-failure exit `2`, and invalid Codex override evidence. Phase 2 must
add complete canonical JSON fixtures and inspector call counts. Phase 3 must add
the workflow and hostile-detail matrices. Phase 4 must add detailed
section-completeness, view routing, flag-conflict, no-inspector, redirected
content, and Interactive default coverage. Phase 4.5 must replace the legacy
Interactive boolean confirmation with the closed three-view selector and prove
all three routes.

## Implementation Shape

The [active implementation plan][doctor-plan] separates:

1. extraction of the current structured evidence report without changing JSON
2. typed workflow-impact and remediation projection
3. compact human rendering
4. detailed human rendering
5. workflow aggregation and shared-condition deduplication
6. JSON shape-preservation tests
7. one-choice Interactive routing across all three existing projections
8. public-safety tests, guide updates, and lifecycle closeout

The plan begins with a documentation-only evidence gate and requires a
Continue/Constrain/Stop verdict before production work. It remains separate from
the completed Markdown PDF plan.

## Revised Direction

The current direction is:

- make compact human output the eventual default
- provide the current evidence categories through a detailed human view selected
  by `--details`
- reject `--details` with `--json` as an ambiguous view combination
- keep `doctor --json` unchanged as the automation surface
- replace Interactive mode's JSON confirmation with one Summary, Details, or
  JSON selector that routes to the same three projections
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

These conclusions are supported by the Phase 1 inventory, controlled fixture
contract, baseline validation, and focused documentation review. The research
remains `completed`; the active implementation plan owns the remaining work.

## Related Plans

- [Doctor output information hierarchy implementation][doctor-plan] — active
  execution plan. Its completed first phase closed this research's evidence
  gate before production implementation began.
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
[doctor-plan]: ../plans/plan-2026-08-16-doctor-output-information-hierarchy.md
[markdown-pdf-usage]: ../guides/markdown-pdf-usage.md
[markdown-pdf-interactive-usage]: ../guides/markdown-pdf-interactive-usage.md
[data-query-usage]: ../guides/data-query-usage.md
[data-query-codex-usage]: ../guides/data-query-codex-usage.md
[data-duckdb-usage]: ../guides/data-duckdb-usage.md
