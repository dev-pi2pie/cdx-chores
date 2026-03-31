import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionDataExtract } from "../src/cli/actions";
import { inspectDataQueryExtensions } from "../src/cli/duckdb/query";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { seedDataExtractFixtures } from "./helpers/data-extract-fixture-test-utils";
import {
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

describe("cli action modules: data extract", () => {
  test("actionDataExtract writes CSV output to file and reports to stderr", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      const outputPath = join(fixtureDir, "people.clean.csv");
      await writeFile(inputPath, "id,name,status\n1,Ada,active\n2,Bob,paused\n", "utf8");

      const { runtime, stdout, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
      });

      expectNoStdout();
      expect(stdout.text).toBe("");
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(stderr.text).toContain("Rows: 2");
      expect(await readFile(outputPath, "utf8")).toBe(
        "id,name,status\n1,Ada,active\n2,Bob,paused\n",
      );
    });
  });

  test("actionDataExtract honors explicit --no-header when materializing CSV input", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "header-row-as-data.csv");
      const outputPath = join(fixtureDir, "header-row-as-data.clean.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n2,Bob\n", "utf8");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        input: toRepoRelativePath(inputPath),
        noHeader: true,
        output: toRepoRelativePath(outputPath),
        overwrite: true,
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe("column_1,column_2\nid,name\n1,Ada\n2,Bob\n");
    });
  });

  test("actionDataExtract writes TSV output with the shaped table columns", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      const outputPath = join(fixtureDir, "people.clean.tsv");
      await writeFile(inputPath, "id,name,status\n1,Ada,active\n2,Bob,paused\n", "utf8");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote TSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "id\tname\tstatus\n1\tAda\tactive\n2\tBob\tpaused\n",
      );
    });
  });

  test("actionDataExtract writes JSON output to file and reports to stderr", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      const outputPath = join(fixtureDir, "people.clean.json");
      await writeFile(inputPath, "id,name\n1,Ada\n2,Bob\n", "utf8");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote JSON: ${toRepoRelativePath(outputPath)}`);
      expect(stderr.text).toContain("Rows: 2");
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: "1", name: "Ada" },
        { id: "2", name: "Bob" },
      ]);
    });
  });

  test("actionDataExtract applies Excel range shaping before materialization", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "summary.csv");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        input: toRepoRelativePath(dataQueryFixturePath("multi.xlsx")),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        range: "A1:B3",
        source: "Summary",
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe("id,name\n1,Ada\n2,Bob\n");
    });
  });

  test("actionDataExtract materializes a DuckDB-file source", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const outputPath = join(fixtureDir, "users.clean.json");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        source: "users",
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote JSON: ${toRepoRelativePath(outputPath)}`);
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: 1, name: "Ada", status: "active" },
        { id: 2, name: "Bob", status: "paused" },
        { id: 3, name: "Cyd", status: "active" },
      ]);
    });
  });

  test("actionDataExtract materializes a schema-qualified DuckDB source", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const outputPath = join(fixtureDir, "events.clean.csv");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        source: "analytics.events",
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "id,user_id,event_type\n10,1,login\n11,1,export\n12,2,login\n",
      );
    });
  });

  test("actionDataExtract infers the only DuckDB source when the file has one table", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = await seedSingleTableDuckDbFixture(fixtureDir);
      const outputPath = join(fixtureDir, "users.clean.json");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote JSON: ${toRepoRelativePath(outputPath)}`);
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: 1, name: "Ada" },
        { id: 2, name: "Bob" },
      ]);
    });
  });

  test("actionDataExtract requires --source for multi-object DuckDB inputs", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const outputPath = join(fixtureDir, "users.clean.json");
      const { runtime, expectNoStdout } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataExtract(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--source is required for DuckDB query inputs",
        },
      );

      expectNoStdout();
    });
  });

  test("actionDataExtract applies header-row shaping on top of an explicit Excel range", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const outputPath = join(fixtureDir, "messy.clean.csv");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        headerRow: 7,
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        range: "B2:E11",
        source: "Summary",
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "ID,item,status,description\n1001,Starter,active,Initial package\n1002,Expansion,paused,Requires follow-up\n1003,Renewal,active,Ready to ship\n1004,Archive,draft,Awaiting approval\n",
      );
    });
  });

  test("actionDataExtract tolerates shaped Excel header-band rows when blank rows follow the header", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "header-band.xlsx");
      const outputPath = join(fixtureDir, "header-band.clean.csv");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        headerRow: 7,
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        range: "B7:E12",
        source: "Summary",
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "ID,question,status,notes\n101,Confirm tax residency,open,Email pending\n102,Collect withholding certificate,closed,Received\n103,Review dividend statement,open,Waiting on broker\n",
      );
    });
  });

  test("actionDataExtract writes a reviewed header-mapping artifact and stops before materialization", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      await writeFile(inputPath, "column_1,column_2\n1001,active\n1002,paused\n", "utf8");

      const { runtime, stdout, stderr } = createActionTestRuntime();
      await actionDataExtract(runtime, {
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
      expect(stderr.text).toContain("data extract");
      expect(stderr.text).toContain("--header-mapping");
      expect(stderr.text).toContain("--output");

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

  test("actionDataExtract writes a reviewed source-shape artifact and stops before materialization", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");

      const { runtime, stdout, stderr } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        codexSuggestShape: true,
        input: toRepoRelativePath(inputPath),
        overwrite: true,
        source: "Summary",
        sourceShapeSuggestionRunner: async ({ prompt }) => {
          expect(prompt).toContain("Selected sheet: Summary");
          expect(prompt).toContain("Current range: (whole sheet)");
          expect(prompt).toContain("Worksheet non-empty row summaries:");
          expect(prompt).toContain('B2="Quarterly Operations Report"');
          return JSON.stringify({
            header_row: 7,
            range: "B2:E11",
            reasoning_summary: "The clean table starts at worksheet row 7 and spans columns B:E.",
          });
        },
        writeSourceShape: toRepoRelativePath(artifactPath),
      });

      expect(stdout.text).toContain("Suggested source shape");
      expect(stdout.text).toContain("--range B2:E11");
      expect(stdout.text).toContain("--header-row 7");
      expect(stdout.text).toContain("The clean table starts at worksheet row 7");
      expect(stderr.text).toContain(`Wrote source shape: ${toRepoRelativePath(artifactPath)}`);
      expect(stderr.text).toContain("--source-shape");
      expect(stderr.text).toContain("--output");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        input: { format: string; path: string; source: string };
        metadata: { artifactType: string; issuedAt: string };
        shape: { headerRow: number; range: string };
        version: number;
      };
      expect(artifact).toEqual({
        input: {
          format: "excel",
          path: toRepoRelativePath(inputPath),
          source: "Summary",
        },
        metadata: {
          artifactType: "data-source-shape",
          issuedAt: "2026-02-25T00:00:00.000Z",
        },
        shape: {
          headerRow: 7,
          range: "B2:E11",
        },
        version: 1,
      });
    });
  });

  test("actionDataExtract shows tty Codex thinking status while reviewing a source shape", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");
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

      await actionDataExtract(runtime, {
        codexSuggestShape: true,
        input: toRepoRelativePath(inputPath),
        overwrite: true,
        source: "Summary",
        sourceShapeSuggestionRunner: async () => {
          await Bun.sleep(420);
          return JSON.stringify({
            header_row: 7,
            range: "B2:E11",
            reasoning_summary: "The clean table starts at worksheet row 7 and spans columns B:E.",
          });
        },
        writeSourceShape: toRepoRelativePath(artifactPath),
      });

      expect(stdout.text).toContain("Thinking");
      expect(stdout.text).toContain("Inspecting worksheet structure");
      expect(stdout.text).toContain("Waiting for Codex source-shape suggestions");
      expect(stdout.text).toContain("Suggested source shape");
      expect(stdout.text).toContain("\r\x1b[2K");
    });
  });

  test("actionDataExtract writes a reviewed source-shape artifact that includes bodyStartRow", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const inputPath = join(fixtureDir, "stacked-merged-band.xlsx");
      const artifactPath = join(fixtureDir, "shape-with-body-start.json");

      const { runtime, stdout, stderr } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        codexSuggestShape: true,
        input: toRepoRelativePath(inputPath),
        overwrite: true,
        source: "Sheet1",
        sourceShapeSuggestionRunner: async ({ prompt }) => {
          expect(prompt).toContain("Selected sheet: Sheet1");
          expect(prompt).toContain("Current body start row: (not set)");
          expect(prompt).toContain("Worksheet non-empty row summaries:");
          return JSON.stringify({
            body_start_row: 10,
            header_row: 7,
            range: "B7:BR20",
            reasoning_summary:
              "The logical table uses row 7 for headers and row 10 for the first true body records.",
          });
        },
        writeSourceShape: toRepoRelativePath(artifactPath),
      });

      expect(stdout.text).toContain("Suggested source shape");
      expect(stdout.text).toContain("--range B7:BR20");
      expect(stdout.text).toContain("--body-start-row 10");
      expect(stdout.text).toContain("--header-row 7");
      expect(stderr.text).toContain(`Wrote source shape: ${toRepoRelativePath(artifactPath)}`);
      expect(stderr.text).toContain("--codex-suggest-headers");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        shape: { bodyStartRow: number; headerRow: number; range: string };
      };
      expect(artifact.shape).toEqual({
        bodyStartRow: 10,
        headerRow: 7,
        range: "B7:BR20",
      });
    });
  });

  test("actionDataExtract writes a reviewed source-shape artifact when body-start-row is the only deterministic change", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const inputPath = join(fixtureDir, "stacked-merged-band.xlsx");
      const artifactPath = join(fixtureDir, "shape-body-only.json");

      const { runtime, stdout, stderr } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        codexSuggestShape: true,
        input: toRepoRelativePath(inputPath),
        overwrite: true,
        source: "Sheet1",
        sourceShapeSuggestionRunner: async () =>
          JSON.stringify({
            body_start_row: 10,
            header_row: null,
            range: null,
            reasoning_summary:
              "The current sheet selection is fine; only the logical body boundary needs to move to worksheet row 10.",
          }),
        writeSourceShape: toRepoRelativePath(artifactPath),
      });

      expect(stdout.text).toContain("Suggested source shape");
      expect(stdout.text).toContain("--body-start-row 10");
      expect(stdout.text).not.toContain("--range ");
      expect(stdout.text).not.toContain("--header-row ");
      expect(stderr.text).toContain(`Wrote source shape: ${toRepoRelativePath(artifactPath)}`);
      expect(stderr.text).toContain("--source-shape");
      expect(stderr.text).toContain("--codex-suggest-headers");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        shape: { bodyStartRow: number };
      };
      expect(artifact.shape).toEqual({
        bodyStartRow: 10,
      });
    });
  });

  test("actionDataExtract reuses an accepted header-mapping artifact when it matches exactly", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      const outputPath = join(fixtureDir, "generic.clean.csv");
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

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        headerMapping: toRepoRelativePath(artifactPath),
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe("id,status\n1001,active\n1002,paused\n");
    });
  });

  test("actionDataExtract reuses an accepted source-shape artifact when it matches exactly", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");
      const outputPath = join(fixtureDir, "messy.clean.csv");
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
              issuedAt: "2026-03-18T00:00:00.000Z",
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

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        sourceShape: toRepoRelativePath(artifactPath),
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "ID,item,status,description\n1001,Starter,active,Initial package\n1002,Expansion,paused,Requires follow-up\n1003,Renewal,active,Ready to ship\n1004,Archive,draft,Awaiting approval\n",
      );
    });
  });

  test("actionDataExtract materializes the stacked merged-band workbook when body-start-row is provided", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const inputPath = join(fixtureDir, "stacked-merged-band.xlsx");
      const outputPath = join(fixtureDir, "stacked-merged-band.clean.csv");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        bodyStartRow: 10,
        headerRow: 7,
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        range: "B7:BR20",
        source: "Sheet1",
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "id,question,status,notes\n1,Does the customer need a follow-up call after the outage review?,- [ ] Yes; - [ ] No,callback\n2,Is there any pending refund evidence that finance still needs to verify?,- [ ] Yes; - [ ] No,refund\n3,Do we already have the replacement tracking number from the warehouse?,- [ ] Yes; - [ ] No,tracking\n4,Did legal approve the latest waiver wording for the support response?,- [ ] Yes; - [ ] No,waiver\n5,Should billing pause the renewal invoice until the dispute is closed?,- [ ] Yes; - [ ] No,renewal\n6,Has the onboarding checklist been resent to the implementation contact?,- [ ] Yes; - [ ] No,onboarding\n7,Do we need another maintenance window before the migration can resume?,- [ ] Yes; - [ ] No,maintenance\n8,Is there a signed change request covering the expanded delivery scope?,- [ ] Yes; - [ ] No,change\n9,Has procurement confirmed the revised purchase order for the hardware?,- [ ] Yes; - [ ] No,procurement\n10,Do we still need security sign-off for the temporary access exception?,- [ ] Yes; - [ ] No,security\n11,Should the account remain in watch status until the next leadership review?,- [ ] Yes; - [ ] No,watch\n",
      );
    });
  });

  test("actionDataExtract reuses a body-start-row-only source-shape artifact to replay source interpretation", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const inputPath = join(fixtureDir, "stacked-merged-band.xlsx");
      const artifactPath = join(fixtureDir, "shape-body-only.json");
      const outputPath = join(fixtureDir, "stacked-merged-band.body-only.csv");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "excel",
              path: toRepoRelativePath(inputPath),
              source: "Sheet1",
            },
            metadata: {
              artifactType: "data-source-shape",
              issuedAt: "2026-03-20T00:00:00.000Z",
            },
            shape: {
              bodyStartRow: 10,
            },
            version: 1,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        sourceShape: toRepoRelativePath(artifactPath),
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      const output = await readFile(outputPath, "utf8");
      expect(output).toContain("B,C,D,E");
      expect(output).toContain("Does the customer need a follow-up call after the outage review?");
      expect(output).toContain("callback");
    });
  });

  test("actionDataExtract reports unknown DuckDB sources clearly", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const outputPath = join(fixtureDir, "missing.clean.json");
      const { runtime } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataExtract(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
            overwrite: true,
            source: "analytics.missing",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unknown DuckDB source: analytics.missing",
        },
      );
    });
  });
});

describe("cli action modules: data extract failure modes", () => {
  test("actionDataExtract requires --output for materialization runs", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");

      await expectCliError(
        () =>
          actionDataExtract(createActionTestRuntime().runtime, {
            input: toRepoRelativePath(inputPath),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--output is required for data extract materialization runs",
        },
      );
    });
  });

  test("actionDataExtract rejects unsupported output extensions", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");

      await expectCliError(
        () =>
          actionDataExtract(createActionTestRuntime().runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "people.txt")),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unsupported --output extension",
        },
      );
    });
  });

  test("actionDataExtract rejects --codex-suggest-headers with --output", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");

      await expectCliError(
        () =>
          actionDataExtract(createActionTestRuntime().runtime, {
            codexSuggestHeaders: true,
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "people.json")),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-suggest-headers stops after writing a header mapping artifact",
        },
      );
    });
  });

  test("actionDataExtract rejects --codex-suggest-shape with --output", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      await expectCliError(
        () =>
          actionDataExtract(createActionTestRuntime().runtime, {
            codexSuggestShape: true,
            input: "test/fixtures/data-query/multi.xlsx",
            output: toRepoRelativePath(join(fixtureDir, "summary.json")),
            source: "Summary",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-suggest-shape stops after writing a source shape artifact",
        },
      );
    });
  });

  test("actionDataExtract rejects --codex-suggest-shape with --header-row", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataExtract(runtime, {
          codexSuggestShape: true,
          headerRow: 7,
          input: "test/fixtures/data-query/multi.xlsx",
          source: "Summary",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--codex-suggest-shape cannot be used together with --header-row",
      },
    );

    expectNoOutput();
  });

  test("actionDataExtract rejects --source-shape for non-Excel inputs", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
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
              issuedAt: "2026-03-18T00:00:00.000Z",
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

      await expectCliError(
        () =>
          actionDataExtract(createActionTestRuntime().runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "people.json")),
            sourceShape: toRepoRelativePath(artifactPath),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--source-shape is only valid for Excel extract inputs",
        },
      );
    });
  });

  test("actionDataExtract enforces explicit overwrite behavior", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "people.csv");
      const outputPath = join(fixtureDir, "people.clean.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n", "utf8");
      await writeFile(outputPath, "existing\n", "utf8");

      await expectCliError(
        () =>
          actionDataExtract(createActionTestRuntime().runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "Output file already exists",
        },
      );
    });
  });
});
