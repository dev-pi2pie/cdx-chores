---
title: "High-quality mode for video GIF conversion"
created-date: 2026-04-10
modified-date: 2026-04-10
status: draft
agent: codex
---

## Goal

Assess how to add a higher-quality `video gif` mode without breaking the current compressed default flow.

## Key Findings

### 1. The current `video gif` implementation is a single-pass compressed path

- `actionVideoGif` currently runs one `ffmpeg` command with `-vf "fps=...,scale=...:flags=lanczos"` and writes the GIF directly.[^video-action]
- The command surface only exposes shared output controls (`--output`, `--width`, `--fps`, `--overwrite`) and does not distinguish between compression or quality strategies.[^video-command]
- The interactive flow mirrors that same narrow surface and therefore cannot currently steer users toward a higher-quality conversion path.[^video-interactive]

Implication:

- The enhancement is additive rather than corrective. A second mode can be introduced without redesigning the existing command family.

### 2. A two-pass palette workflow fits the desired quality mode cleanly

- The requested workflow uses `palettegen` first and `paletteuse` second.
- That approach is a standard `ffmpeg` pattern for better GIF color fidelity because it avoids the weaker direct-encode quantization used by the current one-pass flow.
- The existing `width` and `fps` inputs map directly into both palette-generation and final-GIF filter chains, so the new mode does not require a different sizing model.

Recommended shape:

- Keep the existing one-pass path as `compressed`.
- Add a second `quality` mode that:
  - generates a temporary palette image
  - uses that palette to produce the final GIF
  - removes the palette artifact automatically after success or failure

### 3. Temporary palette handling should be per-run and auto-cleaned

- The palette image is an implementation artifact, not user-facing output.
- Leaving palette files beside the source video or final GIF would create avoidable clutter and make repeated conversions noisy.
- The repository does include a deterministic UID helper for rename workflows, but that helper is tied to rename semantics and stable path-derived identities rather than ephemeral temp artifacts.[^rename-uid]

Recommendation:

- Generate a per-run unique temp palette filename such as `palette-uid-<random>.png`.
- Place it in the system temp directory rather than the repository or output directory.
- Remove it in a `finally` block so cleanup runs for both success and failure cases.

### 4. CLI and interactive mode selection should not behave identically

- Existing users already rely on `video gif` working without an extra mode flag.
- Changing the default behavior to palette-based quality mode could improve visual output, but it would also change runtime cost, file size characteristics, and command behavior without explicit user intent.
- Interactive users do not have the same compatibility constraint because the prompt flow can ask for intent directly before running the conversion.[^video-interactive]

Recommendation:

- Add `--mode compressed|quality`.
- Keep the CLI default as `compressed` to preserve script and alias compatibility.
- In interactive mode, always ask the user to choose `compressed` or `quality` rather than selecting a silent default.
- Keep `--width` and `--fps` shared across both modes.
- Keep palette retention and palette-path control out of the public CLI surface for this feature.

### 5. Progress feedback should be phase-based first, not a full parsed progress bar

- The current action path uses `execCommand`, which buffers process output and returns only after the child process exits.[^process]
- That means the existing video actions naturally support final success/failure messaging, but not a live `ffmpeg` progress stream or parsed percentage bar.
- The new quality mode introduces two distinct phases, so a small amount of explicit progress messaging would help users understand that the command is still working:
  - generating palette
  - rendering GIF

Recommendation:

- Keep first-pass feedback simple and consistent across both CLI and interactive runs:
  - `Starting GIF conversion...`
  - `Mode: compressed` or `Mode: quality`
- For `compressed`, emit a clear processing-phase message before the final success line:
  - `Rendering GIF...`
- For `quality`, emit phase messages before the final success line:
  - `Generating GIF palette...`
  - `Rendering GIF from palette...`
  - final `Wrote GIF: ...`
- Defer true `ffmpeg` progress parsing to a separate follow-up if users need live timing or frame-level progress.

### 6. Temporary palette naming should be descriptive but still ephemeral

- A purely random temp filename is sufficient technically, but a descriptive stem is easier to inspect during debugging and better matches the repository's general preference for readable derived artifacts.
- A user-specified palette path would add surface area without a current user need.

Recommendation:

- Keep palette-path management internal only.
- Use the system temp directory.
- Build the temp filename from:
  - a stable feature prefix such as `cdx-chores-video-gif`
  - a readable stem derived from the input or output basename
  - a short per-run random suffix
- Example shape: `cdx-chores-video-gif-myclip-palette-8f3k2h.png`

Workflow sketch:

```text
compressed
input video
  -> ffmpeg fps+scale
  -> output.gif

quality
input video
  -> ffmpeg palettegen
  -> temp palette.png
  -> ffmpeg paletteuse
  -> output.gif
  -> cleanup temp palette
```

### 7. The implementation impact is localized

- The feature is concentrated in:
  - GIF action logic in `src/cli/actions/video.ts`[^video-action]
  - CLI option registration in `src/cli/commands/video.ts`[^video-command]
  - interactive prompting in `src/cli/interactive/video.ts`[^video-interactive]
- Existing test coverage already includes:
  - command-help assertions for video command UX[^video-help-tests]
  - failure-path coverage for `actionVideoGif`[^video-tests]
  - interactive routing coverage for the GIF flow[^video-interactive-tests]

Implication:

- This enhancement should be low-risk if it preserves the current default path and extends tests around mode selection and palette cleanup behavior.

### 8. Documentation follow-up should include a dedicated GIF guide

- The README currently shows a single `video gif` example and lists only the resize-specific video guide under the `Video` guides section.[^readme][^video-resize-guide]
- That is enough for the current single-mode flow, but it is thin for a two-mode GIF feature with behavior and UX differences.

Recommendation:

- Update the README examples for `video gif`.
- Add a dedicated guide for GIF usage and quality modes rather than folding all GIF details into the resize guide.
- Cover:
  - `compressed` as the primary/default example
  - `quality` as the higher-fidelity alternative example
  - `compressed` vs `quality`
  - interactive mode selection
  - CLI and interactive processing-phase messages
  - temp palette cleanup behavior
  - expected tradeoffs in speed, quality, and file size
  - an ASCII workflow sketch for both conversion methods

## Implications or Recommendations

Recommended implementation direction:

1. Add `--mode compressed|quality` to `video gif`.
2. Keep `compressed` as the default mode for CLI invocation.
3. Prompt interactive users to choose `compressed` or `quality` explicitly every time.
4. Implement `quality` as a two-pass `ffmpeg` workflow using `palettegen` then `paletteuse`.
5. Emit clear phase progress messages during processing for both CLI and interactive runs.
6. Generate the palette under the system temp directory using a descriptive basename plus short per-run random suffix.
7. Delete the palette file automatically in a `finally` block.
8. Keep `--keep-palette` and user-specified palette-path flags out of scope for this feature.
9. Update README examples and add a dedicated GIF usage guide as part of the feature.
10. Make the new GIF guide lead with `compressed`, then document `quality` as the higher-fidelity alternative.

Recommended verification scope once implemented:

1. CLI help output reflects the new mode and default behavior.
2. Interactive GIF flow prompts for mode and forwards the selected value.
3. Missing-input validation still fails before any `ffmpeg` execution.
4. Quality-mode tests confirm the two-pass invocation shape and cleanup path.
5. Compressed-mode tests confirm phase progress messages appear in the expected order.
6. Quality-mode tests confirm phase progress messages appear in the expected order.
7. README and the new GIF guide reflect the new mode surface accurately.

## References

[^video-action]: [`src/cli/actions/video.ts`](../../src/cli/actions/video.ts)
[^video-command]: [`src/cli/commands/video.ts`](../../src/cli/commands/video.ts)
[^video-interactive]: [`src/cli/interactive/video.ts`](../../src/cli/interactive/video.ts)
[^rename-uid]: [`src/cli/rename-uid.ts`](../../src/cli/rename-uid.ts)
[^process]: [`src/cli/process.ts`](../../src/cli/process.ts)
[^video-help-tests]: [`test/cli-ux.test.ts`](../../test/cli-ux.test.ts)
[^video-tests]: [`test/cli-actions-doctor-markdown-video-deferred.test.ts`](../../test/cli-actions-doctor-markdown-video-deferred.test.ts)
[^video-interactive-tests]: [`test/cli-interactive-routing.test.ts`](../../test/cli-interactive-routing.test.ts)
[^readme]: [`README.md`](../../README.md)
[^video-resize-guide]: [`docs/guides/video-resize-usage-and-ux.md`](../guides/video-resize-usage-and-ux.md)
