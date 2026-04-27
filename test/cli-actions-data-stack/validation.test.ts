import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { actionDataStack } from "../../src/cli/actions";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";

describe("cli action modules: data stack validation", () => {
  test("actionDataStack rejects duplicate rows before writing when policy is reject", async () => {
    await withTempFixtureDir("data-stack-action-duplicate-reject", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id,status\n1,active\n1,active\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            onDuplicate: "reject",
            output: "merged.csv",
            sources: ["a.csv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "exact duplicate rows found",
        },
      );
      expectNoOutput();
      await expect(readFile(join(fixtureDir, "merged.csv"), "utf8")).rejects.toThrow();
    });
  });

  test("actionDataStack validates unique key names against output schema", async () => {
    await withTempFixtureDir("data-stack-action-unique-missing", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id,status\n1,active\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            sources: ["a.csv"],
            uniqueBy: ["missing"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unknown --unique-by names",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects duplicate header names before JSON materialization", async () => {
    await withTempFixtureDir("data-stack-action-json-duplicate-header", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.json");
      await writeFile(join(fixtureDir, "rows.csv"), "id,value,value\n1,first,second\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.json",
            overwrite: true,
            sources: ["rows.csv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "JSON stack output requires unique column or key names",
        },
      );
      expectNoOutput();
      await expect(readFile(outputPath, "utf8")).rejects.toThrow();
    });
  });

  test("actionDataStack rejects JSON array key mismatches in strict mode", async () => {
    await withTempFixtureDir("data-stack-action-json-mismatch", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "rows.json"),
        JSON.stringify([
          { id: "evt-001", status: "active" },
          { id: "evt-002", action: "login" },
        ]),
        "utf8",
      );

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            sources: ["rows.json"],
          }),
        {
          code: "DATA_STACK_SCHEMA_MISMATCH",
          exitCode: 2,
          messageIncludes: "JSON key mismatch",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects duplicate header names in union-by-name mode", async () => {
    await withTempFixtureDir("data-stack-action-union-duplicate-header", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "parts");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, "a.csv"), "id,value,value\n1,first,second\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            overwrite: true,
            sources: ["parts"],
            unionByName: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Duplicate column or key name",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects mixed normalized formats", async () => {
    await withTempFixtureDir("data-stack-action-mixed-format", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id,name\n1,Ada\n", "utf8");
      await writeFile(join(fixtureDir, "b.tsv"), "id\tname\n2\tBob\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            sources: ["a.csv", "b.tsv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Mixed normalized input formats are not supported for data stack",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects --columns without --no-header", async () => {
    await withTempFixtureDir("data-stack-action-columns-without-no-header", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id,name\n1,Ada\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            columns: ["id", "name"],
            output: "merged.csv",
            sources: ["a.csv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--columns requires --no-header",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects --exclude-columns without --union-by-name", async () => {
    await withTempFixtureDir("data-stack-action-exclude-without-union", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "parts");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, "a.csv"), "id,name\n1,Ada\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            excludeColumns: ["name"],
            output: "merged.csv",
            sources: ["parts"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--exclude-columns requires --schema-mode union-by-name",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects --union-by-name with --no-header", async () => {
    await withTempFixtureDir("data-stack-action-union-no-header", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "parts");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, "a.csv"), "1,Ada\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            noHeader: true,
            output: "merged.csv",
            sources: ["parts"],
            unionByName: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--schema-mode union-by-name cannot be used with --no-header",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects unknown union exclusions after discovery", async () => {
    await withTempFixtureDir("data-stack-action-union-unknown-exclude", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "parts");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, "a.csv"), "id,name\n1,Ada\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            excludeColumns: ["missing"],
            output: "merged.csv",
            sources: ["parts"],
            unionByName: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unknown --exclude-columns names: missing",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects --no-header for JSONL inputs", async () => {
    await withTempFixtureDir("data-stack-action-jsonl-no-header", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            noHeader: true,
            output: join(fixtureDir, "merged.json"),
            sources: [join(REPO_ROOT, "examples/playground/stack-cases/jsonl-basic")],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--no-header is only valid for CSV and TSV stack inputs",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects explicit unsupported input files", async () => {
    await withTempFixtureDir("data-stack-action-unsupported", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.yaml"), "id: 1\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            sources: ["a.yaml"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unsupported stack file type",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack reports missing sources with the CLI file-not-found contract", async () => {
    await withTempFixtureDir("data-stack-action-missing-source", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            sources: ["missing.csv"],
          }),
        {
          code: "FILE_NOT_FOUND",
          exitCode: 2,
          messageIncludes: "Input source not found",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack refuses to overwrite an existing output file without --overwrite", async () => {
    await withTempFixtureDir("data-stack-action-existing-output", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id,name\n1,Ada\n", "utf8");
      await writeFile(join(fixtureDir, "merged.csv"), "original\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            sources: ["a.csv"],
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "Output file already exists",
        },
      );
      expect(await readFile(join(fixtureDir, "merged.csv"), "utf8")).toBe("original\n");
      expectNoOutput();
    });
  });

  test("actionDataStack rejects unsupported output extensions", async () => {
    await withTempFixtureDir("data-stack-action-output-format", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id,name\n1,Ada\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.parquet",
            sources: ["a.csv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unsupported --output extension",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects header mismatches", async () => {
    await withTempFixtureDir("data-stack-action-header-mismatch", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id,name,status\n1,Ada,active\n", "utf8");
      await writeFile(join(fixtureDir, "b.csv"), "id,name,state\n2,Bob,paused\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            sources: ["a.csv", "b.csv"],
          }),
        {
          code: "DATA_STACK_SCHEMA_MISMATCH",
          exitCode: 2,
          messageIncludes: "Header mismatch",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects headerless column-count mismatches across files", async () => {
    await withTempFixtureDir("data-stack-action-headerless-mismatch", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "1,Ada\n2,Bob\n", "utf8");
      await writeFile(join(fixtureDir, "b.csv"), "3,Cyd,active\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            noHeader: true,
            output: "merged.csv",
            sources: ["a.csv", "b.csv"],
          }),
        {
          code: "DATA_STACK_SCHEMA_MISMATCH",
          exitCode: 2,
          messageIncludes: "Headerless column count mismatch",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects JSONL key mismatches", async () => {
    await withTempFixtureDir("data-stack-action-jsonl-mismatch", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.jsonl"), '{"id":"evt-1","status":"active"}\n', "utf8");
      await writeFile(join(fixtureDir, "b.jsonl"), '{"id":"evt-2","state":"paused"}\n', "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.json",
            sources: ["a.jsonl", "b.jsonl"],
          }),
        {
          code: "DATA_STACK_SCHEMA_MISMATCH",
          exitCode: 2,
          messageIncludes: "JSONL key mismatch",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects malformed JSONL rows", async () => {
    await withTempFixtureDir("data-stack-action-jsonl-invalid", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.jsonl"), '{"id":"evt-1"}\n{"id":\n', "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.json",
            sources: ["a.jsonl"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Invalid JSONL row",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects non-object JSONL rows", async () => {
    await withTempFixtureDir("data-stack-action-jsonl-non-object", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.jsonl"), '{"id":"evt-1"}\n["evt-2"]\n', "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.json",
            sources: ["a.jsonl"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "JSONL rows must be JSON objects",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects empty JSONL files", async () => {
    await withTempFixtureDir("data-stack-action-jsonl-empty", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.jsonl"), "\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.json",
            sources: ["a.jsonl"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Input file has no JSONL rows",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects unsupported JSON stack shapes", async () => {
    await withTempFixtureDir("data-stack-action-json-shape", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "object.json"), '{"id":"evt-001"}\n', "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            sources: ["object.json"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "JSON stack input must be one top-level array of objects",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects non-object JSON array items", async () => {
    await withTempFixtureDir("data-stack-action-json-non-object", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "rows.json"), '[{"id":"evt-001"}, 2]\n', "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            sources: ["rows.json"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "JSON array items must be JSON objects",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects JSONL rows with no keys", async () => {
    await withTempFixtureDir("data-stack-action-jsonl-no-keys", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.jsonl"), "{}\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.json",
            sources: ["a.jsonl"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "JSONL rows must contain at least one key",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects files with an empty header row", async () => {
    await withTempFixtureDir("data-stack-action-empty-header-row", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "\n1,Ada\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            sources: ["a.csv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Input file has no header row",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects files with empty header cells", async () => {
    await withTempFixtureDir("data-stack-action-empty-header-cell", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id,,status\n1,Ada,active\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            sources: ["a.csv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Input file contains empty header cells",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects rows wider than the header", async () => {
    await withTempFixtureDir("data-stack-action-wide-row", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id,name\n1,Ada,extra\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            sources: ["a.csv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Input row has more cells than the header",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects no-match directory discovery runs", async () => {
    await withTempFixtureDir("data-stack-action-no-matches", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "parts");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, "notes.txt"), "skip me\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            sources: ["parts"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "No stackable input files matched the provided sources",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack rejects explicit output path conflicts", async () => {
    await withTempFixtureDir("data-stack-action-output-conflict", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "merged.csv"), "id,name\n1,Ada\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            overwrite: true,
            sources: ["merged.csv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Output path conflicts with an input source",
        },
      );
      expectNoOutput();
    });
  });
});
