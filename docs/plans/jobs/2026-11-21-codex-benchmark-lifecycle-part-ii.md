---
title: "Codex benchmark lifecycle corrections, Part II — Implementation record"
created-date: 2026-11-21
modified-date: 2026-11-21
status: in-progress
agent: codex
---

The [Part II plan](../plan-2026-11-21-codex-benchmark-lifecycle-part-ii.md) tracks the remaining work. Earlier results are in the [Part I job record](2026-11-20-codex-benchmark-lifecycle-corrections.md).

## Both Node callers received HUP during initialization

The four [Phase 1 regression cases](../../../test/codex-benchmark/hangup.app.test.ts) exercised the built benchmark CLI and maintainer live check with a TERM-resistant fixture leader and worker on macOS. The parent verified both process groups before sending HUP and sampled the app-server group at caller exit, before teardown. [Phase 1 checklist](../plan-2026-11-21-codex-benchmark-lifecycle-part-ii.md#phase-1-hangup-cleanup-in-both-node-callers)

| Caller HUP policy | Before the fix at `c482d937`, both callers |
| --- | --- |
| Default | Terminated by HUP with the leader and worker still live. |
| Installed handler sets exit 42 | Reached `initialize-fallback`, then exited 1 with zero live members. |
