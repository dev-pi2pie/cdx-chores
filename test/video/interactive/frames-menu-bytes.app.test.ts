import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { runFrameMenuFixture } from "./fixtures/frames-menu-fixture";

const rawObservations = new Map<string, unknown>();

for (const scenario of [
  "raw-select-back-and-reuse",
  "raw-simple-draft-return",
  "raw-inline-draft-return",
  "raw-inline-path-return",
  "raw-simple-path-return",
  "raw-fragmented-arrows",
])
  test(
    "Node frame menu bytes preserve " + scenario,
    async () => {
      const receipt = await runFrameMenuFixture("frames-menu-byte-input.ts", scenario);
      expect(receipt).toEqual({
        scenario,
        method: "raw",
        observation: expect.any(Object),
        passed: true,
      });
      rawObservations.set(scenario, (receipt as { observation: unknown }).observation);
    },
    20_000,
  );

// Separate driver invocations keep parity work inside each test's ownership budget.
for (const scenario of [
  "raw-simple-draft-return",
  "raw-inline-draft-return",
  "raw-inline-path-return",
  "raw-simple-path-return",
])
  test(
    "Node decoded Escape agrees with " + scenario,
    async () => {
      assert(rawObservations.has(scenario), "Missing raw observation for " + scenario);
      const receipt = await runFrameMenuFixture("frames-menu-byte-input.ts", scenario, "decoded");
      expect(receipt).toEqual({
        scenario,
        method: "decoded",
        observation: rawObservations.get(scenario),
        passed: true,
      });
    },
    20_000,
  );
