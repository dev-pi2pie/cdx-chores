import { describe, expect, test } from "bun:test";

import { inspectCommand } from "../../../src/cli/deps";
import type { ExecCommandResult } from "../../../src/cli/process";

function ok(stdout = "", stderr = ""): ExecCommandResult {
  return {
    ok: true,
    code: 0,
    signal: null,
    stdout,
    stderr,
  };
}

describe("CLI dependency command inspection", () => {
  test("inspectCommand parses WeasyPrint version labels", async () => {
    const versions = [
      ["WeasyPrint version 67.0\n", "67.0"],
      ["WeasyPrint version: 67.0\n", "67.0"],
      ["System: test\nVersion: 67.0\n", "67.0"],
    ] as const;

    for (const [stdout, expectedVersion] of versions) {
      const status = await inspectCommand("weasyprint", "darwin", async () => ok(stdout));
      expect(status).toMatchObject({
        available: true,
        version: expectedVersion,
      });
    }
  });

  test("inspectCommand parses fontconfig version labels", async () => {
    const status = await inspectCommand("fc-query", "darwin", async () =>
      ok("fontconfig version 2.15.0\n"),
    );

    expect(status).toMatchObject({
      available: true,
      version: "2.15.0",
    });
  });

  test("inspectCommand treats missing fontconfig commands as optional unavailable tools", async () => {
    const status = await inspectCommand("fc-list", "darwin", async () => {
      throw new Error("spawn fc-list ENOENT");
    });

    expect(status).toMatchObject({
      name: "fc-list",
      available: false,
      version: null,
      installHint: "brew install fontconfig",
    });
  });
});
