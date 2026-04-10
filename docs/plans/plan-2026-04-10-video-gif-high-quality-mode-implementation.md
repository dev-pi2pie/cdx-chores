---
title: "Video GIF high-quality mode implementation"
created-date: 2026-04-10
modified-date: 2026-04-10
status: active
agent: codex
---

## Goal

Implement the new high-quality `video gif` mode from the current research direction while preserving the current compressed CLI default and keeping the shipped UX explicit, readable, and low-risk.

## Why This Plan

The current research records the main product and UX decisions guiding this feature:

- direct CLI gains `--mode compressed|quality`
- direct CLI keeps `compressed` as the default/fallback mode
- interactive mode always asks the user to choose `compressed` or `quality`
- both CLI and interactive runs emit clear processing-phase messages
- `quality` uses a two-pass `ffmpeg` palette workflow
- the palette artifact stays internal, temporary, descriptive, and auto-cleaned
- `--keep-palette` and custom palette-path flags stay out of scope
- the feature should land with README updates plus a dedicated GIF guide

This work is best handled as a dedicated implementation plan because it crosses CLI command registration, action execution, interactive prompting, temp-artifact handling, tests, README wording, and guide documentation.

## Current State

- `video gif` currently supports one one-pass `ffmpeg` path in `src/cli/actions/video.ts`
- direct CLI currently exposes:
  - `--output`
  - `--width`
  - `--fps`
  - `--overwrite`
- interactive `video gif` currently prompts for:
  - input path
  - optional output path
  - width
  - fps
  - overwrite behavior
- current action execution prints only the final success line because `execCommand` buffers child-process output rather than streaming phase or progress updates
- README currently documents a single GIF example
- the current video guides include resize guidance only

## Scope

### Direct CLI contract

- add `--mode compressed|quality` to `video gif`
- keep `compressed` as the CLI default when `--mode` is omitted
- keep `--width` and `--fps` shared across both modes
- keep `--overwrite` behavior unchanged
- keep output-path defaulting behavior unchanged

### GIF execution behavior

- preserve the current one-pass filter path as `compressed`
- add a two-pass palette workflow for `quality`
- generate the palette under the system temp directory
- use a descriptive temp filename with a readable stem plus short per-run random suffix
- delete the temp palette in a `finally` block

### Processing feedback

- emit clear phase messages during processing for both CLI and interactive runs
- use simple phase wording rather than parsed `ffmpeg` progress
- support:
  - `Starting GIF conversion...`
  - `Mode: compressed` or `Mode: quality`
  - `Rendering GIF...` for compressed mode
  - `Generating GIF palette...` and `Rendering GIF from palette...` for quality mode
  - final `Wrote GIF: ...`

### Interactive UX

- prompt for GIF mode explicitly every time
- keep the rest of the prompt flow intact unless the new mode phase requires small wording updates
- forward the selected mode into `actionVideoGif`

### Documentation

- update README examples for `video gif`
- add a dedicated GIF usage guide
- make the new guide lead with `compressed`
- document `quality` as the higher-fidelity alternative
- include an ASCII workflow sketch for both methods

### Verification

- extend help-output coverage for the new mode flag
- extend interactive routing coverage for mode selection
- add action-level tests for:
  - compressed-mode invocation
  - quality-mode two-pass invocation
  - palette cleanup behavior
  - phase message ordering
- keep automated coverage synthetic and command-shape-focused rather than dependent on a checked-in real video sample
- treat `examples/playground/video/` artifacts as local manual smoke-test inputs only, not public test fixtures

## Non-Goals

- real-time parsed `ffmpeg` progress bars
- custom palette-path selection
- a public `--keep-palette` flag
- changing the CLI default from `compressed` to `quality`
- broader video-command redesign outside `video gif`
- shipping real media samples into public docs or repository fixtures
- using local playground video files as checked-in automated test fixtures

## Risks and Mitigations

- Risk: adding `quality` changes the behavior users expect from existing `video gif` commands.
  Mitigation: keep `compressed` as the CLI default and preserve the current one-pass path when `--mode` is omitted.

- Risk: interactive flow becomes ambiguous if the mode is not visible enough.
  Mitigation: make mode choice an explicit prompt every time and emit the chosen mode again in processing-phase output.

- Risk: temp palette artifacts leak into user-visible locations or remain after failures.
  Mitigation: keep palette creation internal to the system temp directory and delete it in a `finally` block.

- Risk: phase messaging becomes inconsistent between compressed and quality modes.
  Mitigation: freeze one message sequence per mode and verify ordering in tests.

- Risk: documentation lags behind the shipped option surface.
  Mitigation: treat README and the new GIF guide as part of the implementation scope, not as a later follow-up.

- Risk: a real local smoke-test video is accidentally pulled into public tests, fixtures, or docs.
  Mitigation: keep automated tests synthetic, keep real-video verification manual under `examples/playground/video/`, and avoid referencing private/local media in public-facing examples.

## Implementation Touchpoints

- `src/cli/actions/video.ts`
- `src/cli/commands/video.ts`
- `src/cli/interactive/video.ts`
- `src/cli/process.ts` or adjacent helpers only if needed for message sequencing
- `README.md`
- `docs/guides/video-gif-usage-and-quality-modes.md`
- video CLI and interactive tests under `test/`

## Phase Checklist

### Phase 1: Freeze public contract in code-facing terms

- [x] add `mode?: "compressed" | "quality"` to `VideoGifOptions`
- [x] freeze `compressed` as the direct CLI default when no mode is provided
- [x] freeze explicit interactive mode selection on every GIF conversion flow
- [x] freeze the processing-phase message sequence for both modes
- [x] freeze the temp palette naming and cleanup approach

### Phase 2: Implement CLI surface and GIF execution

- [x] add `--mode compressed|quality` to `video gif`
- [x] document the mode flag in CLI help text
- [x] keep the existing one-pass execution path as compressed mode
- [x] implement the two-pass palette workflow for quality mode
- [x] generate the temp palette in the system temp directory
- [x] use a descriptive temp filename with readable stem plus short per-run random suffix
- [x] delete the temp palette in a `finally` block
- [x] preserve existing output-path and overwrite behavior

### Phase 3: Implement processing-phase UX and interactive flow

- [x] emit `Starting GIF conversion...` before mode-specific processing
- [x] emit `Mode: compressed` or `Mode: quality`
- [x] emit `Rendering GIF...` for compressed mode
- [x] emit `Generating GIF palette...` for quality mode
- [x] emit `Rendering GIF from palette...` for quality mode
- [x] keep final success output as `Wrote GIF: ...`
- [x] prompt for GIF mode explicitly in interactive `video gif`
- [x] thread the selected mode through the interactive action call

### Phase 4: Add focused tests

- [x] add help-output assertions for `--mode compressed|quality`
- [x] add direct action coverage for compressed-mode invocation shape
- [x] add direct action coverage for quality-mode two-pass invocation shape
- [x] add cleanup coverage for palette deletion after quality-mode execution
- [x] add failure-path coverage ensuring palette cleanup still runs when the second phase fails
- [x] add output/message-order coverage for compressed-mode phase messages
- [x] add output/message-order coverage for quality-mode phase messages
- [x] extend interactive routing coverage for explicit mode selection
- [x] keep automated tests independent from real checked-in video media
- [ ] verify the feature manually with a local-only playground video under `examples/playground/video/`

### Phase 5: Update README and add guide

- [ ] update README `video gif` examples
- [ ] add `docs/guides/video-gif-usage-and-quality-modes.md`
- [ ] make the guide lead with `compressed`
- [ ] document `quality` as the higher-fidelity alternative
- [ ] describe the temp palette as internal and auto-cleaned
- [ ] include an ASCII workflow sketch for compressed and quality modes
- [ ] link the new guide from the README video-guides section

### Phase 6: GIF profile and color-tuning follow-up

- [ ] freeze the public `--gif-profile` surface from follow-up research
- [ ] decide whether the first profile set is:
  - [ ] `video`, `motion`, `screen`
  - [ ] or a smaller initial subset
- [ ] define how `--gif-profile` interacts with `--mode compressed|quality`
- [ ] centralize profile-to-recipe mapping in one helper
- [ ] implement at least the default `video` recipe tuning for quality mode
- [ ] add profile-aware tests for argument generation and validation
- [ ] update README and the GIF guide with profile selection guidance if the profile surface lands

## Related Research

- `docs/researches/research-2026-04-10-video-gif-high-quality-mode.md`
- `docs/researches/research-2026-04-10-video-gif-profile-color-tuning.md`
