---
title: "Canary.7 turn reporting, shutdown, and application-suite investigation"
created-date: 2026-11-20
status: completed
agent: codex
---

Tested `v0.2.2-canary.7` at `0618462b` on macOS arm64 with Node.js 24.22.3 and Bun 1.4.5. The SDK and bundled CLI were 0.171.0. The benchmark used the built Node CLI and a synthetic app-server with one warm-up and one measured trial. The native Codex executable was checked for its version. [Dependency refresh](2026-11-20-v0.2.2-canary.7-dependency-refresh.md)

| Check | Observed outcome |
| --- | --- |
| Turn dispatch | When the measured write was refused locally, the server received only the warm-up. When the write was queued and the server rejected it, the server trace showed both requests. Both reports marked the measured trial attempted at the `default` tier and labelled the warm-up’s 230 known tokens as partial usage. Only the queued rejection warranted that reporting. |
| Shutdown after both turns completed | With escalation allowed, the CLI exited 0 with both trials in JSON and the owned group was empty. With the leader still alive and group `SIGKILL` denied, the CLI exited 1 after 1.233 seconds with empty stdout. An independent process check found the leader and worker alive at CLI exit and confirmed their group was empty after fixture cleanup. |
| Managed suite cancellation | The managed runner executed a synthetic suite body that attempted fixture B after A settled. In the control, both completed. When the runner delivered cancellation during A, A recorded a stopped cancellation. B then acquired a new PID and completed. |
| Application-suite timing | Three isolated sequential runs each passed all 2,484 cases. The test process took 261.804, 251.235, and 259.019 seconds. All exceeded the 240-second reassessment threshold. Video and Codex benchmark tests accounted for the most summed case time. |

The research records the resulting implementation direction. [Turn reporting and process shutdown](../../researches/research-2026-11-19-codex-turn-reporting-and-process-shutdown.md#implementation-direction) · [Timeout reassessment criteria](2026-10-18-application-test-costs-and-timeout-budgeting.md#timeout-decision)

Follow-up: [v0.2.2-canary.7 withheld `turn/start` reply investigation](2026-11-20-canary-7-withheld-turn-start-reply.md).
