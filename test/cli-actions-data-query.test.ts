import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionDataQuery } from "../src/cli/actions";
import { getDisplayWidth } from "../src/cli/text-display-width";
import { inspectDataQueryExtensions } from "../src/cli/duckdb/query";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { REPO_ROOT, toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

function dataQueryFixturePath(name: string): string {
  return join(REPO_ROOT, "test", "fixtures", "data-query", name);
}

const queryExtensions = await inspectDataQueryExtensions();
const excelReady = queryExtensions.available && queryExtensions.excel?.loadable === true;
const sqliteReady = queryExtensions.available && queryExtensions.sqlite?.loadable === true;

describe("cli action modules: data query", () => {
  test("actionDataQuery renders bounded table output for CSV input", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name,age\n2,Bob,28\n1,Ada,36\n", "utf8");

      const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        sql: "select id, name from file order by id",
      });

      expectNoStderr();
      expect(stderr.text).toBe("");
      expect(stdout.text).toContain(`Input: ${toRepoRelativePath(inputPath)}`);
      expect(stdout.text).toContain("Format: csv");
      expect(stdout.text).toContain("Result rows: 2");
      expect(stdout.text).toContain("Visible columns: id, name");
      expect(stdout.text).toContain("1   | Ada");
      expect(stdout.text).toContain("2   | Bob");
    });
  });

  test("actionDataQuery honors --input-format override for TSV-like input", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.data");
      await writeFile(inputPath, "id\tname\n1\tAda\n2\tBob\n", "utf8");

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        inputFormat: "tsv",
        sql: "select name from file order by id",
      });

      expectNoStderr();
      expect(stdout.text).toContain("Format: tsv");
      expect(stdout.text).toContain("Ada");
      expect(stdout.text).toContain("Bob");
    });
  });

  test("actionDataQuery emits JSON to stdout", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

    await actionDataQuery(runtime, {
      input: "test/fixtures/parquet-preview/basic.parquet",
      json: true,
      sql: "select id, name from file order by id",
    });

    expectNoStderr();
    expect(JSON.parse(stdout.text)).toEqual([
      { id: "1", name: "Ada" },
      { id: "2", name: "Bob" },
      { id: "3", name: "Cyd" },
    ]);
  });

  test("actionDataQuery writes JSON output to file and reports to stderr", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      const outputPath = join(fixtureDir, "people.json");
      await writeFile(inputPath, "id,name\n1,Ada\n2,Bob\n", "utf8");

      const { runtime, stdout, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        pretty: true,
        sql: "select * from file order by id",
      });

      expectNoStdout();
      expect(stdout.text).toBe("");
      expect(stderr.text).toContain(`Wrote JSON: ${toRepoRelativePath(outputPath)}`);
      expect(stderr.text).toContain("Rows: 2");
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: "1", name: "Ada" },
        { id: "2", name: "Bob" },
      ]);
    });
  });

  test("actionDataQuery writes CSV output to file and reports to stderr", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      const outputPath = join(fixtureDir, "people.csv.out.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n2,Bob\n", "utf8");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        sql: "select name, id from file order by id",
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(stderr.text).toContain("Rows: 2");
      expect(await readFile(outputPath, "utf8")).toBe("name,id\nAda,1\nBob,2\n");
    });
  });

  test("actionDataQuery keeps mixed English and CJK table output aligned by display width", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "word,meaning_zh\nstructure,結構；架構\nhierarchy,階層；等級制度\n", "utf8");

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        sql: "select word, meaning_zh from file order by word desc",
      });

      expectNoStderr();
      const tableLines = stdout.text
        .split("\n")
        .filter((line) => line.includes("|") || line.includes("+-"));
      expect(tableLines).toHaveLength(4);
      const widths = tableLines.map((line) => getDisplayWidth(line));
      expect(new Set(widths).size).toBe(1);
    });
  });

  test("actionDataQuery applies Excel range shaping before querying", async () => {
    if (!excelReady) {
      return;
    }

    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    await actionDataQuery(runtime, {
      input: toRepoRelativePath(dataQueryFixturePath("multi.xlsx")),
      range: "A1:B3",
      source: "Summary",
      sql: "select * from file order by id",
    });

    expectNoStderr();
    expect(stdout.text).toContain("Format: excel");
    expect(stdout.text).toContain("Source: Summary");
    expect(stdout.text).toContain("Range: A1:B3");
    expect(stdout.text).toContain("Visible columns: id, name");
    expect(stdout.text).not.toContain("status");
  });
});

describe("cli action modules: data query failure modes", () => {
  test("actionDataQuery rejects --json with --output", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            json: true,
            output: toRepoRelativePath(join(fixtureDir, "people.json")),
            sql: "select * from file",
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "--json cannot be used together" },
      );

      expectNoOutput();
    });
  });

  test("actionDataQuery rejects --pretty without JSON output", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            pretty: true,
            sql: "select * from file",
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "--pretty requires either --json" },
      );

      expectNoOutput();
    });
  });

  test("actionDataQuery rejects unsupported output extensions", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "people.txt")),
            sql: "select * from file",
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "Unsupported --output extension" },
      );

      expectNoOutput();
    });
  });

  test("actionDataQuery rejects --install-missing-extension for built-in formats", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            installMissingExtension: true,
            sql: "select * from file",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--install-missing-extension is only valid for extension-backed query formats",
        },
      );

      expectNoOutput();
    });
  });

  test("actionDataQuery requires source for SQLite inputs", async () => {
    if (!sqliteReady) {
      return;
    }

    const { runtime, expectNoOutput } = createActionTestRuntime();
    await expectCliError(
      () =>
        actionDataQuery(runtime, {
          input: toRepoRelativePath(dataQueryFixturePath("multi.sqlite")),
          sql: "select * from file",
        }),
      { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "--source is required for SQLite" },
    );

    expectNoOutput();
  });

  test("actionDataQuery rejects source for single-object inputs", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            source: "sheet1",
            sql: "select * from file",
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "--source is not valid for CSV" },
      );

      expectNoOutput();
    });
  });

  test("actionDataQuery rejects --range for non-Excel inputs", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            range: "A1:B2",
            sql: "select * from file",
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "--range is only valid for Excel query inputs" },
      );

      expectNoOutput();
    });
  });
});
