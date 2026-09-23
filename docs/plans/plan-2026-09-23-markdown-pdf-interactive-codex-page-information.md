---
title: "Markdown PDF Interactive Codex Page Information Implementation"
created-date: 2026-09-23
modified-date: 2026-09-23
status: active
agent: codex
---

## Goal

Let Interactive Codex Assistant collect exact page-number and repeating
header/footer text choices when preparing a Markdown PDF Profile or Project.
Apply those choices to the final Profile before review, save, or Project
Template preparation. The [research](../researches/research-2026-09-22-markdown-pdf-interactive-codex-page-information.md) owns the full
answer, default, and page-role contract; this plan organizes implementation
and evidence.

This work adds no direct command flags, Profile fields, renderer behavior,
Template-owned page settings, or model-generated clarification round. The
existing Interactive one-render page-number override remains separate from
reusable Profile policy.

## Starting Boundary

- `src/cli/interactive/markdown/codex-setup.ts` collects the optional sample,
  intent, base Profile, and font hints, but no structured page information.
  The base Profile is currently selected from the setup menu after the initial
  sample and intent prompts. `codex-authoring.ts` compares setup values before
  reusing a prepared candidate.
- `formal-guide/` already has the guided labels, positions, placeholder help,
  and clear-or-retain conflict prompt. Its current repeating-content OFF path
  can retain an occupied reserved slot; explicit Interactive Codex OFF must
  clear all six content slots.
- `profile-codex/signal-mode.ts` classifies sample, intent, font hints, and a
  base Profile. `project-codex/signal-mode.ts` may reject a run with no
  recognized signal. Neither admits page-information-only input today.
- Interactive currently asks for Codex consent before helper preparation and
  describes a request as completed even when preparation was deterministic.
  Project Template model need can also depend on directions returned by its
  Profile phase.
- `project-codex/profile-phase.ts` hands `finalProfile` to
  `project-codex/template-phase.ts`. Exact answers must be applied and
  validated at that handoff; standalone Profile preparation must use the same
  rule before report construction and save.
- `codex-execution-configuration.md` already documents the command-local
  `--codex-model` option. It selects a model for actual requests; it does not
  cause a deterministic path to call Codex.
- [CLI Output And Color](../guides/cli-output-and-color.md) owns the existing
  per-stream picocolors rules. New Markdown PDF setup, consent, review, and
  warning lines must retain canonical plain text and current stream routing.

## Product Contract

| Group                  | Unspecified                              | OFF                                                              | ON                                                                                                  |
| ---------------------- | ---------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Page numbers           | Preserve base/candidate or Codex choice. | Disable numbers while retaining valid inert details.             | Set the chosen body/document outcome, label, and position; use start and increment of 1.            |
| Repeating page content | Preserve base/candidate or Codex choice. | Clear all six text slots; retain header/footer styles and fonts. | Set selected slots exactly; clear unselected slots except an explicitly retained reserved conflict. |

Fresh page-number ON defaults to body pages starting at 1, `Page {page}`, and
bottom center. Page numbers and repeating content share six positions. The
number position cannot receive new repeating text. An inherited occupied
position offers explicit clear or retain, defaulting to retain; a retained
conflict is visible in review and its text is not promised to render. Repeating
content OFF clears that position without a conflict prompt.

Each group can return to unspecified through `Remove explicit choice`, leaving
the other group's answer intact. Reprepare from the original base/default and
current signals, not from the previously overlaid candidate. Recheck conflicts
after normalization: unresolved collisions involving explicit choices return
to local revision before acceptance or Project Template preparation, following
research decision 6. Both groups unspecified keep existing helper behavior.

Both groups are optional and independent. Exact answers outrank free-form
intent and model suggestions. Entered text and metadata placeholders are sent
as bounded structured data when a model request is needed, but local
materialization preserves the entered values exactly. Page-information-only
Profile and Project preparation, with or without a base Profile, is
deterministic. Other signals keep their existing phase-selection rules.

The preparation order is:

```text
Interactive setup and review
  -> classify signals and obtain consent if a model request is needed
  -> resolve Profile from default/base values and optional Codex decision
  -> apply exact page-information answers locally
  -> normalize and check conflicts; unresolved -> local setup revision
  -> validate final Profile
  -> Project only: prepare Template from that final Profile
  -> review, save, or render through the existing lifecycle
```

This is the target flow after Phase 4 connects page information to the normal
Interactive lifecycle. The phase gates below govern when each part becomes
available; earlier phases exercise the new choices through internal harnesses.

## Implementation Approach

- Keep unspecified answers absent in typed Interactive setup. Store explicit
  OFF/ON and entered text separately from free-form intent, so omission cannot
  become a default or an implicit clear during revision or requests. Reported
  state follows the metadata-only projection in the research.
- Reuse Formal Guide prompt controls and Profile compilation where their
  behavior matches. Give explicit Interactive OFF its own clearing policy so
  the existing Formal Guide reserved-slot exception does not change silently.
- Use the helper's existing signal classification for request decisions. Page
  information is sufficient input but never a reason by itself to call Codex.
  Do not create an unrelated Interactive heuristic for consent.
- Apply exact answers once at the Profile boundary shared by standalone
  Profile and Project preparation. The overlay is optional internal helper
  input supplied only by Interactive; direct invocations retain their current
  behavior. Build review and saved artifacts from the same validated final
  Profile. Use the separately defined report projection; the final Profile is
  not itself a safe diagnostic-report payload.
- Keep the existing Project Profile-then-Template order, renderer capability
  advisories, and save/render/recovery lifecycle. Reuse the completed renderer
  evidence unless effective HTML/CSS or render behavior changes.

## Prerequisite Contract Gate

Complete this gate before starting Phase 1. The saved Profile keeps exact
page text, and Codex receives it after consent only when a request is needed.
The existing optional Profile or Project Codex diagnostic report gains
page-information metadata but omits the entered page-number label and
header/footer text, including echoes in Codex results. The
[research](../researches/research-2026-09-22-markdown-pdf-interactive-codex-page-information.md#report-data-contract)
defines the allowed metadata. Page information needs no generated filesystem
path or change to the shared path redactor.

- [x] Trace each answer from collection through consent, model input, final
      Profile, candidate review, and optional report. Mark which surfaces need
      exact text and which may retain a durable copy.
- [x] Decide the optional Profile and Project report fields, including
      requested versus validated final stored values, model-result omission,
      and structural reader compatibility. Define synthetic acceptance cases
      here and run them when Phase 4 adds the projection; verify existing
      reader compatibility at this gate without
      introducing real local paths.
- [x] Show entered page text in local consent and entered or model-proposed
      text in candidate review, with terminal controls and Unicode formatting
      characters escaped. Keep this separate from report retention and color
      styling.
- [x] Define the first rendered-PDF review after Phase 3, the saved-recipe
      comparison after Phase 4, and the final Phase 5 matrix. Identify the
      page snapshots to show before owned test artifacts are cleaned.
- [x] Review the revised research and plan contract before implementation.
      Record the decision and its evidence in the single
      [implementation job record](jobs/2026-09-23-markdown-pdf-interactive-codex-page-information.md).

Gate: report and local review text boundaries, terminal presentation, and
rendered-artifact checkpoints are explicit and reviewable. No implementation
phase begins while a text-retention or display decision is open.

Local consent and review display the text with terminal controls escaped. For
explicit page-information runs, the existing optional reports keep choice and
final stored metadata but mark model-result detail omission. They copy no
structured page text or Codex echo. Repeating-content positions describe
stored Profile slots, not rendered text; retained number-slot conflicts are
marked. Do not assign provenance to stored slots in the report; local review
may show it when verified. The omission marker follows actual model attempts,
including failure before or after a call. Existing free-form intent and
font-hint report fields keep their current retention; users can independently
repeat the same text there. Local review must use the in-memory preparation
and validated Profile, not the text-limited optional report, so report
omissions do not remove visible warnings or fallback details.

Phase 4 acceptance cases use synthetic label and slot markers, including ESC,
a C1 control, a bidirectional formatting control, and Unicode line and
paragraph separators. Assert exact Profile round trips, readable escaped
local reviews, absence of a marker placed only in structured page text from the
entire serialized report even when the model echoes it, an omission marker
consistent with actual calls across deterministic, pre-call failure, attempted
failure, and success paths, and accurate requested/final stored metadata after
clear, retain, OFF, and failure. Assert that a retained number-slot conflict
is not called rendered and no slot provenance is inferred.
Run an independent case with a different marker in free-form intent to prove
that field's current retention is unchanged. The Profile version-4 reader must
accept the additive projection, and Project bundle recognition must still
identify its report. Direct-command reports retain their current behavior.
Phase 1–3 checks cover their own earlier boundaries.

## Terminal And Render Evidence Rules

Use the shared per-stream picocolors wrapper and existing diagnostic-label
helper for new terminal output. Style only fixed labels or headings; style
`Warning:` without styling its message or user-entered text. Preserve the same
words, spacing, and stream routing when ANSI is removed. Runtime color,
`NO_COLOR` including an empty value, global `--no-color`, and each target
stream's TTY state control eligibility; `FORCE_COLOR` does not override them.
Escape control and formatting characters, including C0/C1, bidirectional
controls, and Unicode line and paragraph separators, in untrusted text before
display. Do not mask path-like page text in local consent or review. Keep ANSI
out of JSON, reports, saved recipes, and PDFs. Check these rules as each new
terminal surface appears, including setup and consent in Phases 1–2, conflict warnings
in Phase 3, and candidate and handoff review in Phase 4.

At the Phase 3, 4, and 5 gates, render real PDFs from synthetic Markdown and
the accepted Profile or Project artifact. Check extracted text and rasterized
pages, then display labeled PNG snapshots in the conversation before marking
the phase complete; a text-only claim or a file path is insufficient. Phase 3
owns the first visual proof, Phase 4 compares a render from the saved recipe
and one-render override, and Phase 5 owns the wider page-role matrix and
built-CLI smoke. Keep selected review PNGs available until the visual review
closes; clean only owned temporary PDFs and scratch meanwhile. Do not commit
generated media or record local artifact paths in public docs. The unified job
records public-safe visual conclusions and cleanup, not the images themselves.
If rendering is unavailable or a visual mismatch remains, record the limit or
finding and leave the corresponding phase gate open.

The snapshot set is fixed before implementation:

| Gate | Pages to show | Evidence to compare |
| ---- | ------------- | ------------------- |
| Phase 3 | Cover, ToC, first body, and later body pages from an accepted Profile or Project, including a retained occupied number slot | Extracted number labels and repeating text; visible placement; retained slot text absent where numbering owns its position |
| Phase 4 | Corresponding body pages from a saved recipe with numbers ON and a one-render number-OFF override | Same saved page text and styling; numbers absent only in the override; saved recipe unchanged |
| Phase 5 | Representative cover, ToC, and body pages from the integrated matrix and built CLI smoke | Page-role boundaries, number scope, header/footer positions, and any visual mismatch |

Show labeled PNGs inline at each gate before clearing it. Keep those review
copies through the user discussion, then clean only generated files owned by
the verification run.

## Implementation Phases

Keep the new page-information path out of the normal Interactive save/render
flow while its contracts are incomplete. Phases 1–2 exercise collection,
signals, and consent through focused harnesses; Phase 3 uses the internal path
to validate, save, and render exact Profile/Project artifacts without retaining
an optional Codex diagnostic report. Phase 4 connects the path to the normal
Interactive lifecycle only after candidate review and the report omission
contract pass their checks. Direct commands retain their existing behavior.

### Phase 1: Sparse Answers And Guided Collection

- [x] Add separate typed page-number and repeating-content answers to the
      internal Profile and Project Codex setup collector. An absent group means
      unspecified; explicit OFF and ON retain their own values through
      revision. Do not wire the collector into the normal Interactive route
      yet. Template-bundle setup does not acquire these answers.
- [x] In the collector, ask whether to specify page information after optional
      sample selection and before PDF intent. Within selected groups, reuse
      Formal Guide's body/document choices, page-number labels, six positions,
      literal text, and placeholder help. Use Profile wording for the
      contained Project Profile without adding a Project Formal Guide mode.
- [x] Add a Page information setup action in the collector with separate group
      edits. Preselect eligible occupied base-Profile positions on first edit
      when a base is already selected. If the base is chosen later, re-evaluate
      on revision without replacing earlier explicit content choices or adding
      new slots to an explicit ON selection. Newly occupied eligible base slots
      remain unselected and clear unless selected during revision; OFF still clears
      all slots. Recheck the reserved slot after base or number-position changes.
- [x] Add `Remove explicit choice` per group for ON/OFF-to-unspecified
      revision. Preserve the other group's answers, discard obsolete conflict
      decisions, and distinguish removal from OFF or cancelling an edit.
- [x] Reuse the clear-or-retain prompt for an occupied number position,
      defaulting to retain. Prevent new text in that position. Give explicit
      repeating-content OFF a six-slot clear with no conflict question; keep
      the existing Formal Guide reserved-slot exception unchanged.
- [x] Add focused collection, prompt-order, revision, cancellation, and
      Formal Guide compatibility tests under `test/markdown-pdf/interactive/`.
      Cover later base selection/replacement separately from first-edit base
      preselection, including newly occupied eligible slots under ON and OFF.

Phase gate: the collection harness keeps omission, OFF, and ON distinct across
first setup, base selection, and revision; the existing Formal Guide path and
Template setup remain unchanged; Back/Cancel writes nothing. No partial
page-information candidate can enter the normal save/render/report path.

### Phase 2: Signal Classification And Request Consent

- [x] Carry the sparse answers as bounded structured signals through internal
      Interactive Profile and Project preparation. Check a finite length limit
      for each entered page-number label and repeating-content field before
      preparation; reject over-limit input instead of truncating it. Send
      accepted text unchanged, with metadata placeholders unresolved and
      separate from advisory PDF intent.
      Do not add direct-command flags or serialize a second Profile schema.
- [x] Make page information sufficient input for both helpers without making
      it a model trigger. Profile and Project page-information-only paths, with
      or without a base Profile, use deterministic Profile preparation; Project
      also uses deterministic Template preparation. Sample, intent, font hints,
      and Template-owned directions retain their existing mode rules.
- [x] Drive Interactive consent from the same phase classifications used by
      preparation. Skip model consent for deterministic-only work. When a
      Project Template request may depend on Profile-phase directions, keep
      consent before the first possible request and describe possible phases
      without claiming both will run. Report the actual phase modes afterward.
- [x] Present the entered text a request would send according to the decided
      local consent display policy. Keep the one session `codexExecution`
      selection through actual requests, retries, and regeneration; the option
      alone must not create a request.
- [x] Test signal modes, too-low-signal admission, consent/no-consent, request
      counts, model-option forwarding, and Project phase combinations with
      injected runners in the Profile, Project, and Interactive suites.
- [x] Reclassify after removal, including removal of the last explicit group:
      restore the existing default/base and too-low-signal rules rather than
      treating an empty page-information container as sufficient input.

Phase gate: injected Profile, Project, and Interactive harnesses show that
page-information-only preparation makes zero model requests and needs no Codex
consent; mixed-signal preparation asks consent before any request and retains
current model-selection rules. Final candidate content and Project Template
handoff belong to Phase 3; normal save/render/report remains unavailable for
the new page-information path.

### Phase 3: Exact Profile Materialization And Project Handoff

- [ ] Add one shared local application step for the two groups after the
      default/base/Profile-Codex decision. Call it only when Interactive passes
      explicit answers. Keep direct `md pdf-profile codex` and
      `md pdf-project codex` behavior unchanged when the optional input is
      omitted.
- [ ] For number ON, compile the chosen scope and count origin together,
      `start: 1`, `increment: 1`, exact label, and position. Number OFF changes
      enablement and retains valid inert details. An unspecified group changes
      nothing.
- [ ] For repeating-content ON, set selected text exactly, clear unselected
      slots, and retain the reserved slot only after an explicit retain choice.
      OFF clears all six slots, including an occupied reserved position, while
      preserving header/footer styles and `fonts.pageChrome.default`.
- [ ] Apply the step to standalone Profile preparation before acceptance or
      write. Apply it inside the Project Profile phase before Template
      preparation, binding, or write. Do not retain an optional Codex diagnostic
      report from this internal path; Phase 4 owns its safe projection. Normalize and
      validate the same final Profile used by all those consumers; retain
      existing patch, capability-advisory, and diagnostic behavior. Authoring
      itself does not probe the installed renderer; the phase render check is
      separate QA.
- [ ] Return unresolved normalized slot conflicts to Interactive revision
      before acceptance or any Project Template preparation. Keep prompts in
      Interactive. Protect explicit text from model-selected numbering; offer
      number/text revision for explicit text and clear/retain for inherited or
      model-selected text, as specified in research decision 6. Record a
      slot-specific resolution without implicitly specifying the whole content
      group; bind it to the position and exact text, and recheck on regeneration.
      Apply valid resolutions locally and revalidate. Both groups unspecified
      retain existing behavior; do not automatically retry the model.
- [ ] Align the Profile helper prompt with logical `{page}` / `{pages}` and
      physical `{pdfPage}` / `{pdfPages}` terms. Test local exact authority over
      conflicting intent and injected Codex decisions, base preservation,
      clear/retain behavior, font-hint coexistence, Profile YAML/JSON round
      trips, and Project Template compatibility.
- [ ] Render representative accepted Profile and Project results through the
      existing `md to-pdf` path using synthetic Markdown. Extract page text and
      inspect PNGs for numbering, repeating content, and retained-slot
      non-rendering, including relevant cover/ToC/body pages. Show labeled
      snapshots to the user before Phase 3 closeout and retain the review
      copies until that discussion closes.

Phase gate: an internally accepted Profile matches every explicit answer after
normalization; unresolved conflicts cannot reach acceptance or Project Template
preparation; Project Template preparation consumes that Profile; bundle and
saved Profile values agree; the first rendered pages and extracted text match
that Profile and their snapshots have been reported; the internal path retains
no optional Codex diagnostic report; page-information answers remain
inaccessible through normal Interactive save/render; no direct helper or
renderer contract changes.

### Phase 4: Review, Reports, And Candidate Lifecycle

- [ ] Add page information and conflict decisions to setup equality. An edited
      or removed group invalidates its prepared candidate; unchanged setup,
      Back, and applicable save/render recovery retain it. A one-render
      page-number override remains transient and does not cause another
      artifact or Codex preparation.
- [ ] Show requested answers and explicit versus inherited/Codex-selected
      provenance once in Profile and Project candidate review under the
      decided local text-display policy. Show effective Profile fields and
      material conflicts in the Profile review and Project handoff summary
      respectively, without repeating the same values in one review. Include
      Project repeating text, actual preparation modes, and a warning when
      retained reserved text cannot render while numbering owns that slot.
      Build the Project handoff and font review from the original preparation
      and validated Profile rather than reduced report fields, preserving
      fallback and unsupported-direction details. Escape controls in page
      text without path masking.
- [ ] Carry sparse answers through dry-run and success/failure handling. Add
      the requested and final stored page-information metadata decided at the
      gate to the existing optional Profile and Project reports. Mark model
      details as omitted on explicit page-information runs; retain only safe
      status, field names, and fixed codes instead of raw model values
      or prose. Keep independent input fields and runs without explicit page
      information unchanged; do not change the shared redactor. Validate the
      optional section in the Profile reader while accepting old version-4
      reports without it; test the Project writer projection and bundle
      recognition, plus actual deterministic/model
      work. Execution settings remain command-local and
      absent from saved recipes.
- [ ] Test candidate reuse and invalidation, regeneration, consent text,
      the decided report projection and privacy, no-usable candidates,
      failure/recovery, and save-only versus render lifecycles. Cover Profile
      and Project review independently.
      Include late-conflict revision/cancellation, stale resolution rejection,
      and removal that restores base/Codex authority without reusing old overlays.
- [ ] Connect the completed page-information path to normal Interactive
      review, save, and render only after exact Profile materialization, local
      review, and optional report omission are verified together. Test the
      connected Profile and Project save paths for bypasses.
- [ ] Render from the saved Profile and Project recipe, then compare the
      extracted text and representative PNGs with Phase 3. Exercise the
      transient one-render page-number override and confirm it does not change
      the saved recipe. Show the saved-artifact and override snapshots before
      Phase 4 closeout; keep review copies until that discussion closes.

Phase gate: review and saved output use the same validated Profile, and any
reported final stored fields agree with it; request claims match real calls; no
unaccepted candidate or page text beyond the decided report contract is
written; saved-recipe and override renders have been visually reported;
existing cleanup and recovery behavior still applies.

### Phase 5: Integrated Validation

- [ ] Run a focused matrix for both groups' unspecified/OFF/ON states across
      fresh and revised Profile and Project paths. Cover page-information-only
      with and without a base, occupied-slot clear/retain, literal text and
      placeholders, font preservation including OFF, and Project Template
      consumption of the final Profile.
- [ ] Cover ON/OFF-to-unspecified for each group with the other group intact,
      last-signal removal, and injected model decisions that put a number over
      explicit text or text under an explicit number. Assert that unresolved
      conflicts start no Template preparation and write no artifact, that local
      resolutions preserve unrelated fields, and that changed conflict text or
      position requires a fresh decision.
- [ ] Prove Template-only, direct Profile/Project commands, Profile
      initialization defaults, and the Interactive one-render override remain
      compatible. Reuse existing page-role and renderer evidence unless the
      implementation changes effective HTML/CSS or rendered behavior; rerun
      affected extraction and visual cases if it does.
- [ ] Run affected managed unit and app suites, the full managed test gate,
      TypeScript, lint, format, build, and `git diff --check`. Run the bounded
      built-CLI smoke below and distinguish its deterministic, model, and PDF
      outcomes from automated coverage.
- [ ] Complete the wider page-role render matrix and show a final labeled PNG
      snapshot report with extraction findings and any visual mismatch.
      Preserve selected review copies through the discussion, then record
      scoped cleanup of the owned PDFs, scratch, and review copies.
- [ ] Review the complete implementation range after the gates and smoke;
      resolve accepted findings and rerun affected checks. Record the final
      validated tip, model and renderer limitations, extraction/visual results,
      and cleanup state in the unified job record's Phase 5 entry.

#### Bounded Built-CLI Smoke

Use one ignored `examples/playground/md-pdf/smoke/page-information/<unique-run>/`
directory with synthetic Markdown and an unchanged base Profile whose bottom
center footer slot contains text and whose header/footer style and
`fonts.pageChrome.default` are set. Follow the
[Codex execution guide](../guides/codex-execution-configuration.md) for the public
`cdx-chores interactive --codex-model <model>` form. In the development
checkout, build first and exercise the built Node CLI:

```sh
bun run build
bun run cli interactive --codex-model gpt-6-luna
```

1. Under `md -> pdf-recipes`, prepare a Profile with no sample or intent. Use
   page information alone: enable numbers and explicitly turn repeating
   content OFF against the styled base. Save and reload the Profile. Check that
   no Codex consent or request occurred, all six text slots cleared, and
   number settings, styles, and fonts survived as specified. The model option
   is accepted but unused on this deterministic path.
2. Prepare a Project from that original base Profile with a synthetic sample
   and intent. Enable numbers at bottom center and choose repeating header-left
   text. Retain the occupied bottom-center content and inspect its conflict
   warning. Accept consent before the Profile request using the selected
   model. Record the actual Profile and Template modes and request counts;
   Template preparation may be deterministic. Save the bundle and verify
   exact final `profile.yml` content, preserved page-chrome font choice, and
   Template compatibility. Check that the optional report describes the
   actual requests and follows the decided payload contract; model selection
   is not persisted.
3. Render the saved Project through the normal `to-pdf` handoff with the
   one-render page-number choice set to `Use recipe setting`. Extract the page
   label and repeating text by page and inspect rasterized representative
   pages for position and overlap. Show the labeled PNGs in the final snapshot
   report. This is a workflow sanity check; existing renderer evidence owns
   the broader version and page-role matrix.

Keep the full state and failure matrix in automated tests rather than in long
terminal sessions. Record only sanitized outcomes, relevant public versions,
limitations, and cleanup state. Remove only the owned smoke artifacts after
capturing selected review PNGs. Keep those PNGs available until the visual
review closes, then clean them separately. Do not commit generated PDFs,
images, raw requests, reports, or local paths. If a model or installed
renderer cannot be used, identify that limitation separately from automated
contract results.

Phase gate: the automated matrix and built-CLI checks account for Profile and
Project preparation, their saved artifacts, and the render handoff. The Phase
5 entry of the unified job records a Continue, Constrain, or Stop verdict
from actual results, including any unavailable model or renderer path,
reported snapshots, and scoped cleanup.

### Phase 6: Guidance And Lifecycle Closeout

- [ ] Compare the current Interactive, Profile helper, and Project helper
      guides, CLI help, and examples with the Phase 5 validated behavior. Keep
      Markdown PDF Usage as the canonical Profile/page-number contract.
- [ ] Update the Interactive Markdown PDF usage guide with the page-information
      questions, three-state meaning, base/revision behavior, exact Profile
      authority, deterministic path, consent, terminal presentation, review,
      rendered-artifact checkpoints, and Project handoff.
      Adjust helper guides only where their direct-command boundaries need
      clarification. Link the existing Codex execution guide for model choice;
      do not present `gpt-6-luna` as a required product setting.
- [ ] Check changed wording and examples against the Phase 5 built CLI and
      recorded artifacts. If a mismatch exposes a product defect, correct the
      affected implementation and rerun its gates before describing the
      behavior as shipped.
- [ ] Link the completed unified job record from this plan and the research.
      Record public-safe validation conclusions and documentation decisions,
      then set the guide, research, and plan statuses from the evidence. Keep
      the research `in-progress` and this plan `active` while required work
      remains.
- [ ] Review the exact documentation change range, resolve accepted findings,
      and run Markdown link, formatting, and `git diff --check` checks on the
      documentation closeout.

Phase gate: current guides describe the validated behavior with correct
surface ownership, every required implementation/evidence record is linked,
documentation checks and review pass, and statuses match the achieved state.

## Unified Job Record

Use the current [testing guide](../guides/testing.md) for the focused checks in each
phase and the final Phase 5 gate. Keep one
[implementation job record](jobs/2026-09-23-markdown-pdf-interactive-codex-page-information.md)
for the whole plan. Update its phase entries as work proceeds: starting
boundary, affected contract, focused checks, exact reviewed change range,
accepted fixes, user-visible snapshot report, cleanup, and phase verdict.
Its Phase 5 entry owns built-CLI smoke outcomes and model or renderer
limitations; Phase 6 owns guide review and lifecycle decisions. Do not create
separate phase job files.

Keep machine-specific setup and raw report contents out of public records.
Move this plan from `draft` to `active` when implementation starts; mark it
and the linked research complete only when the corresponding evidence is
recorded. Do not close the plan while either artifact path, the smoke,
guidance, or cleanup remains unaccounted for.

## Related Research

- [Interactive Markdown PDF Codex Page Information Signals](../researches/research-2026-09-22-markdown-pdf-interactive-codex-page-information.md)
- [Markdown PDF Interactive Page Numbers And Repeating Page Content UX](../researches/research-2026-08-14-markdown-pdf-interactive-page-number-and-page-chrome-ux.md)
- [Markdown PDF Page Roles And Counter Semantics](../researches/research-2026-08-15-markdown-pdf-page-roles-and-counter-semantics.md)

## Related Plans

- [Markdown PDF page-number configuration implementation](plan-2026-08-12-markdown-pdf-page-number-configuration.md)
