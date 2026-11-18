---
title: "Codex CLI Benchmark Implementation"
created-date: 2026-11-18
status: in-progress
agent: codex
---

This record tracks all six phases of the [benchmark implementation plan](../plan-2026-11-18-codex-cli-benchmark.md). The [research](../../researches/research-2026-11-18-codex-cli-benchmark.md) records the design and live-check evidence.

## Phase 1. Offline Rollout Recovery

Completed offline rollout recovery verification. The spike and the fixtures use the [same rollout reader](../../../scripts/spikes/codex-benchmark-rollout.ts). The [application fixtures](../../../test/codex-benchmark/rollout-recovery.app.test.ts) use real JSONL in an isolated Codex home and wait for the fake app-server process group to stop before removing it.

- The reader starts its 2 s recovery window when the matching turn completes and retries every 50 ms. The deadline fixtures use a 300 ms budget. The delayed-write fixture finishes the record only after the first read. The fallback fixture asserts two lookups for the original thread ID and a read of the returned path.
- Deadline and interruption fixtures preserve only attributable cumulative usage, flag incomplete usage, and leave unavailable saved metrics empty. Retention fixtures cover omitted and explicit keep, archive and delete after readback, archive after expiry, cleanup failures, and skipped cleanup without confirmed completion. An unrelated synthetic rollout stays untouched.
- `bun test --path-ignore-patterns='**/fixtures/**' --rerun-each=3 ./test/codex-benchmark/rollout-recovery.app.test.ts` passed all 14 cases in each run. TypeScript, lint, format check, `git diff --check`, and the Node `--help` smoke check passed.
- `bun run test:integration:app` passed 2,388 cases at checkpoint `9f92d1b3` after rerunning with process observation available. The focused fixtures were rerun after the review fixes.
- Code and test review covered `9d79cc5e..d6f70562`. The re-review confirmed that the fixtures use the production file reader and confirm process shutdown before scratch cleanup. No material findings remained.
