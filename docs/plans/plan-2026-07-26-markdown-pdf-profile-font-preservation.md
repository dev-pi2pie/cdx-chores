---
title: "Markdown PDF Profile font preservation implementation"
created-date: 2026-07-26
modified-date: 2026-07-27
status: active
agent: codex
---

## Goal

Keep an effective compatibility Profile's font roles effective through generated
Template CSS and the final rendered PDF.

The implementation should make shared Template synthesis omit competing
`font-family` output for Profile-owned CSS slots while preserving non-font
Template styling, bounded direct-Template `template_level` overrides, Project
compatibility validation, existing stylesheet order, and deliberate user CSS
overrides.

## Why This Plan

The related research identifies a shared synthesis defect: ordinary Template
font decisions are blocked when the compatibility Profile owns the same role,
but preset font tokens are still emitted into generated `style.css`. Because
`md to-pdf` loads Profile-derived CSS before generated Template CSS, the later
preset family can override the Profile.

Issue #60 affects direct Template generation with `--base-profile` and Project
generation through the final Project Profile. Both paths converge on the same
Template synthesis service, so they should be fixed and validated together.

## Starting State

Current implementation seams:

- `src/cli/markdown-pdf/template-codex/slots.ts` blocks ordinary Profile-owned
  font decisions but still initializes preset body, heading, and monospace
  tokens.
- `src/cli/markdown-pdf/template-codex/synthesize-css.ts` always emits those
  tokens and uses a `font` shorthand for the body.
- `src/cli/markdown-pdf/template-codex/synthesize.ts` combines materialized
  decisions, theme tokens, CSS output, and bounded Codex CSS blocks.
- `src/cli/markdown-pdf/template-codex/synthesize-css.ts` uses the same body and
  heading tokens in Template-owned cover title, subtitle, and byline rules.
- `src/cli/markdown-pdf/template-codex/css-blocks.ts` bounds selectors but does
  not prevent family-bearing declarations from bypassing `font_decisions`.
- `src/cli/markdown-pdf/project-codex/template-phase.ts` forwards the normalized
  final Project Profile as Template compatibility input.
- `src/cli/markdown-pdf/project-codex/validate-project.ts` rejects reported
  explicit Template overrides of Profile-owned fonts.
- `src/cli/markdown-pdf/render.ts` loads Profile-derived CSS before custom or
  bundle `style.css`.

Missing evidence and implementation:

- direct Template and Project reproductions with visibly distinct families
- an explicit full-Profile-to-CSS-slot ownership mask
- conditional omission of generated font declarations
- a single generated-font channel that prevents CSS blocks from bypassing
  ownership and Project validation
- an explicit Template-owned cover typography boundary
- separation of body size/line-height from the current `font` shorthand
- generated-CSS and rendered-output validation for both bundle shapes
- regression coverage for language and combined-code slots

## Implementation Order

This is the preferred second plan derived from the shared research:

1. Interactive installed-font search — completed
2. Markdown PDF Profile font preservation — active

There is no code dependency on the first plan. This plan must preserve any
effective compatibility Profile regardless of whether its font preference came
from direct flags, Interactive selection, a base candidate, or a generated
Project Profile. The completed installed-font work makes the final Interactive
selection-to-render smoke required rather than conditional.

## Product Contract

### Artifact ownership

- Profile owns reusable render policy, including font roles.
- Template owns reviewable HTML/CSS presentation and managed assets.
- Project coordinates and validates the final Profile and Template artifacts.
- Direct Template output remains a partial bundle and does not copy its
  compatibility Profile into the bundle.
- Project output remains a complete bundle containing its final Profile.

### CSS ownership

- Profile-owned CSS font slots omit competing generated Template
  `font-family`.
- Non-font Template styling remains present.
- Direct Template without a compatibility Profile retains accepted Template
  decisions and preset families.
- Explicit direct-Template `template_level` decisions remain deliberate bounded
  overrides.
- Project continues rejecting explicit Template decisions that override a
  Profile-owned slot.
- Generated Template font families may enter through `font_decisions` only.
  Bounded Codex CSS blocks must reject `font`, `font-family`, and
  `--template-*-font` declarations.
- Cover title, subtitle, and byline typography remains Template-owned. Its
  family, size, weight, and line height remain stable when document font
  declarations are omitted.
- User-authored CSS may override through the normal cascade.
- `--no-default-css` remains outside the preservation guarantee.

### CSS slot mapping

| CSS slot      | Profile ownership source         | Generated Template behavior                     |
| ------------- | -------------------------------- | ----------------------------------------------- |
| Body default  | `body.default`                   | omit the Template body family                   |
| Body language | matching `body.<language-tag>`   | omit the competing language-selector family     |
| Headings      | `heading.default`                | omit the Template heading family                |
| Code stack    | `code.default` or `code.symbols` | treat the combined declaration as Profile-owned |
| Page chrome   | `pageChrome.default`             | preserve the current Profile-only boundary      |
| Cover media   | Template cover presentation      | retain Template-owned cover typography          |

The ownership mask must be derived from the full normalized compatibility
Profile, not the bounded Profile summary exposed to Codex. Ownership means an
exact canonical role/key with a non-empty configured family. The mask is active
only when a compatibility Profile exists: direct Template fallback candidates
used without `--base-profile` must not claim ownership, while Project always
uses its normalized final Profile.

## Scope

### In scope

- direct `md pdf-template codex --base-profile`
- direct `md pdf-project codex`
- shared Template slot, theme-token, and CSS synthesis
- bounded Codex CSS-block declaration validation
- Profile role/key to CSS-slot ownership mapping
- direct bounded override and Project rejection behavior
- partial Template and complete Project bundles
- generated CSS inspection and rendered-PDF evidence
- inherited Interactive behavior through existing shared services
- focused tests, live render smoke, current guidance, and release records

### Out of scope

- new command options
- changing `fontHints: string[]`
- changing Profile role/key validity
- reversing stylesheet order
- adding `!important`
- copying Profile font stacks into Template policy
- automatic renderer or glyph-coverage guarantees
- changes to installed-font discovery or ranking from Issue #61
- redesigning base-profile candidate selection

## Implementation Approach

Derive an explicit ownership mask before CSS synthesis:

```text
normalized compatibility Profile
  -> internal CSS font-slot ownership mask
  -> materialized Template decisions
  -> conditional Template font emission
  -> family-safe bounded CSS blocks
  -> existing stylesheet order
  -> Profile family remains effective
```

The internal ownership mask should carry exact canonical non-empty role/keys
and derived CSS-slot booleans. It must remain separate from the bounded
`profileFonts` prompt/report summary and must not expose the full Profile to
Codex.

The implementation should not duplicate Profile font serialization inside the
Template. It should omit only competing Template font declarations. Because the
current body rule uses the `font` shorthand, it must preserve body size and line
height through separate declarations when the family is omitted.

Language selectors and the combined code stack require explicit handling.
`code.default` and `code.symbols` share one rendered fallback stack, so either
Profile key owns the generated code-family declaration. Template-owned cover
rules may continue consuming Template font tokens, but they must not cause a
suppressed body or heading family to reappear on Profile-owned document
selectors.

Bounded Codex CSS blocks are not a second font-decision surface. Family-bearing
declarations and Template font custom-property assignments must fail validation;
direct deliberate family overrides continue to use `template_level`
`font_decisions`, which Project can identify and reject.

## Execution Protocol

- Work one phase at a time and record the starting commit in its job record.
- Keep checklist items unchecked until implementation and matching evidence
  exist.
- Run phase-focused checks before the phase-boundary commit.
- Review the exact range from the preceding boundary through the current phase
  commit and resolve all actionable findings before continuing.
- Record generated-CSS and rendered-output evidence using repository-relative,
  public-safe descriptions.
- If reproduction or the ownership spike disproves the selected mechanism,
  update the research and plan before applying a different fix.

## Implementation Phases

### Phase 1: Reproduction And Ownership Gate

Tasks:

- [x] Add a direct Template reproduction using `--base-profile` with visibly
      distinct Profile and preset families.
- [x] Render the partial Template bundle with the same compatibility Profile
      supplied separately.
- [x] Add a Project reproduction whose final `profile.yml` and generated
      `style.css` use visibly distinct families.
- [x] Confirm generated Template CSS wins only because it appears after
      Profile-derived CSS in the existing cascade.
- [x] Classify body default, one language-tag body role, heading default, code
      default, code symbols, and page chrome.
- [x] Confirm cover title, subtitle, and byline typography is Template-owned and
      identify every generated selector that consumes body or heading font
      tokens.
- [x] Confirm bounded Codex CSS blocks can currently emit family-bearing
      declarations after synthesized CSS and record that path in the ownership
      model.
- [x] Confirm generated Template CSS emits no page-chrome font declaration and
      Profile-derived `@page` CSS remains the sole page-chrome font owner.
- [x] Verify direct Template without a compatibility Profile remains unaffected.
- [x] Record the released-tag boundary when reproducible without expanding the
      fix scope.
- [x] Review the Phase 1 commit range and resolve all actionable findings.

Phase gate:

- **Continue** — direct Template and Project reproduce the shared conflict and
  the CSS-slot ownership model explains every generated family surface,
  including cover rules and bounded CSS blocks.
- **Constrain** — only one authoring path is affected; narrow later phases and
  update the research before implementation.
- **Stop** — rendered evidence does not confirm competing generated CSS or the
  source-supported causal model is wrong; return to research.

### Phase 2: Ownership-Aware Template Synthesis

Tasks:

- [x] Derive a CSS font-slot ownership mask from the full normalized
      compatibility Profile.
- [x] Define ownership as exact canonical role/keys with non-empty families and
      activate it only for a real compatibility Profile.
- [x] Keep the mask separate from the bounded Profile font summary sent to
      Codex and from persisted prompt/report summaries.
- [x] Add a focused prompt-shape assertion that Codex receives only the existing
      bounded `profileFonts` facts and receives neither the internal ownership
      mask nor the full normalized Profile.
- [x] Thread the mask through shared Template theme/CSS synthesis without
      creating a second Profile serializer.
- [x] Replace the body `font` shorthand with declarations that preserve
      `font-size` and `line-height` when `font-family` is omitted.
- [x] Omit body, language, heading, and combined-code families only when their
      slots are Profile-owned.
- [x] Preserve preset or accepted Template families for unowned slots.
- [x] Preserve explicit direct-Template `template_level` family emission.
- [x] Keep cover title, subtitle, and byline typography Template-owned while
      preventing cover token use from restoring families on Profile-owned
      document selectors.
- [x] Reject `font`, `font-family`, and `--template-*-font` declarations in
      bounded Codex CSS blocks so `font_decisions` remains the only generated
      family channel.
- [x] Preserve the current page-chrome Profile-only boundary.
- [x] Add a focused assertion that `pageChrome.default` changes Profile-derived
      `@page` CSS without introducing a generated Template family.
- [x] Keep stylesheet order and non-font Template styling unchanged.
- [x] Add focused ownership-mask, theme-token, and generated-CSS tests.
- [x] Review the Phase 2 commit range and resolve all actionable findings.

Phase gate:

- Generated CSS contains no competing family for every Profile-owned slot.
- Codex-facing prompt facts remain bounded and exclude the internal ownership
  mask and full normalized Profile.
- Bounded CSS blocks cannot bypass the ownership mask or reported
  `font_decisions`.
- Unowned and explicit direct-override slots retain their intended families.
- Body size, line height, selectors, cover typography, and other Template
  styling remain stable.

### Phase 3: Direct Template, Project, And Interactive Integration

Tasks:

- [ ] Apply the shared synthesis behavior to direct Template generation.
- [ ] Apply the same behavior to the Project Template phase through its final
      normalized Profile.
- [ ] Preserve Project rejection of explicit Profile-owned Template overrides.
- [ ] Verify Project reports and validation use the same effective ownership
      boundary as generated CSS.
- [ ] Assert direct Template and Project report artifacts preserve their bounded
      public shapes without serializing the internal ownership mask or full
      normalized Profile.
- [ ] Verify Project cannot accept a family override hidden in a bounded CSS
      block.
- [ ] Verify direct Template reports distinguish blocked, applied, and explicit
      override decisions without claiming a generated Profile.
- [ ] Verify Interactive Template and Project authoring inherit the shared
      behavior without Interactive-only branches.
- [ ] Cover no-base-profile, ordinary hint, explicit direct override, Project
      rejection, deterministic fallback, and overflow-ownership cases.
- [ ] Cover the combined `code.default`/`code.symbols` declaration.
- [ ] Cover canonical language keys, empty configured families, Template fallback
      candidates without `--base-profile`, and Template-owned cover typography.
- [ ] Review the Phase 3 commit range and resolve all actionable findings.

Phase gate:

- Direct Template and Project share one ownership-aware synthesis path.
- Existing helper and Interactive contracts remain compatible.
- Direct Template and Project reports remain bounded and exclude internal
  ownership data.
- Project validation cannot approve CSS that contradicts its reported font
  ownership.

### Phase 4: Render Validation, Documentation, And Closeout

Tasks:

- [ ] Inspect generated `style.css` for partial Template and complete Project
      bundles.
- [ ] Render a partial Template bundle with its compatibility Profile supplied
      explicitly.
- [ ] Render a complete Project bundle using bundle discovery.
- [ ] Verify Profile fonts remain effective for body, language, heading, and
      code slots and that page chrome remains Profile-only.
- [ ] Verify `--no-default-css` remains an intentional negative boundary.
- [ ] Verify user-authored CSS can still override through the normal cascade.
- [ ] Run focused and repository-wide checks.
- [ ] Record live-render evidence for both bundle shapes. If the renderer or
      required fonts are unavailable, record the limitation and keep the plan
      `blocked` until the smoke runs in a capable environment.
- [ ] Update current guidance and release records for the fixed ownership
      contract.
- [ ] Update the related research with evidence, plan/job links, and accurate
      completion status.
- [ ] Add one end-to-end Interactive installed-font selection-to-render smoke.
- [ ] Review the Phase 4 and complete-plan commit ranges and resolve all
      actionable findings.

Phase gate:

- Both bundle shapes preserve compatibility-Profile fonts in generated CSS and
  rendered output.
- The Interactive installed-font selection reaches the same preserved render
  path.
- Negative and deliberate override boundaries remain intact.
- Documentation and recorded evidence match shipped behavior.
- No actionable review finding remains unresolved.

## Validation Plan

### Focused automated coverage

```bash
bun test \
  test/adapters-codex-markdown-pdf-template.test.ts \
  test/cli-actions-md-to-pdf-template-codex/slots.test.ts \
  test/cli-actions-md-to-pdf-template-codex/template-synthesis.test.ts \
  test/cli-actions-md-to-pdf-template-codex/action-integration.test.ts \
  test/cli-actions-md-to-pdf-project-codex/action-write.test.ts \
  test/cli-actions-md-to-pdf-project-codex/template-phase.test.ts \
  test/cli-actions-md-to-pdf-project-codex/validation.test.ts \
  test/cli-actions-md-to-pdf-actions-profile-rendering.test.ts \
  test/cli-actions-md-to-pdf-recipe-fonts.test.ts \
  test/cli-actions-md-to-pdf-bundle.test.ts \
  test/cli-interactive-markdown-pdf/font-hints.test.ts
```

Add a dedicated preservation test file if the cross-path matrix would make an
existing file too broad.

### Repository gates

```bash
bun run lint
bun run format:check
bunx tsc --noEmit
bun run build
bun test
git diff --check
```

### Manual smoke

Use `examples/playground/md-pdf/` for isolated render artifacts:

1. Generate a partial Template bundle with a compatibility Profile.
2. Inspect the generated CSS and render with that Profile supplied separately.
3. Generate and render a complete Project bundle.
4. Compare body, language, heading, and code results using visibly distinct
   Profile and preset families.
5. Inspect page chrome and confirm its family comes only from Profile-derived
   `@page` CSS.
6. Confirm cover title, subtitle, and byline retain their Template-owned
   typography.
7. Record resolved or embedded family names when the available PDF inspection
   tooling exposes them; otherwise retain a raster comparison showing the
   distinct Profile and preset results.
8. Repeat one direct Template case with an explicit `template_level` override.
9. Repeat one case with `--no-default-css`.
10. Verify a user CSS override still wins through the normal cascade.
11. Select an installed family through Interactive and verify it reaches the
    preserved render path.

Do not record local font paths, machine-specific dependency setup, or localhost
URLs in repository documents.

## Risks And Mitigations

- Risk: omitting the body font also removes size or line height.
  Mitigation: replace the `font` shorthand with separately testable declarations.

- Risk: ownership logic duplicates Profile CSS serialization.
  Mitigation: derive a boolean CSS-slot mask from the normalized Profile and
  leave font-stack serialization with the Profile renderer.

- Risk: the internal mask or full normalized Profile leaks into a Codex prompt
  or persisted report.
  Mitigation: assert the exact bounded prompt and report shapes for direct
  Template and Project paths.

- Risk: a fallback candidate used without `--base-profile` is mistaken for an
  effective compatibility Profile.
  Mitigation: gate the ownership mask on compatibility-Profile availability and
  test the no-base-profile deterministic path.

- Risk: language or code roles map incorrectly to generated selectors.
  Mitigation: test the language selector and treat either code role as ownership
  of the combined code declaration.

- Risk: cover typography loses its family or shorthand sizing when document
  families are omitted.
  Mitigation: keep cover typography explicitly Template-owned and assert its
  family, size, weight, and line height.

- Risk: bounded Codex CSS blocks bypass `font_decisions` and Project validation.
  Mitigation: reject family-bearing declarations and Template font custom
  properties in every bounded CSS-block slot.

- Risk: direct Template overrides or Project rejection behavior regress.
  Mitigation: keep those paths explicit in Phase 2 and Phase 3 fixtures.

- Risk: metadata tests pass while the rendered PDF remains wrong.
  Mitigation: inspect generated CSS and require rendered evidence for both bundle
  shapes; an unavailable render environment blocks completion rather than
  substituting for evidence.

## Expected Job Records

Create one implementation job record when Phase 1 begins:

- `docs/plans/jobs/YYYY-MM-DD-markdown-pdf-profile-font-preservation.md`

The job should record each phase boundary, validation evidence, review range,
and final disposition.

## Completion Criteria

This plan is complete only when:

- direct Template and Project reproductions confirm the affected boundary
- the full normalized Profile determines CSS-slot ownership
- Codex prompts and persisted reports remain bounded and exclude the internal
  ownership mask and full normalized Profile
- generated Template CSS omits competing Profile-owned font declarations
- bounded CSS blocks cannot introduce an unreported generated family override
- non-font Template styling remains stable
- Template-owned cover typography remains stable
- unowned slots and explicit direct overrides retain intended families
- Project continues rejecting explicit Profile-owned overrides
- body, language, heading, code, symbol, and page-chrome boundaries are covered
- partial Template and complete Project bundle renders preserve Profile fonts
- `--no-default-css` and user CSS remain deliberate boundaries
- inherited Interactive behavior requires no parallel fix
- an Interactive installed-font selection reaches the preserved render path
- focused and repository checks pass
- live-render evidence exists for both bundle shapes
- guidance, release records, research, and job links are current
- the complete-plan review has no unresolved actionable findings

## Related Research

- [Markdown PDF Font Selection and Template Preservation](../researches/research-2026-07-24-markdown-pdf-font-selection-and-template-preservation.md)
- [Markdown PDF Codex Font Patch Contract](../researches/research-2026-06-16-markdown-pdf-codex-font-patch-contract.md)
- [Markdown PDF Template Codex Helper](../researches/research-2026-06-18-markdown-pdf-template-codex-helper.md)
- [Markdown PDF Project Codex Helper](../researches/research-2026-07-03-markdown-pdf-project-codex-helper.md)
- [Markdown PDF Render Bundle Directory](../researches/research-2026-07-10-markdown-pdf-render-bundle-directory.md)

## Related Plans

- [Interactive Markdown PDF installed-font search implementation](plan-2026-07-26-interactive-markdown-pdf-installed-font-search.md)
- [Markdown PDF template Codex helper implementation](plan-2026-06-23-markdown-pdf-template-codex-helper.md)
- [Markdown PDF project Codex helper implementation](plan-2026-07-04-markdown-pdf-project-codex-helper.md)
- [Markdown PDF render bundle directory implementation](plan-2026-07-10-markdown-pdf-render-bundle-directory.md)
