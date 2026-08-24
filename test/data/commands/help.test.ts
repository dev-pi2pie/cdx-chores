import { describe, expect, test } from "bun:test";

import { runCli } from "../../helpers/cli-test-utils";

describe("data command help", () => {
  test("data help reflects preview, stack, and conversion workflows", () => {
    const result = runCli(["data", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(
      "Data preview, extract, stack, query, and conversion utilities",
    );
    expect(result.stdout).toContain("json-to-csv");
    expect(result.stdout).toContain("json-to-tsv");
    expect(result.stdout).toContain("csv-to-json");
    expect(result.stdout).toContain("csv-to-tsv");
    expect(result.stdout).toContain("tsv-to-csv");
    expect(result.stdout).toContain("tsv-to-json");
    expect(result.stdout).toContain("extract");
    expect(result.stdout).toContain("preview");
    expect(result.stdout).toContain("parquet");
    expect(result.stdout).toContain("query");
    expect(result.stdout).toContain("stack");
  });
});
