---
title: "Inline ghost prompt wrap bug investigation"
created-date: 2026-03-29
modified-date: 2026-03-30
status: in-progress
agent: codex
---

## Goal

Investigate the reported interactive "ghost hint" duplication bug, determine the root cause, and identify the affected release range.

## Key Findings

### 1. The current evidence points to prompt repainting rather than path suggestion resolution

The observed repeated text output appears to be caused by the inline prompt renderer clearing only the current terminal row before repainting:

- `src/cli/tui/screen.ts` uses `\r\x1b[2K` in `clearCurrentLine()`
- `src/cli/prompts/path-inline.ts` repaints the prompt by:
  - clearing one row
  - writing the full prompt line again
  - moving the cursor left by the ghost-suffix width

That appears to work only while the rendered prompt fits on a single terminal row.

When the visible prompt wraps, the cursor rests on the last wrapped row. The next repaint clears only that last row, then writes the entire prompt again from there, leaving stale wrapped rows above intact. This matches the reported "ghost hint" duplication where the prompt label and long path appear repeated many times.

### 2. Deeper nested paths make the bug much easier to trigger

The prompt line is:

- prompt label
- typed value
- dimmed ghost suffix

Long nested relative paths quickly exceed common terminal widths, especially for prompts such as:

- `Input CSV, TSV, or JSON file`
- `Custom output path`

This explains why the user report becomes worse with multi-folder paths.

### 3. The same rendering limitation likely also exists in the text ghost prompt

`src/cli/prompts/text-inline.ts` uses the same repaint pattern:

- `clearCurrentLine(stdout)`
- write the prompt line
- `moveCursorLeft(stdout, cursorBackCount)`

So the underlying defect is probably broader than the path prompt. The path prompt is the clearest reproduction because file paths become long quickly, but any inline ghost prompt may misrender once it wraps.

### 4. The bug appears to date back to the first advanced inline path prompt release

The wrap-unsafe clear-and-rerender behavior was introduced with the advanced inline path prompt in:

- `dfe9804` — `feat: implement advanced path prompt with inline suggestions and autocomplete` on 2026-02-26

That commit is already present in tag:

- `v0.0.6`

Current release-range working conclusion:

- affected released versions: `v0.0.6` through `v0.0.9`
- affected prereleases: `v0.0.7-canary.1` through `v0.0.9-canary.2`, plus current `0.1.0-canary.2` in `package.json`

Provenance:

- `dfe9804` introduced the advanced inline path prompt on 2026-02-26
- that commit is present in tag `v0.0.6`, which directly verifies the released lower bound
- the higher released bound comes from the latest published release currently present in this repository tag history: `v0.0.9`
- the prerelease span is inferred from repository tag history between the first release line that contains `dfe9804` and the latest prerelease tags currently present
- `0.1.0-canary.2` comes from the current working tree `package.json`

This does not look like a recent regression. It appears to be a long-standing limitation in the advanced TTY prompt renderer.

### 5. The previously fixed "ghost preview race" is a separate issue

The earlier race-condition fix documented in `docs/plans/jobs/2026-03-02-fix-inline-path-ghost-preview-race.md` addressed stale async suggestion results overriding an active sibling preview.

That fix is unrelated to the current bug. The current failure is terminal repaint behavior after line wrapping.

## Implications or Recommendations

### Recommendation A. File the issue as a shared inline-renderer wrap bug

The issue title and scope should focus on multiline terminal repainting, not only path suggestions. Suggested scope:

- path inline ghost prompt visibly duplicates wrapped rows
- text inline ghost prompt likely has the same limitation
- root cause is single-row clearing in the shared repaint model

### Recommendation B. Fix the shared renderer before adding more inline-prompt polish

The current renderer assumes:

- one visible prompt row
- simple leftward cursor movement from the ghost suffix

Any future prompt polish built on top of that assumption will remain fragile for long values or narrow terminals.

Recommended direction:

- do not keep per-prompt manual repaint logic as the long-term model
- replace the current single-row repaint assumption with a small shared line-aware renderer used by both `path-inline` and `text-inline`
- let that renderer track the previous rendered visual row count and clear all previously occupied rows before repainting

Why:

- the current long-path failure is caused by a shared renderer assumption, not by path suggestion logic
- the repository already needed one prompt-specific workaround on 2026-02-25 by shortening the live message for optional output prompts, which indicates the current repaint contract is too fragile for prompt-specific patching
- the same single-row repaint pattern exists in both inline prompt implementations, so the fix should live below them instead of duplicating row-tracking in each prompt

### Recommendation C. Add regression coverage with simulated wrapped prompts

Current tests validate behavior through captured write streams, but they do not model terminal width or wrapped-row repainting. A regression test should simulate:

- a narrow terminal width
- consecutive renders of a wrapped prompt
- verification that stale wrapped rows do not remain after repaint

Recommended direction:

- keep the regression coverage requirement
- extend it to cover display-width-sensitive content, not only ASCII paths

Why:

- the current issue reproduces with ordinary long ASCII multi-folder paths
- however, cursor movement and row counting in a wrap-aware renderer must use visible terminal columns, not JavaScript string length
- existing `src/cli/text-display-width.ts` already establishes a repo-local display-width model for emoji and full-width graphemes
- example width mismatch from local inspection: `資料😀.csv` has raw string length `8` but visible display width `10`
- a wrap-aware renderer built on raw string length would still be wrong for CJK and emoji paths even after fixing the ASCII wrap bug

## GitHub Issue

- issue: `#31`
- title: `Inline ghost prompts render incorrectly for long multi-folder paths in interactive mode`
- url: `https://github.com/dev-pi2pie/cdx-chores/issues/31`

The issue wording uses an ordinary multi-folder path example and describes the visible failure in neutral bug-report language.

## Behavior Observations

- observed: the long multi-folder path failure lines up with stale wrapped rows left behind during repaint rather than with suggestion-selection behavior
- observed: the renderer problem is shared by both inline prompt implementations because both rely on the same single-row clear and redraw pattern
- observed: a renderer fix should count visible terminal columns rather than raw JavaScript string length, or non-ASCII paths may still misrender after the ASCII wrap case is fixed
- observed on 2026-03-30: the latest renderer changes work in iTerm2 but the ghost-row issue still reproduces in Ghostty, which means terminal compatibility now needs to be treated as an explicit verification dimension rather than assuming one TTY model
- observed on 2026-03-30: in Ghostty, `TERM` reports `xterm-256color`, so the remaining gap is not explained by an unusual `TERM` value alone

## Recommended Solution Shape

- replace the current manual single-row repaint model with a small shared line-aware renderer
- have that renderer track previously occupied visual rows and clear all of them before repainting
- use display width for ghost-suffix cursor movement and for any wrap-related row counting inside that renderer
- keep regression coverage for narrow-terminal wrapped repainting and extend it to include display-width-sensitive content
- expand manual verification to include a terminal matrix, starting with iTerm2 and Ghostty, and record terminal-specific environment details when the remaining gap reproduces

## Related Plans

- `docs/plans/plan-2026-03-29-inline-ghost-prompt-wrap-fix.md`

## Related Research

- `docs/researches/archive/research-2026-02-25-interactive-path-hints-and-autocomplete-ux.md`
- `docs/researches/archive/research-2026-02-28-interactive-path-ghost-hint-and-sibling-navigation-ux.md`

## References

- `src/cli/prompts/path-inline.ts`
- `src/cli/prompts/text-inline.ts`
- `src/cli/tui/screen.ts`
- `docs/plans/jobs/2026-03-02-fix-inline-path-ghost-preview-race.md`
