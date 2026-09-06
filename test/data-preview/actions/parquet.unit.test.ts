import { describe, test } from "bun:test";
import { join } from "node:path";

import { actionDataParquetPreview } from "../../../src/cli/actions/data-parquet-preview";
import { actionDataPreview } from "../../../src/cli/actions/data-preview";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import { REPO_ROOT, toRepoRelativePath } from "../../helpers/cli-test-utils";

function parquetFixturePath(name: string): string {
  return join(REPO_ROOT, "test", "fixtures", "parquet-preview", name);
}

describe("cli action modules: data parquet preview", () => {
  test("actionDataPreview still rejects Parquet inputs on the lightweight path", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();
    const inputPath = parquetFixturePath("basic.parquet");

    await expectCliError(
      () =>
        actionDataPreview(runtime, {
          input: toRepoRelativePath(inputPath),
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Unsupported preview file type:",
      },
    );

    expectNoOutput();
  });

  test("actionDataParquetPreview rejects non-parquet inputs before DuckDB runs", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataParquetPreview(runtime, {
          input: "package.json",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: ".parquet input file",
      },
    );

    expectNoOutput();
  });

  test("actionDataParquetPreview surfaces missing file failures clearly", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataParquetPreview(runtime, {
          input: "test/fixtures/data-preview/missing.parquet",
        }),
      {
        code: "FILE_NOT_FOUND",
        exitCode: 2,
        messageIncludes: "Input file not found:",
      },
    );

    expectNoOutput();
  });

  test("actionDataParquetPreview surfaces DuckDB initialization failures", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();
    const inputPath = parquetFixturePath("basic.parquet");

    await expectCliError(
      () =>
        actionDataParquetPreview(
          runtime,
          {
            input: toRepoRelativePath(inputPath),
          },
          {
            loadDuckDb: async () => ({
              DuckDBConnection: {
                create: async () => {
                  throw new Error("native initialization failed");
                },
              },
            }),
          },
        ),
      {
        code: "DUCKDB_UNAVAILABLE",
        exitCode: 2,
        messageIncludes: "DuckDB is unavailable for Parquet preview: native initialization failed",
      },
    );

    expectNoOutput();
  });
});
