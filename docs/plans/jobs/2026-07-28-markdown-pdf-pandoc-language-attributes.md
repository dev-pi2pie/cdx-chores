---
title: "Markdown PDF Pandoc language-attribute compatibility"
created-date: 2026-07-28
status: completed
agent: codex
---

## Scope

Clarify and enforce the Pandoc compatibility boundary used by `md to-pdf`
when Markdown language attributes activate Profile language-specific font
rules.

This job keeps the renderer on Pandoc's default `markdown` reader, establishes
Pandoc 2.0 as the minimum supported `md to-pdf` version, aligns Doctor with
that capability requirement, verifies inline and block language attributes,
and updates public guidance.

The completed Profile font-preservation plan remains closed. This is a bounded
compatibility follow-up and does not change Profile or Template font ownership.

## Starting Boundary

- Starting commit:
  `d46eb8a9f31f603c59d3737602673a3953a274c4`.
- The worktree was clean before this job began.
- `md to-pdf` invokes Pandoc with `--from markdown`.
- Dependency inspection parsed the Pandoc version, but render readiness and
  Doctor checked executable availability only.
- Existing live-Pandoc coverage verifies bracketed inline spans but not fenced
  block Divs.

## Settled Decisions

- Keep `--from markdown`; do not add redundant extension flags.
- Require Pandoc 2.0 or newer for the complete `md to-pdf` input contract.
- Treat installed Pandoc versions below 2.0 as unsupported for `md to-pdf`,
  not as a degraded rendering mode.
- Keep `md to-docx` on its existing availability-only policy.
- Distinguish missing, unsupported, unverified, and satisfied requirements in
  Doctor while preserving the existing boolean capability result.
- Keep machine-specific environment setup and local font details out of this
  public record.

## Tasks

- [x] Add a shared dotted-numeric dependency-version assessment.
- [x] Enforce Pandoc 2.0 or newer before `md to-pdf` rendering starts.
- [x] Report Markdown PDF requirement status in Doctor text and JSON.
- [x] Verify missing, unsupported, unverified, and satisfied dependency cases.
- [x] Verify Pandoc's default `markdown` reader emits `lang` attributes for
      bracketed inline spans and fenced block Divs.
- [x] Document the Pandoc minimum and supported language-attribute forms.
- [x] Run focused and repository verification.
- [x] Review the exact implementation range and resolve actionable findings.

## Implementation

- Shared dependency inspection now assesses dotted numeric versions without
  assuming a three-component SemVer shape.
- `md to-pdf` reuses the existing `pandoc --version` probe, rejects versions
  below 2.0 or versions it cannot verify, and stops before WeasyPrint or render
  execution.
- Doctor continues to report the Pandoc executable as available when present,
  while `md.to-pdf` reports unavailable, unsupported, unverified, or available
  according to its complete requirement set.
- Doctor JSON preserves the boolean `capabilities["md.to-pdf"]` result and adds
  `markdownPdf.requirements` with detected versions and requirement states.
- `md.to-docx` remains on its existing executable-availability contract.
- Renderer command coverage pins `--from markdown`; real-Pandoc coverage proves
  bracketed spans and fenced Divs both retain their `lang` attributes in HTML.
- README and the Markdown PDF guides now state the Pandoc 2.0 minimum and link
  the language-attribute syntax to one central explanation.

## Verification

- Focused dependency, Doctor, render-action, and real-Pandoc tests: 48 passed,
  0 failed, 318 assertions.
- Markdown PDF and Interactive regression slice: 718 passed, 0 failed, 4,798
  assertions across 59 files.
- Repository suite: 1,854 passed, 0 failed, 10,030 assertions across 230 files.
- TypeScript check: passed.
- Lint and formatting checks: passed.
- Build: passed.
- Diff whitespace check: passed.

The affected live boundary is Pandoc Markdown-to-HTML conversion, so no new
renderer-specific PDF smoke was required. Existing Markdown PDF render
integration remained green in the broader regression slice.

## Review

- Reviewed the complete implementation and documentation diff from starting
  commit `d46eb8a9f31f603c59d3737602673a3953a274c4` through the final worktree.
- The review checked capability scoping, version-comparison behavior, Doctor
  state precedence, JSON compatibility, direct-render failure ordering,
  default-reader command arguments, test coverage, and public wording.
- No actionable correctness, maintainability, test, or documentation findings
  remained after the final pass.

## Outcome

`md to-pdf` now has one explicit Pandoc compatibility boundary: Pandoc 2.0 or
newer. Installed older versions remain visible as tools but do not claim full
Markdown PDF capability, and the documented inline and block language
annotations are verified against Pandoc's default `markdown` reader.

## References

- [Pandoc 1.18 release](https://github.com/jgm/pandoc/releases/tag/1.18)
- [Pandoc 2.0 release](https://github.com/jgm/pandoc/releases/tag/2.0)
- [Pandoc Divs and Spans manual](https://pandoc.org/demo/example33/8.18-divs-and-spans.html)

## Related Historical Docs

- [Markdown PDF Profile font preservation plan](../plan-2026-07-26-markdown-pdf-profile-font-preservation.md)
- [Markdown PDF Profile font preservation implementation](2026-07-27-markdown-pdf-profile-font-preservation.md)
