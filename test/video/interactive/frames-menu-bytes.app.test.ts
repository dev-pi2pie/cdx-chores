import { expect, test } from "bun:test";
import { runFrameMenuFixture } from "./fixtures/frames-menu-fixture";

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
    },
    20_000,
  );
