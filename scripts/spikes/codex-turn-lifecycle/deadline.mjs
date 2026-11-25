// Only loaded in the two observation callers. The RPC and interrupt timers keep their durations.
const timeout = AbortSignal.timeout.bind(AbortSignal);
AbortSignal.timeout = (ms) => timeout(ms === 120_000 ? 500 : ms);
