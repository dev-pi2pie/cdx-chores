import { describe, expect, test } from "bun:test";

import { defaultFontDiscoveryRunner } from "../../../src/fonts";

describe("font discovery cancellation and timeout controls", () => {
  test("aborts the default runner child process", async () => {
    const controller = new AbortController();
    const startedAt = Date.now();
    const pending = defaultFontDiscoveryRunner(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      { signal: controller.signal, timeoutMs: 5_000 },
    );
    setTimeout(() => controller.abort(), 25);

    const result = await pending;

    expect(result.ok).toBe(false);
    expect(result.failureKind).toBeUndefined();
    expect("failureKind" in result).toBe(false);
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });

  test("applies an explicit runner timeout without changing the default contract", async () => {
    const startedAt = Date.now();
    const result = await defaultFontDiscoveryRunner(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      { timeoutMs: 25 },
    );

    expect(result.ok).toBe(false);
    expect(result.failureKind).toBe("timeout");
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });
});
