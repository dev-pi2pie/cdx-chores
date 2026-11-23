---
title: "Dev against canary review follow-up"
created-date: 2026-11-22
modified-date: 2026-11-22
status: completed
agent: codex
---

Follow-up for the review against `canary` at merge base `0dd77cf5`.

## Retained fix

| Fix | Commit | Verification |
| --- | --- | --- |
| Codex benchmark preserves confirmed completion when stdout closes before the start reply. It reports transport failure separately and skips retention. | `0428193a` | Node fixtures cover both callers, EOF before and after completion, and retention. Unit tests reject unrelated completion evidence. [EOF fixtures](../../../test/codex-benchmark/app-server-exit.app.test.ts) |

## Conclusion

The restored `dev` tree matched `0428193a` and passed 2,190 Unit and 5 Pandoc cases. Follow-up questions are tracked in the [Markdown PDF HTML boundary research](../../researches/research-2026-11-22-markdown-pdf-html-boundaries.md).
