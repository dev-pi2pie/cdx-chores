import { describe, expect, test } from "bun:test";

import { defaultFontDiscoveryRunner, discoverSystemFonts } from "../src/fonts";
import type { FontDiscoveryRunOptions } from "../src/fonts";

describe("font discovery cancellation and timeout controls", () => {
  test("forwards additive run controls to explicit fontconfig discovery", async () => {
    const controller = new AbortController();
    let received: FontDiscoveryRunOptions | undefined;

    await discoverSystemFonts({
      discovery: "fontconfig",
      platform: "darwin",
      runner: async (_command, _args, options) => {
        received = options;
        return { ok: false, stdout: "", stderr: "unavailable" };
      },
      signal: controller.signal,
      timeoutMs: 1_000,
    });

    expect(received).toEqual({ signal: controller.signal, timeoutMs: 1_000 });
  });

  test("keeps the same controls when macOS auto discovery falls back", async () => {
    const controller = new AbortController();
    const received: Array<FontDiscoveryRunOptions | undefined> = [];

    await discoverSystemFonts({
      platform: "darwin",
      runner: async (command, _args, options) => {
        received.push(options);
        if (command === "fc-list") {
          return { ok: false, stdout: "", stderr: "unavailable" };
        }
        return { ok: true, stdout: JSON.stringify({ SPFontsDataType: [] }), stderr: "" };
      },
      signal: controller.signal,
      timeoutMs: 750,
    });

    expect(received).toEqual([
      { signal: controller.signal, timeoutMs: 750 },
      { signal: controller.signal, timeoutMs: 750 },
    ]);
  });

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
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });
});
