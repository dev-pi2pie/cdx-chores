import { describe, expect, test } from "bun:test";

import { runCli } from "../../helpers/cli-test-utils";

describe("CLI UX flags and path output", () => {
  test("data query help documents SQL, shaping, header review, source, and output options", () => {
    const result = runCli(["data", "query", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--sql <query>");
    expect(result.stdout).toContain("--input-format <format>");
    expect(result.stdout).toContain("--relation <binding>");
    expect(result.stdout).toContain("--source <name>");
    expect(result.stdout).toContain("--range <A1:Z99>");
    expect(result.stdout).toContain("--source-shape <path>");
    expect(result.stdout).toContain("--no-header");
    expect(result.stdout).toContain("--body-start-row <value>");
    expect(result.stdout).toContain("--header-row <value>");
    expect(result.stdout).toContain("--header-mapping <path>");
    expect(result.stdout).toContain("--codex-suggest-headers");
    expect(result.stdout).toContain("--write-header-mapping <path>");
    expect(result.stdout).toContain("--rows <value>");
    expect(result.stdout).toContain("--json");
    expect(result.stdout).toContain("--pretty");
    expect(result.stdout).toContain("--output <path>");
    expect(result.stdout).toContain("codex");
  });

  test("data query rejects invalid input-format values at CLI parsing time", () => {
    const result = runCli([
      "data",
      "query",
      "sample.csv",
      "--sql",
      "select * from file",
      "--input-format",
      "json",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--input-format must be one of:");
  });
});
