import { describe, expect, test } from "bun:test";

import { runCli } from "../../helpers/cli-test-utils";

describe("CLI UX flags and path output", () => {
  test("data query codex help documents intent, shaping, and print-sql options", () => {
    const result = runCli(["data", "query", "codex", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--intent <text>");
    expect(result.stdout).toContain("--input-format <format>");
    expect(result.stdout).toContain("--relation <binding>");
    expect(result.stdout).toContain("--source <name>");
    expect(result.stdout).toContain("--range <A1:Z99>");
    expect(result.stdout).toContain("--body-start-row <value>");
    expect(result.stdout).toContain("--header-row <value>");
    expect(result.stdout).toContain("--print-sql");
  });

  test("data query codex rejects invalid input-format values at CLI parsing time", () => {
    const result = runCli([
      "data",
      "query",
      "codex",
      "sample.csv",
      "--intent",
      "show rows",
      "--input-format",
      "json",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--input-format must be one of:");
  });
});
