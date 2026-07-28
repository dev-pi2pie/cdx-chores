---
title: "Markdown PDF Profile font preservation implementation"
created-date: 2026-07-27
modified-date: 2026-07-28
status: in-progress
agent: codex
plan: ../plan-2026-07-26-markdown-pdf-profile-font-preservation.md
---

## Scope

Execute the Markdown PDF Profile font preservation plan one phase at a time.

Phase 1 owns direct Template and Project reproductions, the generated CSS
ownership inventory, live rendered-output evidence, the released-tag boundary,
and the Continue, Constrain, or Stop gate. It does not implement the
ownership-aware synthesis fix.

## Starting Boundary

- Starting commit:
  `b3ce965d82b7c5f24d2835ac871f71ec89f8efcd`
- The worktree was clean before Phase 1 began.
- The implementation plan is `active`.
- The related research remains `in-progress`.

## Execution Protocol

1. Keep Phase 1 characterization coverage passing while it demonstrates the
   current conflict.
2. Record only repository-relative, public-safe evidence.
3. Run focused checks before each meaningful checkpoint.
4. Review the exact Phase 1 implementation range and resolve all actionable
   findings before closing the phase.
5. Do not begin Phase 2 unless the Phase 1 gate is **Continue**.

## Phase 1: Reproduction And Ownership Gate

Status: completed.

### Evidence

- Direct Template generation with a compatibility Profile retains only bounded
  Profile facts for authoring, then emits preset body, heading, and code
  families in `style.css`.
- Project generation preserves the full final Profile in `profile.yml`, but its
  Template phase emits the same effective preset family declarations.
- A Profile-only control render used distinct Profile families for body,
  heading, code, language-specific body text, and page chrome. Adding the
  generated Template CSS changed the embedded body, heading, and code families
  to Template preset fallbacks while leaving the language-specific body family
  and page chrome unchanged.
- Direct Template and Project produced identical rendered PDFs for the
  reproduction. Raster inspection confirmed the same visible typography and
  structurally valid one-page A4 output in both paths.
- Renderer integration passes Profile-derived CSS before generated Template
  CSS. The later body shorthand, heading family, and code family therefore win
  through ordinary cascade order rather than renderer-specific behavior.

### Ownership Inventory

| CSS slot                  | Current generated surface                     | Phase 1 classification                                                         |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------ |
| Body default              | preset variable plus `body` `font` shorthand  | conflicting Template output overrides Profile                                  |
| Body language             | no Template language selector today           | matching Profile selector remains effective; retain an explicit ownership slot |
| Headings                  | preset variable plus `h1` through `h6` family | conflicting Template output overrides Profile                                  |
| Code stack                | one preset variable consumed by `code`        | either Profile code key must own the combined declaration                      |
| Page chrome               | no generated Template declaration             | Profile-derived `@page` CSS remains sole owner                                 |
| Cover title               | heading variable in a cover shorthand         | Template-owned presentation                                                    |
| Cover subtitle and byline | body variable in cover shorthands             | Template-owned presentation                                                    |

Bounded Codex CSS blocks are appended after synthesized CSS and currently accept
`font`, `font-family`, and Template font custom-property declarations. They are
therefore a second generated family channel that can bypass both the proposed
ownership mask and Project validation unless Phase 2 rejects those declarations.

The deterministic direct Template path without a compatibility Profile still
emits its preset families, confirming that fallback candidates alone must not
claim ownership.

### Released Boundary

- `v0.1.5-canary.4` is the first canary containing both affected authoring
  paths.
- `v0.1.5` is the first stable release containing both affected paths.
- The causal Template synthesis files are unchanged between those two tags, so
  the same reproduction applies without expanding the fix scope.

### Verification

- Focused plan suite: 223 passed, 0 failed.
- Repository suite: 1,802 passed, 0 failed.
- Lint and formatting checks: passed.
- TypeScript check: passed.
- Build: passed.
- Generated direct Template and Project artifacts: inspected.
- Profile-only, direct Template, and Project PDFs: rendered successfully.
- Direct Template and Project PDFs: byte-for-byte comparison passed.
- Rasterized pages: visually inspected.
- PDF metadata and embedded font resources: inspected.
- Diff whitespace check: passed.

### Review

- Reviewed exact range:
  `b3ce965d82b7c5f24d2835ac871f71ec89f8efcd..d231ab5`.
- The initial review found three actionable coverage/documentation gaps:
  the direct characterization bypassed the real base-profile action path,
  language and page-chrome cascade assertions were too narrow, and the
  no-Profile control did not cover heading and code output.
- The review-fix checkpoint added the direct action reproduction, widened those
  assertions, and recorded the exact PDF comparison.
- Correctness, test, and documentation reviewers re-ran against the widened
  range and reported no remaining actionable findings.

### Gate

**Continue.** Both authoring paths reproduce the shared conflict. The ownership
inventory accounts for every current generated family surface, including the
Template-owned cover rules, the Profile-only page-chrome boundary, and bounded
CSS blocks.

## Phase 2: Ownership-Aware Template Synthesis

Status: completed.

### Scope

Phase 2 owns the internal full-Profile font-ownership model, shared
ownership-aware CSS emission, body shorthand separation, generated CSS-block
family validation, and prompt/report isolation. Direct Template and Project
production wiring remains Phase 3.

### Starting Boundary

- Starting commit:
  `fee223ce1d8b70da8fd9a34cd551915f42f91640`
- The worktree was clean before Phase 2 began.
- Phase 1 passed its **Continue** gate and exact-range review.

### Evidence

- The internal ownership mask is derived only from a real normalized
  compatibility Profile. It records canonical, non-empty role keys plus their
  document CSS slots without entering bounded signals, synthesis results, or
  report types.
- Shared synthesis now accepts the mask as an internal input. Profile-owned
  body, language, heading, and combined-code declarations are omitted, while
  unowned slots and explicit `template_level` decisions retain Template family
  output.
- Body typography now emits size and line height separately, so suppressing its
  family does not remove non-font styling.
- Template font tokens remain available to cover title, subtitle, and byline
  rules without restoring families on Profile-owned document selectors.
- Either `code.default` or `code.symbols` owns the combined code stack.
  Explicit overrides restore every shared code-family selector after inherited
  code styling.
- Generated CSS blocks reject direct and indirect family resets, nested rules,
  and escaped or comment-split validation bypasses. Non-family typography
  declarations and reads of Template font variables remain valid.
- Prompt-shape coverage confirms Codex receives only the bounded
  `profileFonts` summary. The full Profile and internal ownership mask remain
  outside the prompt and persisted artifact contracts.
- Profile-derived `@page` font CSS remains the only page-chrome family surface;
  Template CSS still emits page layout without a page-chrome family.

### Verification

- Focused Phase 2 ownership, synthesis, and adapter tests: 68 passed, 0
  failed.
- All six Phase 2-modified test files: 103 passed, 0 failed.
- Repository suite: 1,814 passed, 0 failed.
- TypeScript check: passed.
- Lint and formatting checks: passed.
- Build: passed.
- Diff whitespace check: passed.
- No renderer smoke was required for this internal synthesis phase; production
  authoring-path and rendered-output verification remains in later phases.

### Review

- Reviewed exact range:
  `fee223ce1d8b70da8fd9a34cd551915f42f91640..f73b0fb9b2ab4a0a02c51f598f2e88d1ca699f20`.
- The initial correctness, security, maintainability, and test reviews found
  actionable gaps in combined-code override coverage, CSS lexical and nesting
  defenses, ownership-query consistency, and mixed language/code test
  coverage.
- Widened review passes identified and resolved CSS-wide resets, escaped path
  references, declarations after nested rules, and quoted/comment brace
  handling.
- Final correctness, security, maintainability, and test reviews reported no
  remaining actionable findings.

### Gate

**Passed.** Internal synthesis omits every Profile-owned document family,
bounded CSS cannot introduce an unreported family override, prompt/report
contracts remain bounded, explicit overrides remain deliberate, and non-font
Template styling remains intact. Phase 3 may wire the shared behavior into
direct Template and Project production paths.

## Phase 3: Direct Template, Project, And Interactive Integration

Status: completed.

### Scope

Phase 3 wires the internal ownership mask into direct Template preparation and
the Project Template phase, makes Project compatibility validation derive the
same ownership boundary from the final normalized Profile, and verifies that
Interactive authoring inherits both paths without a separate ownership branch.
Public signal and report schemas remain unchanged.

### Starting Boundary

- Starting commit:
  `e3b4d1aa226e2394b906b7066d0352f0de862ca6`
- The worktree was clean before Phase 3 began.
- Phase 2 passed its gate and exact-range review.

### Evidence

- Phase 3 landed in five checkpoints after the Phase 2 range:
  - `899adf4` — wire ownership into direct Template generation.
  - `d9b8650` — enforce project font ownership.
  - `f6c92db` — cover interactive ownership inheritance.
  - `ec40282` — defer template adapter loading in the project phase.
  - `53a1811` — validate the emitted Project stylesheet against final-Profile
    ownership.
- Direct Template and Project now derive one shared ownership-aware synthesis
  path from the real normalized Profile.
- Public signal and report schemas stay bounded; the internal ownership mask is
  not serialized into prompt, signal, or report artifacts.
- Project validation recomputes the effective ownership boundary from the final
  normalized Profile and rejects hidden family overrides in bounded CSS blocks.
- Project validation also compares the synthesized stylesheet against the final
  normalized Profile, so forged CSS cannot bypass ownership checks when font
  decisions are absent.

### Verification

- Focused Phase 3 suites: 436 passed, 0 failed across 37 files.
- Full repository suite: 1,824 passed, 0 failed across 228 files.
- `bun run lint` passed.
- `bun run format:check` passed.
- `bun run build` passed.
- `git diff --check` passed.

### Review

- Exact range reviewed:
  `e3b4d1aa226e2394b906b7066d0352f0de862ca6..53a1811cf3f6e4898265da97dd124290535876de`.
- The initial correctness review found that Project validation trusted
  decision metadata without independently checking the emitted stylesheet.
- The widened correctness, security, maintainability, and test reviews reported
  no remaining actionable findings after stylesheet re-synthesis validation
  and its mutation regression landed.

### Gate

Passed.

## Phase 4: Dedicated Render Smoke Validation

Status: reopened.

### Scope

Phase 4 adds a repeatable Issue #60 smoke harness and validates the fixed
ownership contract through real Profile-only, partial Template, complete
Project, deliberate override, cascade-boundary, and Interactive renders. Local
render artifacts and machine-specific setup remain outside repository records.

### Starting Boundary

- Starting commit:
  `a50a723ef57d24054b964b306ae75cc6fa63326a`.
- The worktree was clean before Phase 4 began.
- Phase 3 passed its gate and exact-range review.

### Harness Evidence

- The tracked harness plans and runs a stable scenario matrix around
  operator-supplied local Markdown and compatibility Profile inputs. Neither
  input is assumed to be tracked.
- Cleanup is restricted to a marked, direct generated-output child. The
  harness atomically detaches an owned target before recursive removal and
  validates canonical containment before writing a new target.
- Missing inputs, input aliases inside the cleanup target, symlinked targets,
  unrelated paths, and absent or mismatched ownership markers fail closed.
- Ordinary Template and Project generation is deterministic. The
  Codex-assisted explicit-override scenario requires a separate opt-in, and
  Interactive remains an intentional live manual scenario.
- Missing renderer commands return a stable unavailable classification instead
  of converting an incomplete smoke into success.

### Live Render Evidence

- The Profile-only control, partial Template bundle with an explicit Profile,
  and complete Project bundle through discovery all rendered as valid
  three-page A4 PDF 1.7 documents.
- Generated partial-Template and complete-Project stylesheets differed only in
  artifact identity. Both omitted competing body, language, heading, code, and
  page-chrome family declarations while preserving non-font document styling
  and Template-owned cover font tokens.
- Embedded PDF resources resolved the operator-supplied Profile families for
  labeled body, language, heading, code, and page-chrome slots. Raster review
  found no missing glyphs, clipping, overlap, or unreadable content.
- The partial Template and complete Project body pages were pixel-identical,
  confirming the explicit and discovery render shapes reached the same
  preserved path.
- Cover title, subtitle, and author byline retained Template-owned typography.
  A Codex-assisted direct Template case applied and reported one explicit
  `template_level` heading override from an operator-supplied installed family
  without changing the remaining Profile-owned slots.
- `--no-default-css` produced the expected negative-boundary result, and
  user-authored CSS remained able to load the generated Template styling first
  and then override it through normal cascade order.
- Interactive selected an installed suggestion from the local font inventory,
  applied it to the generated Project Profile body slot, omitted the competing
  Template body declaration, and rendered a valid two-page A4 PDF. Embedded
  resources and raster review confirmed that the selected family reached the
  output while multilingual text and code remained readable.
- No smoke finding required a product-contract change or a new plan task.

### Verification

- Smoke harness suite: 18 passed, 0 failed.
- Focused plan suite: 190 passed, 0 failed across 12 files.
- Full repository suite: 1,842 passed, 0 failed across 229 files.
- `bun run lint` passed.
- `bun run format:check` passed.
- `bunx tsc --noEmit` passed.
- `bun run build` passed.
- `git diff --check` passed.
- Generated CSS, reports, PDF metadata, embedded font resources, and rasterized
  pages were inspected.

### Review

- Exact range reviewed:
  `a50a723ef57d24054b964b306ae75cc6fa63326a..a000c63f95d08c3a3f4bb05a9c287e0f6069026c`.
- Review fixes made the Markdown input explicit and local, aligned successful
  execution with the emitted plan, covered failed-command short-circuiting,
  and removed every tracked-fixture assumption.
- Cleanup review fixes limited mutation to an owned direct child, added exact
  marker checks, atomically detached owned targets before removal, validated
  the full symlink component chain, and rechecked canonical containment before
  the first generated write.
- Fresh-checkout coverage proves the ignored output root can be created safely,
  and successful runs can be cleaned immediately without manual setup.
- Shared implementation-derived test expectations and reuse of the older,
  weaker fixture cleanup policy were not adopted because independent contract
  assertions and this stricter ownership boundary are intentional.
- Final widened correctness, security, maintainability, and test reviews
  reported no unresolved actionable findings.

### Original Gate

Passed.

### Reopened Follow-up

Status: Phase 4 follow-up complete; Phase 4 gate passed.

The original Phase 4 matrix proved Profile-owned omission, Project parity,
explicit Template-level override behavior, user CSS precedence, and Interactive
inheritance. It did not directly render an ordinary no-Profile `--font-hint`
through generated Template `style.css`. That missing side of the cascade
contract means Phase 4 is reopened rather than treating automated synthesis and
action coverage as complete live evidence.

Reopening boundary:

- Starting commit:
  `10773d98ed69ba26cda948cca2174906df5aea6f`.
- The worktree was clean before the follow-up began.
- Original Phase 4 artifacts and review results remain valid historical
  evidence.

Follow-up execution boundary:

- Starting commit:
  `08d682575ea0bab33514e5fc8b65d02347d09fb5`.
- `8936e56` added repeatable ordinary-hint scenarios for direct Template,
  Profile-owned Template, and Project generation.
- `41f1992` corrected those scenarios to require the existing explicit
  Codex-assisted opt-in before the live run.
- `c6887a1` recorded the public-safe live evidence and repository verification.
- `1ca86cf` resolved review feedback by deriving commands, scenarios, and
  inspection paths from one descriptor table.
- `20499a5` pinned the exact hinted render commands and inspection surfaces in
  the harness tests.

Follow-up evidence:

- Direct Template generation without a compatibility Profile applied five
  ordinary body, heading, language, code, and symbol hint decisions. Generated
  CSS emitted the corresponding document families, and labeled PDF resources
  resolved those families.
- Repeating the same hints with a Profile that owned every exact role/key
  blocked all five ordinary decisions. Generated CSS omitted competing body,
  language, heading, and combined-code document families, while PDF resources
  resolved the Profile body, language, heading, code, and page-chrome families.
- Project generation persisted the five reusable families in `profile.yml`.
  Its generated Template stylesheet omitted competing document families, all
  seven Project compatibility checks passed, and the rendered PDF resolved the
  Project Profile families.
- The explicit direct Template-level decision remained an applied,
  Profile-overriding heading decision. User-authored CSS still replaced body,
  heading, and code families through the later stylesheet position without
  changing Profile page chrome.
- The unchanged renderer order remains Profile-derived CSS first and the
  generated or user stylesheet second. Preservation comes from generated
  document-family omission for owned slots, not from reversed priority.
- The completed run executed all 15 planned commands. Generated bundles,
  reports, HTML, PDFs, a machine-readable observation summary, and rasterized
  representative pages remain in the ignored smoke workspace.
- Raster review found readable multilingual and symbol glyphs with no clipping,
  overlap, or missing content. Local font resources and environment setup
  remain outside repository records.

Follow-up verification:

- Focused ownership and smoke suite: 262 passed, 0 failed across 12 files.
- Full repository suite: 1,847 passed, 0 failed across 229 files.
- `bun run lint` passed.
- `bun run format:check` passed.
- `bunx tsc --noEmit` passed.
- `bun run build` passed.
- `git diff --check` passed.

Follow-up review:

- Correctness, security, maintainability, test, and documentation reviewers
  reviewed
  `08d682575ea0bab33514e5fc8b65d02347d09fb5..20499a5`.
- One maintainability finding about duplicated scenario wiring was resolved by
  the descriptor-table refactor.
- Two test-review findings about render-command and inspection-list coverage
  were resolved with exact independent assertions.
- The final widened review reported no unresolved actionable findings.
- The reopened Phase 4 gate passed. Phase 5 remains reopened and was not
  entered during this follow-up.

## Phase 5: Documentation And Closeout

Status: Phase 5 follow-up validation complete; exact-range review pending.

### Scope

Phase 5 aligns current public guidance, research, the implementation plan, and
this job with the implemented ownership contract and Phase 4 render evidence.
It closes this documentation lifecycle only after focused, repository, Phase 5,
and complete-plan reviews pass. Stable release-note authoring, PR creation,
Issue #60 communication, pushing, and merging remain separate later work.

### Starting Boundary

- Starting commit:
  `3e2d087ff310813f5a63a5b1ec94d54078754433`.
- The worktree was clean before Phase 5 began.
- Phase 4 passed its gate and exact-range review.

### Documentation Contract

- The implementation plan now records the confirmed before-and-after flow:
  generated Template CSS previously overrode earlier Profile CSS through the
  normal cascade; ownership-aware synthesis now omits competing document
  families while preserving non-font styling and Template-owned cover
  typography.
- Template guidance explains that preservation comes from ownership-aware
  output rather than higher Profile cascade priority.
- Project guidance explains that the final Profile determines both generated
  omission and stylesheet re-synthesis validation.
- General usage guidance keeps deliberate user CSS and `--no-default-css`
  outside the preservation guarantee.
- The related research records the reproduced version boundary, selected fix,
  implementation evidence, and final review disposition.
- Stable release notes remain governed by the later stable release workflow;
  Phase 5 does not create a future stable-tag record or perform PR/Issue work.

### Verification

- Focused ownership and smoke suite: 260 passed, 0 failed across 12 files.
- Full repository suite: 1,845 passed, 0 failed across 229 files.
- `bun run lint` passed.
- `bun run format:check` passed.
- `bunx tsc --noEmit` passed.
- `bun run build` passed.
- Markdown relative-link checks passed for the six changed lifecycle and
  guidance documents.
- Public-safety scanning found no added local workspace path, font file path,
  machine-specific dependency setup, or localhost reference.
- `git diff --check` passed.
- Phase 4 live-render evidence remained authoritative because Phase 5 changed
  documentation and regression coverage without changing runtime behavior.

### Review

- Phase 5 substantive range reviewed:
  `3e2d087ff310813f5a63a5b1ec94d54078754433..d6c20d82c4ba3eb5425af0e8230bda3d87f6b73c`.
- Complete implementation range reviewed:
  `b3ce965d82b7c5f24d2835ac871f71ec89f8efcd..d6c20d82c4ba3eb5425af0e8230bda3d87f6b73c`.
- The initial correctness and documentation reviews found stale research
  summary wording, one stale release-record completion criterion, and four
  stale `modified-date` values.
- The initial test review found missing coverage for Codex-assisted Project
  stylesheet re-synthesis, an explicit `body.default` Template-level override,
  and smoke `run` refusal for unowned or corrupt-marker targets.
- Those accepted findings were corrected in `d6c20d8`; the widened correctness,
  test, documentation, security, and maintainability reviews reported no
  remaining actionable findings.
- The maintainability review's initial suggestions to remove independent
  Project re-synthesis validation or consolidate the bounded CSS and smoke
  safety helpers were not adopted. Independent re-synthesis closes a proven
  metadata-trust gap, while the parser and filesystem checks preserve narrow
  defense-in-depth boundaries. The widened re-review confirmed that these
  choices do not block closeout.

### Original Gate

Passed.

### Reopened Follow-up

The original Phase 5 verification and reviews remain valid for their recorded
ranges. After the reopened Phase 4 gate, Phase 5 must record the new smoke
result, update current guidance and lifecycle evidence, rerun appropriate
documentation and repository checks, and review the widened Phase 5 and
complete-plan ranges before any lifecycle document returns to `completed`.

Reopened starting boundary:

- Starting commit:
  `0536fe4`.
- The worktree was clean before the Phase 5 follow-up began.
- Phase 4 passed its reopened gate and exact-range review.

Reopened documentation result:

- The ordinary no-Profile Template path emits accepted font hints through
  generated `style.css`.
- The same ordinary hints remain omitted for slots owned by a compatibility
  Profile, without changing stylesheet order.
- Coordinated Project hints persist as reusable ownership in `profile.yml`
  while generated `style.css` remains non-competing.
- Explicit Template-level and user-authored CSS remain deliberate later
  overrides.
- The new evidence confirms the implemented contract; no implementation
  correction or return to discussion is required.
- Template, Project, general usage, and Interactive guidance now describe the
  relevant artifact ownership and cascade boundaries.
- The related research no longer describes the completed Phase 4 proof as
  missing.
- PR creation, release-note authoring, and Issue #60 communication remain
  outside this Phase 5 closeout.

Reopened verification:

- Phase 4 live-render evidence remains authoritative because the Phase 5
  follow-up changes documentation only.
- Focused ownership and smoke suite: 262 passed, 0 failed with 2,243
  assertions across 12 files.
- Full repository suite: 1,847 passed, 0 failed with 9,963 assertions across
  229 files.
- `bun run lint` passed.
- `bun run format:check` passed.
- `bunx tsc --noEmit` passed.
- `bun run build` passed.
- Markdown relative-link checks passed for the seven changed lifecycle and
  guidance documents.
- Public-safety scanning found no added local workspace path, font file path,
  machine-specific dependency setup, or localhost reference.
- `git diff --check` passed.

## Checkpoint Commits

### Phase 1

- `f98215e` — characterize the shared direct Template and Project conflict.
- `d231ab5` — resolve Phase 1 review gaps and widen regression coverage.

### Phase 2

- `4ad465c` — add the ownership-aware synthesis model and focused coverage.
- `8ab785d` — resolve combined-code, ownership-query, and validator review
  findings.
- `8fd1731` — reject CSS-wide family resets and escaped path bypasses.
- `21ebebe` — reject nested generated CSS rules.
- `f73b0fb` — make brace inspection safe for quoted and commented content.

### Phase 3

- `899adf4` — wire ownership into direct Template generation.
- `d9b8650` — enforce project font ownership.
- `f6c92db` — cover interactive ownership inheritance.
- `ec40282` — defer template adapter loading in the project phase.
- `53a1811` — reject Project stylesheets that differ from ownership-aware
  synthesis.

### Phase 4

- `47def3c` — add the explicit-input Profile font-preservation smoke harness.
- `fe92701` — harden canonical resources and ownership-gated cleanup.
- `c4f4f74` — cover failed commands and ownership recovery.
- `52cd8ed` — create and verify a missing ignored smoke root safely.
- `a000c63` — enforce canonical output containment before generated writes.
- `8936e56` — add the ordinary-hint ownership smoke scenarios.
- `41f1992` — require explicit Codex assistance for the hinted scenarios.
- `c6887a1` — record public-safe ordinary-hint smoke evidence.
- `1ca86cf` — derive the hinted smoke plan from one descriptor table.
- `20499a5` — pin hinted render commands and inspection surfaces.

### Phase 5

- `cf86ca9` — align guidance and lifecycle docs with the ownership contract.
- `d6c20d8` — close whole-range test and documentation review gaps.

## Related Documents

- [Markdown PDF Profile font preservation implementation](../plan-2026-07-26-markdown-pdf-profile-font-preservation.md)
- [Markdown PDF Font Selection and Template Preservation](../../researches/research-2026-07-24-markdown-pdf-font-selection-and-template-preservation.md)
