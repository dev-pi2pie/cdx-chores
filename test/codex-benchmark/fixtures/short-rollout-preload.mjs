import { mock } from "bun:test";
import { readSavedTurn } from "../../../src/adapters/codex/benchmark/rollout.ts";

// Keep real rollout reads and retries. Shorten readback only for the selected turn.
const turnId = process.env.FIXTURE_SHORT_ROLLOUT_TURN;
if (turnId) {
  const read = readSavedTurn;
  mock.module("../../../src/adapters/codex/benchmark/rollout.ts", () => ({
    readSavedTurn(options) {
      return read(options.turnId === turnId ? { ...options, deadlineMs: 250 } : options);
    },
  }));
}
