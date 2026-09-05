import { describe, expect, test } from "bun:test";
import { once } from "node:events";
import { access } from "node:fs/promises";

import { withLiveCodexFixture } from "./live-fixture";

describe("Codex live fixture ownership", () => {
  test("cleans up a rejected configuration without replacing its original failure", async () => {
    const original = new Error("configuration rejected");
    let scratch = "";
    const run = withLiveCodexFixture(async ({ root, start, close }) => {
      scratch = root;
      const owned = start({ executable: process.execPath, args: ["-e", "process.exit(1)"] });
      await once(owned.child, "exit");
      await close(owned);
      const result = await owned.completion;
      expect(result.exitCode).toBe(1);
      expect(result.reason).toBe("exit-failed");
      expect(result.stopped).toBe(true);
      throw original;
    });
    await expect(run).rejects.toBe(original);
    await expect(access(scratch)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("retains the original failure alongside a bounded execution failure", async () => {
    const original = new Error("assertion failed");
    let scratch = "";
    let failure: unknown;
    try {
      await withLiveCodexFixture(async ({ root, start }) => {
        scratch = root;
        const owned = start({
          executable: process.execPath,
          args: ["-e", "setInterval(() => {}, 1000)"],
          timeoutMs: 100,
        });
        const result = await owned.completion;
        expect(result.reason).toBe("timeout");
        expect(result.stopped).toBe(true);
        throw original;
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AggregateError);
    const errors = (failure as AggregateError).errors;
    expect(errors[0]).toBe(original);
    expect(errors[1].message).toContain('"reason":"timeout"');
    await expect(access(scratch)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
