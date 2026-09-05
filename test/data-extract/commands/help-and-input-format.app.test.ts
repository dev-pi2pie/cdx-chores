import { describe, expect, test } from "bun:test";

import { runCli } from "../../helpers/cli-test-utils";

describe("data extract command help and input format", () => {
  test("data extract help documents shaping, reviewed header suggestions, and output options", () => {
    const result = runCli(["data", "extract", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--input-format <format>");
    expect(result.stdout).toContain("--source <name>");
    expect(result.stdout).toContain("--range <A1:Z99>");
    expect(result.stdout).toContain("--no-header");
    expect(result.stdout).toContain("--body-start-row <value>");
    expect(result.stdout).toContain("--header-row <value>");
    expect(result.stdout).toContain("--source-shape <path>");
    expect(result.stdout).toContain("--codex-suggest-shape");
    expect(result.stdout).toContain("--write-source-shape <path>");
    expect(result.stdout).toContain("--header-mapping <path>");
    expect(result.stdout).toContain("--codex-suggest-headers");
    expect(result.stdout).toContain("--write-header-mapping <path>");
    expect(result.stdout).toContain("--output <path>");
    expect(result.stdout).toContain("--overwrite");
    expect(result.stdout).not.toContain("--sql");
  });

  test("data extract rejects invalid input-format values at CLI parsing time", () => {
    const result = runCli([
      "data",
      "extract",
      "sample.csv",
      "--output",
      "sample.json",
      "--input-format",
      "json",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--input-format must be one of:");
  });
});
