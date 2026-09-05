import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { actionDataParquetPreview } from "../../../src/cli/actions";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import { REPO_ROOT, toRepoRelativePath } from "../../helpers/cli-test-utils";

function parquetFixturePath(name: string): string {
  return join(REPO_ROOT, "test", "fixtures", "parquet-preview", name);
}

describe("cli action modules: data parquet preview", () => {
  test("actionDataParquetPreview renders Parquet summary and table output", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    const inputPath = parquetFixturePath("basic.parquet");

    await actionDataParquetPreview(runtime, {
      input: toRepoRelativePath(inputPath),
    });

    expectNoStderr();
    expect(stdout.text).toContain(`Input: ${toRepoRelativePath(inputPath)}`);
    expect(stdout.text).toContain("Format: parquet");
    expect(stdout.text).toContain("Rows: 3");
    expect(stdout.text).toContain("Window: 1-3 of 3");
    expect(stdout.text).toContain("Visible columns: id, name, status, created_at");
    expect(stdout.text).toContain("Ada");
  });

  test("actionDataParquetPreview applies column filtering and row windowing", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    const inputPath = parquetFixturePath("large.parquet");

    await actionDataParquetPreview(runtime, {
      input: toRepoRelativePath(inputPath),
      columns: ["id", "status"],
      offset: 1,
      rows: 1,
    });

    expectNoStderr();
    expect(stdout.text).toContain("Window: 2-2 of 250");
    expect(stdout.text).toContain("Visible columns: id, status");
    expect(stdout.text).toContain("2   | draft");
    expect(stdout.text).not.toContain("1  | paused");
  });

  test("actionDataParquetPreview rejects unknown requested columns", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();
    const inputPath = parquetFixturePath("basic.parquet");

    await expectCliError(
      () =>
        actionDataParquetPreview(runtime, {
          input: toRepoRelativePath(inputPath),
          columns: ["owner"],
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Unknown columns: owner",
      },
    );

    expectNoOutput();
  });

  test("actionDataParquetPreview surfaces invalid Parquet load failures", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();
    const inputPath = parquetFixturePath("invalid.parquet");

    await expectCliError(
      () =>
        actionDataParquetPreview(runtime, {
          input: toRepoRelativePath(inputPath),
        }),
      {
        code: "PARQUET_PREVIEW_FAILED",
        exitCode: 2,
        messageIncludes: "Failed to preview Parquet file:",
      },
    );

    expectNoOutput();
  });
});
