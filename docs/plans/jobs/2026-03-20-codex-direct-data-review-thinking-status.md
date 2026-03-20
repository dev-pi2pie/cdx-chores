---
title: "Codex direct data review thinking status"
created-date: 2026-03-20
status: completed
agent: codex
---

Added the missing TTY Codex thinking/progress surface for direct reviewed data flows that call Codex outside the interactive menu wrappers.

What changed:

- wired the existing analyzer status primitive into direct `data extract --codex-suggest-shape`
- wired the same status surface into the shared direct header-suggestion flow used by `data extract --codex-suggest-headers` and `data query --codex-suggest-headers`
- added focused TTY action tests covering:
  - direct source-shape review status
  - direct header-review status

Why:

- the interactive data shaping flows already showed the Codex thinking surface
- the direct reviewed CLI flows were calling the same Codex suggestion helpers without the TTY status wrapper
- that made direct `--codex-suggest-shape` feel stalled even though the Codex request was running

Verification:

- `bun test test/cli-actions-data-extract.test.ts test/cli-actions-data-query.test.ts test/cli-interactive-analyzer-status.test.ts`
- `bun test test/cli-command-data-extract.test.ts test/cli-command-data-query.test.ts`
