import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionDataQuery } from "../src/cli/actions";
import { getDisplayWidth } from "../src/cli/text-display-width";
import {
  createDuckDbConnection,
  inspectDataQueryExtensions,
  listDataQuerySources,
} from "../src/cli/duckdb/query";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { seedDataExtractFixtures } from "./helpers/data-extract-fixture-test-utils";
import {
  seedAmbiguousDuckDbSourceFixture,
  seedDuckDbWorkspaceFixture,
  seedSingleTableDuckDbFixture,
} from "./helpers/data-query-duckdb-fixture-test-utils";
import { REPO_ROOT, toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";
import { seedStackedMergedBandFixture } from "./helpers/stacked-merged-band-fixture-test-utils";

function dataQueryFixturePath(name: string): string {
  return join(REPO_ROOT, "test", "fixtures", "data-query", name);
}

class TtyCaptureStream {
  public text = "";
  public isTTY = true;

  write(chunk: string | Uint8Array): boolean {
    this.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }
}

const queryExtensions = await inspectDataQueryExtensions();
const duckdbReady = queryExtensions.available;
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

  test("actionDataQuery renders bounded table output for SQLite workspace relations", async () => {
    if (!sqliteReady) {
      return;
    }

    const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
    await actionDataQuery(runtime, {
      input: toRepoRelativePath(dataQueryFixturePath("multi.sqlite")),
      relations: [
        { alias: "users", source: "users" },
        { alias: "entries", source: "time_entries" },
      ],
      sql: "select users.name, entries.hours from users join entries on users.id = entries.entry_id order by users.id",
    });

    expectNoStderr();
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Format: sqlite");
    expect(stdout.text).toContain("Relations: users, entries");
    expect(stdout.text).toContain("Ada  | 8");
    expect(stdout.text).toContain("Bob  | 5");
  });

  test("actionDataQuery treats one explicit relation binding as workspace mode", async () => {
    if (!sqliteReady) {
      return;
    }

    const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
    await actionDataQuery(runtime, {
      input: toRepoRelativePath(dataQueryFixturePath("multi.sqlite")),
      relations: [{ alias: "people", source: "users" }],
      sql: "select id, name from people order by id",
    });

    expectNoStderr();
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Relations: people");
    expect(stdout.text).not.toContain("Source: users");
    expect(stdout.text).toContain("1   | Ada");
  });

  test("actionDataQuery renders bounded table output for DuckDB-file inputs", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);

      const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        source: "users",
        sql: "select id, name from file order by id",
      });

      expectNoStderr();
      expect(stderr.text).toBe("");
      expect(stdout.text).toContain("Format: duckdb");
      expect(stdout.text).toContain("Source: users");
      expect(stdout.text).toContain("1   | Ada");
      expect(stdout.text).toContain("2   | Bob");
    });
  });

  test("actionDataQuery infers the only DuckDB source when the file has one table", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = await seedSingleTableDuckDbFixture(fixtureDir);

      const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        sql: "select id, name from file order by id",
      });

      expectNoStderr();
      expect(stderr.text).toBe("");
      expect(stdout.text).toContain("Format: duckdb");
      expect(stdout.text).toContain("Source: users");
      expect(stdout.text).toContain("1   | Ada");
      expect(stdout.text).toContain("2   | Bob");
    });
  });

  test("actionDataQuery supports schema-qualified DuckDB sources", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);

      const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        source: "analytics.events",
        sql: "select id, event_type from file order by id",
      });

      expectNoStderr();
      expect(stderr.text).toBe("");
      expect(stdout.text).toContain("Source: analytics.events");
      expect(stdout.text).toContain("10  | login");
      expect(stdout.text).toContain("11  | export");
    });
  });

  test("actionDataQuery renders bounded table output for DuckDB workspace relations", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);

      const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        relations: [
          { alias: "users", source: "users" },
          { alias: "events", source: "analytics.events" },
        ],
        sql: "select users.name, events.event_type from users join events on users.id = events.user_id order by events.id",
      });

      expectNoStderr();
      expect(stderr.text).toBe("");
      expect(stdout.text).toContain("Format: duckdb");
      expect(stdout.text).toContain("Relations: users, events");
      expect(stdout.text).toContain("Ada  | login");
      expect(stdout.text).toContain("Ada  | export");
    });
  });

  test("actionDataQuery keeps dotted DuckDB source names selectable without collisions", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = await seedAmbiguousDuckDbSourceFixture(fixtureDir);
      const connection = await createDuckDbConnection();
      try {
        const sources = await listDataQuerySources(connection, inputPath, "duckdb");
        expect(sources).toEqual(["analytics.events", '"analytics.events"']);
      } finally {
        connection.closeSync();
      }

      const mainSourceRun = createActionTestRuntime();
      await actionDataQuery(mainSourceRun.runtime, {
        input: toRepoRelativePath(inputPath),
        source: '"analytics.events"',
        sql: "select id, scope from file",
      });
      mainSourceRun.expectNoStderr();
      expect(mainSourceRun.stdout.text).toContain('"analytics.events"');
      expect(mainSourceRun.stdout.text).toContain("1   | main-table");

      const schemaSourceRun = createActionTestRuntime();
      await actionDataQuery(schemaSourceRun.runtime, {
        input: toRepoRelativePath(inputPath),
        source: "analytics.events",
        sql: "select id, scope from file",
      });
      schemaSourceRun.expectNoStderr();
      expect(schemaSourceRun.stdout.text).toContain("Source: analytics.events");
      expect(schemaSourceRun.stdout.text).toContain("2   | schema-table");
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

  test("actionDataQuery rejects --source together with --relation before query execution", async () => {
    const { runtime } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQuery(runtime, {
          input: "test/fixtures/data-query/multi.sqlite",
          relations: [{ alias: "entries", source: "time_entries" }],
          source: "users",
          sql: "select * from file",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--relation cannot be used together with --source",
      },
    );
  });

  test("actionDataQuery allows explicit file aliases in workspace mode", async () => {
    if (!sqliteReady) {
      return;
    }

    const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
    await actionDataQuery(runtime, {
      input: "test/fixtures/data-query/multi.sqlite",
      relations: [{ alias: "file", source: "users" }],
      sql: "select id, name from file order by id",
    });

    expectNoStderr();
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Relations: file");
    expect(stdout.text).toContain("1   | Ada");
  });

  test("actionDataQuery rejects duplicate relation aliases in workspace mode", async () => {
    const { runtime } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQuery(runtime, {
          input: "test/fixtures/data-query/multi.sqlite",
          relations: [
            { alias: "users", source: "users" },
            { alias: "users", source: "time_entries" },
          ],
          sql: "select * from users",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Duplicate workspace relation alias: users",
      },
    );
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
      await writeFile(
        inputPath,
        "word,meaning_zh\nstructure,結構；架構\nhierarchy,階層；等級制度\n",
        "utf8",
      );

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

  test("actionDataQuery reports unknown DuckDB sources clearly", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const { runtime } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            source: "analytics.missing",
            sql: "select * from file",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unknown DuckDB source: analytics.missing",
        },
      );
    });
  });

  test("actionDataQuery normalizes headerless CSV placeholder names to the shared column_n contract", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "no-head.csv");
      await writeFile(inputPath, "1,Ada,active,2026-03-01\n2,Bob,paused,2026-03-02\n", "utf8");

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        sql: "select column_1, column_2, column_3, column_4 from file order by column_1",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`Input: ${toRepoRelativePath(inputPath)}`);
      expect(stdout.text).toContain("Visible columns: column_1, column_2, column_3, column_4");
      expect(stdout.text).toContain("1        | Ada");
      expect(stdout.text).not.toContain("column0");
      expect(stdout.text).not.toContain("column1");
    });
  });

  test("actionDataQuery honors explicit --no-header when DuckDB would otherwise treat row 1 as headers", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "header-row-as-data.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n2,Bob\n", "utf8");

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        noHeader: true,
        sql: "select column_1, column_2 from file order by column_1",
      });

      expectNoStderr();
      expect(stdout.text).toContain("Visible columns: column_1, column_2");
      expect(stdout.text).toContain("id       | name");
      expect(stdout.text).toContain("1        | Ada");
    });
  });

  test("actionDataQuery preserves explicit CSV headers that match columnN patterns", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "literal-column-names.csv");
      await writeFile(inputPath, "column1,column2\n1001,active\n1002,paused\n", "utf8");

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        sql: "select column1, column2 from file order by column1",
      });

      expectNoStderr();
      expect(stdout.text).toContain("Visible columns: column1, column2");
      expect(stdout.text).toContain("1001    | active");
      expect(stdout.text).not.toContain("column_2");
      expect(stdout.text).not.toContain("column_3");
    });
  });

  test("actionDataQuery suggests semantic headers for headerless CSV inputs using normalized placeholder names", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "no-head.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      await writeFile(inputPath, "1,Ada,active,2026-03-01\n2,Bob,paused,2026-03-02\n", "utf8");

      const { runtime, stdout, stderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        codexSuggestHeaders: true,
        headerSuggestionRunner: async ({ prompt }) => {
          expect(prompt).toContain("1. column_1 (BIGINT) samples: 1, 2");
          expect(prompt).toContain("2. column_2 (VARCHAR) samples: Ada, Bob");
          expect(prompt).toContain("3. column_3 (VARCHAR) samples: active, paused");
          expect(prompt).toContain("4. column_4 (DATE) samples: 2026-03-01, 2026-03-02");
          return JSON.stringify({
            suggestions: [
              { from: "column_1", to: "id" },
              { from: "column_2", to: "name" },
              { from: "column_3", to: "status" },
              { from: "column_4", to: "created_at" },
            ],
          });
        },
        input: toRepoRelativePath(inputPath),
        overwrite: true,
        writeHeaderMapping: toRepoRelativePath(artifactPath),
      });

      expect(stdout.text).toContain("column_1 -> id");
      expect(stdout.text).toContain("column_4 -> created_at");
      expect(stderr.text).toContain(`Wrote header mapping: ${toRepoRelativePath(artifactPath)}`);
    });
  });

  test("actionDataQuery carries explicit no-header into reviewed header-mapping artifacts and follow-up guidance", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "no-head.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      await writeFile(inputPath, "1,Ada,active\n2,Bob,paused\n", "utf8");

      const { runtime, stdout, stderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        codexSuggestHeaders: true,
        headerSuggestionRunner: async () =>
          JSON.stringify({
            suggestions: [
              { from: "column_1", to: "id" },
              { from: "column_2", to: "name" },
              { from: "column_3", to: "status" },
            ],
          }),
        input: toRepoRelativePath(inputPath),
        noHeader: true,
        overwrite: true,
        writeHeaderMapping: toRepoRelativePath(artifactPath),
      });

      expect(stdout.text).toContain("column_1 -> id");
      expect(stderr.text).toContain("--no-header");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        input: { format: string; noHeader?: boolean; path: string };
      };
      expect(artifact.input).toEqual({
        format: "csv",
        noHeader: true,
        path: toRepoRelativePath(inputPath),
      });
    });
  });

  test("actionDataQuery shows tty Codex thinking status while reviewing headers", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      await writeFile(inputPath, "column_1,column_2\n1001,active\n1002,paused\n", "utf8");
      const stdout = new TtyCaptureStream();
      const stderr = new TtyCaptureStream();
      const runtime = {
        colorEnabled: true,
        cwd: REPO_ROOT,
        displayPathStyle: "relative" as const,
        now: () => new Date("2026-02-25T00:00:00.000Z"),
        platform: process.platform,
        stderr: stderr as unknown as NodeJS.WritableStream,
        stdin: process.stdin,
        stdout: stdout as unknown as NodeJS.WritableStream,
      };

      await actionDataQuery(runtime, {
        codexSuggestHeaders: true,
        headerSuggestionRunner: async () => {
          await Bun.sleep(420);
          return JSON.stringify({
            suggestions: [
              { from: "column_1", to: "id" },
              { from: "column_2", to: "status" },
            ],
          });
        },
        input: toRepoRelativePath(inputPath),
        overwrite: true,
        writeHeaderMapping: toRepoRelativePath(artifactPath),
      });

      expect(stdout.text).toContain("Thinking");
      expect(stdout.text).toContain("Inspecting shaped source");
      expect(stdout.text).toContain("Waiting for Codex header suggestions");
      expect(stdout.text).toContain("Suggested headers");
      expect(stdout.text).toContain("\r\x1b[2K");
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

  test("actionDataQuery applies header-row shaping on top of an explicit Excel range", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        headerRow: 7,
        input: toRepoRelativePath(inputPath),
        range: "B2:E11",
        source: "Summary",
        sql: "select id, item, status from file order by id",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`Input: ${toRepoRelativePath(inputPath)}`);
      expect(stdout.text).toContain("Format: excel");
      expect(stdout.text).toContain("Source: Summary");
      expect(stdout.text).toContain("Range: B2:E11");
      expect(stdout.text).toContain("Header row: 7");
      expect(stdout.text).toContain("Visible columns: ID, item, status");
      expect(stdout.text).toContain("1001 | Starter");
      expect(stdout.text).not.toContain("Quarterly Operations Report");
    });
  });

  test("actionDataQuery tolerates shaped Excel header-band rows when the first data rows are blank", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "header-band.xlsx");

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        headerRow: 7,
        input: toRepoRelativePath(inputPath),
        range: "B7:E12",
        source: "Summary",
        sql: "select ID, question, status from file order by ID",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`Input: ${toRepoRelativePath(inputPath)}`);
      expect(stdout.text).toContain("Format: excel");
      expect(stdout.text).toContain("Source: Summary");
      expect(stdout.text).toContain("Range: B7:E12");
      expect(stdout.text).toContain("Header row: 7");
      expect(stdout.text).toContain("Visible columns: ID, question, status");
      expect(stdout.text).toContain("101 | Confirm tax residency");
      expect(stdout.text).toContain("102 | Collect withholding certificate");
    });
  });

  test("actionDataQuery materializes the stacked merged-band workbook when body-start-row is provided", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const inputPath = join(fixtureDir, "stacked-merged-band.xlsx");

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        bodyStartRow: 10,
        headerRow: 7,
        input: toRepoRelativePath(inputPath),
        range: "B7:BR20",
        source: "Sheet1",
        sql: "select id, question, status, notes from file order by id",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`Input: ${toRepoRelativePath(inputPath)}`);
      expect(stdout.text).toContain("Source: Sheet1");
      expect(stdout.text).toContain("Range: B7:BR20");
      expect(stdout.text).toContain("Body start row: 10");
      expect(stdout.text).toContain("Header row: 7");
      expect(stdout.text).toContain("Visible columns: id, question, status, notes");
      expect(stdout.text).toContain("1   | Does the customer need");
      expect(stdout.text).toContain("11  | Should the account remain");
    });
  });

  test("actionDataQuery writes a reviewed header-mapping artifact and stops before SQL execution", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      await writeFile(inputPath, "column_1,column_2\n1001,active\n1002,paused\n", "utf8");

      const { runtime, stdout, stderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        codexSuggestHeaders: true,
        headerSuggestionRunner: async ({ prompt }) => {
          expect(prompt).toContain("Detected format: csv");
          expect(prompt).toContain("1. column_1 (BIGINT) samples: 1001, 1002");
          expect(prompt).toContain("2. column_2 (VARCHAR) samples: active, paused");
          return JSON.stringify({
            suggestions: [
              { from: "column_1", to: "id" },
              { from: "column_2", to: "status" },
            ],
          });
        },
        input: toRepoRelativePath(inputPath),
        overwrite: true,
        writeHeaderMapping: toRepoRelativePath(artifactPath),
      });

      expect(stdout.text).toContain("Suggested headers");
      expect(stdout.text).toContain("column_1 -> id");
      expect(stdout.text).toContain("column_2 -> status");
      expect(stderr.text).toContain(`Wrote header mapping: ${toRepoRelativePath(artifactPath)}`);
      expect(stderr.text).toContain("--header-mapping");
      expect(stderr.text).toContain("--sql");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        input: { format: string; path: string };
        mappings: Array<{ from: string; inferredType?: string; sample?: string; to: string }>;
        metadata: { artifactType: string; issuedAt: string };
        version: number;
      };
      expect(artifact.version).toBe(1);
      expect(artifact.metadata.artifactType).toBe("data-header-mapping");
      expect(artifact.input).toEqual({
        format: "csv",
        path: toRepoRelativePath(inputPath),
      });
      expect(artifact.mappings).toEqual([
        { from: "column_1", inferredType: "BIGINT", sample: "1001", to: "id" },
        { from: "column_2", inferredType: "VARCHAR", sample: "active", to: "status" },
      ]);
    });
  });

  test("actionDataQuery forwards --install-missing-extension when reviewed header suggestions inspect extension-backed inputs", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const artifactPath = join(fixtureDir, "header-map.json");
      const collectedOptions: Array<{
        installMissingExtension?: boolean;
        statusStream?: NodeJS.WritableStream;
      }> = [];
      const { runtime, stderr } = createActionTestRuntime();

      await actionDataQuery(runtime, {
        codexSuggestHeaders: true,
        headerSuggestionRunner: async () =>
          JSON.stringify({
            suggestions: [{ from: "column_1", to: "id" }],
          }),
        input: toRepoRelativePath(dataQueryFixturePath("multi.xlsx")),
        installMissingExtension: true,
        overwrite: true,
        source: "Summary",
        sourceIntrospectionCollector: async (
          _connection,
          _inputPath,
          _format,
          _shape,
          _sampleRowLimit,
          options = {},
        ) => {
          collectedOptions.push({
            installMissingExtension: options.installMissingExtension,
            statusStream: options.statusStream,
          });
          return {
            columns: [{ name: "column_1", type: "BIGINT" }],
            sampleRows: [{ column_1: "1" }],
            selectedSource: "Summary",
            truncated: false,
          };
        },
        writeHeaderMapping: toRepoRelativePath(artifactPath),
      });

      expect(collectedOptions).toEqual([
        {
          installMissingExtension: true,
          statusStream: runtime.stderr,
        },
      ]);
      expect(stderr.text).toContain(`Wrote header mapping: ${toRepoRelativePath(artifactPath)}`);
    });
  });

  test("actionDataQuery reuses an accepted header-mapping artifact when it matches exactly", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      await writeFile(inputPath, "column_1,column_2\n1001,active\n1002,paused\n", "utf8");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "csv",
              path: toRepoRelativePath(inputPath),
            },
            mappings: [
              { from: "column_1", to: "id" },
              { from: "column_2", to: "status" },
            ],
            metadata: {
              artifactType: "data-header-mapping",
              issuedAt: "2026-03-18T00:00:00.000Z",
            },
            version: 1,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        headerMapping: toRepoRelativePath(artifactPath),
        input: toRepoRelativePath(inputPath),
        sql: "select id, status from file order by id",
      });

      expectNoStderr();
      expect(stdout.text).toContain("Visible columns: id, status");
      expect(stdout.text).toContain("1001 | active");
      expect(stdout.text).not.toContain("column_1");
      expect(stdout.text).not.toContain("column_2");
    });
  });

  test("actionDataQuery reuses an accepted source-shape artifact when it matches exactly", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "excel",
              path: toRepoRelativePath(inputPath),
              source: "Summary",
            },
            metadata: {
              artifactType: "data-source-shape",
              issuedAt: "2026-03-20T00:00:00.000Z",
            },
            shape: {
              headerRow: 7,
              range: "B2:E11",
            },
            version: 1,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        sourceShape: toRepoRelativePath(artifactPath),
        sql: "select ID, item, status from file order by ID",
      });

      expectNoStderr();
      expect(stdout.text).toContain("Format: excel");
      expect(stdout.text).toContain("Source: Summary");
      expect(stdout.text).toContain("Range: B2:E11");
      expect(stdout.text).toContain("Header row: 7");
      expect(stdout.text).toContain("Visible columns: ID, item, status");
      expect(stdout.text).toContain("1001 | Starter");
    });
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
          messageIncludes:
            "--install-missing-extension is only valid for extension-backed query formats",
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
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--range is only valid for Excel query inputs",
        },
      );

      expectNoOutput();
    });
  });

  test("actionDataQuery rejects --source-shape for non-Excel inputs", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      const artifactPath = join(fixtureDir, "shape.json");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "excel",
              path: "test/fixtures/data-query/multi.xlsx",
              source: "Summary",
            },
            metadata: {
              artifactType: "data-source-shape",
              issuedAt: "2026-03-20T00:00:00.000Z",
            },
            shape: {
              range: "A1:B3",
            },
            version: 1,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const { runtime, expectNoOutput } = createActionTestRuntime();
      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            sourceShape: toRepoRelativePath(artifactPath),
            sql: "select * from file",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--source-shape is only valid for Excel query inputs",
        },
      );

      expectNoOutput();
    });
  });

  test("actionDataQuery rejects explicit shape flags when --source-shape is provided", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQuery(runtime, {
          input: "test/fixtures/data-query/multi.xlsx",
          range: "A1:B3",
          sourceShape: "shape.json",
          sql: "select * from file",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--source-shape cannot be used together with --range",
      },
    );

    expectNoOutput();
  });

  test("actionDataQuery rejects mismatched header-mapping artifacts", async () => {
    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      await writeFile(inputPath, "column_1,column_2\n1001,active\n", "utf8");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "csv",
              path: "examples/playground/other.csv",
            },
            mappings: [{ from: "column_1", to: "id" }],
            metadata: {
              artifactType: "data-header-mapping",
              issuedAt: "2026-03-18T00:00:00.000Z",
            },
            version: 1,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const { runtime, expectNoOutput } = createActionTestRuntime();
      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            headerMapping: toRepoRelativePath(artifactPath),
            input: toRepoRelativePath(inputPath),
            sql: "select * from file",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "does not match the current input context exactly",
        },
      );

      expectNoOutput();
    });
  });

  test("actionDataQuery rejects mismatched source-shape artifacts", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "excel",
              path: "examples/playground/other.xlsx",
              source: "Summary",
            },
            metadata: {
              artifactType: "data-source-shape",
              issuedAt: "2026-03-20T00:00:00.000Z",
            },
            shape: {
              range: "B2:E11",
            },
            version: 1,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const { runtime, expectNoOutput } = createActionTestRuntime();
      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            sourceShape: toRepoRelativePath(artifactPath),
            sql: "select * from file",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Source shape artifact does not match the current input context exactly",
        },
      );

      expectNoOutput();
    });
  });
});
