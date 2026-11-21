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

| HUP policy, both callers | Before at `c482d937` | After at `39c4cca0` |
| --- | --- | --- |
| Default | Terminated by HUP with the leader and worker still live. | Terminated by HUP with zero live group members. |
| Installed handler sets exit 42 | Reached `initialize-fallback`, then exited 1 with zero live members. | Exited 42 with zero live group members. |

All four fixed cases observed group TERM followed by KILL, caller exit within 2.5 seconds of HUP, and no initialization fallback. After ordinary completion, both callers restored the original HUP listener count and terminated on a later default HUP.

| Checkpoint | Evidence |
| --- | --- |
| Implementation `75707fda` | Shared HUP cleanup starts at detached launch and uses the existing bounded group shutdown. |
| Review `c482d937..75707fda` | Mixed signals could overwrite the initiating outcome. Tests also needed to cover ordinary listener release and concurrent owners. |
| Correction `39c4cca0` | Both callers retained 42 for installed HUP followed by TERM and 143 for TERM followed by default HUP. TERM interrupted a known benchmark turn and preserved its partial report through HUP. Default TERM emptied both groups when the benchmark and doctor ran in one process. |
| Controls | 186 focused tests passed. The live check closed immediately on INT/TERM with exit 130/143. Doctor, SDK retention, denied and undelivered escalation, and direct and managed teardown after assertion failure passed. |
| Managed suites at `39c4cca0` | 2,687 Application and 39 Codex cases passed with zero failures, errors or skips. Application test-process execution took 346.115 seconds against the 360-second limit. Both runs verified shutdown without escalation and removed scratch and results. |
| Tooling | The Node build, packaged CLI help, TypeScript, lint, changed-file formatting and diff checks passed. |
| Re-review `c482d937..39c4cca0` | Code and test reviewers found no remaining material issues. |
