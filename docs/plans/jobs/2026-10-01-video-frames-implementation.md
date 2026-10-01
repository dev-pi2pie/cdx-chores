---
title: "Video Frames Implementation Record"
created-date: 2026-10-01
status: in-progress
agent: codex
---

## Scope and Checkpoints

Execute the [implementation plan](../plan-2026-09-30-video-frames-implementation.md) from baseline `cfd2d7ca15195fc19b69ce6d2bd940f838d2b560`. This record stays open across all phases. Check off tasks after recording their evidence; close a phase only after reviewing its complete commit range.

| Phase | Research obligations | State |
| --- | --- | --- |
| 1 | Independent fixture expectations, smoke preparation, real terminal keys/resize, selection retention, fallbacks, prompt ownership/restoration | Verification passed; range review pending |
| 2 | Real-tool timing, stream agreement, encoder/filter feasibility, bounded writer topology, decoder guard, synthetic workload measurements | Not started |
| 3 | Streaming records, exact identities, bounded cache, source invalidation, cancellation/child closure | Not started |
| 4 | Verified pixels, alpha/transforms, safe publication, failure accounting, private processing smoke | Not started |
| 5 | Sampling, retained repeats, destinations and concrete naming | Not started |
| 6 | Direct command, validation, dependencies and doctor | Not started |
| 7 | Guided Interactive flow and recovery | Not started |
| 8 | Full regression, explicit smoke, documentation and research closure evidence | Not started |

## Phase 1

The earlier attempt is preserved on a separate local branch; its verification results are not acceptance evidence for this implementation. Reimplementation uses TypeScript/JavaScript, Bun development checks, and Node.js runtime checks.

Initial terminal facility check: Node received a key through a real terminal, reported TTY input/output, and restored the original terminal mode. No media or private input has been accessed.

Preparation evidence:

- Literal small timing expectations and 30/120/300-second scan recipes live in `scripts/spikes/video-frames/fixtures.ts`. They generate nothing on import.
- `bun scripts/spikes/video-frames/verify-workspace.ts` and its Node bundle both passed: budget rejection, ignored uniquely owned scratch, result readback, refusal to remove a replaced run directory, and cleanup. Only a tiny synthetic JSON result was written. Cadence was preserved when rejecting excessive image counts.
- Four focused budget unit tests passed (12 assertions); TypeScript and focused lint passed.
- The budget functions provide preflight and observed-limit checks. Real generation/process deadlines, shutdown acknowledgement, and ongoing disk observation remain Phase 2 verification work. The scratch threshold remains a monitored stop trigger.

Prototype implementation reuses raw sessions, key parsing, display-width measurement, existing menus, and template completion. The feature-local prompt adapter defers abort forwarding until the installed library's initial effects can run; isolated real-library regression cases verify that listeners do not appear after cleanup. No new runtime dependency or general terminal-test framework was added.

### Terminal Evidence

The developer entry is `scripts/spikes/video-frames-terminal.ts`. Bundle it with `bun build scripts/spikes/video-frames-terminal.ts --target=node --outfile <owned-run>/terminal.mjs`, then run `node <owned-run>/terminal.mjs` in a real terminal. It accepts synthetic fixtures only. Optional traces must stay in the owned ignored run; inspect them before cleanup. Use `--mode set|single|set-naming|sequence`, `--simple`, and the explicit fallback/failure switches to repeat the cases below.

Twenty-one Node terminal cases passed on macOS with Node 26.5.0:

| Check | Observed result |
| --- | --- |
| Endpoint/interior arrows | First/last roles stayed anchored, outward arrows did not wrap, and navigation made no resolution call |
| Measured layouts and resize | Full at 100 × 32, compact at 100 × 19, direct at 28 × 8, then full again; rapid resize also restored the wave |
| Precise retention | Requested 1,234 ms and resolved frame 3 at 1,200 ms survived layout/glyph/editor round trips unchanged |
| Editors | `aTf` stayed editor text; invalid Enter did not resolve; cursor editing and resize retained the draft; Escape restored the previous selection; valid time Enter resolved once |
| Fallbacks | Unknown dimensions, unknown duration, simple mode, unsupported raw input, and frame identity without time each allowed direct frame input |
| Direct time and noninteractive input | Timestamp input resolved the declared identity; redirected input gave CLI guidance without opening a prompt or resolving |
| Presets | First/last returned roles `[1, 4]`, first/middle/last `[1, 3, 4]`, and the one-frame fixture retained all three repeated roles |
| Naming | Single/set defaults omitted serial prompts; sequence defaults used start 1/width 6; embedded start 3/width 4 survived accepted defaults and produced `0003` |
| Glyphs and color | Unicode/ASCII toggled in both directions, hints changed, and disabled color retained geometry and controls |
| Cancellation and failure | Escape cancelled synthetic resolution before a follow-up prompt; Ctrl+C and resolver failure restored raw mode, cursor visibility, and listeners |

Real resize used terminal size changes, not injected layout objects. Terminal output and synthetic observations were inspected together. The resize/follow-up case also compared the terminal mode before and after Node. Every owned Node process closed; the prototype bundle and all 21 local traces were removed afterward.

### Regression Evidence and Limits

- Focused picker checks: 33 unit tests / 282 assertions and 7 application tests / 32 assertions passed.
- Managed unit suite: 1,442 cases / 5,556 assertions / 173 files passed.
- Managed application suite: 2,154 cases / 13,665 assertions / 292 files passed; process and fixture cleanup passed. Neither suite retained results.
- TypeScript, lint, formatting, build, built Node video help, and ESM/CommonJS imports passed. The build retains the existing non-blocking TypeScript 7 API warning.

The prototype uses integer-millisecond fixtures; exact real-tool timing is Phase 3 work. Production registration/integration, image names/publication, media extraction, heavy workloads, minimum Node version, and other platforms remain unverified. Private processing smoke: **not tested**. Generated/private video smoke remains outside regular suites and CI.

The complete phase-range review remains pending; plan task closeout follows that review.

## Related Research

- [Video Frame Selection, Frame Sets, and Sequence Export](../../researches/research-2026-09-30-video-frames.md)
