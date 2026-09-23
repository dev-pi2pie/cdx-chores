---
title: "Markdown PDF Interactive Codex Page Information Implementation"
created-date: 2026-09-23
status: draft
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

## Product Contract

| Group | Unspecified | OFF | ON |
| --- | --- | --- | --- |
| Page numbers | Preserve base/candidate or Codex choice. | Disable numbers while retaining valid inert details. | Set the chosen body/document outcome, label, and position; use start and increment of 1. |
| Repeating page content | Preserve base/candidate or Codex choice. | Clear all six text slots; retain header/footer styles and fonts. | Set selected slots exactly; clear unselected slots except an explicitly retained reserved conflict. |

Fresh page-number ON defaults to body pages starting at 1, `Page {page}`, and
bottom center. Page numbers and repeating content share six positions. The
number position cannot receive new repeating text. An inherited occupied
position offers explicit clear or retain, defaulting to retain; a retained
conflict is visible in review and its text is not promised to render. Repeating
content OFF clears that position without a conflict prompt.

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
  -> normalize and validate final Profile
  -> Project only: prepare Template from that final Profile
  -> review, save, or render through the existing lifecycle
```

## Implementation Approach

- Keep unspecified answers absent in typed Interactive setup. Store explicit
  OFF/ON and entered text separately from free-form intent, so omission cannot
  become a default or an implicit clear during revision, requests, or reports.
- Reuse Formal Guide prompt controls and Profile compilation where their
  behavior matches. Give explicit Interactive OFF its own clearing policy so
  the existing Formal Guide reserved-slot exception does not change silently.
- Use the helper's existing signal classification for request decisions. Page
  information is sufficient input but never a reason by itself to call Codex.
  Do not create an unrelated Interactive heuristic for consent.
- Apply exact answers once at the Profile boundary shared by standalone
  Profile and Project preparation. The overlay is optional internal helper
  input supplied only by Interactive; direct invocations retain their current
  behavior. Build review, reports, and saved artifacts from the same validated
  final Profile.
- Keep the existing Project Profile-then-Template order, renderer capability
  advisories, report redaction, and save/render/recovery lifecycle. Reuse the
  completed renderer evidence unless effective HTML/CSS or render behavior
  changes.

## Implementation Phases

### Phase 1: Sparse Answers And Guided Collection

- [ ] Add separate typed page-number and repeating-content answers to Profile
      and Project Codex setup. An absent group means unspecified; explicit OFF
      and ON retain their own values through revision. Template-bundle setup
      does not acquire these answers.
- [ ] Ask whether to specify page information after optional sample selection
      and before PDF intent. Within selected groups, reuse Formal Guide's
      body/document choices, page-number labels, six positions, literal text,
      and placeholder help. Use Profile wording for the contained Project
      Profile without adding a Project Formal Guide mode.
- [ ] Add a Page information setup action with separate group edits. Preselect
      eligible occupied base-Profile positions on first edit when a base is
      already selected. If the base is chosen later, re-evaluate on revision
      without replacing earlier explicit content choices; recheck the reserved
      slot after base or page-number position changes.
- [ ] Reuse the clear-or-retain prompt for an occupied number position,
      defaulting to retain. Prevent new text in that position. Give explicit
      repeating-content OFF a six-slot clear with no conflict question; keep
      the existing Formal Guide reserved-slot exception unchanged.
- [ ] Add focused collection, prompt-order, revision, cancellation, and
      Formal Guide compatibility tests under `test/markdown-pdf/interactive/`.

Phase gate: omission, OFF, and ON remain distinct across first setup, base
selection, and revision; the existing Formal Guide path keeps its behavior;
Template setup remains unchanged; Back/Cancel writes nothing.

### Phase 2: Signal Classification And Request Consent

- [ ] Carry the sparse answers as bounded structured signals through
      Interactive Profile and Project preparation. Keep literal text and
      metadata placeholders unresolved, separate from advisory PDF intent.
      Do not add direct-command flags or serialize a second Profile schema.
- [ ] Make page information sufficient input for both helpers without making
      it a model trigger. Profile and Project page-information-only paths, with
      or without a base Profile, use deterministic Profile preparation; Project
      also uses deterministic Template preparation. Sample, intent, font hints,
      and Template-owned directions retain their existing mode rules.
- [ ] Drive Interactive consent from the same phase classifications used by
      preparation. Skip model consent for deterministic-only work. When a
      Project Template request may depend on Profile-phase directions, keep
      consent before the first possible request and describe possible phases
      without claiming both will run. Report the actual phase modes afterward.
- [ ] Show the entered text that a request would send. Keep the one session
      `codexExecution` selection through actual requests, retries, and
      regeneration; the option alone must not create a request.
- [ ] Test signal modes, too-low-signal admission, consent/no-consent, request
      counts, model-option forwarding, and Project phase combinations with
      injected runners in the Profile, Project, and Interactive suites.

Phase gate: page-information-only Profile and Project candidates reach review
with zero model requests and no Codex consent; mixed-signal paths ask consent
before requests and retain current model-selection rules.

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
- [ ] Apply the step to standalone Profile preparation before acceptance and
      report construction. Apply it inside the Project Profile phase before
      Template preparation, binding, report construction, or write. Normalize
      and validate the same final Profile used by all those consumers; retain
      existing patch, capability-advisory, and diagnostic behavior. Authoring
      does not probe the installed renderer.
- [ ] Align the Profile helper prompt with logical `{page}` / `{pages}` and
      physical `{pdfPage}` / `{pdfPages}` terms. Test local exact authority over
      conflicting intent and injected Codex decisions, base preservation,
      clear/retain behavior, font-hint coexistence, Profile YAML/JSON round
      trips, and Project Template compatibility.

Phase gate: an accepted Profile matches every explicit answer after
normalization; Project Template preparation consumes that Profile; report,
bundle, and saved Profile values agree; no direct helper or renderer contract
changes.

### Phase 4: Review, Reports, And Candidate Lifecycle

- [ ] Add page information to setup equality. An edited group invalidates its
      prepared candidate; unchanged setup, Back, and applicable save/render
      recovery retain it. A one-render page-number override remains transient
      and does not cause another artifact or Codex preparation.
- [ ] Show requested answers, explicit versus inherited/Codex-selected
      provenance, final Profile fields, preparation modes, and material
      conflicts in Profile and Project candidate review. Show repeating text
      in the Project handoff summary and warn when retained reserved text will
      not render while numbering owns that slot.
- [ ] Carry sparse answers through dry-run, optional reports, success, and
      failure. Keep report additions compatible with existing readers, apply
      established redaction, and describe actual deterministic/model work.
      Execution settings remain command-local and absent from saved recipes.
- [ ] Test candidate reuse and invalidation, regeneration, consent text,
      report privacy, no-usable candidates, failure/recovery, and save-only
      versus render lifecycles. Cover Profile and Project review independently.

Phase gate: review, reports, and saved output describe the same validated
Profile; request claims match real calls; no unaccepted candidate or private
report data is written; existing cleanup and recovery behavior still applies.

### Phase 5: Integrated Validation

- [ ] Run a focused matrix for both groups' unspecified/OFF/ON states across
      fresh and revised Profile and Project paths. Cover page-information-only
      with and without a base, occupied-slot clear/retain, literal text and
      placeholders, font preservation including OFF, and Project Template
      consumption of the final Profile.
- [ ] Prove Template-only, direct Profile/Project commands, Profile
      initialization defaults, and the Interactive one-render override remain
      compatible. Reuse existing page-role and renderer evidence unless the
      implementation changes effective HTML/CSS or rendered behavior; rerun
      affected extraction and visual cases if it does.
- [ ] Run affected managed unit and app suites, the full managed test gate,
      TypeScript, lint, format, build, and `git diff --check`. Run the bounded
      built-CLI smoke below and distinguish its deterministic, model, and PDF
      outcomes from automated coverage.
- [ ] Review the complete implementation range after the gates and smoke;
      resolve accepted findings and rerun affected checks. Record the final
      validated tip, model and renderer limitations, extraction/visual results,
      and cleanup state in the Phase 5 job record.

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
   actual requests and follows redaction rules; model selection is not
   persisted.
3. Render the saved Project through the normal `to-pdf` handoff with the
   one-render page-number choice set to `Use recipe setting`. Extract the page
   label and repeating text by page and inspect a representative PDF page for
   position and overlap. This is a workflow sanity check; existing renderer
   evidence owns the broader version and page-role matrix.

Keep the full state and failure matrix in automated tests rather than in long
terminal sessions. Record only sanitized outcomes, relevant public versions,
limitations, and cleanup state. Remove only the owned smoke artifacts; do not
commit generated PDFs, raw requests, reports, or local paths. If a model or
installed renderer cannot be used, identify that limitation separately from
automated contract results.

Phase gate: the automated matrix and built-CLI checks account for Profile and
Project preparation, their saved artifacts, and the render handoff. The Phase
5 job records a Continue, Constrain, or Stop verdict from actual results, including
any unavailable model or renderer path, and confirms scoped smoke cleanup.

### Phase 6: Guidance And Lifecycle Closeout

- [ ] Compare the current Interactive, Profile helper, and Project helper
      guides, CLI help, and examples with the Phase 5 validated behavior. Keep
      Markdown PDF Usage as the canonical Profile/page-number contract.
- [ ] Update the Interactive Markdown PDF usage guide with the page-information
      questions, three-state meaning, base/revision behavior, exact Profile
      authority, deterministic path, consent, review, and Project handoff.
      Adjust helper guides only where their direct-command boundaries need
      clarification. Link the existing Codex execution guide for model choice;
      do not present `gpt-6-luna` as a required product setting.
- [ ] Check changed wording and examples against the already built CLI and
      recorded Phase 5 artifacts. If a mismatch exposes a product defect,
      return to the affected implementation phase and refresh its evidence
      before describing the behavior as shipped.
- [ ] Link the completed phase job records from this plan and the research.
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

## Phase Records

Use the current [testing guide](../guides/testing.md) for the focused checks in each
phase and the final Phase 5 gate. Create a concise job record when each phase
begins. Record the starting boundary, affected contract, focused checks,
exact reviewed change range, accepted fixes, and phase verdict. The Phase 5
record owns built-CLI smoke outcomes, any model or renderer limitation, and
cleanup state; Phase 6 owns guide review and lifecycle decisions.

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
