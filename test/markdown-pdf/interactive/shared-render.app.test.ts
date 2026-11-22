import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";

const harness = fileURLToPath(new URL("./fixtures/phase-2-render.ts", import.meta.url));

describe("Interactive Markdown PDF shared render execution", () => {
  test.each([
    ["prepared", ["Report"], 0],
    ["retry", ["Report", "Revised report"], 1],
  ] as const)(
    "uses the real shared service for %s rendering",
    async (mode, snapshots, retries) => {
      await withTempFixtureDir("md-pdf-interactive-shared-render", async (cwd) => {
        const child = startFixtureProcess({
          executable: process.execPath,
          args: [harness, mode, cwd],
          env: { ...process.env, PATH: "", TMPDIR: cwd },
          cwd,
          timeoutMs: 10_000,
          graceMs: 250,
          cleanupMs: 1_500,
        });
        child.child.stdin.end();
        const result = await child.completion;
        expect(result.stopped).toBe(true);
        expect(result.stderr).toBe("");
        expect(result.ok).toBe(true);
        expect(JSON.parse(result.stdout)).toEqual({
          snapshots,
          conversions: snapshots.length * 2,
          retries,
          distinctCheckpoints: snapshots.length,
        });
      });
    },
    15_000,
  );
});
