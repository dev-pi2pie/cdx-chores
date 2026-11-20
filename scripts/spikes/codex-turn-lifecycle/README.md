# Can Fast start while Standard is still active?

Use macOS with Node.js 24.22.3 and Bun 1.4.5 on `PATH`. Install the locked dependencies with `bun install --frozen-lockfile` and run this command from the repository root.

```sh
bun run build && bun scripts/spikes/codex-turn-lifecycle/run.ts
```

The command builds the Node CLI and runs it alongside the Bun Standard/Fast live check. Each case gets its own copy of the fixture's state and an isolated Codex home. The fixture provides the model catalog, rollouts, and archive responses. It announces the first Standard turn and leaves it active until it emits a matching terminal event. Later turns complete normally.

| Control             | First Standard turn                                                             |
| ------------------- | ------------------------------------------------------------------------------- |
| Normal              | Start reply and matching completion                                             |
| No reply + terminal | Matching completion immediately after the start notification                    |
| No reply + active   | No start reply or matching completion                                           |
| Reply + ack only    | Start reply. Any interrupt is acknowledged and matching completion is withheld. |

The start RPC timeout is the real 15 seconds. The spike shortens the 120-second turn completion deadline to 500 ms in the two caller processes. The interrupt RPC, interrupt confirmation, and rollout readback retain their two-second budgets. Cases run concurrently and normally take about 18 seconds after the build. A 30-second watchdog bounds each invocation.

**Terminal** is confirmed when the fixture emitted a matching Standard terminal event and the caller reported its turn ID and requested archive. **Emitted only** records a fixture notification without that caller confirmation. **Archive** is Standard's reported retention result. **Fast overlap** compares the first Fast start notification with Standard's terminal event. **None** in the interrupt column means the caller sent no interrupt.

The table includes each caller's exit status. The spike succeeds when it collected all eight observations, including expected caller failures in the fault cases. Inspect the reported ignored scratch directory for the individual JSON reports, stderr, and protocol traces. No account or live Codex service is required.
