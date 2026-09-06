import { describe, expect, test } from "bun:test";

import { runCli } from "../../helpers/cli-test-utils";

describe("data Parquet preview command UX", () => {
  test("data parquet preview renders relative input paths by default", () => {
    const result = runCli([
      "data",
      "parquet",
      "preview",
      "test/fixtures/parquet-preview/basic.parquet",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Input: test/fixtures/parquet-preview/basic.parquet");
    expect(result.stdout).toContain("Format: parquet");
    expect(result.stdout).toContain("name");
  });

  test("data parquet preview help documents supported bounded-preview options only", () => {
    const result = runCli(["data", "parquet", "preview", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--rows <value>");
    expect(result.stdout).toContain("--offset <value>");
    expect(result.stdout).toContain("--columns <names>");
    expect(result.stdout).not.toContain("--contains");
  });

  test("data parquet preview rejects unsupported contains filtering at CLI parsing time", () => {
    const result = runCli([
      "data",
      "parquet",
      "preview",
      "test/fixtures/parquet-preview/basic.parquet",
      "--contains",
      "status:active",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("unknown option '--contains'");
  });
});
