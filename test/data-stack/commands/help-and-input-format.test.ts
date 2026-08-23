import { describe, expect, test } from "bun:test";

import { runCli } from "../../helpers/cli-test-utils";

describe("data stack command help and input format", () => {
  test("data stack help documents mixed-source discovery and output options", () => {
    const result = runCli(["data", "stack", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--input-format <format>");
    expect(result.stdout).toContain("--pattern <glob>");
    expect(result.stdout).toContain("--no-header");
    expect(result.stdout).toContain("--columns <names>");
    expect(result.stdout).toContain("--recursive");
    expect(result.stdout).toContain("--max-depth <value>");
    expect(result.stdout).toContain("--output <path>");
    expect(result.stdout).toContain("--overwrite");
    expect(result.stdout).toContain("Input source file or directory");
  });

  test("data stack rejects invalid input-format values at CLI parsing time", () => {
    const result = runCli([
      "data",
      "stack",
      "sample.csv",
      "--output",
      "merged.csv",
      "--input-format",
      "parquet",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--input-format must be one of:");
  });
});
