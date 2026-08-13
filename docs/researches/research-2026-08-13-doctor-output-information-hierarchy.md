---
title: "Doctor Output Information Hierarchy"
created-date: 2026-08-13
status: draft
agent: codex
---

## Goal

Research a clearer human-output hierarchy for `cdx-chores doctor` without
hiding actionable remediation, weakening existing probes, or destabilizing
machine-readable output.

The likely direction is a compact default view, a detailed human view, and the
existing structured JSON view. This document records an initial product shape;
it does not authorize implementation yet.

## Scheduling Boundary

The active [Markdown PDF page-number configuration plan][page-number-plan]
remains the current implementation priority. Its later phases still use
`doctor --json` as renderer evidence and must finish against a stable doctor
contract.

Therefore:

- this research may be refined while that plan remains active
- doctor implementation work should not begin until the active plan is closed
- no new doctor implementation plan is created from this first draft
- a later plan should be created only after this research settles the human
  views, advisory rules, compatibility boundary, and verification matrix

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
Compact output hides routine evidence, not actionable information.
```

A successful low-level probe may be collapsed into a feature-family summary.
A warning, blocker, unknown result, install opportunity, or state-derived
remediation must remain visible in the compact view.

This distinction matters for DuckDB extensions. If SQLite or Excel support is
not loadable but the missing extension is installable, the compact result must
show the exact supported install command even when the wider data-query system
is usable.

## Candidate View Model

### Default compact view

The default view should answer three questions quickly:

1. Can the main feature families run?
2. Is anything degraded, blocked, or unknown?
3. Is there a concrete action that improves the current environment?

Possible shape:

```text
cdx-chores doctor

Status: Ready with 1 recommendation

- Markdown: ready
- Video: ready
- Data query: ready with recommendation
- Fonts: ready
- Codex: ready

Recommendation:
- SQLite queries need the DuckDB sqlite extension.
  Try: cdx-chores data duckdb extension install sqlite

Use the future detailed human view for versions and capability details.
```

This example is directional rather than settled copy. In particular, research
must decide whether an installable missing extension is described as
`ready with recommendation`, `attention`, or `degraded`. It must not be reduced
to an unqualified `ready` state.

### Detailed human view

A proposed detailed view could carry forward the current evidence-oriented
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
`--json`. `--verbose` is one candidate because it communicates expanded human
detail, but the name and behavior must be checked against repository-wide CLI
conventions before a plan freezes it.

Research must also decide how a future detailed flag interacts with `--json`:
reject the combination as mutually exclusive, let JSON take precedence, or
define another explicit rule. Help and usage guides should change only after
that command contract is accepted.

### Structured JSON view

`doctor --json` is the current automation surface. Its payload currently
contains `generatedAt`, platform and Node.js facts, tool inspections, Markdown
PDF requirements and renderer capabilities, data-query runtime and format
facts, Codex readiness, font probes, and the flat capability map.

Before claiming compatibility, research must inventory the exact nested fields,
booleans, status values, optional details, and tests. A human-output redesign
should not silently rename, remove, regroup, or reinterpret those existing
values. In particular, a future family-health taxonomy must not change the
meaning of current capability booleans or renderer statuses.

If later research finds that the JSON model cannot represent compact-view
severity or advisories without inference, any additive fields need their own
compatibility review. Human rendering should not become the source of truth.

## Candidate Status Taxonomy

One shared model should drive compact, detailed, and JSON rendering. The first
taxonomy to evaluate is:

| Status               | Meaning                                                                               | Compact behavior                                         |
| -------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `ready`              | The feature family is usable and has no current action                                | Show one collapsed success line                          |
| `ready-with-actions` | The primary feature works, but a detected optional or scoped improvement is available | Show the family and every actionable recommendation      |
| `degraded`           | Part of the supported feature family is unavailable                                   | Show the affected capability and remediation             |
| `blocked`            | A primary workflow cannot run                                                         | Show the blocker prominently                             |
| `unknown`            | Availability or compatibility could not be determined                                 | Show the uncertainty and the safest next diagnostic step |

The names are provisional. The important contract is that an actionable state
cannot collapse into ordinary success.

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

When several checks lead to the same command, compact output should deduplicate
the recommendation while preserving the affected feature names. Detailed and
JSON views may retain the individual evidence entries.

## Feature-Family Aggregation

Compact output should aggregate evidence at a user-facing feature boundary,
not simply truncate the current list.

Initial grouping to evaluate:

| Compact family | Evidence that may be collapsed when successful                                           | Evidence that must expand                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Markdown       | Pandoc, WeasyPrint, DOCX/PDF readiness, renderer capability matrix                       | Missing/unsupported tools, unverified renderer state, unavailable required capability                     |
| Video          | FFmpeg-backed convert, resize, and GIF capabilities                                      | Missing FFmpeg or a future operation-specific limitation                                                  |
| Data query     | Core formats, extension formats, DuckDB runtime, Codex drafting readiness where relevant | Missing/unloadable extensions, install commands, unavailable runtime, authentication/configuration action |
| Fonts          | Discovery and coverage probes                                                            | Missing selected support, degraded discovery, unknown coverage state                                      |
| Codex          | Configured support and authenticated session                                             | Configuration, authentication, or environment action                                                      |

The final grouping must avoid double-reporting one condition under multiple
families. For example, data-query Codex readiness may be summarized under Data
query while a general Codex family explains the shared configuration problem.

## Exit-Code Boundary

The current doctor action reports detected missing, unsupported, and unknown
states in its output but does not derive a nonzero exit code from those health
states. Nonzero behavior currently comes from ordinary command-level failures,
not from a `ready`/`degraded`/`blocked` taxonomy.

This research must decide whether presentation-only work preserves that
behavior or whether status-driven exit codes are a separate compatibility
change. The default direction is to preserve current exit behavior unless
evidence shows scripts need a new explicit health-check contract. Any change
would require focused CLI tests for every status and documentation for shell
automation; it must not arrive implicitly with compact rendering.

## TTY And Redirected Output

The first implementation should prefer one deterministic compact human format
for TTY and redirected output. Automatically switching detail based on TTY can
make captured logs differ from an interactive run and complicate support.

Color may continue to depend on terminal capabilities, but information content
should remain stable unless later evidence justifies a separate non-interactive
contract. Research must define whether redirected output is textually stable
apart from color before a plan makes byte-stability claims.

## Compatibility Boundary

The redesign should preserve:

- the existing probe implementations and dependency-selection rules
- one structured source of truth for readiness and remediation
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
- silently changing exit codes as a side effect of presentation work
- introducing a general notification framework solely for doctor output

Existing public-safety behavior needs an explicit audit rather than a blanket
compatibility claim. Current detail fields may carry environment-derived paths
or raw error text from Codex and DuckDB inspection. Research must decide whether
the redesign preserves those details only in existing detailed/JSON surfaces,
sanitizes new compact advisories, or proposes a separately reviewed redaction
change. Tests should cover secrets, override paths, raw errors, and public
install commands for every changed surface.

## Research Evidence Needed

Before this research can become an implementation plan, record:

- an inventory of current doctor JSON fields, human sections, exit behavior,
  and tests
- a public-safety audit of current Codex and DuckDB detail fields
- the exact existing DuckDB installability states and remediation commands
- representative compact output for all-ready, ready-with-actions, degraded,
  blocked, and unknown environments
- a mapping from each current human line to compact, detailed, and JSON
  visibility
- a mapping from low-level conditions to feature-family status without
  duplicate or contradictory messages
- flag-name consistency with other CLI commands
- the interaction between the proposed detailed flag and `--json`
- compatibility expectations for scripts that currently consume human output,
  even though JSON is the intended automation surface
- focused tests proving actionable install tips remain visible in compact mode

## Possible Implementation Shape After Research

If the direction is accepted, a later plan will likely separate:

1. a shared doctor health and advisory model
2. compact human rendering
3. detailed human rendering
4. DuckDB and dependency remediation preservation
5. Markdown PDF capability aggregation
6. JSON compatibility and additive-schema decisions, if any
7. tests, guide updates, and lifecycle closeout

That plan should use focused checkpoints and exact commit-range review. It
should not be appended to the active Markdown PDF plan.

## Current Leaning

The current leaning is:

- make compact human output the eventual default
- provide the current evidence categories through a proposed detailed human
  view after its flag and combination rules are settled
- keep `doctor --json` as the automation surface and preserve inventoried field
  meanings
- summarize fully satisfied capability families
- always display detected remediation, including DuckDB extension install
  commands, in compact output
- use state-derived recommendations rather than generic advice
- finish the active Markdown PDF plan before implementing this redesign

These are research hypotheses, not committed implementation requirements. The
document should remain `draft` until the output taxonomy, compatibility rules,
and evidence matrix are reviewed.

## Related Plans

- [Markdown PDF page-number configuration plan][page-number-plan] — current
  scheduling dependency. Finish its remaining `doctor --json` validation before
  implementing this redesign.

## Related Research

- [Markdown PDF page-number configuration research][page-number-research] —
  discovery context. Its renderer capability matrix demonstrated how detailed
  feature evidence can make the top-level human doctor output difficult to
  scan.

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
[page-number-research]: ./research-2026-08-11-markdown-pdf-page-number-configuration.md
[markdown-pdf-usage]: ../guides/markdown-pdf-usage.md
[markdown-pdf-interactive-usage]: ../guides/markdown-pdf-interactive-usage.md
[data-query-usage]: ../guides/data-query-usage.md
[data-query-codex-usage]: ../guides/data-query-codex-usage.md
[data-duckdb-usage]: ../guides/data-duckdb-usage.md
