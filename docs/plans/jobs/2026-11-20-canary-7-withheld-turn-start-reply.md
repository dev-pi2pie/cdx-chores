---
title: "v0.2.2-canary.7 withheld turn/start replies"
created-date: 2026-11-20
status: completed
agent: codex
---

Compared the built Node benchmark and the Bun Standard/Fast live check at `0618462b` on macOS with Node.js 24.22.3 and Bun 1.4.5. A synthetic app-server announced Standard, recorded interrupts and archive requests, and tracked whether Standard was still active when Fast started. Both callers requested archive. [Earlier investigation](2026-11-20-canary-7-turn-reporting-and-shutdown.md)

## Full-deadline observations

Across 12 runs, the callers used the configured 15-second start RPC timeout and 120-second completion wait. The RPC clock starts at dispatch. The completion wait can begin only once the caller accepts the turn ID. With the start reply withheld and no matching terminal event, neither caller reached that wait or sent an interrupt.

| Standard turn | Built benchmark | Standard/Fast live check |
| --- | --- | --- |
| Normal start reply and completion | Archived Standard, then started Fast. | Same order. |
| Reply withheld, matching completion after about 250 ms | Recovered the turn ID, archived Standard, then started Fast. | Received the completion, reported a start timeout, and skipped archive. Standard had finished when Fast started. |
| Reply withheld, Standard still active at the RPC timeout | Retained the announced ID, skipped archive, and stopped scheduling. | Skipped archive and started Fast while Standard was active. |
| Reply received, Standard active at the completion deadline | Interrupted the identified turn. A matching terminal event permitted archive and Fast. An acknowledgement alone left archive skipped and Fast blocked. | Sent no interrupt, skipped archive, and started Fast while Standard was active in both controls. |

## Reusable comparison

The manual spike repeats four scenarios for both callers. It keeps the 15-second RPC timeout and shortens the completion wait to 500 ms. A clean checkout produced all eight observations in 19.46 seconds, including the build. The scheduling, archive, and interrupt outcomes agreed with the corresponding full-deadline runs. Native provider behavior and the frequency of these sequences remain open. [Spike command and output guide](../../../scripts/spikes/codex-turn-lifecycle/README.md) · [Implementation direction](../../researches/research-2026-11-19-codex-turn-reporting-and-process-shutdown.md#implementation-direction)
