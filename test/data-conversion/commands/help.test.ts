import { describe, expect, test } from "bun:test";

import { runCli } from "../../helpers/cli-test-utils";

describe("data conversion command help", () => {
  test("data csv-to-tsv help does not expose JSON-only pretty printing", () => {
    const result = runCli(["data", "csv-to-tsv", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("--pretty");
    expect(result.stdout).toContain("Input CSV file");
  });

  test("data tsv-to-json help exposes pretty printing for JSON output", () => {
    const result = runCli(["data", "tsv-to-json", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--pretty");
    expect(result.stdout).toContain("Input TSV file");
  });
});
