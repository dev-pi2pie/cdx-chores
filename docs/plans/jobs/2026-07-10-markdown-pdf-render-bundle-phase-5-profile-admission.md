---
title: "Markdown PDF render bundle Phase 5 profile admission"
created-date: 2026-07-10
status: completed
agent: codex
plan: ../plan-2026-07-10-markdown-pdf-render-bundle-directory.md
---

## Scope

Implement the Phase 5 profile-admission gate for `md to-pdf --bundle` without
changing explicit profile compatibility, report ownership, ambiguity policy, or
the existing render pipeline.

This phase replaces extension-only YAML and JSON profile candidacy with parsed
profile-pattern admission. Recognized Markdown PDF reports remain silent,
unclassified files remain visible through stable diagnostics, and valid
profile-pattern inputs continue through the existing structural and semantic
validation contracts.

Starting commit: `c44e310`.

## Baseline Audit

Before implementation, the resolver and bundle tests were audited for completed
Phase 2–4 expectations that encoded extension-level profile candidacy. The
affected cases in `test/cli-actions-md-to-pdf-bundle.test.ts` were:

- a generic YAML string treated as a single profile artifact
- an empty JSON object included in deterministic profile ordering
- inverse-field report lookalikes treated as profiles
- oversized custom report-like JSON treated as a profile
- malformed and unrelated JSON counted as profiles
- generic YAML strings used to create profile ambiguity
- an unknown-root YAML object reaching selected-profile validation

The Phase 2–4 job records and completed checklist wording remain unchanged. This
record captures the intentional Phase 5 behavior transition.

## Implementation Notes

- Extracted a parse-only profile-file helper that returns the existing JSON or
  YAML parser result without applying profile shape validation.
- Kept `readMarkdownPdfProfileFile` authoritative for explicit profiles by
  layering its existing plain-object and shape validation over the shared parse
  result.
- Kept generated report filename exclusions and the three exact Markdown PDF
  report discriminators ahead of profile admission.
- Kept those report discriminators local to the renderer resolver. Their
  producing commands are `md pdf-profile codex`, `md pdf-template codex`, and
  `md pdf-project codex`.
- Required discovered profiles to be non-empty plain objects with at least one
  recognized Markdown PDF profile root key and no root keys outside that
  namespace.
- Reused `validateMarkdownPdfProfileShape` and
  `normalizeMarkdownPdfProfile` for structural and semantic admission checks.
- Discarded admission-time normalization and retained the existing render-time
  profile read and normalization path.
- Scoped profile admission diagnostics to unresolved profile roles so an
  explicit `--profile` remains authoritative while valid bundle profiles still
  support explicit resolution of the only represented role.
- Collected malformed, non-object, empty, and out-of-namespace YAML or JSON as
  stable unclassified basenames rather than profile candidates.
- Kept profile-pattern inputs that fail structural or semantic validation fatal.
- Printed one stderr warning block when unclassified files coexist with an
  admitted render artifact.
- Added ignored basenames to the no-artifacts error when no render artifact is
  admitted, without printing a separate warning.

## Tests

- Covered malformed JSON, empty documents, `null`, arrays, primitive roots,
  empty objects, multi-document YAML, and out-of-namespace objects.
- Preserved current parser behavior for BOM-prefixed JSON and YAML.
- Covered mixed recognized and outside root keys as unclassified.
- Covered structural and semantic invalid-profile failures.
- Covered profile coexistence with profile, template, and project reports,
  including custom report filenames with exact discriminators.
- Covered malformed and unrelated data files no longer contributing to profile
  conflicts.
- Preserved multiple-valid-profile ambiguity behavior.
- Preserved explicitly selected empty-profile compatibility.
- Covered an explicitly selected in-bundle empty profile without a false
  ignored-file warning.
- Covered an explicit external profile bypassing an invalid bundle profile when
  another bundle role remains discoverable.
- Covered stable warning aggregation and enriched no-artifacts errors.
- Covered admission failures before dependency probes, PDF writes, or
  intermediate HTML writes.

## Live Smoke

Live render smoke used repository-relative fixtures under
`examples/playground/md-pdf/smoke/render-bundle-phase5/` and recorded sanitized
behavioral evidence.

- A profile bundle containing a recognized project report rendered successfully
  without an ignored-file warning.
- A profile bundle containing out-of-namespace data JSON rendered successfully
  with exactly one ignored-file warning naming `data.json`.
- Both smoke cases wrote their PDFs inside the ignored smoke tree.

## Verification

- Focused bundle, profile, command, validation, rendering, and asset suite
  - Passed: 133 tests, 0 failures.
- `bun run lint`
  - Passed.
- `bun run format:check`
  - Passed.
- `bun run build`
  - Passed.
- `bun test`
  - Passed: 1514 tests, 8048 assertions.
- `git diff --check`
  - Passed.
- Recognized-report coexistence render smoke
  - Passed without an ignored-file warning.
- Unclassified-data coexistence render smoke
  - Passed with one stable warning.
- Public-record privacy scan
  - Passed with no actionable matches.

## Artifact Safety

- Manual smoke artifacts remain under the ignored
  `examples/playground/md-pdf/smoke/` tree.
- This record uses repository-relative paths and sanitized command results.
- No machine-local resource identifiers are recorded.

## Review

The initial independent review of `c44e310..35d5379` found that explicit
`--profile` selection did not bypass bundle profile admission. An invalid
profile-pattern file could therefore block an explicit profile, and an
explicitly selected in-bundle empty profile could produce a false ignored-file
warning.

The resolver now receives explicit profile-role state, suppresses profile
admission diagnostics for that resolved role, and retains admitted valid bundle
profiles for the existing explicit-only-role contract. Regression tests cover
both reported cases.

The final independent rereview covered `c44e310..ab0f408`.

Verdict: `APPROVE` with no remaining findings.

The reviewer independently confirmed:

- explicit profiles bypass invalid bundle profile admission
- explicitly selected in-bundle empty profiles do not emit false warnings
- valid bundle profiles still satisfy explicit-only-role bundle resolution
- invalid or unclassified profile files alone do not make an empty bundle valid
- 134 relevant focused tests passed
- lint, build, whitespace, and public-record privacy checks passed

## Outcome

Phase 5 is complete. Only admitted Markdown PDF profiles participate in bundle
profile candidate counting, recognized reports remain silent, unclassified
files produce stable diagnostics for unresolved profile discovery, and explicit
profile selection retains precedence and compatibility. Phase 6 may adopt the
bundle shorthand in helper follow-up commands.

## Related Plan

- [Markdown PDF render bundle directory implementation](../plan-2026-07-10-markdown-pdf-render-bundle-directory.md)

## Related Research

- [Markdown PDF Render Bundle Directory](../../researches/research-2026-07-10-markdown-pdf-render-bundle-directory.md)
