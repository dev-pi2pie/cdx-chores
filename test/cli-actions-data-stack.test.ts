import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { actionDataStack } from "../src/cli/actions";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { REPO_ROOT, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: data stack", () => {
  test("actionDataStack writes CSV output from mixed explicit and directory sources", async () => {
    await withTempFixtureDir("data-stack-action", async (fixtureDir) => {
      const manualPath = join(fixtureDir, "manual.csv");
      const partsPath = join(fixtureDir, "parts");
      const outputPath = join(fixtureDir, "merged.csv");
      await mkdir(partsPath, { recursive: true });
      await writeFile(manualPath, "id,name,status\n1,Ada,active\n", "utf8");
      await writeFile(join(partsPath, "b.csv"), "id,name,status\n3,Cyd,paused\n", "utf8");
      await writeFile(join(partsPath, "a.csv"), "id,name,status\n2,Bob,active\n", "utf8");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime({ cwd: fixtureDir });
      await actionDataStack(runtime, {
        output: "merged.csv",
        overwrite: true,
        pattern: "*.csv",
        sources: ["manual.csv", "parts"],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote CSV:");
      expect(stderr.text).toContain("Files: 3");
      expect(stderr.text).toContain("Rows: 3");
      expect(await readFile(outputPath, "utf8")).toBe(
        "id,name,status\n1,Ada,active\n2,Bob,active\n3,Cyd,paused\n",
      );
    });
  });

  test("actionDataStack writes JSON output for TSV inputs", async () => {
    await withTempFixtureDir("data-stack-action-tsv", async (fixtureDir) => {
      const partsPath = join(fixtureDir, "parts");
      const outputPath = join(fixtureDir, "merged.json");
      await mkdir(partsPath, { recursive: true });
      await writeFile(join(partsPath, "b.tsv"), "id\tname\tstatus\n5\tEdda\tpaused\n", "utf8");
      await writeFile(join(partsPath, "a.tsv"), "id\tname\tstatus\n4\tDion\tactive\n", "utf8");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime({ cwd: fixtureDir });
      await actionDataStack(runtime, {
        output: "merged.json",
        overwrite: true,
        pattern: "*.tsv",
        sources: ["parts"],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote JSON:");
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: "4", name: "Dion", status: "active" },
        { id: "5", name: "Edda", status: "paused" },
      ]);
    });
  });

  test("actionDataStack stacks headerless CSV inputs with generated placeholder names", async () => {
    await withTempFixtureDir("data-stack-action-headerless", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.csv");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataStack(runtime, {
        noHeader: true,
        output: outputPath,
        overwrite: true,
        sources: [join(REPO_ROOT, "examples/playground/stack-cases/csv-headerless")],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote CSV:");
      expect(await readFile(outputPath, "utf8")).toBe(
        "column_1,column_2,column_3\n2001,active,north\n2002,paused,south\n2003,active,west\n2004,paused,east\n",
      );
    });
  });

  test("actionDataStack stacks headerless TSV inputs with explicit columns", async () => {
    await withTempFixtureDir("data-stack-action-headerless-columns", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.json");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataStack(runtime, {
        columns: ["id", "status", "region"],
        noHeader: true,
        output: outputPath,
        overwrite: true,
        sources: [join(REPO_ROOT, "examples/playground/stack-cases/tsv-headerless")],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote JSON:");
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: "6001", region: "north", status: "active" },
        { id: "6002", region: "south", status: "paused" },
        { id: "6003", region: "west", status: "active" },
        { id: "6004", region: "east", status: "paused" },
      ]);
    });
  });

  test("actionDataStack stacks JSONL inputs with strict same-key handling", async () => {
    await withTempFixtureDir("data-stack-action-jsonl", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.json");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataStack(runtime, {
        output: outputPath,
        overwrite: true,
        sources: [join(REPO_ROOT, "examples/playground/stack-cases/jsonl-basic")],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote JSON:");
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { action: "login", id: "evt-001", region: "apac", user_id: 41 },
        { action: "view", id: "evt-002", region: "emea", user_id: 42 },
        { action: "purchase", id: "evt-003", region: "amer", user_id: 43 },
        { action: "logout", id: "evt-004", region: "apac", user_id: 44 },
      ]);
    });
  });

  test("actionDataStack excludes an output path that lives inside a scanned directory", async () => {
    await withTempFixtureDir("data-stack-action-output-inside-source", async (fixtureDir) => {
      const partsPath = join(fixtureDir, "parts");
      const outputPath = join(partsPath, "merged.csv");
      await mkdir(partsPath, { recursive: true });
      await writeFile(join(partsPath, "a.csv"), "id,name,status\n1,Ada,active\n", "utf8");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime({ cwd: fixtureDir });
      await actionDataStack(runtime, {
        output: "parts/merged.csv",
        overwrite: true,
        sources: ["parts"],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote CSV: parts/merged.csv");
      expect(stderr.text).toContain("Files: 1");
      expect(await readFile(outputPath, "utf8")).toBe("id,name,status\n1,Ada,active\n");
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
      await writeFile(join(fixtureDir, "a.json"), '[{"id":1}]\\n', "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            output: "merged.csv",
            sources: ["a.json"],
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
          code: "INVALID_INPUT",
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
          code: "INVALID_INPUT",
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
          code: "INVALID_INPUT",
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

  test("actionDataStack rejects JSONL rows with no keys", async () => {
    await withTempFixtureDir("data-stack-action-jsonl-no-keys", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.jsonl"), '{}\n', "utf8");

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

  test("actionDataStack normalizes BOM and surrounding header whitespace before matching", async () => {
    await withTempFixtureDir("data-stack-action-normalized-headers", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.json");
      await writeFile(join(fixtureDir, "a.csv"), "\uFEFFid, name , status \n1,Ada,active\n", "utf8");
      await writeFile(join(fixtureDir, "b.csv"), "id,name,status\n2,Bob,paused\n", "utf8");

      const { runtime, expectNoStdout, stderr } = createActionTestRuntime({ cwd: fixtureDir });
      await actionDataStack(runtime, {
        output: "merged.json",
        overwrite: true,
        sources: ["a.csv", "b.csv"],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote JSON: merged.json");
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: "1", name: "Ada", status: "active" },
        { id: "2", name: "Bob", status: "paused" },
      ]);
    });
  });

  test("actionDataStack pads short rows with empty cells during materialization", async () => {
    await withTempFixtureDir("data-stack-action-short-rows", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(join(fixtureDir, "a.csv"), "id,name,status\n1,Ada\n", "utf8");
      await writeFile(join(fixtureDir, "b.csv"), "id,name,status\n2,Bob,paused\n", "utf8");

      const { runtime, expectNoStdout, stderr } = createActionTestRuntime({ cwd: fixtureDir });
      await actionDataStack(runtime, {
        output: "merged.csv",
        overwrite: true,
        sources: ["a.csv", "b.csv"],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote CSV: merged.csv");
      expect(await readFile(outputPath, "utf8")).toBe(
        "id,name,status\n1,Ada,\n2,Bob,paused\n",
      );
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
