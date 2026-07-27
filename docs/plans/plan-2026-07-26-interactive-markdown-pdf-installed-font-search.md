---
title: "Interactive Markdown PDF installed-font search implementation"
created-date: 2026-07-26
modified-date: 2026-07-27
status: active
agent: codex
---

## Goal

Improve Interactive Markdown PDF font-family discovery and search while keeping
the existing local, custom-first, cancellable authoring contract.

The implementation should retain fontconfig family aliases and full names as
shared lookup metadata, rank local matches deterministically, and replace the
current implicit timeout assumptions with an explicit soft wait threshold and
hard safety ceiling. The selected value must remain the primary
adapter-reported family and continue to enter the existing ordered
`fontHints: string[]` contract.

## Why This Plan

The related research separates installed-font discovery and selection from
later Profile and Template font ownership. Interactive currently uses one
fontconfig discovery attempt per session, keeps only primary family names,
matches contiguous substrings, and gives discovery a one-second hard deadline.

Issue #61 requires coordinated changes across shared font discovery and
matching, Interactive result ranking, and the discovery lifecycle. These changes
need their own evidence and review boundaries. They do not depend on the
Profile-font preservation implementation.

## Starting State

Current implementation seams:

- `src/fonts/adapters/fontconfig.ts` requests family and full-name data but keeps
  only the first reported family and one full name per face.
- `src/fonts/types.ts` defines the shared `FontFace` and discovery-attempt
  contracts.
- `src/fonts/matching.ts` owns the matching behavior used by `font inspect` and
  `font check`.
- `src/cli/interactive/markdown/font-hints/suggestions.ts` deduplicates primary
  families, sorts them alphabetically, performs contiguous-substring filtering,
  and returns at most six installed matches.
- `src/cli/interactive/markdown/font-hints/service.ts` requests explicit
  fontconfig discovery, enforces a one-second deadline in multiple places,
  caches the session promise, and falls back to custom input.
- `test/fonts-*` covers shared discovery, inspection, and selection.
- `test/cli-interactive-markdown-pdf/font-hints.test.ts` covers the current
  Interactive font-hint flow.

Missing pieces:

- retained fontconfig aliases and all reported full names
- a shared searchable-family record with stable primary-family identity
- fixture-defined ranking and tie-breaking
- first- and subsequent-run responsiveness evidence
- an explicit automatic-wait threshold and total hard safety ceiling
- one conditional slow-discovery choice that reuses the same attempt
- timeout classification in discovery evidence
- focused regression coverage across shared font commands and Interactive

## Implementation Order

This is the first of the two plans derived from the shared research:

1. Interactive installed-font search
2. Markdown PDF Profile font preservation

The order is preferred, not a code dependency. This plan owns discovery,
search, and `fontHints[]` selection only. It does not own Profile font-role
assignment, Template CSS emission, stylesheet ordering, or rendered-font
preservation.

## Product Contract

### Discovery source

- Interactive continues to request `discovery: "fontconfig"`.
- No network catalogue, native fallback, or discovery-source prompt is added.
- Missing, empty, failed, cancelled, or timed-out discovery keeps custom input
  reachable.
- One discovery result is shared across the Interactive session.

### Search and selection

- The primary adapter-reported family remains the installed suggestion value.
- Remaining reported families are aliases used only for lookup.
- All reported full names are lookup metadata and never replace the selected
  primary family.
- Exact, prefix, token-prefix, substring, and ordered-subsequence matches are
  ranked in that order.
- Score thresholds and tie-breaking are explicit and fixture-tested.
- Custom typed input remains first and preserves the entered text.
- No more than six installed suggestions are returned.

### Responsiveness and privacy

- Discovery is read-only, cancellable, session-cached, and bounded.
- Interactive waits automatically for up to three seconds.
- If discovery is still running, offer `Continue with custom input` or
  `Keep waiting for installed fonts` once.
- Continued waiting reuses the same discovery attempt under one ten-second total
  hard safety ceiling measured from the original start.
- Choosing custom input cancels discovery and caches the unavailable outcome for
  the session.
- Successful completion before the hard deadline wins must be accepted without
  a later elapsed-time rejection.
- Repository evidence checks this policy for regressions but does not claim
  cross-machine coverage; unavailable older-hardware evidence is recorded as an
  environment limitation.
- Public evidence may record aggregate timing, platform, architecture, runtime,
  and face-count ranges, but not font names, paths, or raw host errors.

### Non-guarantees

Installed suggestions do not prove glyph coverage, WeasyPrint availability, or
the final Profile role selected by Codex. The implementation must not add those
claims to prompts, reports, or guides.

## Scope

### In scope

- fontconfig family, alias, and full-name parsing
- shared search-record and matching helpers
- compatibility of `font inspect` and `font check`
- deterministic Interactive ranking
- discovery timing and timeout evidence
- a three-second automatic-wait threshold and ten-second total hard ceiling
- the conditional slow-discovery choice
- cancellation, caching, fallback, and unavailable-notice behavior
- focused tests, live fontconfig smoke, and current guidance

### Out of scope

- network font catalogues
- native-discovery fallback in Interactive
- font installation or downloading
- glyph-coverage inference
- renderer-availability guarantees
- automatic font-role assignment
- changes to the ordered `fontHints: string[]` contract
- Profile/Template CSS preservation from Issue #60
- unrelated Interactive presentation redesign
- a public font-discovery timeout flag or configuration source
- persisted timing heuristics or hardware classification

## Implementation Approach

Keep adapter identity, shared matching, and Interactive presentation separate:

```text
fontconfig rows
  -> shared faces with primary family + aliases + full names
  -> grouped searchable-family records
  -> deterministic ranked installed matches
  -> custom-first Interactive choices
  -> selected primary family or typed custom value
  -> fontHints[]
```

The fontconfig adapter should retain source metadata without deciding
Interactive ranking. Shared matching should expose reusable normalization and
identity behavior without forcing the Interactive scorer onto diagnostic
commands. Interactive should rank grouped family records and return only the
stable primary-family value.

## Execution Protocol

- Work one phase at a time and record the starting commit in its job record.
- Keep checklist items unchecked until implementation and matching evidence
  exist.
- Run phase-focused checks before the phase-boundary commit.
- Review the exact range from the preceding boundary through the current phase
  commit and resolve all actionable findings before continuing.
- Record commands, results, review disposition, and environment limitations in
  repository-relative, public-safe language.
- If evidence requires revisiting the responsiveness lifecycle, update this plan
  and its job record before Phase 4. Shared search work may continue
  independently.

## Implementation Phases

### Phase 1: Responsiveness Evidence And Policy Checkpoint

Tasks:

- [ ] Add
      `scripts/spikes/markdown-pdf-font-discovery-evidence-spike.ts`.
- [ ] Validate `--runs <count>` and `--timeout-ms <ms>` inputs and default to 30
      serial runs.
- [ ] Call
      `discoverSystemFonts({ discovery: "fontconfig", includeAttempts: true })`
      through the shared implementation.
- [ ] Record the first run separately from subsequent runs.
- [ ] Report total and adapter p50, p95, and maximum latency using documented
      nearest-rank percentiles.
- [ ] Report success, failure, and timeout counts without host font names, font
      paths, or raw command errors.
- [ ] Expose timeout distinctly in spike or shared attempt evidence instead of
      inferring it only from duration.
- [ ] Keep the spike stdout-only and limit its cleanup ownership to timers,
      listeners, controllers, and child processes that it starts.
- [ ] Redirect optional reports into one uniquely named, phase-owned directory
      under `examples/playground/.tmp-tests/`.
- [ ] Retain local reports through the Phase 1 range review; after successful
      closeout remove only that exact directory, or retain it with a private
      repository-relative handoff note when the phase is blocked or fails.
- [ ] Measure the current one-second boundary and evaluate the three-second
      automatic-wait threshold under a generous measurement ceiling.
- [ ] Check available runs against the ten-second total hard safety ceiling and
      document it as a policy bound rather than a cross-machine performance
      guarantee.
- [ ] Record unavailable older-hardware coverage as an environment limitation.
- [ ] Review the Phase 1 commit range and resolve all actionable findings.

Phase gate:

- **Proceed** — evidence and timeout classification are usable; continue with
  the selected responsiveness policy.
- **Proceed with limitation** — available hardware is not representative;
  record the limitation and continue because local measurements are not treated
  as cross-machine proof.
- **Revisit responsiveness only** — available fontconfig cannot complete under
  the generous measurement ceiling or timeout outcomes cannot be classified
  correctly; pause Phase 4 lifecycle work while Phases 2 and 3 continue.

### Phase 2: Shared Font Search Records

Tasks:

- [ ] Extend the shared font discovery model additively so fontconfig aliases
      and all reported full names are retained.
- [ ] Keep the first reported family as the primary adapter family.
- [ ] Define a searchable-family record that groups faces by normalized primary
      family and merges aliases and full names deterministically.
- [ ] Keep aliases and full names as lookup metadata rather than selectable
      values.
- [ ] Reuse shared query normalization and make any matching-rank extension
      explicit.
- [ ] Preserve existing `font inspect` output identity and `font check`
      unambiguous-selection behavior.
- [ ] Add parser fixtures for multiple families, multiple full names, empty
      metadata, duplicate aliases, case variants, and stable grouping.
- [ ] Add regression tests for exact family, exact full name, family substring,
      full-name substring, and ambiguous loose-family selection.
- [ ] Review the Phase 2 commit range and resolve all actionable findings.

Phase gate:

- Fontconfig metadata is retained without changing the primary selected family.
- Shared diagnostic commands remain deterministic and compatible.
- Interactive-specific ranking has not leaked into adapter parsing.

### Phase 3: Deterministic Installed-Font Ranking

Tasks:

- [ ] Implement a small local scorer over searchable-family records.
- [ ] Rank exact, prefix, token-prefix, substring, and ordered-subsequence
      matches in the settled order.
- [ ] Define explicit score thresholds and stable tie-breaking from fixtures.
- [ ] Normalize case and whitespace without changing the selected display value.
- [ ] Collapse exact duplicate primary families deterministically.
- [ ] Return the primary family for alias and full-name matches.
- [ ] Keep typed custom input first and preserve its exact normalized text.
- [ ] Limit installed results to six independently of the custom choice.
- [ ] Cover missing spaces, initials, separated tokens, aliases, styled full
      names, ambiguous matches, and no-match input.
- [ ] Avoid a fuzzy-search dependency unless the accepted fixture contract
      cannot be expressed by the bounded scorer.
- [ ] Review the Phase 3 commit range and resolve all actionable findings.

Phase gate:

- Fixture order determines every result and tie.
- Alias and full-name queries never substitute metadata for the primary family.
- The result contract remains custom-first with at most six installed choices.

### Phase 4: Interactive Discovery Lifecycle

Tasks:

- [ ] Integrate searchable-family records and ranked choices into the existing
      font-hint suggestion service.
- [ ] Preserve one discovery promise per Interactive session.
- [ ] Race discovery against a three-second automatic-wait threshold without
      treating that threshold as a timeout.
- [ ] If the soft threshold wins, show `Continue with custom input` and
      `Keep waiting for installed fonts` once.
- [ ] Make custom input the default slow-path choice; cancel discovery and cache
      the unavailable outcome when selected.
- [ ] Reuse the same discovery promise when continued waiting is selected.
- [ ] Show and clear concise waiting status while continued waiting is active.
- [ ] Enforce one ten-second total hard safety ceiling from the original
      discovery start without resetting it after the slow-path choice.
- [ ] Ensure the hard deadline cancels the discovery subprocess.
- [ ] Remove the post-completion elapsed-time rejection and accept a successful
      result that wins before the hard deadline.
- [ ] Keep the visible slow-path choice authoritative if discovery completes
      while the user is deciding.
- [ ] Preserve session cancellation and avoid showing an unavailable notice
      after user cancellation.
- [ ] Keep timeout, empty result, and command failure on the custom-input path.
- [ ] Do not show an unavailable notice after explicit custom selection; show it
      at most once for other fallback outcomes.
- [ ] Verify later font prompts reuse the cached result without another
      fontconfig call.
- [ ] Preserve the current `fontHints[]` ordering and direct-helper behavior.
- [ ] Review the Phase 4 commit range and resolve all actionable findings.

Phase gate:

- The first font prompt waits automatically for no more than three seconds
  before offering the conditional slow path.
- Continued waiting never extends the ten-second total process ceiling.
- Soft-threshold races, both slow-path choices, near-hard-boundary success,
  timeout, cancellation, failure, empty result, and cache reuse have distinct
  deterministic tests.
- Completion while the slow-path prompt is open honors the user's eventual
  choice without restarting discovery.
- Custom input remains reachable in every unavailable path.

### Phase 5: Validation, Guidance, And Closeout

Tasks:

- [ ] Run the focused shared-font and Interactive suites.
- [ ] Run repository lint, format, type, build, test, and diff checks.
- [ ] Perform a live fontconfig smoke on the development operating system.
- [ ] Confirm live installed selections produce primary-family `fontHints[]`.
- [ ] Confirm no network request or discovery-source prompt exists.
- [ ] Record aggregate public-safe evidence and any environment limitation.
- [ ] Update current Interactive Markdown PDF guidance for alias-aware search,
      custom-first selection, and the two-stage responsiveness contract.
- [ ] Update the related research with evidence, plan/job links, and accurate
      remaining status.
- [ ] If the Profile-font preservation plan has completed, add one end-to-end
      Interactive selection-to-render smoke; otherwise record it as a sibling
      plan closeout check without blocking this plan.
- [ ] Review the Phase 5 and complete-plan commit ranges and resolve all
      actionable findings.

Phase gate:

- Focused and repository validation pass.
- Live evidence or a precise environment limitation is recorded.
- Documentation describes shipped behavior without publishing host inventory.
- No actionable review finding remains unresolved.

## Validation Plan

### Focused automated coverage

```bash
bun test \
  test/fonts-discovery-parsers.test.ts \
  test/fonts-discovery-cancellation.test.ts \
  test/fonts-discovery.test.ts \
  test/fonts-cli-inspect-matching.test.ts \
  test/fonts-cli-check-selection.test.ts \
  test/cli-interactive-markdown-pdf/font-hints.test.ts
```

Add any new scorer or search-record test file to this focused command.

### Repository gates

```bash
bun run lint
bun run format:check
bunx tsc --noEmit
bun run build
bun test
git diff --check
```

### Local evidence lifecycle

The spike emits structured JSON to standard output and does not accept
report-file write or cleanup options. Redirected reports are caller-owned local
evidence, not durable command artifacts.

Keep all Phase 1 reports in one uniquely named directory under
`examples/playground/.tmp-tests/`. Retain that directory until its aggregate
evidence and exact-range review are complete. On successful closeout, inspect
and remove only the confirmed phase-owned directory. On failure, blocking, or
handoff, retain it for diagnosis and communicate its repository-relative path
privately rather than publishing it in repository documents.

Tests that need filesystem fixtures should reuse `withTempFixtureDir(...)` so
their uniquely created directories are removed in `finally`. Tests that only
exercise parsing, aggregation, or serialization should keep their evidence in
memory.

### Manual smoke

Use `examples/playground/` for isolated local evidence:

1. Search by exact primary family.
2. Search by alias and select the returned primary family.
3. Search by a styled full name and select the returned primary family.
4. Search with missing spaces or separated tokens.
5. Enter a custom value that is not installed.
6. Force the three-second slow path and choose custom input.
7. Force the slow path, continue waiting, and complete before the hard ceiling.
8. Force missing fontconfig, hard timeout, cancellation, and empty results.
9. Revisit the font prompt and confirm the session cache prevents another call.

Do not record the local font inventory or machine-specific paths in repository
documents.

## Risks And Mitigations

- Risk: alias support changes `font inspect` or `font check` identity.
  Mitigation: keep primary family identity stable and add command-level
  regression fixtures before Interactive integration.

- Risk: a scorer produces surprising or unstable ordering.
  Mitigation: define all rank tiers, thresholds, and tie-breakers in fixtures.

- Risk: a relaxed hard ceiling makes Interactive feel blocked.
  Mitigation: stop automatic waiting after three seconds and make custom input
  the default conditional choice.

- Risk: the soft threshold and hard deadline disagree near a boundary.
  Mitigation: measure both from one discovery start, never reset the hard
  deadline, reuse the same promise, and accept successful completion when it
  wins.

- Risk: the slow-path choice adds routine prompt friction.
  Mitigation: show it only when discovery exceeds three seconds and at most once
  per session.

- Risk: evidence leaks host font data.
  Mitigation: emit aggregate timing and face-count ranges only.

- Risk: evidence cleanup removes unrelated playground artifacts.
  Mitigation: use one uniquely named phase-owned directory, retain it through
  review, and remove only that exact confirmed directory after successful
  closeout.

## Expected Job Records

Create job records when their work begins:

- `docs/plans/jobs/YYYY-MM-DD-interactive-markdown-pdf-font-search-evidence.md`
- `docs/plans/jobs/YYYY-MM-DD-interactive-markdown-pdf-font-search-implementation.md`

The evidence job owns Phase 1, the policy check, and any environment limitation.
The implementation job owns accepted work from Phases 2–5.

## Completion Criteria

This plan is complete only when:

- fontconfig aliases and full names are retained in the shared lookup model
- primary adapter family identity remains stable
- `font inspect` and `font check` compatibility is proven
- deterministic ranking and tie-breaking are fixture-defined
- custom input remains first and installed results remain bounded
- the responsiveness policy is checked against recorded environment evidence
- discovery uses a three-second automatic-wait threshold and one ten-second
  total hard safety ceiling
- both conditional slow-path choices reuse or cancel the same discovery attempt
  as specified
- timeout, cancellation, failure, empty result, and cache reuse are covered
- selected installed values enter `fontHints[]` as primary families
- focused and repository checks pass
- public-safe live evidence or an environment limitation is recorded
- phase-owned local evidence is removed after successful Phase 1 closeout or
  retained with a private repository-relative handoff note when blocked
- guidance and research links reflect the shipped contract
- both job records and review dispositions are linked
- the complete-plan review has no unresolved actionable findings

## Related Research

- [Markdown PDF Font Selection and Template Preservation](../researches/research-2026-07-24-markdown-pdf-font-selection-and-template-preservation.md)
- [Markdown PDF Interactive Font Hint Suggestions](../researches/research-2026-07-22-markdown-pdf-interactive-font-hint-suggestions.md)
- [Font Command Discovery Options](../researches/research-2026-05-07-font-command-discovery-options.md)

## Related Plans

- [Interactive Markdown PDF mode implementation](plan-2026-07-21-markdown-pdf-interactive-mode.md)
- [Markdown PDF Profile font preservation implementation](plan-2026-07-26-markdown-pdf-profile-font-preservation.md)
