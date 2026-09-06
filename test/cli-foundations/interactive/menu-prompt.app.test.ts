import { describe, expect, test } from "bun:test";

describe("interactive command menu prompt helper", () => {
  test("preserves real select search behavior for q-prefixed menu entries", async () => {
    const result = Bun.spawnSync({
      cmd: [process.execPath, import.meta.dir + "/real-select-search-fixture.ts"],
      stdout: "pipe",
      stderr: "pipe",
    });

    expect({
      exitCode: result.exitCode,
      stderr: result.stderr.toString(),
      stdout: result.stdout.toString(),
    }).toEqual({ exitCode: 0, stderr: "", stdout: "query\n" });
  });
});
